export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  setupFiles: ['./tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.js',
    '!src/index.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
