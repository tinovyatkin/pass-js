'use strict';

module.exports = {
  '*.ts': [
    'eslint --fix --quiet -f visualstudio',
    'prettier --write',
    'git add',
    'node -r env-app-yaml/config --max_old_space_size=2048 --expose-gc node_modules/jest/bin/jest --maxWorkers=2 --silent --forceExit --errorOnDeprecated --ci --bail --findRelatedTests',
  ],
  '.app.yml': ['git rm'],
  '*.{yaml,yml}': ['prettier --write', 'git add'],
  '*.{md,json}': ['prettier --write', 'git add'],

  '.codecov.yml': () =>
    'curl -f --silent --data-binary @.codecov.yml https://codecov.io/validate',
};
