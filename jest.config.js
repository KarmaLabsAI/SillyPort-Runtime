module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/browser/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000, // 30 second timeout for browser tests
  // Only run browser-specific tests
  testPathIgnorePatterns: [
    '/node_modules/',
    // Skip Node.js tests
    'tests/node/',
    // Skip SillyTavern backup tests
    '.project/sources/sillytavern-backup/'
  ]
}; 