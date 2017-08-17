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
    // color-string reduces maximum to 255 but still generates the color
    expect(() => templ.labelColor('rgba(33, 344,3)')).not.toThrow();
    expect(() => templ.foregroundColor('rgb(33, 0,287)')).not.toThrow();
    // should convert values to rgb
    templ.foregroundColor('white');
    expect(templ.foregroundColor()).toBe('rgb(255, 255, 255)');
    // should throw on bad color
    expect(() => templ.foregroundColor('byaka a ne color')).toThrow(
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

  /*
  test('push updates', async () => {
    const template = new Template('coupon', {
      passTypeIdentifier: 'pass.com.example.passbook',
      teamIdentifier: 'MXL',
      labelColor: 'red',
    });

    template.keys(`${__dirname}/../keys`, 'secret');

    const res = await template.pushUpdates(
      '0e40d22a36e101a59ab296d9e6021df3ee1dcf95e29e8ab432213b12ba522dbb',
    );
    console.log(JSON.stringify(res));
    // shutting down APN
    if (template.apn) template.apn.shutdown();
    expect(res.sent).toBeInstanceOf(Array);
    expect(res.sent).toHaveLength(1);
  });
  */
});
