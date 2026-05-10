// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

// Minimal PNG dimensions reader for .pkpass bundles.
//
// Apple requires all pkpass image assets to be PNG; the library enforces
// this in images.ts#checkImage. We only need width/height and don't care
// about the full pixel data, so the 24-byte prefix is sufficient.
//
// PNG spec (W3C PNG 2nd ed. §5 / RFC 2083):
//   0..7     8-byte magic:  89 50 4E 47 0D 0A 1A 0A
//   8..11    IHDR chunk length (big-endian uint32, always 13)
//   12..15   'IHDR'
//   16..19   width  (big-endian uint32)
//   20..23   height (big-endian uint32)

import { open } from 'node:fs/promises';

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

// Reads only the 24-byte PNG header slice from disk to determine dimensions.
export async function readPngDimensionsFromFile(
  filePath: string,
): Promise<PngDimensions> {
  await using file = await open(filePath, 'r');
  const header = Buffer.allocUnsafe(MIN_BYTES);
  let total = 0;
  while (total < MIN_BYTES) {
    const { bytesRead } = await file.read(
      header,
      total,
      MIN_BYTES - total,
      total,
    );
    if (bytesRead === 0) break;
    total += bytesRead;
  }
  if (total < MIN_BYTES) {
    throw new TypeError(
      `Not a PNG: file truncated (${total} < ${MIN_BYTES} bytes)`,
    );
  }
  return readPngDimensions(header);
}
