import { faker } from '@faker-js/faker';

/** Linha do carrinho como o backend devolve em GET /carrinhos/:id. */
export function itemCarrinhoFactory({ codigo, preco, quantidade, disponivel = true, problema = null } = {}) {
  return {
    codigo_produto: codigo,
    descricao: faker.commerce.productName(),
    marca: faker.company.name(),
    categoria: 'ARREFECIMENTO',
    aplicacao: faker.vehicle.model(),
    imagem_url: null,
    preco_unitario: preco,
    quantidade,
    estoque: disponivel ? quantidade + 10 : 0,
    disponivel,
    problema,
    valor_total: Number((preco * quantidade).toFixed(2)),
  };
}

/**
 * Carrinho ativo enriquecido, como GET /carrinhos/:id devolve: os itens com
 * preco, os agregados e a meta do carrinho (id/titulo/principal). Os agregados
 * sao calculados para a factory ficar coerente sozinha.
 */
export function carrinhoFactory({ id = 1, titulo = 'Carrinho 1', descricao = null, principal = true, itens = [], ...resto } = {}) {
  const disponiveis = itens.filter((item) => item.disponivel);

  return {
    id,
    titulo,
    descricao,
    principal,
    itens,
    quantidade_itens: itens.length,
    quantidade_pecas: itens.reduce((soma, item) => soma + item.quantidade, 0),
    valor_total: Number(disponiveis.reduce((soma, item) => soma + item.valor_total, 0).toFixed(2)),
    pronto_para_checkout: itens.length > 0 && disponiveis.length === itens.length,
    ...resto,
  };
}

/** Resumo de carrinho, como GET /carrinhos devolve (lista, sem itens/preco). */
export function resumoCarrinhoFactory({ id = 1, titulo = 'Carrinho 1', descricao = null, principal = true, quantidadePecas = 0, quantidadeItens = 0 } = {}) {
  return {
    id,
    titulo,
    descricao,
    principal,
    quantidade_itens: quantidadeItens,
    quantidade_pecas: quantidadePecas,
    atualizado_em: '2026-01-01T00:00:00.000Z',
  };
}
