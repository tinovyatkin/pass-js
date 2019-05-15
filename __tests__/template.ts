import * as path from 'path';

import { Template } from '../src/template';

const originalFields = {
  passTypeIdentifier: 'com.example.passbook',
};

describe('Template', () => {
  it('should throw an error on unsupported type', () => {
    // @ts-ignore
    expect(() => new Template('discount')).toThrow();
  });

  it('fields', () => {
    const templ = new Template('coupon', originalFields);
    expect(templ.passTypeIdentifier).toBe('com.example.passbook');
    templ.passTypeIdentifier = 'com.byaka.buka';
    expect(templ.passTypeIdentifier).toBe('com.byaka.buka');
    expect(originalFields.passTypeIdentifier).toBe('com.example.passbook');

    // should not change when original object changes'
    originalFields.passTypeIdentifier = 'com.example.somethingelse';
    expect(templ.passTypeIdentifier).toBe('com.byaka.buka');
  });

  it('webServiceURL', () => {
    const templ = new Template('coupon', originalFields);
    expect(() => {
      templ.webServiceURL = 'https://transfers.do/webservice';
    }).not.toThrow();
    // should throw on bad url
    expect(() => {
      templ.webServiceURL = '/webservice';
    }).toThrow();
  });

  it('color values as RGB triplets', () => {
    const templ = new Template('coupon', originalFields);
    expect(() => {
      templ.backgroundColor = 'rgb(125, 125,0)';
    }).not.toThrow();
    // color-string reduces maximum to 255 but still generates the color
    expect(() => {
      templ.labelColor = 'rgba(33, 344,3)';
    }).not.toThrow();
    expect(() => {
      templ.foregroundColor = 'rgb(33, 0,287)';
    }).not.toThrow();
    // should convert values to rgb
    templ.foregroundColor = 'white';
    expect(templ.foregroundColor).toEqual([255, 255, 255]);
    // should throw on bad color
    expect(() => {
      templ.foregroundColor = 'byaka a ne color';
    }).toThrow('Invalid color value');
  });

  it('loading template from a folder', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/BoardingPass.pass'),
    );
    expect(templ.passTypeIdentifier).toBe('pass.com.apple.devpubs.example');
    expect(templ.images.count).toBe(4);

    const templ2 = await Template.load(
      path.resolve(__dirname, './resources/passes/Event.pass'),
    );
    expect(templ2.teamIdentifier).toBe('A93A5CM278');
    expect(templ2.images.count).toBe(8);
  });

  it('push updates', async () => {
    const template = new Template('coupon', {
      passTypeIdentifier: 'pass.com.example.passbook',
      teamIdentifier: 'MXL',
      // labelColor: 'red',
    });

    template.setCertificate(process.env.APPLE_PASS_CERTIFICATE as string);
    template.setPrivateKey(
      process.env.APPLE_PASS_PRIVATE_KEY as string,
      process.env.APPLE_PASS_KEY_PASSWORD,
    );

    const res = await template.pushUpdates(
      '0e40d22a36e101a59ab296d9e6021df3ee1dcf95e29e8ab432213b12ba522dbb',
    );
    // if (template.apn) template.apn.destroy();
    expect(res).toEqual(
      expect.objectContaining({
        ':status': 200,
        'apns-id': expect.any(String),
      }),
    );
  });
});
