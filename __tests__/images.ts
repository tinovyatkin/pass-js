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

  it('reads localized images', async (t) => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, './resources/passes/Generic');
    await img.load(imgDir);
    assert.equal(img.size, 5);
    const arr = await img.toArray();
    assert.ok(Array.isArray(arr));
    t.assert.snapshot(
      arr.map((f) => f.path).sort((a, b) => a.localeCompare(b)),
    );
  });
});
