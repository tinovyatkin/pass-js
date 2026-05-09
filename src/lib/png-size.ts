// Minimal PNG dimensions reader for .pkpass bundles.
//
// Apple requires all pkpass image assets to be PNG; the library enforces
// this in images.ts#checkImage. We only need width/height and don't care
// about the full pixel data, so the 24-byte prefix is sufficient.
//
// Replaces the stale `imagesize` npm dep (2013, last touched 2022, still
// uses deprecated `new Buffer()`). ~30 LOC vs. 305, PNG-specific, no
// streaming state machine.
//
// PNG spec (W3C PNG 2nd ed. §5 / RFC 2083):
//   0..7     8-byte magic:  89 50 4E 47 0D 0A 1A 0A
//   8..11    IHDR chunk length (big-endian uint32, always 13)
//   12..15   'IHDR'
//   16..19   width  (big-endian uint32)
//   20..23   height (big-endian uint32)

import { createReadStream } from 'node:fs';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR_OFFSET = 12;
const IHDR_MAGIC = Buffer.from('IHDR', 'ascii');
const MIN_BYTES = 24;

export interface PngDimensions {
  width: number;
  height: number;
}

// Synchronously extracts PNG width/height from a Buffer. Throws TypeError
// if the input isn't a valid PNG header.
export function readPngDimensions(buf: Buffer): PngDimensions {
  if (buf.length < MIN_BYTES) {
    throw new TypeError(
      `Not a PNG: buffer too short (${buf.length} < ${MIN_BYTES} bytes)`,
    );
  }
  if (buf.compare(PNG_MAGIC, 0, PNG_MAGIC.length, 0, PNG_MAGIC.length) !== 0) {
    throw new TypeError('Not a PNG: magic bytes do not match');
  }
  if (
    buf.compare(
      IHDR_MAGIC,
      0,
      IHDR_MAGIC.length,
      IHDR_OFFSET,
      IHDR_OFFSET + IHDR_MAGIC.length,
    ) !== 0
  ) {
    throw new TypeError('Not a PNG: IHDR chunk missing or misaligned');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width === 0 || height === 0) {
    throw new TypeError(`Not a PNG: invalid dimensions ${width}x${height}`);
  }
  return { width, height };
}

// Reads only the first 24 bytes from disk to determine PNG dimensions.
// Uses the same tiny highWaterMark pattern as the original imagesize
// stream path so we don't pull the whole image into memory just to read
// two uint32s.
export async function readPngDimensionsFromFile(
  filePath: string,
): Promise<PngDimensions> {
  return new Promise<PngDimensions>((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: 32, end: 31 });
    const chunks: Buffer[] = [];
    let total = 0;
    // createReadStream without an encoding always emits Buffer chunks.
    stream.on('data', chunk => {
      const buf = chunk as Buffer;
      chunks.push(buf);
      total += buf.length;
      if (total >= MIN_BYTES) {
        stream.destroy();
        try {
          resolve(readPngDimensions(Buffer.concat(chunks)));
        } catch (err) {
          reject(err);
        }
      }
    });
    stream.once('error', reject);
    stream.once('end', () => {
      if (total < MIN_BYTES) {
        reject(
          new TypeError(
            `Not a PNG: file truncated (${total} < ${MIN_BYTES} bytes)`,
          ),
        );
      }
    });
  });
}
