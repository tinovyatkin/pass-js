import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signManifest } from '../dist/lib/sign-manifest.js';
import { Template } from '../dist/template.js';

// Generate a throwaway self-signed Pass Type ID cert + key for tests.
// Previously the test relied on APPLE_PASS_* env vars that have been expired
// since 2020; this version is self-contained.
function makeTestKeypair(): { certPem: string; keyPem: string } {
  const dir = mkdtempSync(join(tmpdir(), 'pass-js-sign-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=Pass Type ID: pass.test/O=pass-js test',
    ],
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
  const dir = mkdtempSync(join(tmpdir(), 'pass-js-cms-'));
  const sigPath = join(dir, 'signature.der');
  const manPath = join(dir, 'manifest.txt');
  writeFileSync(sigPath, signature);
  writeFileSync(manPath, manifest);

  const verify = spawnSync(
    'openssl',
    [
      'cms',
      '-verify',
      '-binary',
      '-inform',
      'DER',
      '-content',
      manPath,
      '-in',
      sigPath,
      '-noverify',
    ],
    { encoding: 'utf8' },
  );
  const verifyOutput = `${verify.stdout}\n${verify.stderr}`;
  assert.equal(verify.status, 0, verifyOutput);
  assert.match(
    verifyOutput,
    /Verification successful|CMS Verification successful/,
  );

  const asn1 = execFileSync(
    'openssl',
    ['asn1parse', '-inform', 'DER', '-in', sigPath, '-i'],
    { encoding: 'utf8' },
  );
  assert.match(asn1, /OBJECT\s+:pkcs7-signedData/);
  assert.match(asn1, /OBJECT\s+:pkcs7-data/);
  assert.match(asn1, /OBJECT\s+:contentType/);
  assert.match(asn1, /OBJECT\s+:messageDigest/);
  assert.match(asn1, /OBJECT\s+:signingTime/);
  assert.match(asn1, /OBJECT\s+:rsaEncryption/);
  assert.match(asn1, /prim:\s+OCTET STRING/);

  const cmsPrint = execFileSync(
    'openssl',
    ['cms', '-cmsout', '-print', '-inform', 'DER', '-in', sigPath],
    { encoding: 'utf8' },
  );
  assert.match(cmsPrint, /eContentType: pkcs7-data/);
  assert.match(cmsPrint, /eContent: <ABSENT>/);
  assert.match(cmsPrint, /signedAttrs:/);

  const certs = execFileSync(
    'openssl',
    ['pkcs7', '-inform', 'DER', '-in', sigPath, '-print_certs'],
    { encoding: 'utf8' },
  );
  assert.equal(certs.match(/BEGIN CERTIFICATE/g)?.length, 2);
  assert.match(certs, /subject=.*Pass Type ID: pass\.test/);
  assert.match(
    certs,
    /subject=.*Apple Worldwide Developer Relations Certification Authority/,
  );
});
