import * as forge from 'node-forge';

import { NFCDictionary } from '../interfaces';

/**
 * node-forge doesn't support ECDH used by Apple in NFC,
 * so we will store keys as PEM encoded strings
 *
 * @see {@link https://github.com/digitalbazaar/forge/issues/116}
 * @see {@link https://stackoverflow.com/questions/48438753/apple-wallet-nfc-encryptionpublickey}
 * @see {@link https://github.com/digitalbazaar/forge/issues/237}
 */

export class NFCField implements NFCDictionary {
  message = '';
  encryptionPublicKey?: string;

  /**
   *
   */

  constructor(nfc?: NFCDictionary) {
    if (!nfc) return;

    // this will check the PEM
    this.message = nfc.message;

    /**
         * The public encryption key used by the Value Added Services protocol.
         * Use a Base64 encoded X.509 SubjectPublicKeyInfo structure containing a ECDH public key for group P256.
          
         encryptionPublicKey ?: string;
      */
    if (typeof nfc.encryptionPublicKey === 'string')
      this.encryptionPublicKey = nfc.encryptionPublicKey;
  }

  /**
   * Sets public key from PEM-encoded key or forge.pki.PublicKey instance
   *
   * @param {forge.pki.PublicKey | string} key
   * @returns {this}
   */
  setPublicKey(key: forge.pki.PublicKey | string): this {
    const pemKey =
      typeof key === 'string' ? key : forge.pki.publicKeyToPem(key);
    // test PEM key type
    // decode throws on invalid PEM message
    const pem = forge.pem.decode(pemKey);
    const publicKey = pem.find(({ type }) => type === 'PUBLIC KEY');
    // ensure it have a public key
    if (!publicKey)
      throw new TypeError(
        `NFC publicKey must be a PEM encoded X.509 SubjectPublicKeyInfo string`,
      );

    const der = forge.pki.pemToDer(pemKey);
    const oid = forge.asn1.derToOid(der);
    /**
     * Ensure it's ECDH
     *
     * @see {@link https://www.alvestrand.no/objectid/1.2.840.10045.2.1.html}
     */
    if (!oid.includes('840.10045.2.1'))
      throw new TypeError(`Public key must be a ECDH public key`);

    this.encryptionPublicKey = Buffer.from(publicKey.body, 'binary').toString(
      'base64',
    );

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
