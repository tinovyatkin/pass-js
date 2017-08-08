'use strict';

module.exports = () => ({
  files: ['src/**/*.js', '__tests__/resources/*', 'keys/*'],

  tests: ['__tests__/*.js'],

  env: {
    type: 'node',
    runner: 'node',
  },

  testFramework: 'jest',

  setup(wallaby) {
    const jestConfig = require('./package.json').jest;
    wallaby.testFramework.configure(jestConfig);
  },
});
