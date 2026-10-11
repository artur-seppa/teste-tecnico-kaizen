import js from '@eslint/js';
import globals from 'globals';

/*
 * Lint como ferramenta de deteccao de defeito, nao de estilo.
 *
 * Nao ha regra de formatacao aqui de proposito: reformatar o projeto inteiro
 * produziria um diff enorme que soterraria as correcoes de verdade. As regras
 * abaixo so acusam coisa que pode quebrar em producao.
 */
export default [
  {
    ignores: ['node_modules/**', 'data/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Variavel ou import que sobrou costuma ser resto de refatoracao - e as
      // vezes a pista de uma linha que deixou de ser executada.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Leitura seguida de escrita em codigo async: fonte classica de perda de
      // atualizacao quando duas requisicoes correm juntas.
      'require-atomic-updates': 'error',

      // Desligada de proposito. Middleware de Express retorna res.json() num
      // ramo e chama next() noutro - padrao correto do framework que a regra
      // acusa como inconsistencia. Acusou 4 vezes, todas falso positivo.
      'consistent-return': 'off',

      // == entre tipos diferentes esconde coercao silenciosa. O projeto ja usa
      // === em todo lugar; fica como trava para o que vier depois.
      eqeqeq: ['error', 'smart'],

      // O projeto usa console de proposito para log de servidor.
      'no-console': 'off',
    },
  },
];
