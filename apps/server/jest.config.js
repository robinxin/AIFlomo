export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.js',
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
  testEnvironmentOptions: {
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      // TEST-ONLY fallback — never reuse this value in production
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'test-only-fallback-do-not-use-in-prod!!',
    },
  },
};
