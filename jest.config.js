module.exports = {
  collectCoverage: true,
  verbose: true,
  coverageReporters: ['text', 'json', 'html', 'cobertura'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.sonarlint/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.vscode/',
  ],
  globals: {
    'ts-jest': {
      diagnostics: {
        ignoreCodes: [2571, 2345, 6031, 18003],
      },
    },
  },
};
