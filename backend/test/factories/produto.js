import { faker } from '@faker-js/faker';

/**
 * Produto como o ERP devolve em GET /produtos/:codigo.
 *
 * Preco, estoque e `ativo` sao sempre explicitos: se o faker sorteasse o preco,
 * a asserção do total viraria a formula do codigo copiada para dentro do teste.
 */
export function produtoFactory({ codigo, preco, estoque, ativo = true, ...resto } = {}) {
  return {
    codigo: codigo ?? `${faker.string.alpha({ length: 3, casing: 'upper' })}-${faker.number.int({ min: 1000, max: 9999 })}`,
    descricao: faker.commerce.productName(),
    marca: faker.company.name(),
    categoria: faker.helpers.arrayElement(['ARREFECIMENTO', 'FREIOS', 'ELETRICA', 'SUSPENSAO']),
    aplicacao: `${faker.vehicle.model()} ${faker.number.float({ min: 1, max: 2.4, fractionDigits: 1 })}`,
    unidade: 'PC',
    imagem_url: null,
    preco_unitario: preco,
    estoque,
    ativo,
    atualizado_em: faker.date.recent().toISOString(),
    ...resto,
  };
}
