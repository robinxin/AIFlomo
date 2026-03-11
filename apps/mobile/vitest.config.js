import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      include: [
        'components/**/*.{js,jsx}',
        'context/**/*.{js,jsx}',
        'hooks/**/*.{js,jsx}',
        'lib/**/*.{js,jsx}',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'app/',
      ],
    },
  },
});
