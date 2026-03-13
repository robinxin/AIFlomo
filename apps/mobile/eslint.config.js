export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.expo/**'],
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        React: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(React|View|Text|TextInput|TouchableOpacity|ScrollView|ActivityIndicator|Slot|AuthProvider|RouteGuard|AuthFormInput|AuthFormError|AuthSubmitButton|PrivacyCheckbox)$'
      }],
      'no-console': 'off',
      'prefer-const': 'error',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
];
