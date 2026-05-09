import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PassImages, IMAGE_FILENAME_REGEX } from '../dist/lib/images.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('PassImages', () => {
  it('IMAGE_FILENAME_REGEX', () => {
    assert.match('logo.png', IMAGE_FILENAME_REGEX);
    assert.match('Somefolder/logo.png', IMAGE_FILENAME_REGEX);
    assert.doesNotMatch('byakablogo.png', IMAGE_FILENAME_REGEX);
    assert.match('icon@2x.png', IMAGE_FILENAME_REGEX);
    assert.match('thumbnail@3x.png', IMAGE_FILENAME_REGEX);
    assert.doesNotMatch('logo@4x', IMAGE_FILENAME_REGEX);
    assert.doesNotMatch('byaka.png', IMAGE_FILENAME_REGEX);
    assert.doesNotMatch('logo.jpg', IMAGE_FILENAME_REGEX);
  });

  it('parseFilename', () => {
    const img = new PassImages();
    assert.deepEqual(img.parseFilename('logo.png'), { imageType: 'logo' });
    assert.deepEqual(img.parseFilename('icon@2x.png'), {
      imageType: 'icon',
      density: '2x',
    });
    assert.equal(img.parseFilename('logo.jpg'), undefined);
  });

  it('has class methods', () => {
    const img = new PassImages();
    assert.equal(typeof img.load, 'function');
    assert.equal(typeof img.add, 'function');
  });

  it('reads all images from directory without localized images', async () => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, '../images/');
    await img.load(imgDir);
    assert.equal(img.size, 18);
  });

  it('disableImageCheck skips dimension validation', async () => {
    const img = new PassImages();
    // A 1x1 PNG that would fail normal icon dimension checks
    const tinyPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    // Without the flag: throws on dimension mismatch
    await assert.rejects(() => img.add('icon', tinyPng));
    // With the flag: accepts any dimensions
    await assert.doesNotReject(() =>
      img.add('icon', tinyPng, undefined, undefined, true),
    );
    assert.equal(img.size, 1);
  });

  it('reads localized images', async t => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, './resources/passes/Generic');
    await img.load(imgDir);
    assert.equal(img.size, 5);
    const arr = await img.toArray();
    assert.ok(Array.isArray(arr));
    t.assert.snapshot(
      arr.map(f => f.path).toSorted((a, b) => a.localeCompare(b)),
    );
  });
});
