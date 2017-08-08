'use strict';

const Template = require('../src/template');

describe('Template', () => {
  test('should throw an error on unsupported type', () => {
    expect(() => new Template('discount')).toThrow();
  });

  test('fields', () => {
    const originalFields = {
      passTypeIdentifier: 'com.example.passbook',
    };
    const templ = new Template('coupon', originalFields);
    expect(templ.passTypeIdentifier()).toBe('com.example.passbook');
    templ.passTypeIdentifier('com.byaka.buka');
    expect(templ.passTypeIdentifier()).toBe('com.byaka.buka');
    expect(originalFields.passTypeIdentifier).toBe('com.example.passbook');

    // should not change when original object changes'
    originalFields.passTypeIdentifier = 'com.example.somethingelse';
    expect(templ.passTypeIdentifier()).toBe('com.byaka.buka');
  });
});
