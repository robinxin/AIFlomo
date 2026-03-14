export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.js',
    '!**/node_modules/**',
    '!src/db/migrations/**',
    '!src/db/migrate.js',
    '!src/db/reset.js',
    '!src/db/index.js',       // DB access layer (integration-level, tested via mocks)
    '!src/plugins/session.js', // Session plugin (integration-level)
    '!src/index.js',           // Server entry point (integration-level)
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Disable transforms - use native ESM with --experimental-vm-modules
  transform: {},
  injectGlobals: true,
};
