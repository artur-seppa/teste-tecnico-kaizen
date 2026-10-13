import { faker } from '@faker-js/faker';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paginaCatalogoFactory, produtoFactory } from './factories/produto.js';

vi.mock('../src/api/cliente.js', () => ({
  api: {
    auth: { eu: vi.fn() },
    carrinhos: { listar: vi.fn(), ler: vi.fn(), adicionarItem: vi.fn() },
    catalogo: { listar: vi.fn(), categorias: vi.fn() },
  },
  dinheiro: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  ErroApi: class ErroApi extends Error {},
}));

const { api } = await import('../src/api/cliente.js');
const { Catalogo } = await import('../src/paginas/Catalogo.jsx');
const { ProvedorAuth } = await import('../src/contextos/AuthContext.jsx');
const { ProvedorCarrinho } = await import('../src/contextos/CarrinhoContext.jsx');

const AMORTECEDOR = produtoFactory({ codigo: 'SUS-2001', descricao: 'Amortecedor Dianteiro', preco: 268 });

/**
 * Monta a vitrine ja posicionada numa pagina. `entrada` e a URL como o
 * navegador a traria - e o estado do chamado: o cliente avancou ate ali.
 */
function montar({ entrada = '/' } = {}) {
  api.auth.eu.mockRejectedValue(new Error('401'));
  api.carrinhos.listar.mockRejectedValue(new Error('401'));
  api.catalogo.categorias.mockResolvedValue({ dados: ['SUSPENSAO', 'FREIOS'] });
  api.catalogo.listar.mockResolvedValue(
    paginaCatalogoFactory({ produtos: [AMORTECEDOR], pagina: 5, total: 120 }),
  );

  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <ProvedorAuth>
        <ProvedorCarrinho>
          <Catalogo />
        </ProvedorCarrinho>
      </ProvedorAuth>
    </MemoryRouter>,
  );
}

/** O que o backend recebeu na ultima consulta ao catalogo. */
const ultimaConsulta = () => api.catalogo.listar.mock.lastCall?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  faker.seed(42);
});

describe('Catalogo - filtro aplicado fora da primeira pagina (KZN-325)', () => {
  it('volta para a primeira pagina ao trocar de categoria', async () => {
    montar({ entrada: '/?pagina=5' });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 5 }));

    fireEvent.click(await screen.findByRole('button', { name: /freios/i }));

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categoria: 'FREIOS', pagina: 1 }));
  });

  it('volta para a primeira pagina ao marcar "so com estoque"', async () => {
    montar({ entrada: '/?pagina=5' });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 5 }));

    fireEvent.click(await screen.findByRole('checkbox', { name: /com estoque/i }));

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 1 }));
  });

  it('volta para a primeira pagina ao limpar a busca', async () => {
    montar({ entrada: '/?pagina=5&busca=amortecedor' });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 5 }));

    fireEvent.click(await screen.findByRole('button', { name: /limpar/i }));

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ busca: '', pagina: 1 }));
  });

  it('continua navegando entre paginas sem se autozerar', async () => {
    montar({ entrada: '/?pagina=5' });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 5 }));

    fireEvent.click(await screen.findByRole('button', { name: /anterior/i }));

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 4 }));
  });
});

describe('Catalogo - adicionar na carrinho ativa (multiplos carrinhos)', () => {
  it('adiciona pela vitrine sem mudar a URL (nao perde a busca/pagina)', async () => {
    const { usuarioFactory } = await import('./factories/usuario.js');
    const { carrinhoFactory, resumoCarrinhoFactory } = await import('./factories/carrinho.js');

    api.auth.eu.mockResolvedValue({ dados: usuarioFactory() });
    api.carrinhos.listar.mockResolvedValue({ dados: [resumoCarrinhoFactory({ id: 1, principal: true })] });
    api.carrinhos.ler.mockResolvedValue({ dados: carrinhoFactory({ id: 1 }) });
    api.carrinhos.adicionarItem.mockResolvedValue({ dados: carrinhoFactory({ id: 1 }) });
    api.catalogo.categorias.mockResolvedValue({ dados: ['SUSPENSAO'] });
    api.catalogo.listar.mockResolvedValue(
      paginaCatalogoFactory({ produtos: [AMORTECEDOR], pagina: 2, total: 60 }),
    );

    render(
      <MemoryRouter initialEntries={['/?busca=amortecedor&pagina=2']}>
        <ProvedorAuth>
          <ProvedorCarrinho>
            <Catalogo />
          </ProvedorCarrinho>
        </ProvedorAuth>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /adicionar/i }));

    await waitFor(() =>
      expect(api.carrinhos.adicionarItem).toHaveBeenCalledWith('SUS-2001', 1),
    );
    // A consulta ao catalogo nao foi refeita: a vitrine nao recarregou/navegou.
    expect(api.catalogo.listar).toHaveBeenCalledTimes(1);
    expect(ultimaConsulta()).toMatchObject({ busca: 'amortecedor', pagina: 2 });
  });
});
