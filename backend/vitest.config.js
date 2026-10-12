import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],

    // `config.js` le o ambiente na importacao. Definir aqui evita que o teste
    // precise mexer em process.env e adiar imports. ERP_URL aponta para um
    // endereco morto: teste que escapar do mock falha em vez de bater no ERP.
    env: {
      NODE_ENV: 'test',
      ERP_URL: 'http://127.0.0.1:1',
      ERP_TOKEN: 'token-de-teste',
      ERP_TIMEOUT_MS: '2000',
      JWT_SEGREDO: 'segredo-de-teste-com-pelo-menos-32-caracteres',
      DB_PATH: ':memory:',
    },
  },
});
