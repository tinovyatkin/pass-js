module.exports = {
  collectCoverage: true,
  verbose: true,
  coverageReporters: ['text', 'json', 'cobertura', 'lcov'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended'],
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.sonarlint/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.vscode/'
  ]
};
