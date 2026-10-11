import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/*
 * Lint como ferramenta de deteccao de defeito, nao de estilo. Ver o comentario
 * equivalente em backend/eslint.config.js.
 *
 * O plugin de hooks entra porque dependencia faltando em useEffect/useMemo e
 * uma das poucas classes de bug de React que da para pegar estaticamente - e
 * costuma se manifestar como "a tela nao atualiza", que e justamente o tipo de
 * sintoma que chega pelo suporte.
 */
export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  js.configs.recommended,
  {
    // vite.config.js roda no Node, nao no navegador. Sem isto ele seria
    // checado contra os globais errados: hoje passa por sorte, porque nao usa
    // nenhum, mas qualquer process.env adicionado ali viraria erro falso.
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Desligada de proposito. Ela acusa o padrao "busca dados ao montar e
      // guarda no estado", que e como todas as paginas de dados deste projeto
      // sao escritas. E regra de idioma, nao de defeito: como erro, o lint
      // nunca passaria e viraria ruido que todo mundo ignora.
      // As regras que pegam bug - rules-of-hooks e exhaustive-deps - seguem
      // ligadas, e hoje nao acusam nada.
      'react-hooks/set-state-in-effect': 'off',

      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
    },
  },
];
