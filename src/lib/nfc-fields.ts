import { createPublicKey } from 'node:crypto';

import type { NFCDictionary } from '../interfaces.js';

// For NFC encryption, Apple requires an ECDH public key on curve P-256,
// base64-encoded as an X.509 SubjectPublicKeyInfo structure.
// See:
// - https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/LowerLevel.html
// - https://stackoverflow.com/questions/48438753/apple-wallet-nfc-encryptionpublickey
export class NFCField implements NFCDictionary {
  message = '';
  encryptionPublicKey?: string;

  constructor(nfc?: NFCDictionary) {
    if (!nfc) return;
    this.message = nfc.message;
    if (typeof nfc.encryptionPublicKey === 'string')
      this.encryptionPublicKey = nfc.encryptionPublicKey;
  }

  // Accepts a PEM-encoded SubjectPublicKeyInfo (SPKI) containing an EC public
  // key on curve P-256 (prime256v1 / secp256r1). Stores it as base64-encoded
  // SPKI DER as Apple expects.
  setPublicKey(pem: string): this {
    const keyObj = createPublicKey({ key: pem, format: 'pem' });
    if (keyObj.asymmetricKeyType !== 'ec') {
      throw new TypeError('NFC public key must be an EC key');
    }
    if (keyObj.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new TypeError(
        'NFC public key must use the P-256 (prime256v1) curve',
      );
    }
    const spkiDer = keyObj.export({ type: 'spki', format: 'der' });
    this.encryptionPublicKey = spkiDer.toString('base64');
    return this;
  }

  toJSON(): NFCDictionary | undefined {
    if (!this.message) return undefined;
    const res: NFCDictionary = { message: this.message };
    if (this.encryptionPublicKey)
      res.encryptionPublicKey = this.encryptionPublicKey;
    return res;
  }
}
