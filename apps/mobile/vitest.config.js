import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.js', 'context/**/*.jsx', 'components/**/*.jsx'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'app/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    // React Native module resolution
    alias: {
      'react-native': 'react-native-web',
    },
  },
});
