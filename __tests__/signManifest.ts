'use strict';

import { randomBytes } from 'crypto';

import { signManifest } from '../src/lib/signManifest-forge';
import { Template } from '../src/template';

const TEST_STRING = randomBytes(1024).toString('base64');

test('signManifest', async () => {
  // creating template to load certificate and key
  const template = new Template('generic');
  template.setCertificate(process.env.APPLE_PASS_CERTIFICATE);
  template.setPrivateKey(
    process.env.APPLE_PASS_PRIVATE_KEY,
    process.env.APPLE_PASS_KEY_PASSWORD,
  );

  const jsSignedBuffer = await signManifest(
    template.certificate,
    template.key,
    TEST_STRING,
  );
  expect(Buffer.isBuffer(jsSignedBuffer)).toBeTruthy();
});
