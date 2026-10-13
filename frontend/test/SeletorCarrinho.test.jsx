import { faker } from '@faker-js/faker';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carrinhoFactory, resumoCarrinhoFactory } from './factories/carrinho.js';

vi.mock('../src/api/cliente.js', () => ({
  api: {
    carrinhos: {
      listar: vi.fn(), ler: vi.fn(), criar: vi.fn(), editar: vi.fn(),
      marcarPrincipal: vi.fn(), remover: vi.fn(), adicionarItem: vi.fn(),
    },
  },
  dinheiro: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  ErroApi: class ErroApi extends Error {},
}));

const { api } = await import('../src/api/cliente.js');
const { SeletorCarrinho } = await import('../src/componentes/SeletorCarrinho.jsx');
const { ProvedorCarrinho } = await import('../src/contextos/CarrinhoContext.jsx');

function montar(listaInicial) {
  api.carrinhos.listar.mockResolvedValue({ dados: listaInicial });
  api.carrinhos.ler.mockResolvedValue({ dados: carrinhoFactory({ id: listaInicial[0]?.id ?? 1 }) });

  return render(
    <ProvedorCarrinho>
      <SeletorCarrinho />
    </ProvedorCarrinho>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  faker.seed(42);
});

describe('SeletorCarrinho', () => {
  it('troca o ativo marcando o carrinho escolhido como principal', async () => {
    api.carrinhos.marcarPrincipal.mockResolvedValue({ dados: [] });
    montar([
      resumoCarrinhoFactory({ id: 1, titulo: 'Gol do Joao', principal: true }),
      resumoCarrinhoFactory({ id: 2, titulo: 'Civic prata', principal: false }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /civic prata/i }));

    await waitFor(() => expect(api.carrinhos.marcarPrincipal).toHaveBeenCalledWith(2));
  });

  it('cria um carrinho novo', async () => {
    api.carrinhos.criar.mockResolvedValue({ dados: {} });
    montar([resumoCarrinhoFactory({ id: 1, titulo: 'Gol do Joao', principal: true })]);

    fireEvent.click(await screen.findByRole('button', { name: /novo carrinho/i }));
    fireEvent.change(await screen.findByLabelText(/nome do novo carrinho/i), {
      target: { value: 'Civic prata' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^criar$/i }));

    await waitFor(() =>
      expect(api.carrinhos.criar).toHaveBeenCalledWith({ titulo: 'Civic prata' }),
    );
  });

  it('exclui um carrinho', async () => {
    api.carrinhos.remover.mockResolvedValue({ dados: [] });
    montar([resumoCarrinhoFactory({ id: 5, titulo: 'Antigo', principal: true })]);

    fireEvent.click(await screen.findByRole('button', { name: /excluir/i }));

    await waitFor(() => expect(api.carrinhos.remover).toHaveBeenCalledWith(5));
  });

  it('sem carrinhos, mostra o estado vazio para criar', async () => {
    montar([]);

    expect(await screen.findByText(/nenhum carrinho ainda/i)).toBeInTheDocument();
  });
});
