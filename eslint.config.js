const eslintConfigPrettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(...tseslint.configs.recommended, eslintConfigPrettier, {
  ignores: ['lib/**', 'node_modules/**', 'dist/**', 'coverage/**', '.turbo/**'],
});
