import { faker } from '@faker-js/faker';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/**
 * A busca do topo monta a URL da vitrine a partir da URL atual, entao o teste
 * precisa de uma URL de verdade - MemoryRouter nao toca em window.location.
 */
function montarNaVitrine(url) {
  window.history.pushState({}, '', url);
  api.auth.eu.mockRejectedValue(new Error('401'));
  api.carrinho.ler.mockRejectedValue(new Error('401'));

  return render(
    <BrowserRouter>
      <ProvedorAuth>
        <ProvedorCarrinho>
          <Cabecalho />
        </ProvedorCarrinho>
      </ProvedorAuth>
    </BrowserRouter>,
  );
}

const pesquisar = async (termo) => {
  const campo = await screen.findByLabelText(/buscar/i);
  fireEvent.change(campo, { target: { value: termo } });
  fireEvent.submit(campo.closest('form'));
};

const urlAtual = () => new URLSearchParams(window.location.search);

afterEach(() => window.history.pushState({}, '', '/'));

describe('Cabecalho - busca feita fora da primeira pagina (KZN-325)', () => {
  it('pesquisa a partir da primeira pagina, nao da pagina em que o cliente estava', async () => {
    // O relato do chamado: o cliente avancou ate a pagina 5 e so entao buscou.
    montarNaVitrine('/?pagina=5');

    await pesquisar('amortecedor');

    expect(urlAtual().get('busca')).toBe('amortecedor');
    expect(urlAtual().has('pagina')).toBe(false);
  });

  it('preserva os filtros ja aplicados na vitrine', async () => {
    montarNaVitrine('/?categoria=SUSPENSAO&somente_disponiveis=true&pagina=3');

    await pesquisar('amortecedor');

    expect(urlAtual().get('categoria')).toBe('SUSPENSAO');
    expect(urlAtual().get('somente_disponiveis')).toBe('true');
    expect(urlAtual().has('pagina')).toBe(false);
  });

  it('limpar o termo tira a busca da URL e volta para a primeira pagina', async () => {
    montarNaVitrine('/?busca=amortecedor&pagina=2');

    await pesquisar('   ');

    expect(urlAtual().has('busca')).toBe(false);
    expect(urlAtual().has('pagina')).toBe(false);
  });
});
