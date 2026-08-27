/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
    rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['off', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        'prefer-const': 'off',
        '@typescript-eslint/no-require-imports': 'off'
    },
};
