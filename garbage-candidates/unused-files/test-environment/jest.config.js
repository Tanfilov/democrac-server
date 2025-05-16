/**
 * Jest configuration for the test environment
 */

module.exports = {
  // The root directory where Jest should scan for tests
  rootDir: '.',
  
  // The test environment to use
  testEnvironment: 'node',
  
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/test/**/*.test.js'
  ],
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // An array of file extensions your modules use
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],
  
  // Optional: Set a different timeout for tests
  testTimeout: 10000,
  
  // A path to a module which exports a setup function for the test framework
  // setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // Custom reporter for test results
  reporters: [
    'default'
  ]
}; 