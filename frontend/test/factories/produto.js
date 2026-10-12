import { faker } from '@faker-js/faker';

/** Produto como o backend devolve em GET /catalogo. */
export function produtoFactory({ codigo, descricao, preco, estoque = 10, ...resto } = {}) {
  return {
    codigo,
    descricao: descricao ?? faker.commerce.productName(),
    marca: faker.company.name(),
    categoria: 'SUSPENSAO',
    aplicacao: faker.vehicle.model(),
    unidade: 'PC',
    imagem_url: null,
    preco_unitario: preco,
    estoque,
    disponivel: estoque > 0,
    ativo: true,
    ...resto,
  };
}

/** Resposta de GET /catalogo: a lista mais o bloco de paginacao. */
export function paginaCatalogoFactory({ produtos = [], pagina = 1, tamanho = 24, total } = {}) {
  const quantidade = total ?? produtos.length;

  return {
    dados: produtos,
    paginacao: {
      pagina,
      tamanho,
      total: quantidade,
      total_paginas: Math.max(1, Math.ceil(quantidade / tamanho)),
    },
  };
}
