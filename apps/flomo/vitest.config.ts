import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/prisma.ts'],
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 0,
        statements: 10,
      },
    },
  },
});
