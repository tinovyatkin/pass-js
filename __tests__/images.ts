'use strict';

import * as path from 'path';

import { PassImages, IMAGE_FILENAME_REGEX } from '../src/lib/images';

describe('PassImages', () => {
  it('IMAGE_FILENAME_REGEX', () => {
    expect('logo.png').toMatch(IMAGE_FILENAME_REGEX);
    expect('Somefolder/logo.png').toMatch(IMAGE_FILENAME_REGEX);
    expect('byakablogo.png').not.toMatch(IMAGE_FILENAME_REGEX);
    expect('icon@2x.png').toMatch(IMAGE_FILENAME_REGEX);
    expect('thumbnail@3x.png').toMatch(IMAGE_FILENAME_REGEX);
    expect('logo@4x').not.toMatch(IMAGE_FILENAME_REGEX);
    expect('byaka.png').not.toMatch(IMAGE_FILENAME_REGEX);
    expect('logo.jpg').not.toMatch(IMAGE_FILENAME_REGEX);
  });

  it('parseFilename', () => {
    const img = new PassImages();
    expect(img.parseFilename('logo.png')).toEqual({
      imageType: 'logo',
    });
    expect(img.parseFilename('icon@2x.png')).toEqual({
      imageType: 'icon',
      density: '2x',
    });
    expect(img.parseFilename('logo.jpg')).toBeUndefined();
  });

  it('has class properties', () => {
    const img = new PassImages();
    expect(img.load).toBeInstanceOf(Function);
    expect(img.add).toBeInstanceOf(Function);
  });

  it('reads all images from directory without localized images', async () => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, '../images/');
    await img.load(imgDir);
    expect(img.size).toBe(18);
  });

  it('should read localized images', async () => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, './resources/passes/Generic');
    await img.load(imgDir);
    expect(img.size).toBe(5);
    const arr = await img.toArray();
    expect(arr).toBeInstanceOf(Array);
    expect(arr.map(f => f.path).sort()).toMatchSnapshot();
  });
});
