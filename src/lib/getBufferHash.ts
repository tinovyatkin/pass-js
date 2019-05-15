'use strict';

import { createHash } from 'crypto';

/**
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
export function getBufferHash(buffer: Buffer | string): string {
  // creating hash
  const sha = createHash('sha1');
  sha.update(buffer);
  return sha.digest('hex');
}
