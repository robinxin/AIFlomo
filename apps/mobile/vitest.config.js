import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { transformWithEsbuild } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pre-plugin: transform .js files that contain JSX before vite:import-analysis runs
const jsxInJsPlugin = {
  name: 'jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.endsWith('.js')) return null;
    // Only transform files that contain JSX angle brackets
    if (!code.includes('<') || (!code.includes('/>') && !code.includes('</'))) return null;
    try {
      const result = await transformWithEsbuild(code, id, {
        loader: 'jsx',
        jsx: 'automatic',
      });
      return result;
    } catch {
      return null;
    }
  },
};

export default defineConfig({
  plugins: [jsxInJsPlugin, react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '__mocks__/',
        'vitest.config.js',
        'lib/api-client.js',
      ],
    },
  },
  resolve: {
    alias: {
      // Map react-native to web stub for jsdom test environment
      'react-native': path.resolve(__dirname, '__mocks__/react-native.js'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
