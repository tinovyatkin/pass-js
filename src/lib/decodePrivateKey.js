'use strict';

const forge = require('node-forge');

function decodePrivateKey(keydata, password, returnPEM = false) {
  const pemMessages = forge.pem.decode(keydata);

  // getting signer private key
  const signerKeyMessage = pemMessages.find(message =>
    message.type.includes('KEY'),
  );

  if (!signerKeyMessage) {
    throw new Error('Invalid certificate, no key found');
  }
  const key = password
    ? forge.pki.decryptRsaPrivateKey(
        forge.pem.encode(signerKeyMessage),
        password,
      )
    : forge.pem.encode(signerKeyMessage);

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
