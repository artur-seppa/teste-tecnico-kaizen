import { faker } from '@faker-js/faker';

/** Linha da tabela `usuarios`. A senha ja vai como hash de mentira: nenhum teste deste arquivo faz login. */
export function usuarioFactory({ id = 1, ...resto } = {}) {
  const agora = faker.date.past().toISOString();

  return {
    id,
    nome: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    senha_hash: 'hash-de-teste',
    documento: faker.string.numeric(11),
    telefone: faker.string.numeric(11),
    criado_em: agora,
    atualizado_em: agora,
    ...resto,
  };
}
