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
const { lerCarrinho } = await import('../src/services/carrinhoService.js');

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
  db.prepare('DELETE FROM carrinho_itens').run();
});

describe('lerCarrinho', () => {
  describe('KZN-312 - total maior que a soma das pecas', () => {
    it('nao soma no total a linha que esta sem estoque', async () => {
      semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1], ['ARR-7003', 3]]);

      const carrinho = await lerCarrinho(usuarioId, db);

      // 313,60 + 193,50: o radiador de 684,00 fica de fora.
      expect(carrinho.valor_total).toBe(507.1);
    });

    it('mantem a linha indisponivel visivel, com o preco dela', async () => {
      semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1]]);

      const carrinho = await lerCarrinho(usuarioId, db);
      const radiador = carrinho.itens.find((item) => item.codigo_produto === 'ARR-7002');

      expect(radiador).toMatchObject({
        disponivel: false,
        problema: 'Sem estoque no momento.',
        valor_total: 684,
      });
    });

    it('tira do total a linha inteira quando o estoque so cobre parte dela', async () => {
      // Pediu 20, o ERP so tem 17: bloqueia a linha inteira.
      semearCarrinho(db, usuarioId, [['ARR-7001', 20], ['ARR-7003', 3]]);

      const carrinho = await lerCarrinho(usuarioId, db);

      expect(carrinho.valor_total).toBe(193.5);
    });

    it('nao soma o produto que sumiu do catalogo do ERP', async () => {
      catalogoDoErp([BOMBA]);
      semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['SUMIU-0001', 1]]);

      const carrinho = await lerCarrinho(usuarioId, db);

      expect(carrinho.valor_total).toBe(313.6);
      expect(carrinho.itens.find((item) => item.codigo_produto === 'SUMIU-0001')).toMatchObject({
        disponivel: false,
        problema: 'Produto indisponivel no catalogo.',
      });
    });

    it('bloqueia o checkout enquanto houver linha indisponivel', async () => {
      semearCarrinho(db, usuarioId, [['ARR-7001', 2], ['ARR-7002', 1]]);

      const carrinho = await lerCarrinho(usuarioId, db);

      expect(carrinho.pronto_para_checkout).toBe(false);
    });
  });

  it('le o preco no ERP a cada leitura, sem cache local', async () => {
    semearCarrinho(db, usuarioId, [['ARR-7001', 1]]);

    await lerCarrinho(usuarioId, db);
    await lerCarrinho(usuarioId, db);

    expect(buscarProduto).toHaveBeenCalledTimes(2);
  });

  it('carrinho vazio nao fica pronto para checkout', async () => {
    const carrinho = await lerCarrinho(usuarioId, db);

    expect(carrinho).toMatchObject({
      itens: [],
      quantidade_itens: 0,
      quantidade_pecas: 0,
      valor_total: 0,
      pronto_para_checkout: false,
    });
  });
});
