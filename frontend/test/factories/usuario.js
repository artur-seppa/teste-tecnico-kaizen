import { faker } from '@faker-js/faker';

/** Usuario como o backend devolve em GET /auth/eu. */
export function usuarioFactory(atributos = {}) {
  return {
    id: 1,
    nome: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    documento: faker.string.numeric(11),
    telefone: faker.string.numeric(11),
    criado_em: faker.date.past().toISOString(),
    ...atributos,
  };
}
