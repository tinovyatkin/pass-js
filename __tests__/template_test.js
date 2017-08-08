'use strict';

const Template = require('../src/template');

const originalFields = {
  passTypeIdentifier: 'com.example.passbook',
};

describe('Template', () => {
  test('should throw an error on unsupported type', () => {
    expect(() => new Template('discount')).toThrow();
  });

  test('fields', () => {
    const templ = new Template('coupon', originalFields);
    expect(templ.passTypeIdentifier()).toBe('com.example.passbook');
    templ.passTypeIdentifier('com.byaka.buka');
    expect(templ.passTypeIdentifier()).toBe('com.byaka.buka');
    expect(originalFields.passTypeIdentifier).toBe('com.example.passbook');

    // should not change when original object changes'
    originalFields.passTypeIdentifier = 'com.example.somethingelse';
    expect(templ.passTypeIdentifier()).toBe('com.byaka.buka');
  });

  test('webServiceURL', () => {
    const templ = new Template('coupon', originalFields);
    expect(() =>
      templ.webServiceURL('https://transfers.do/webservice'),
    ).not.toThrow();
    // should throw on bad url
    expect(() => templ.webServiceURL('/webservice')).toThrow();
  });

  test('color values as RGB triplets', () => {
    const templ = new Template('coupon', originalFields);
    expect(() => templ.backgroundColor('rgb(125, 125,0)')).not.toThrow();
    // should throw on bad url
    expect(() => templ.labelColor('rgba(33, 344,3)')).toThrow();
    expect(() => templ.foregroundColor('rgb(33, 0,287)')).toThrow(
      'Invalid color value',
    );
  });
});
