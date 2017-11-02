'use strict';

const { createHash } = require('crypto');

function getBufferHash(buffer) {
  // creating hash
  const sha = createHash('sha1');
  sha.update(buffer);
  return sha.digest('hex');
}

module.exports = getBufferHash;
