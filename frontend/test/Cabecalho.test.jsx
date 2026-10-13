import { faker } from '@faker-js/faker';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { carrinhoFactory, itemCarrinhoFactory, resumoCarrinhoFactory } from './factories/carrinho.js';
import { usuarioFactory } from './factories/usuario.js';

// Teste de componente: o que ele afirma e a tela. O transporte HTTP e do
// api/cliente.js e esta coberto no teste dele.
vi.mock('../src/api/cliente.js', () => ({
  api: {
    auth: { eu: vi.fn(), entrar: vi.fn(), cadastrar: vi.fn(), sair: vi.fn() },
    carrinhos: {
      listar: vi.fn(), ler: vi.fn(), criar: vi.fn(), editar: vi.fn(),
      marcarPrincipal: vi.fn(), remover: vi.fn(),
      adicionarItem: vi.fn(), alterarItem: vi.fn(), removerItem: vi.fn(), limpar: vi.fn(),
    },
  },
  ErroApi: class ErroApi extends Error {},
}));

const { api } = await import('../src/api/cliente.js');
const { Cabecalho } = await import('../src/componentes/Cabecalho.jsx');
const { ProvedorAuth } = await import('../src/contextos/AuthContext.jsx');
const { ProvedorCarrinho } = await import('../src/contextos/CarrinhoContext.jsx');

// O contador do cabecalho le as pecas do carrinho ativo pelo resumo da lista.
function montar(carrinhoAtivo) {
  api.auth.eu.mockResolvedValue({ dados: usuarioFactory() });
  api.carrinhos.listar.mockResolvedValue({
    dados: [resumoCarrinhoFactory({ id: carrinhoAtivo.id, principal: true, quantidadePecas: carrinhoAtivo.quantidade_pecas })],
  });
  api.carrinhos.ler.mockResolvedValue({ dados: carrinhoAtivo });

  return render(
    <MemoryRouter>
      <ProvedorAuth>
        <ProvedorCarrinho>
          <Cabecalho onAbrirCarrinho={vi.fn()} />
        </ProvedorCarrinho>
      </ProvedorAuth>
    </MemoryRouter>,
  );
}

/**
 * Os dois caminhos para o carrinho convivem no DOM: o icone ate o tablet e o
 * rotulo escrito no desktop. Quem esconde um deles e o CSS, que o jsdom nao
 * aplica - entao o contador e verificado nos dois, no numero que aparece na
 * tela e no nome que o leitor de tela anuncia.
 */
async function carrinhos() {
  const botoes = await screen.findAllByRole('button', { name: /abrir carrinho/i });
  // Os dois precisam existir: se um sumir num refactor, o `for` abaixo passaria
  // em silencio verificando so o que sobrou.
  expect(botoes).toHaveLength(2);
  return botoes.map((botao) => ({ texto: botao.textContent, nome: botao.getAttribute('aria-label') }));
}

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

    for (const botao of await carrinhos()) {
      expect(botao.texto).toContain('7');
      expect(botao.nome).toContain('7 peças');
    }
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

    for (const botao of await carrinhos()) {
      expect(botao.texto).toContain('3');
      expect(botao.nome).toContain('3 peças');
    }
  });

  it('nao mostra contador quando o carrinho esta vazio', async () => {
    montar(carrinhoFactory());

    for (const botao of await carrinhos()) {
      expect(botao.nome).toBe('Abrir carrinho');
      expect(botao.texto).not.toMatch(/\d/);
    }
  });

  it('nao quebra a vitrine quando a leitura do carrinho falha', async () => {
    // 401 de visitante cai aqui: renderiza sem contador, nao quebra.
    api.auth.eu.mockResolvedValue({ dados: usuarioFactory() });
    api.carrinhos.listar.mockRejectedValue(new Error('401'));

    render(
      <MemoryRouter>
        <ProvedorAuth>
          <ProvedorCarrinho>
            <Cabecalho onAbrirCarrinho={vi.fn()} />
          </ProvedorCarrinho>
        </ProvedorAuth>
      </MemoryRouter>,
    );

    for (const botao of await carrinhos()) {
      expect(botao.nome).toBe('Abrir carrinho');
      expect(botao.texto).not.toMatch(/\d/);
    }
  });
});

/**
 * A busca do topo monta a URL da vitrine a partir da URL atual, entao o teste
 * precisa de uma URL de verdade - MemoryRouter nao toca em window.location.
 */
function montarNaVitrine(url) {
  window.history.pushState({}, '', url);
  api.auth.eu.mockRejectedValue(new Error('401'));
  api.carrinhos.listar.mockRejectedValue(new Error('401'));

  return render(
    <BrowserRouter>
      <ProvedorAuth>
        <ProvedorCarrinho>
          <Cabecalho onAbrirCarrinho={() => {}} />
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

/**
 * Abaixo do `lg` a navegacao escrita sai da barra e vai para o MenuNavegacao,
 * que desce do topo.
 *
 * O jsdom nao implementa `showModal`, entao aqui nao da para afirmar que o
 * dialogo abriu de verdade - o que se afirma e o estado que a tela expoe
 * (`aria-expanded`) e o conteudo do menu. A abertura, a animacao e a largura em
 * que ele aparece sao comportamento de navegador, verificados fora do jsdom.
 */
describe('Cabecalho - menu do hamburguer', () => {
  // Sem `showModal` o <dialog> nunca fica `open`, e um dialogo fechado nao
  // expoe o papel `dialog` para as consultas por papel - por isso o menu e
  // alcancado pelo elemento, e so o conteudo dele e consultado por papel.
  const menu = () => document.querySelector('dialog[aria-label="Menu"]');

  it('alterna o estado do hamburguer ao abrir e ao fechar', async () => {
    montar(carrinhoFactory());

    const abrir = await screen.findByRole('button', { name: /abrir menu/i });
    expect(abrir).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(abrir);
    expect(abrir).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /fechar menu/i, hidden: true }));
    expect(abrir).toHaveAttribute('aria-expanded', 'false');
  });

  it('leva aos destinos da conta e fecha ao navegar', async () => {
    montar(carrinhoFactory());
    fireEvent.click(await screen.findByRole('button', { name: /abrir menu/i }));

    const links = within(menu());
    expect(links.getByRole('link', { name: 'Pedidos', hidden: true })).toHaveAttribute('href', '/pedidos');
    expect(links.getByRole('link', { name: 'Perfil', hidden: true })).toHaveAttribute('href', '/perfil');

    fireEvent.click(links.getByRole('link', { name: 'Pedidos', hidden: true }));
    expect(screen.getByRole('button', { name: /abrir menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('encerra a sessao pelo menu', async () => {
    api.auth.sair.mockResolvedValue({});
    montar(carrinhoFactory());

    fireEvent.click(await screen.findByRole('button', { name: /abrir menu/i }));
    fireEvent.click(within(menu()).getByRole('button', { name: 'Sair', hidden: true }));

    await waitFor(() => expect(api.auth.sair).toHaveBeenCalled());
  });
});
