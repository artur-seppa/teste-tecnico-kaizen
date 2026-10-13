import { faker } from '@faker-js/faker';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/ApiError.js';
import { produtoFactory } from './factories/produto.js';
import { criarBancoDeTeste, semearCarrinho, semearUsuario } from './utils/bancoDeTeste.js';

// Teste de unidade do service: o ERP entra mockado. A traducao de HTTP para
// ApiError e responsabilidade do erp/cliente.js e esta coberta no teste dele -
// se ela quebrar, quem fica vermelho e aquele arquivo, nao este.
vi.mock('../src/erp/cliente.js', () => ({
  buscarProduto: vi.fn(),
}));

const { buscarProduto } = await import('../src/erp/cliente.js');
const { adicionarNaAtiva, alterarQuantidade, lerCarrinho, removerItem } = await import(
  '../src/services/carrinhoService.js'
);
const { criar: criarCarrinho, listar: listarCarrinhos } = await import(
  '../src/services/carrinhosService.js'
);

faker.seed(42);

const BOMBA = produtoFactory({ codigo: 'ARR-7001', preco: 156.8, estoque: 17 });
const RADIADOR = produtoFactory({ codigo: 'ARR-7002', preco: 684, estoque: 0 });
const VALVULA = produtoFactory({ codigo: 'ARR-7003', preco: 64.5, estoque: 38 });

/** Faz o ERP mockado responder por codigo, como o de verdade responde. */
function catalogoDoErp(produtos) {
  const porCodigo = new Map(produtos.map((produto) => [produto.codigo, produto]));

  buscarProduto.mockImplementation(async (codigo) => {
    const produto = porCodigo.get(codigo);
    if (!produto) throw ApiError.naoEncontrado(`Produto nao encontrado: ${codigo}`);
    return produto;
  });
}

let db;
let usuarioId;

beforeAll(() => {
  db = criarBancoDeTeste();
  usuarioId = semearUsuario(db);
});

afterAll(() => {
  db?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  catalogoDoErp([BOMBA, RADIADOR, VALVULA]);
  db.prepare('DELETE FROM carrinhos').run(); // cascata limpa os itens
});

describe('lerCarrinho', () => {
  describe('KZN-312 - total maior que a soma das pecas', () => {
    it('nao soma no total a linha que esta sem estoque', async () => {
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1], ['ARR-7003', 3]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

      // 313,60 + 193,50: o radiador de 684,00 fica de fora.
      expect(carrinho.valor_total).toBe(507.1);
    });

    it('mantem a linha indisponivel visivel, com o preco dela', async () => {
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);
      const radiador = carrinho.itens.find((item) => item.codigo_produto === 'ARR-7002');

      expect(radiador).toMatchObject({
        disponivel: false,
        problema: 'Sem estoque no momento.',
        valor_total: 684,
      });
    });

    it('tira do total a linha inteira quando o estoque so cobre parte dela', async () => {
      // Pediu 20, o ERP so tem 17: bloqueia a linha inteira.
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 20], ['ARR-7003', 3]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

      expect(carrinho.valor_total).toBe(193.5);
    });

    it('nao soma o produto que sumiu do catalogo do ERP', async () => {
      catalogoDoErp([BOMBA]);
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['SUMIU-0001', 1]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

      expect(carrinho.valor_total).toBe(313.6);
      expect(carrinho.itens.find((item) => item.codigo_produto === 'SUMIU-0001')).toMatchObject({
        disponivel: false,
        problema: 'Produto indisponivel no catalogo.',
      });
    });

    it('bloqueia o checkout enquanto houver linha indisponivel', async () => {
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

      expect(carrinho.pronto_para_checkout).toBe(false);
    });
  });

  describe('KZN-318 - contador do icone do carrinho', () => {
    it('conta as unidades, nao as linhas', async () => {
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7003', 3]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

      expect(carrinho.quantidade_pecas).toBe(5);
      expect(carrinho.quantidade_itens).toBe(2);
    });

    it('conta tambem as unidades do item indisponivel', async () => {
      // O contador diz quantas pecas tem ai dentro, nao quantas da para levar.
      const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1]]);

      const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

      expect(carrinho.quantidade_pecas).toBe(3);
    });
  });

  it('le o preco no ERP a cada leitura, sem cache local', async () => {
    const carrinhoId = semearCarrinho(db, usuarioId, [['ARR-7001', 1]]);

    await lerCarrinho(usuarioId, carrinhoId, db);
    await lerCarrinho(usuarioId, carrinhoId, db);

    expect(buscarProduto).toHaveBeenCalledTimes(2);
  });

  it('carrinho vazio nao fica pronto para checkout', async () => {
    const carrinhoId = semearCarrinho(db, usuarioId, []);
    const carrinho = await lerCarrinho(usuarioId, carrinhoId, db);

    expect(carrinho).toMatchObject({
      itens: [],
      quantidade_itens: 0,
      quantidade_pecas: 0,
      valor_total: 0,
      pronto_para_checkout: false,
    });
  });
});

