export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**'],
  },
  {
    files: ['app/**/*.jsx', 'components/**/*.jsx', 'context/**/*.jsx', 'lib/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        document: 'readonly',
        window: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];
