/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', 'migrations.integration.test.js'],
};