describe('adicionarNaAtiva', () => {
  it('cria "Carrinho 1" principal quando o usuario nao tem carrinho e adiciona o item', async () => {
    const carrinho = await adicionarNaAtiva(usuarioId, 'ARR-7001', 2, db);

    expect(carrinho.titulo).toBe('Carrinho 1');
    expect(carrinho.principal).toBe(true);
    expect(carrinho.quantidade_pecas).toBe(2);

    const lista = listarCarrinhos(usuarioId, db);
    expect(lista).toHaveLength(1);
  });

  it('adiciona na carrinho principal existente, nao numa nova', async () => {
    criarCarrinho(usuarioId, { titulo: 'Gol do Joao' }, db); // principal
    criarCarrinho(usuarioId, { titulo: 'Civic prata' }, db);

    await adicionarNaAtiva(usuarioId, 'ARR-7001', 1, db);

    const lista = listarCarrinhos(usuarioId, db);
    expect(lista).toHaveLength(2);
    expect(lista[0].principal).toBe(true);
    expect(lista[0].quantidade_pecas).toBe(1);
  });
});

describe('isolamento de item entre carrinhos', () => {
  it('nao mexe em item de carrinho de outro usuario (404)', async () => {
    const outroId = semearUsuario(db, { id: 99, email: 'outro-item@x.com' });
    const alheio = criarCarrinho(outroId, { titulo: 'Do outro' }, db);
    db.prepare("INSERT INTO carrinho_itens (carrinho_id, codigo_produto, quantidade, adicionado_em) VALUES (?, 'ARR-7001', 1, '2026-01-01T00:00:00.000Z')").run(alheio);

    const naoEncontrado = expect.objectContaining({ status: 404 });
    await expect(lerCarrinho(usuarioId, alheio, db)).rejects.toThrowError(naoEncontrado);
    await expect(alterarQuantidade(usuarioId, alheio, 'ARR-7001', 3, db)).rejects.toThrowError(naoEncontrado);
    await expect(removerItem(usuarioId, alheio, 'ARR-7001', db)).rejects.toThrowError(naoEncontrado);

    db.prepare('DELETE FROM usuarios WHERE id = 99').run();
  });
});

describe('atualizado_em do carrinho', () => {
  it('sobe a cada mutacao de item', async () => {
    const carrinhoId = semearCarrinho(db, usuarioId, []);
    const antes = db.prepare('SELECT atualizado_em FROM carrinhos WHERE id = ?').get(carrinhoId).atualizado_em;

    await new Promise((r) => setTimeout(r, 5));
    await adicionarNaAtiva(usuarioId, 'ARR-7001', 1, db);

    const depois = db.prepare('SELECT atualizado_em FROM carrinhos WHERE id = ?').get(carrinhoId).atualizado_em;
    expect(depois >= antes).toBe(true);
  });
});
