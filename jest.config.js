module.exports = {
  collectCoverage: true,
  verbose: true,
  coverageReporters: ['text', 'json', 'html', 'cobertura'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.sonarlint/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.vscode/',
  ],
};
