'use strict';

const getBufferHash = require('./getBufferHash');
const { readFile } = require('fs');
const { promisify } = require('util');

const readFileAsync = promisify(readFile);

/**
 * Reads file and returns it content as buffer and hash as hex string
 * 
 * @param {string} filename - full fill name
 * @param {string} name - alias or basename of file for archive
 * @returns {{filename: string, content: Buffer, hash: string}}
 */
async function readAndHashFile(filename, name = filename) {
  const content = await readFileAsync(filename);
  const hash = getBufferHash(content);
  return { name, content, hash };
}
module.exports = readAndHashFile;
