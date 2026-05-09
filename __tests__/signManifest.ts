import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signManifest } from '../dist/lib/sign-manifest.js';
import { Template } from '../dist/template.js';

// Generate a throwaway self-signed Pass Type ID cert + key for tests.
// Previously the test relied on APPLE_PASS_* env vars that have been expired
// since 2020; this version is self-contained.
function makeTestKeypair(): { certPem: string; keyPem: string } {
  const dir = tmpdir();
  const keyPath = join(dir, `pass-js-test-${process.pid}.key`);
  const certPath = join(dir, `pass-js-test-${process.pid}.crt`);
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} ` +
      `-days 1 -nodes -subj "/CN=Pass Type ID: pass.test/O=pass-js test"`,
    { stdio: 'ignore' },
  );
  return {
    certPem: readFileSync(certPath, 'utf8'),
    keyPem: readFileSync(keyPath, 'utf8'),
  };
}

test('signManifest produces a valid detached PKCS#7 signature', () => {
  const { certPem, keyPem } = makeTestKeypair();
  const manifest = randomBytes(512).toString('base64');

  const template = new Template('generic');
  template.setCertificate(certPem);
  template.setPrivateKey(keyPem);
  assert.ok(template.certificate, 'cert loaded');
  assert.ok(template.key, 'key loaded');

  const signature = signManifest(template.certificate, template.key, manifest);
  assert.ok(Buffer.isBuffer(signature), 'signature is Buffer');
  assert.ok(signature.length > 0, 'signature non-empty');

  // Round-trip: openssl cms -verify must succeed against the signing cert.
  const dir = tmpdir();
  const sigPath = join(dir, `pass-js-sig-${process.pid}.der`);
  const manPath = join(dir, `pass-js-man-${process.pid}.txt`);
  writeFileSync(sigPath, signature);
  writeFileSync(manPath, manifest);
  const out = execSync(
    `openssl cms -verify -binary -inform DER -content ${manPath} -in ${sigPath} -noverify 2>&1`,
  ).toString();
  assert.match(out, /Verification successful|CMS Verification successful/);
});
