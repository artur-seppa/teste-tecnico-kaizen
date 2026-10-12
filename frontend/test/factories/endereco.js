import { faker } from '@faker-js/faker';

/** Endereco como o backend devolve em GET /enderecos. */
export function enderecoFactory({ id, apelido, principal = false, ...resto } = {}) {
  return {
    id,
    apelido,
    cep: '01310-100',
    logradouro: faker.location.street(),
    numero: String(faker.number.int({ min: 1, max: 9999 })),
    complemento: null,
    bairro: faker.location.county(),
    cidade: faker.location.city(),
    uf: 'SP',
    principal,
    ...resto,
  };
}
