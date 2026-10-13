import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { api, ErroApi } from '../src/api/cliente.js';
import { respostaJson, respostaVazia, stubarFetch } from './utils/fetchFalso.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api/cliente', () => {
  it('manda o cookie de sessao junto, senao a API nao reconhece a pessoa', async () => {
    const { chamadas } = stubarFetch(() => respostaJson(200, { dados: {} }));

    await api.carrinhos.listar();

    expect(chamadas[0].url).toBe('/api/carrinhos');
    expect(chamadas[0].opcoes.credentials).toBe('include');
  });

  it('adiciona na ativa via POST /carrinhos/itens', async () => {
    const { chamadas } = stubarFetch(() => respostaJson(201, { dados: {} }));

    await api.carrinhos.adicionarItem('ARR-7001', 2);

    expect(chamadas[0].url).toBe('/api/carrinhos/itens');
    expect(chamadas[0].opcoes.method).toBe('POST');
    expect(JSON.parse(chamadas[0].opcoes.body)).toEqual({ codigo_produto: 'ARR-7001', quantidade: 2 });
  });

  it('troca o ativo via PUT /carrinhos/:id/principal', async () => {
    const { chamadas } = stubarFetch(() => respostaJson(200, { dados: [] }));

    await api.carrinhos.marcarPrincipal(7);

    expect(chamadas[0].url).toBe('/api/carrinhos/7/principal');
    expect(chamadas[0].opcoes.method).toBe('PUT');
  });

  it('devolve null em 204 sem tentar fazer parse do corpo', async () => {
    stubarFetch(() => respostaVazia());

    await expect(api.enderecos.remover(1)).resolves.toBeNull();
  });

  it('transforma erro da API em ErroApi com codigo e status', async () => {
    stubarFetch(() =>
      respostaJson(409, {
        erro: { codigo: 'ESTOQUE_INSUFICIENTE', mensagem: 'Restam apenas 2 unidades.' },
      }),
    );

    await expect(api.carrinhos.adicionarItem('ARR-7001', 5)).rejects.toMatchObject({
      status: 409,
      codigo: 'ESTOQUE_INSUFICIENTE',
      message: 'Restam apenas 2 unidades.',
    });
  });

  it('agrupa os detalhes de validacao por campo, que e como o formulario consome', async () => {
    stubarFetch(() =>
      respostaJson(422, {
        erro: {
          codigo: 'ENTIDADE_NAO_PROCESSAVEL',
          mensagem: 'Dados invalidos.',
          detalhes: [
            { campo: 'email', mensagem: 'E-mail invalido.' },
            { campo: 'senha', mensagem: 'Senha muito curta.' },
          ],
        },
      }),
    );

    const erro = await api.auth.cadastrar({}).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro.porCampo).toEqual({
      email: 'E-mail invalido.',
      senha: 'Senha muito curta.',
    });
  });

  it('marca 401 como sessao expirada', async () => {
    stubarFetch(() => respostaJson(401, { erro: { codigo: 'NAO_AUTENTICADO' } }));

    const erro = await api.perfil.ler().catch((e) => e);

    expect(erro.ehSessaoExpirada).toBe(true);
  });

  it('transforma falha de rede em SEM_CONEXAO', async () => {
    stubarFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(api.catalogo.listar()).rejects.toMatchObject({
      status: 0,
      codigo: 'SEM_CONEXAO',
    });
  });

  it('nao manda filtro vazio na query do catalogo', async () => {
    const { chamadas } = stubarFetch(() => respostaJson(200, { dados: [] }));

    await api.catalogo.listar({ busca: 'amortecedor', categoria: '', pagina: undefined });

    expect(chamadas[0].url).toContain('busca=amortecedor');
    expect(chamadas[0].url).not.toContain('categoria=');
    expect(chamadas[0].url).not.toContain('pagina=');
  });
});
