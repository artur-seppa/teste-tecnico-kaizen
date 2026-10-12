import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import { config } from '../src/config.js';
import * as erp from '../src/erp/cliente.js';
import { produtoFactory } from './factories/produto.js';
import { falhaDeRede, respostaJson, stubarFetch } from './utils/fetchFalso.js';

faker.seed(7);

beforeEach(() => {
  // O cliente loga em console.error nos caminhos de falha; o teste nao precisa
  // ver isso, mas a chamada em si continua acontecendo.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('erp/cliente', () => {
  it('monta a URL sobre a base e manda o token no header', async () => {
    const { chamadas } = stubarFetch(() =>
      respostaJson(200, { dados: produtoFactory({ codigo: 'ARR-7001', preco: 10, estoque: 1 }) }),
    );

    await erp.buscarProduto('ARR-7001');

    expect(chamadas[0].url).toBe(`${config.erp.url}/produtos/ARR-7001`);
    expect(chamadas[0].headers['X-API-Token']).toBe(config.erp.token);
  });

  it('escapa o codigo do produto no caminho', async () => {
    const { chamadas } = stubarFetch(() => respostaJson(404, {}));

    await expect(erp.buscarProduto('a/b c')).rejects.toThrow();

    expect(chamadas[0].url).toContain('/produtos/a%2Fb%20c');
  });

  it('devolve o conteudo de `dados` quando o ERP responde 200', async () => {
    const produto = produtoFactory({ codigo: 'ARR-7002', preco: 684, estoque: 0 });
    stubarFetch(() => respostaJson(200, { dados: produto }));

    await expect(erp.buscarProduto('ARR-7002')).resolves.toEqual(produto);
  });

  it('repassa o 404 do ERP, que e informacao util para a loja', async () => {
    stubarFetch(() =>
      respostaJson(404, { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto nao existe.' } }),
    );

    await expect(erp.buscarProduto('NAO-EXISTE')).rejects.toMatchObject({
      status: 404,
      codigo: 'NAO_ENCONTRADO',
    });
  });

  it('repassa o 409 de estoque com os detalhes', async () => {
    stubarFetch(() =>
      respostaJson(409, {
        erro: {
          codigo: 'ESTOQUE_INSUFICIENTE',
          mensagem: 'Restam apenas 2.',
          detalhes: [{ codigo_produto: 'ARR-7001', estoque_disponivel: 2 }],
        },
      }),
    );

    await expect(erp.criarPedido({ itens: [] })).rejects.toMatchObject({
      status: 409,
      codigo: 'ESTOQUE_INSUFICIENTE',
      detalhes: [{ codigo_produto: 'ARR-7001', estoque_disponivel: 2 }],
    });
  });

  it('nao vaza o 401 do ERP para o cliente da loja', async () => {
    // Token mal configurado e problema nosso, nao de quem esta comprando: vira
    // 502, nunca um 401 que faria a loja deslogar a pessoa.
    stubarFetch(() => respostaJson(401, { erro: { codigo: 'TOKEN_INVALIDO' } }));

    await expect(erp.buscarProduto('ARR-7001')).rejects.toMatchObject({
      status: 502,
      codigo: 'ERP_NAO_AUTORIZADO',
    });
  });

  it('transforma 500 do ERP em 502 da loja', async () => {
    stubarFetch(() => respostaJson(500, { erro: { codigo: 'BOOM' } }));

    await expect(erp.buscarProduto('ARR-7001')).rejects.toMatchObject({
      status: 502,
      codigo: 'ERP_INDISPONIVEL',
    });
  });

  it('transforma falha de rede em 502', async () => {
    stubarFetch(() => falhaDeRede());

    await expect(erp.buscarProduto('ARR-7001')).rejects.toMatchObject({
      status: 502,
      codigo: 'ERP_INDISPONIVEL',
    });
  });

  it('transforma timeout em 502', async () => {
    stubarFetch(() => falhaDeRede('TimeoutError'));

    await expect(erp.buscarProduto('ARR-7001')).rejects.toMatchObject({
      status: 502,
      codigo: 'ERP_INDISPONIVEL',
    });
  });

  it('ignora filtro vazio ao montar a query', async () => {
    const { chamadas } = stubarFetch(() => respostaJson(200, { dados: [] }));

    await erp.listarProdutos({ busca: 'amortecedor', categoria: '', pagina: undefined });

    expect(chamadas[0].url).toContain('busca=amortecedor');
    expect(chamadas[0].url).not.toContain('categoria=');
    expect(chamadas[0].url).not.toContain('pagina=');
  });
});
