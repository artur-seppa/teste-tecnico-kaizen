import { faker } from '@faker-js/faker';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carrinhoFactory, itemCarrinhoFactory, resumoCarrinhoFactory } from './factories/carrinho.js';

vi.mock('../src/api/cliente.js', () => ({
  api: {
    carrinhos: {
      listar: vi.fn(), ler: vi.fn(), criar: vi.fn(), editar: vi.fn(),
      marcarPrincipal: vi.fn(), remover: vi.fn(),
      adicionarItem: vi.fn(), alterarItem: vi.fn(), removerItem: vi.fn(), limpar: vi.fn(),
    },
  },
  dinheiro: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  ErroApi: class ErroApi extends Error {},
}));

const { api } = await import('../src/api/cliente.js');
const { PainelCarrinho } = await import('../src/componentes/PainelCarrinho.jsx');
const { ProvedorCarrinho } = await import('../src/contextos/CarrinhoContext.jsx');

const ATIVO = carrinhoFactory({
  id: 1,
  titulo: 'Gol do Joao',
  itens: [itemCarrinhoFactory({ codigo: 'ARR-7001', preco: 156.8, quantidade: 2 })],
});

function montar({ aberto = true, aoFechar = vi.fn() } = {}) {
  api.carrinhos.listar.mockResolvedValue({ dados: [resumoCarrinhoFactory({ id: 1, principal: true, quantidadePecas: 2 })] });
  api.carrinhos.ler.mockResolvedValue({ dados: ATIVO });

  const utils = render(
    <MemoryRouter>
      <ProvedorCarrinho>
        <PainelCarrinho aberto={aberto} aoFechar={aoFechar} />
      </ProvedorCarrinho>
    </MemoryRouter>,
  );
  return { ...utils, aoFechar };
}

beforeEach(() => {
  vi.clearAllMocks();
  faker.seed(42);
});

describe('PainelCarrinho', () => {
  it('mostra os itens do carrinho ativo', async () => {
    montar();
    expect(await screen.findByText(ATIVO.itens[0].descricao)).toBeInTheDocument();
  });

  it('o botao de fechar chama aoFechar', async () => {
    const { aoFechar } = montar();
    fireEvent.click(await screen.findByRole('button', { name: /fechar carrinho/i, hidden: true }));
    expect(aoFechar).toHaveBeenCalled();
  });

  it('remover um item chama a API no carrinho ativo', async () => {
    api.carrinhos.removerItem.mockResolvedValue({ dados: carrinhoFactory({ id: 1 }) });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /remover/i, hidden: true }));

    expect(api.carrinhos.removerItem).toHaveBeenCalledWith(1, 'ARR-7001');
  });

  it('esvaziar o carrinho chama a API no carrinho ativo', async () => {
    api.carrinhos.limpar.mockResolvedValue({ dados: carrinhoFactory({ id: 1, itens: [] }) });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /esvaziar carrinho/i, hidden: true }));

    expect(api.carrinhos.limpar).toHaveBeenCalledWith(1);
  });
});
