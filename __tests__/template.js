'use strict';

const Template = require('../src/template');
const path = require('path');

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

  test('loading template from a folder', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/BoardingPass.pass'),
    );
    expect(templ.passTypeIdentifier()).toBe('pass.com.apple.devpubs.example');
    expect(templ.images.logo2x).toBeDefined();

    const templ2 = await Template.load(
      path.resolve(__dirname, './resources/passes/Event.pass'),
    );
    expect(templ2.teamIdentifier()).toBe('A93A5CM278');
    expect(templ2.images.thumbnail).toBeDefined();
  });
});
