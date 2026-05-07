/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
    },
    ignorePatterns: ['node_modules/', 'coverage/'],
    rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-console': 'off',
    },
};
