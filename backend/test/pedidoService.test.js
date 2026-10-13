import { beforeEach, describe, expect, it, vi } from 'vitest';
import { produtoFactory } from './factories/produto.js';
import { criarBancoDeTeste, semearCarrinho, semearUsuario } from './utils/bancoDeTeste.js';

// Teste de unidade: o ERP entra mockado (buscarProduto para enriquecer o
// carrinho, criarPedido para o fechamento). O foco e a regra de fechar UM
// carrinho: cria o pedido e remove aquele carrinho, deixando os outros intactos.
vi.mock('../src/erp/cliente.js', () => ({
  buscarProduto: vi.fn(),
  criarPedido: vi.fn(),
}));

const erp = await import('../src/erp/cliente.js');
const { finalizarPedido } = await import('../src/services/pedidoService.js');
const { criar: criarCarrinho, listar: listarCarrinhos } = await import(
  '../src/services/carrinhosService.js'
);

const BOMBA = produtoFactory({ codigo: 'ARR-7001', preco: 156.8, estoque: 17 });

let db;
let usuarioId;
let enderecoId;

function semearEndereco(uid) {
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO enderecos (usuario_id, apelido, cep, logradouro, numero, bairro, cidade, uf, principal, criado_em, atualizado_em)
    VALUES (?, 'Casa', '01310-100', 'Rua X', '1', 'Centro', 'SP', 'SP', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
  `).run(uid);
  return Number(lastInsertRowid);
}

beforeEach(() => {
  db = criarBancoDeTeste();
  usuarioId = semearUsuario(db, { id: 1, email: 'dono@x.com' });
  enderecoId = semearEndereco(usuarioId);

  erp.buscarProduto.mockImplementation(async (codigo) => (codigo === 'ARR-7001' ? BOMBA : null));
  erp.criarPedido.mockResolvedValue({ numero: 'PED-2026-000999', valor_total: 313.6 });
});

const usuario = () => ({ id: usuarioId, nome: 'Dono', documento: '12345678901' });

describe('finalizarPedido', () => {
  it('cria o pedido e remove o carrinho fechado, promovendo outro', async () => {
    const ativo = semearCarrinho(db, usuarioId, [['ARR-7001', 2]]); // principal
    const outro = criarCarrinho(usuarioId, { titulo: 'Civic' }, db);

    const pedido = await finalizarPedido(usuario(), enderecoId, null, ativo, db);

    expect(pedido.numero).toBe('PED-2026-000999');
    const gravado = db.prepare('SELECT * FROM pedidos_usuario WHERE numero_erp = ?').get('PED-2026-000999');
    expect(gravado).toBeDefined();

    const restantes = listarCarrinhos(usuarioId, db);
    expect(restantes.map((c) => c.id)).toEqual([outro]);
    expect(restantes[0].principal).toBe(true); // o que sobrou virou principal
  });

  it('recusa carrinho de outro usuario (404)', async () => {
    const outroId = semearUsuario(db, { id: 2, email: 'intruso@x.com' });
    const alheio = criarCarrinho(outroId, { titulo: 'Do intruso' }, db);

    await expect(finalizarPedido(usuario(), enderecoId, null, alheio, db)).rejects.toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(erp.criarPedido).not.toHaveBeenCalled();
  });

  it('recusa carrinho vazio (409 CARRINHO_VAZIO)', async () => {
    const vazio = criarCarrinho(usuarioId, { titulo: 'Vazio' }, db);

    await expect(finalizarPedido(usuario(), enderecoId, null, vazio, db)).rejects.toThrowError(
      expect.objectContaining({ codigo: 'CARRINHO_VAZIO' }),
    );
  });

  it('recusa carrinho com item indisponivel (409 CARRINHO_COM_PENDENCIAS)', async () => {
    erp.buscarProduto.mockImplementation(async () => ({ ...BOMBA, estoque: 0 }));
    const comPendencia = semearCarrinho(db, usuarioId, [['ARR-7001', 1]]);

    await expect(finalizarPedido(usuario(), enderecoId, null, comPendencia, db)).rejects.toThrowError(
      expect.objectContaining({ codigo: 'CARRINHO_COM_PENDENCIAS' }),
    );
    expect(erp.criarPedido).not.toHaveBeenCalled();
  });
});
