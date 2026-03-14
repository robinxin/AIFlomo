export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.js',
    '!**/node_modules/**',
    // Exclude CLI entry points — these are thin wrappers that start the server
    // or run migrations; they cannot be unit-tested without side effects.
    '!src/main.js',
    '!src/db/migrate.js',
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
