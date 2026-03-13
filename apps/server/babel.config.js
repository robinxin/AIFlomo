/**
 * Babel configuration for Jest — converts ESM to CJS for test execution.
 *
 * Source files use ESM (import/export), but Jest's mocking system works more
 * reliably with CJS. babel-jest uses this config to transform both source and
 * test files so that jest.mock() hoisting works as expected.
 */
export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: 'commonjs',
      },
    ],
  ],
};
