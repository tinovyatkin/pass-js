import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { Template } from '../dist/template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Template', () => {
  it('throws on unsupported style', () => {
    assert.throws(
      // @ts-expect-error testing invalid input
      () => new Template('discount'),
      /Unsupported pass style/,
    );
  });

  it('does not mutate input fields', () => {
    const original = { passTypeIdentifier: 'com.example.passbook' };
    const templ = new Template('coupon', original);
    assert.equal(templ.passTypeIdentifier, 'com.example.passbook');
    templ.passTypeIdentifier = 'com.byaka.buka';
    assert.equal(templ.passTypeIdentifier, 'com.byaka.buka');
    assert.equal(original.passTypeIdentifier, 'com.example.passbook');

    original.passTypeIdentifier = 'com.example.somethingelse';
    assert.equal(templ.passTypeIdentifier, 'com.byaka.buka');
  });

  it('loads a template from a folder', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/BoardingPass.pass'),
    );
    assert.equal(templ.passTypeIdentifier, 'pass.com.apple.devpubs.example');
    assert.equal(templ.images.size, 4);

    const templ2 = await Template.load(
      path.resolve(__dirname, './resources/passes/Event.pass'),
    );
    assert.equal(templ2.teamIdentifier, 'A93A5CM278');
    assert.equal(templ2.images.size, 8);
  });

  it('loads images and translations from a folder without pass.json', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/Generic'),
    );
    assert.equal(templ.images.size, 5);
    assert.equal(templ.localization.size, 2);
    assert.ok(templ.localization.has('zh-CN'));
  });

  it('loads a template from a ZIP buffer', async () => {
    const buffer = readFileSync(
      path.resolve(__dirname, './resources/passes/Generic.zip'),
    );
    const res = await Template.fromBuffer(buffer);
    assert.ok(res instanceof Template);
    assert.equal(res.images.size, 8);
    assert.equal(res.localization.size, 3);
    assert.equal(res.localization.get('zh-CN').size, 29);
  });

  it('loads an existing .pkpass buffer as a Template', async () => {
    const buffer = readFileSync(
      path.resolve(__dirname, './resources/passes/StoreCard.pkpass'),
    );
    const res = await Template.fromBuffer(buffer);
    assert.ok(res instanceof Template);
    assert.equal(res.passTypeIdentifier, 'pass.com.apple.devpubs.example');
    assert.equal(res.images.size, 5);
  });

  // Real-network push test against APNs — requires both a valid Pass Type ID
  // cert and a live device token. Skipped in CI; opt-in via env var.
  it(
    'push updates',
    {
      skip:
        !process.env['APPLE_PASS_CERTIFICATE'] ||
        !process.env['APPLE_PASS_PRIVATE_KEY'] ||
        !process.env['APPLE_PUSH_TOKEN'],
    },
    async () => {
      const template = new Template('coupon', {
        passTypeIdentifier: 'pass.com.example.passbook',
        teamIdentifier: 'MXL',
        labelColor: 'red',
      });

      template.setCertificate(process.env['APPLE_PASS_CERTIFICATE']!);
      template.setPrivateKey(
        process.env['APPLE_PASS_PRIVATE_KEY']!,
        process.env['APPLE_PASS_KEY_PASSWORD'],
      );

      const resp = await template.pushUpdates(process.env['APPLE_PUSH_TOKEN']!);
      assert.equal(resp[':status'], 200);
      assert.equal(typeof resp['apns-id'], 'string');
    },
  );
});
