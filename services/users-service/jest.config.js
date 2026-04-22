/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    // Las migraciones requieren Postgres; se ejecutan con: npm run test:migrations
    testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/src/__tests__/migrations.integration.test.js',
    ],
};
