'use strict';

const PassImages = require('../lib/images');

describe('PassImages', () => {
  test('Class properties', () => {
    const img = new PassImages();
    expect(img).toHaveProperty('background');
    expect(img).toHaveProperty('footer2x');
    expect(img.loadFromDirectory).toBeInstanceOf(Function);
  });

  test('images setter and getter', () => {
    const img = new PassImages();
    img.background = 'testBackground';
    img.background2x = 'testBackground2x';
    expect(img.background).toBe('testBackground');
    expect(img.background2x).toBe('testBackground2x');
    expect(img.background3x).toBeUndefined();
  });
});
