module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'airbnb-typescript/base',
  ],
  parserOptions: {
    'ecmaVersion': 2020,
    'project': './tsconfig.json',
  },
};
