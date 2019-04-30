'use strict';

import { promises as fs } from 'fs';

import { getBufferHash } from './getBufferHash';

/**
 * Reads file and returns it content as buffer and hash as hex string
 *
 * @param {string} filename - full fill name
 * @param {string} [name] - alias or basename of file for archive
 * @returns {Promise.<{name: string, content: Buffer, hash: string}>}
 */
export async function readAndHashFile(
  filename: string,
  name: string,
): Promise<{ name: string; content: Buffer; hash: string }> {
  const content = await fs.readFile(filename);
  const hash = getBufferHash(content);
  return { name, content, hash };
}
