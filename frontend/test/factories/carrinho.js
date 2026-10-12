import { faker } from '@faker-js/faker';

/** Linha do carrinho como o backend devolve em GET /carrinho. */
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
 * Resposta de GET /carrinho. Os agregados sao calculados para a factory ficar
 * coerente sozinha - um teste que queira afirmar contagem passa override, senao
 * compara a formula da factory com ela mesma.
 */
export function carrinhoFactory({ itens = [], ...resto } = {}) {
  const disponiveis = itens.filter((item) => item.disponivel);

  return {
    itens,
    quantidade_itens: itens.length,
    quantidade_pecas: itens.reduce((soma, item) => soma + item.quantidade, 0),
    valor_total: Number(disponiveis.reduce((soma, item) => soma + item.valor_total, 0).toFixed(2)),
    pronto_para_checkout: itens.length > 0 && disponiveis.length === itens.length,
    ...resto,
  };
}
