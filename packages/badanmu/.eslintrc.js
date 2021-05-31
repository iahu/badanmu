module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    indent: ['warn', 2, { SwitchCase: 1 }],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    'prefer-const': ['warn'],
    'no-control-regex': 'off',
  },
  overrides: [
    {
      files: ['lib.js', 'kuaishou/*.js'],
      rules: {
        semi: 'off',
        quotes: 'off',
        'no-func-assign': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        'no-global-assign': 'off',
        '@typescript-eslint/no-this-alias': 'off',
      },
    },
  ],
}
