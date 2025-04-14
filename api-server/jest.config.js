module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'index.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/coverage/**'
  ],
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  testTimeout: 10000, // 10 seconds
  setupFilesAfterEnv: ['./tests/jest.setup.js']
};