import * as forge from 'node-forge';

import { NFCField } from '../src/lib/nfc-fields';

/**
 * @see {@link https://stackoverflow.com/questions/48438753/apple-wallet-nfc-encryptionpublickey}
 */
const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MDkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDIgADLFuyM4y1GV0CxWhs35qxxk+ob4Mz
Tm6EWP0OZQBdErU=
-----END PUBLIC KEY-----`;

describe('NFCField', () => {
  it('returns undefined for JSON stringify', () => {
    const n = new NFCField();
    expect(JSON.stringify(n)).toBeUndefined();
  });

  it('decodes public key', () => {
    const nfc = new NFCField([
      {
        message: 'test message',
        encryptionPublicKey: Buffer.from(TEST_PUBLIC_KEY, 'utf-8').toString(
          'base64',
        ),
      },
    ]);
    expect(nfc.toJSON()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.toBeString() }),
      ]),
    );
  });

  it('add Base64 encoded public key', () => {
    const nfc = new NFCField();
    nfc.add('hello world', TEST_PUBLIC_KEY);
    expect(nfc.toJSON()).toEqual([
      {
        encryptionPublicKey: TEST_PUBLIC_KEY.replace(/\n/g, '')
          .replace('-----BEGIN PUBLIC KEY-----', '')
          .replace('-----END PUBLIC KEY-----', ''),
        message: 'hello world',
      },
    ]);
  });

  it('throws on wrong algorithm public key or no public key', () => {
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    const privatePem = forge.pki.privateKeyToPem(keypair.privateKey);
    const publicPem = forge.pki.publicKeyToPem(keypair.publicKey);
    const nfc = new NFCField();
    expect(() => nfc.add('hello', privatePem)).toThrow(/SubjectPublicKeyInfo/);
    expect(() => nfc.add('wrong', publicPem)).toThrow(/ECDH public key/);
  });
});
