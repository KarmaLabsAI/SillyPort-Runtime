module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/node/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.node.js'],
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000, // 10 second timeout
  // Only run Node.js-safe tests
  testPathIgnorePatterns: [
    '/node_modules/',
    // Skip browser-specific tests
    'tests/browser/',
    // Skip SillyTavern backup tests (browser-specific)
    '.project/sources/sillytavern-backup/'
  ]
}; 