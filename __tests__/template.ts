import * as path from 'path';
import { readFileSync } from 'fs';

import { Template } from '../src/template';

const originalFields = {
  passTypeIdentifier: 'com.example.passbook',
};

describe('Template', () => {
  it('should throw an error on unsupported type', () => {
    // @ts-ignore
    expect(() => new Template('discount')).toThrow();
  });

  it('doesn`t mutate fields', () => {
    const templ = new Template('coupon', originalFields);
    expect(templ.passTypeIdentifier).toBe('com.example.passbook');
    templ.passTypeIdentifier = 'com.byaka.buka';
    expect(templ.passTypeIdentifier).toBe('com.byaka.buka');
    expect(originalFields.passTypeIdentifier).toBe('com.example.passbook');

    // should not change when original object changes'
    originalFields.passTypeIdentifier = 'com.example.somethingelse';
    expect(templ.passTypeIdentifier).toBe('com.byaka.buka');
  });

  it('loading template from a folder', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/BoardingPass.pass'),
    );
    expect(templ.passTypeIdentifier).toBe('pass.com.apple.devpubs.example');
    expect(templ.images.size).toBe(4);

    const templ2 = await Template.load(
      path.resolve(__dirname, './resources/passes/Event.pass'),
    );
    expect(templ2.teamIdentifier).toBe('A93A5CM278');
    expect(templ2.images.size).toBe(8);
  });

  it('loads images and translation from folder without pass.json', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/Generic'),
    );
    expect(templ.images.size).toBe(5);
    expect(templ.localization.size).toBe(2);
    // ensure it normalizes locales name
    expect(templ.localization.has('zh-CN')).toBeTruthy();
  });

  it('loads template from ZIP buffer', async () => {
    const buffer = readFileSync(
      path.resolve(__dirname, './resources/passes/Generic.zip'),
    );
    const res = await Template.fromBuffer(buffer);
    expect(res).toBeInstanceOf(Template);
    expect(res.images.size).toBe(8);
    expect(res.localization.size).toBe(3);
    expect(res.localization.get('zh-CN').size).toBe(29);
  });

  it('push updates', async () => {
    const template = new Template('coupon', {
      passTypeIdentifier: 'pass.com.example.passbook',
      teamIdentifier: 'MXL',
      labelColor: 'red',
    });

    template.setCertificate(process.env.APPLE_PASS_CERTIFICATE as string);
    template.setPrivateKey(
      process.env.APPLE_PASS_PRIVATE_KEY as string,
      process.env.APPLE_PASS_KEY_PASSWORD,
    );

    await expect(
      template.pushUpdates(
        '0e40d22a36e101a59ab296d9e6021df3ee1dcf95e29e8ab432213b12ba522dbb',
      ),
    ).resolves.toBeUndefined();
    // if (template.apn) template.apn.destroy();
    // expect(res).toEqual(
    //   expect.objectContaining({
    //     ':status': 200,
    //     'apns-id': expect.any(String),
    //   }),
    // );
  }, 7000);
});
