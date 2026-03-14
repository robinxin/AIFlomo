export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.js',
    '!**/node_modules/**',
    // Exclude server entry point — cannot be unit tested without starting a real server
    '!src/index.js',
    // Exclude database connection layer — requires real SQLite at runtime
    '!src/db/index.js',
    // Exclude session plugin — requires real @fastify/session and connect-sqlite3 at runtime
    '!src/plugins/session.js',
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
