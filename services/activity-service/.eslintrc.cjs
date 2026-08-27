/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    parser: '@typescript-eslint/parser',
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    ignorePatterns: ['node_modules/', 'coverage/', 'dist/'],
    rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-unused-vars': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'prefer-const': 'off',
        '@typescript-eslint/no-explicit-any': 'off'
    },
};
