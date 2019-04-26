'use strict';

const path = require('path');

const PassImages = require('../src/lib/images');

describe('PassImages', () => {
  it('have class properties', () => {
    const img = new PassImages();
    expect(img).toHaveProperty('background');
    expect(img).toHaveProperty('footer2x');
    expect(img.loadFromDirectory).toBeInstanceOf(Function);
  });

  it('images setter and getter', () => {
    const img = new PassImages();
    img.background = 'testBackground';
    img.background2x = 'testBackground2x';
    expect(img.background).toBe('testBackground');
    expect(img.background2x).toBe('testBackground2x');
    expect(img.background3x).toBeUndefined();
  });

  it('reading images from directory', async () => {
    const img = new PassImages();
    await img.loadFromDirectory(path.resolve(__dirname, '../images/'));
    expect(img.map.size).toBe(6);
    // ensure it loaded all dimensions for all images
    for (const variations of img.map.values()) {
      expect(variations).toBeInstanceOf(Map);
      expect(variations.size).toBe(3);
    }

    // relative path
  });
});
