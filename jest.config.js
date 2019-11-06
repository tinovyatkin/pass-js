module.exports = {
  collectCoverage: true,
  verbose: true,
  coverageReporters: ['text', 'json', 'cobertura', 'lcov'],
  moduleFileExtensions: ['ts', 'js'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended'],
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
        ignoreCodes: [
          2571,
          2532,
          2488,
          2322,
          2339,
          2345,
          6031,
          6133,
          7006,
          18003,
        ],
      },
    },
  },
};
