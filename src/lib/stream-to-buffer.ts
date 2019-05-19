import { Readable } from 'stream';

/**
 *  Converts readableStream into a Buffer
 *
 * @param {Readable} readableStream
 * @returns {Promise<Buffer>}
 */
export async function streamToBuffer(
  readableStream: Readable,
): Promise<Buffer> {
  const buf = [];
  for await (const data of readableStream) {
    buf.push(data);
  }
  return Buffer.concat(buf);
}
