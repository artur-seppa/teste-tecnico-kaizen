import { faker } from '@faker-js/faker';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carrinhoFactory, itemCarrinhoFactory, resumoCarrinhoFactory } from './factories/carrinho.js';
import { enderecoFactory } from './factories/endereco.js';

vi.mock('../src/api/cliente.js', () => ({
  api: {
    auth: { eu: vi.fn() },
    enderecos: { listar: vi.fn(), criar: vi.fn(), salvar: vi.fn() },
    carrinhos: { listar: vi.fn(), ler: vi.fn() },
    pedidos: { criar: vi.fn() },
  },
  dinheiro: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  ErroApi: class ErroApi extends Error {},
}));

const { api } = await import('../src/api/cliente.js');
const { Checkout } = await import('../src/paginas/Checkout.jsx');
const { ProvedorCarrinho } = await import('../src/contextos/CarrinhoContext.jsx');

const CASA = enderecoFactory({ id: 1, apelido: 'Casa', principal: true });
const OFICINA = enderecoFactory({ id: 2, apelido: 'Oficina', principal: false });

const CARRINHO = carrinhoFactory({
  id: 7,
  itens: [itemCarrinhoFactory({ codigo: 'ARR-7001', preco: 156.8, quantidade: 2 })],
});

function montar({ enderecos = [CASA, OFICINA] } = {}) {
  api.enderecos.listar.mockResolvedValue({ dados: enderecos });
  api.carrinhos.listar.mockResolvedValue({
    dados: [resumoCarrinhoFactory({ id: CARRINHO.id, principal: true, quantidadePecas: CARRINHO.quantidade_pecas })],
  });
  api.carrinhos.ler.mockResolvedValue({ dados: CARRINHO });
  api.pedidos.criar.mockResolvedValue({ dados: { numero: 'PED-2026-000001' } });

  return render(
    <MemoryRouter>
      <ProvedorCarrinho>
        <Checkout />
      </ProvedorCarrinho>
    </MemoryRouter>,
  );
}

const escolher = async (apelido) => fireEvent.click(await screen.findByRole('radio', { name: new RegExp(apelido, 'i') }));
const confirmar = async () => fireEvent.click(await screen.findByRole('button', { name: /confirmar pedido/i }));

beforeEach(() => {
  vi.clearAllMocks();
  faker.seed(42);
});

describe('Checkout - endereco de entrega (KZN-331)', () => {
  it('fecha o pedido no endereco escolhido, nao no principal', async () => {
    montar();

    await escolher('Oficina');
    await confirmar();

    // Fecha o endereco escolhido (KZN-331) e o carrinho ativo (multiplos carrinhos).
    expect(api.pedidos.criar).toHaveBeenCalledWith(
      expect.objectContaining({ endereco_id: OFICINA.id, carrinho_id: CARRINHO.id }),
    );
  });

  it('mantem o principal quando e ele o escolhido', async () => {
    montar();

    await escolher('Casa');
    await confirmar();

    expect(api.pedidos.criar).toHaveBeenCalledWith(
      expect.objectContaining({ endereco_id: CASA.id }),
    );
  });

  it('comeca com o principal marcado', async () => {
    montar();

    expect(await screen.findByRole('radio', { name: /Casa/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Oficina/i })).not.toBeChecked();
  });

  it('fecha no endereco cadastrado durante o proprio checkout', async () => {
    const novo = enderecoFactory({ id: 9, apelido: 'Galpao' });
    api.enderecos.criar.mockResolvedValue({ dados: novo });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /adicionar outro/i }));
    fireEvent.click(await screen.findByRole('button', { name: /adicionar endere/i }));
    await screen.findByRole('radio', { name: /Galpao/i });
    await confirmar();

    expect(api.pedidos.criar).toHaveBeenCalledWith(
      expect.objectContaining({ endereco_id: novo.id }),
    );
  });

  it('sem nenhum principal, marca o primeiro da lista', async () => {
    const semPrincipal = [
      enderecoFactory({ id: 1, apelido: 'Casa' }),
      enderecoFactory({ id: 2, apelido: 'Oficina' }),
    ];
    montar({ enderecos: semPrincipal });

    expect(await screen.findByRole('radio', { name: /Casa/i })).toBeChecked();
  });
});
