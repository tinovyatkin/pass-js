import * as forge from 'node-forge';

import { NFCDictionary } from '../interfaces';

/**
 * node-forge doesn't support ECDH used by Apple in NFC,
 * so we will store keys as PEM encoded strings
 * @see {@link https://github.com/digitalbazaar/forge/issues/116}
 * @see {@link https://stackoverflow.com/questions/48438753/apple-wallet-nfc-encryptionpublickey}
 * @see {@link https://github.com/digitalbazaar/forge/issues/237}
 */

export class NFCField {
  private nfc: { message: string; publicKey?: string }[] = [];

  toJSON(): NFCDictionary[] | undefined {
    if (this.nfc.length < 1) return undefined;
    return this.nfc.map(({ message, publicKey }) => ({
      message,
      encryptionPublicKey: publicKey
        ? // we need internal part of PEM message
          Buffer.from(
            // @ts-ignore
            forge.pem
              .decode(publicKey)
              .find(({ type }) => type === 'PUBLIC KEY').body,
            'binary',
          ).toString('base64')
        : undefined,
    }));
  }

  add(message: string, publicKey?: string): this {
    if (typeof message !== 'string' || message.length > 64)
      throw new TypeError(
        `NFC message must be a string 64 characters or less, received "${message}"`,
      );

    if (publicKey) {
      if (typeof publicKey !== 'string')
        throw new TypeError(
          `Public key must be a PEM encoded ECDH public key for group P256`,
        );
      // this must be PEM encoded string, let's check it
      const pem = forge.pem.decode(publicKey);
      // ensure it have a public key
      if (!pem || !pem.find(({ type }) => type === 'PUBLIC KEY'))
        throw new TypeError(
          `NFC publicKey must be a PEM encoded X.509 SubjectPublicKeyInfo string`,
        );
      const der = forge.pki.pemToDer(publicKey);
      const oid = forge.asn1.derToOid(der);
      /**
       * Ensure it's ECDH
       * @see {@link https://www.alvestrand.no/objectid/1.2.840.10045.2.1.html}
       */
      if (!oid.includes('840.10045.2.1'))
        throw new TypeError(`Public key must be a ECDH public key`);

      this.nfc.push({ message, publicKey });
    }
    return this;
  }

  addRaw(nfcs: NFCDictionary[]): void {
    /**
     * The payload to be transmitted to the Apple Pay terminal.
     * Must be 64 bytes or less.
     * Messages longer than 64 bytes are truncated by the system.
     
     message: string;
   */
    /**
         * The public encryption key used by the Value Added Services protocol.
         * Use a Base64 encoded X.509 SubjectPublicKeyInfo structure containing a ECDH public key for group P256.
          
         encryptionPublicKey ?: string;
      */
    // we will decode everything
    if (!Array.isArray(nfcs)) throw new TypeError(`nfc must be an array`);
    if (nfcs.length < 1) return;
    for (const { message, encryptionPublicKey } of nfcs) {
      if (encryptionPublicKey) {
        if (typeof encryptionPublicKey !== 'string')
          throw new TypeError(
            `encryptionPublicKey must be Base64 encoded X.509 SubjectPublicKeyInfo structure containing a ECDH public key for group P256`,
          );
        // this will check the PEM
        this.add(
          message,
          Buffer.from(encryptionPublicKey, 'base64').toString('utf8'),
        );
      } else this.add(message);
    }
  }

  clear(): this {
    this.nfc = [];
    return this;
  }
}
