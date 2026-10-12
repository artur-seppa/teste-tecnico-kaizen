import { faker } from '@faker-js/faker';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carrinhoFactory, itemCarrinhoFactory } from './factories/carrinho.js';
import { usuarioFactory } from './factories/usuario.js';

// Teste de componente: o que ele afirma e a tela. O transporte HTTP e do
// api/cliente.js e esta coberto no teste dele.
vi.mock('../src/api/cliente.js', () => ({
  api: {
    auth: { eu: vi.fn(), entrar: vi.fn(), cadastrar: vi.fn(), sair: vi.fn() },
    carrinho: { ler: vi.fn(), adicionar: vi.fn(), alterar: vi.fn(), remover: vi.fn(), limpar: vi.fn() },
  },
  ErroApi: class ErroApi extends Error {},
}));

const { api } = await import('../src/api/cliente.js');
const { Cabecalho } = await import('../src/componentes/Cabecalho.jsx');
const { ProvedorAuth } = await import('../src/contextos/AuthContext.jsx');
const { ProvedorCarrinho } = await import('../src/contextos/CarrinhoContext.jsx');

function montar(carrinho) {
  api.auth.eu.mockResolvedValue({ dados: usuarioFactory() });
  api.carrinho.ler.mockResolvedValue({ dados: carrinho });

  return render(
    <MemoryRouter>
      <ProvedorAuth>
        <ProvedorCarrinho>
          <Cabecalho />
        </ProvedorCarrinho>
      </ProvedorAuth>
    </MemoryRouter>,
  );
}

const contador = () => screen.findByLabelText(/no carrinho/i);

beforeEach(() => {
  vi.clearAllMocks();
  faker.seed(42);
});

describe('Cabecalho - contador do carrinho (KZN-318)', () => {
  it('mostra o numero de pecas, nao o de produtos distintos', async () => {
    // 2 produtos, 7 pecas: o relato literal do chamado.
    montar(
      carrinhoFactory({
        itens: [
          itemCarrinhoFactory({ codigo: 'ARR-7001', preco: 156.8, quantidade: 5 }),
          itemCarrinhoFactory({ codigo: 'ARR-7003', preco: 64.5, quantidade: 2 }),
        ],
      }),
    );

    expect(await contador()).toHaveTextContent('7');
  });

  it('conta tambem as pecas da linha indisponivel', async () => {
    montar(
      carrinhoFactory({
        itens: [
          itemCarrinhoFactory({ codigo: 'ARR-7001', preco: 156.8, quantidade: 2 }),
          itemCarrinhoFactory({
            codigo: 'ARR-7002',
            preco: 684,
            quantidade: 1,
            disponivel: false,
            problema: 'Sem estoque no momento.',
          }),
        ],
      }),
    );

    expect(await contador()).toHaveTextContent('3');
  });

  it('nao mostra contador quando o carrinho esta vazio', async () => {
    montar(carrinhoFactory());

    expect(await screen.findByRole('link', { name: /carrinho/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/no carrinho/i)).not.toBeInTheDocument();
  });

  it('nao quebra a vitrine quando a leitura do carrinho falha', async () => {
    // 401 de visitante cai aqui: renderiza sem contador, nao quebra.
    api.auth.eu.mockResolvedValue({ dados: usuarioFactory() });
    api.carrinho.ler.mockRejectedValue(new Error('401'));

    render(
      <MemoryRouter>
        <ProvedorAuth>
          <ProvedorCarrinho>
            <Cabecalho />
          </ProvedorCarrinho>
        </ProvedorAuth>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /carrinho/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/no carrinho/i)).not.toBeInTheDocument();
  });
});
