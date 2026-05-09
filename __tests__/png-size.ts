import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import {
  readPngDimensions,
  readPngDimensionsFromFile,
} from '../dist/lib/png-size.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, './resources/icon.png');

describe('png-size', () => {
  it('readPngDimensions returns width/height for a real PNG', () => {
    const buf = readFileSync(FIXTURE);
    const { width, height } = readPngDimensions(buf);
    assert.equal(typeof width, 'number');
    assert.equal(typeof height, 'number');
    assert.ok(width > 0 && height > 0);
  });

  it('readPngDimensionsFromFile round-trips with readPngDimensions', async () => {
    const buf = readFileSync(FIXTURE);
    const fromBuf = readPngDimensions(buf);
    const fromFile = await readPngDimensionsFromFile(FIXTURE);
    assert.deepEqual(fromBuf, fromFile);
  });

  it('rejects a buffer smaller than 24 bytes', () => {
    assert.throws(
      () => readPngDimensions(Buffer.alloc(16)),
      /buffer too short/,
    );
  });

  it('rejects a buffer with wrong magic bytes', () => {
    const buf = Buffer.alloc(32, 0);
    // PDF magic "%PDF-1.4"
    buf.write('%PDF-1.4', 0);
    assert.throws(() => readPngDimensions(buf), /magic bytes/);
  });

  it('rejects a PNG whose IHDR chunk is misaligned', () => {
    // Valid magic bytes but bytes 12..15 are NOT "IHDR".
    const buf = Buffer.alloc(32, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    buf.write('IEND', 12);
    assert.throws(() => readPngDimensions(buf), /IHDR chunk missing/);
  });

  it('rejects zero-width or zero-height claims', () => {
    const buf = Buffer.alloc(32, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    buf.write('IHDR', 12);
    // width=0 by leaving buffer zeroed; height=0 too
    assert.throws(() => readPngDimensions(buf), /invalid dimensions 0x0/);
  });

  it('reads a synthesized 1×1 PNG header', () => {
    const buf = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    // IHDR length (4 bytes) — not inspected, can be anything
    buf.writeUInt32BE(13, 8);
    buf.write('IHDR', 12);
    buf.writeUInt32BE(1, 16);
    buf.writeUInt32BE(1, 20);
    const dims = readPngDimensions(buf);
    assert.deepEqual(dims, { width: 1, height: 1 });
  });

  it('rejects a truncated file via the streaming reader', async () => {
    // Point at a tiny text file that clearly isn't a PNG.
    await assert.rejects(
      () => readPngDimensionsFromFile(path.resolve(__dirname, '../.npmrc')),
      /PNG/,
    );
  });
});
