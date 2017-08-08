'use strict';

module.exports = () => ({
  files: [
    'src/**/*.js',
    { pattern: '__tests__/resources/**/*', instrument: false },
    { pattern: 'keys/*', instrument: false },
  ],

  tests: ['__tests__/*.js'],

  env: {
    type: 'node',
    runner: 'node',
  },

  testFramework: 'jest',

  setup(wallaby) {
    /* eslint-disable */
    wallaby.testFramework.configure(require('./package').jest);
  },
});
