import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import { NFCField } from '../dist/lib/nfc-fields.js';

// ECDH P-256 public key in raw X.509 SPKI form (base64).
// https://stackoverflow.com/questions/48438753/apple-wallet-nfc-encryptionpublickey
const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MDkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDIgADLFuyM4y1GV0CxWhs35qxxk+ob4Mz
Tm6EWP0OZQBdErU=
-----END PUBLIC KEY-----`;

const TEST_PUBLIC_KEY_BASE64 = TEST_PUBLIC_KEY_PEM.replace(/\n/g, '')
  .replace('-----BEGIN PUBLIC KEY-----', '')
  .replace('-----END PUBLIC KEY-----', '');

describe('NFCField', () => {
  it('returns undefined for JSON stringify', () => {
    const n = new NFCField();
    assert.equal(JSON.stringify(n), undefined);
  });

  it('decodes public key', () => {
    const nfc = new NFCField({
      message: 'test message',
      encryptionPublicKey: TEST_PUBLIC_KEY_BASE64,
    });
    assert.deepEqual(nfc.toJSON(), {
      message: nfc.message,
      encryptionPublicKey: nfc.encryptionPublicKey,
    });
  });

  it('accepts a PEM public key via setPublicKey', () => {
    const nfc = new NFCField();
    nfc.message = 'hello world';
    nfc.setPublicKey(TEST_PUBLIC_KEY_PEM);
    assert.deepEqual(nfc.toJSON(), {
      message: 'hello world',
      encryptionPublicKey: TEST_PUBLIC_KEY_BASE64,
    });
  });

  it('throws on wrong key type', () => {
    // RSA key, not EC — should be rejected
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const publicPem = publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
    const privatePem = privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;

    const nfc = new NFCField();
    // Private key: node:crypto's createPublicKey rejects non-public keys
    assert.throws(() => nfc.setPublicKey(privatePem));
    // Wrong algorithm: RSA, not EC
    assert.throws(() => nfc.setPublicKey(publicPem), /EC key/);
  });

  it('throws on wrong curve (secp384r1 instead of P-256)', () => {
    const { publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
    });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const nfc = new NFCField();
    assert.throws(() => nfc.setPublicKey(pem), /prime256v1/);
  });
});
