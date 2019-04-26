'use strict';

const { readFile } = require('fs').promises;

const getBufferHash = require('./getBufferHash');

/**
 * Reads file and returns it content as buffer and hash as hex string
 *
 * @param {string} filename - full fill name
 * @param {string} name - alias or basename of file for archive
 * @returns {Promise.<{name: string, content: Buffer, hash: string}>}
 */
async function readAndHashFile(filename, name = filename) {
  const content = await readFile(filename);
  const hash = getBufferHash(content);
  return { name, content, hash };
}
module.exports = readAndHashFile;
