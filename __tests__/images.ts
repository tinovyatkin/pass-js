'use strict';

import * as path from 'path';

import { PassImages } from '../src/lib/images';

describe('PassImages', () => {
  it('has class properties', () => {
    const img = new PassImages();
    expect(img.load).toBeInstanceOf(Function);
  });

  it('reads all images from directory without localized images', async () => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, '../images/');
    await img.load(imgDir);
    expect(img.count).toBe(18);
  });

  it('should read localized images', async () => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, './resources/passes/Generic');
    await img.load(imgDir);
    expect(img.count).toBe(5);
    const arr = await img.toArray();
    expect(arr).toBeInstanceOf(Array);
    expect(arr.map(f => f.path)).toMatchSnapshot();
  });
});
