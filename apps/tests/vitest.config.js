import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.config.js',
        'vitest.setup.js',
        '**/*.test.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../'), // 指向 apps/ 目录
    },
  },
});
