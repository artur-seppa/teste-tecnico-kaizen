import { defineConfig, mergeConfig } from 'vitest/config';
import configVite from './vite.config.js';

// Reaproveita plugins e resolucao do vite.config.js: o teste roda o mesmo
// pipeline de transformacao que o `npm run dev`.
export default mergeConfig(
  configVite,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./test/setup.js'],
      include: ['test/**/*.test.{js,jsx}'],
    },
  }),
);
