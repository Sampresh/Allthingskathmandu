import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['node_modules/**', 'src/generated/**', 'coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': 'error',
    },
  },
  {
    // CLI scripts report progress on stdout.
    files: ['prisma/seed.js', 'scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
]
