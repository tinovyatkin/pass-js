'use strict';

/* eslint-disable @typescript-eslint/promise-function-async */

const assert = require('assert');

const forge = require('node-forge');

/**
 * @typedef {import('node-forge').pki.PrivateKey} PrivateKey
 */

/**
 *
 * @param {string} keydata
 * @param {string} [password]
 * @param {boolean} [returnPEM]
 * @returns {string | PrivateKey}
 */
function decodePrivateKey(keydata, password, returnPEM = false) {
  const pemMessages = forge.pem.decode(keydata);

  // getting signer private key
  const signerKeyMessage = pemMessages.find(message =>
    message.type.includes('KEY'),
  );

  assert.ok(signerKeyMessage, 'Invalid certificate, no key found');

  const key = forge.pki.decryptRsaPrivateKey(
    forge.pem.encode(signerKeyMessage),
    password,
  );

  if (!key) {
    if (
      (signerKeyMessage.procType &&
        signerKeyMessage.procType.type === 'ENCRYPTED') ||
      signerKeyMessage.type.includes('ENCRYPTED')
    ) {
      throw new Error('Unable to parse key, incorrect passphrase');
    }
  }

  if (returnPEM) return forge.pki.privateKeyToPem(key);
  return key;
}
module.exports = decodePrivateKey;
