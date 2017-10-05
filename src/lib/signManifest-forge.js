'use strict';

const forge = require('node-forge');
const { readFile, readFileSync } = require('fs');
const { resolve } = require('path');

const APPLE_CA_CERTIFICATE = forge.pki.certificateFromPem(
  readFileSync(resolve(__dirname, '../../keys/wwdr.pem')),
);

/**
 * Signs a manifest and returns the signature.
 * 
 * @param {string} signerPemFile - signing certificate filename
 * @param {string} password - certificate password
 * @param {string} manifest - manifest to sign
 * @param {Function} callback
 * @returns {Promise.<string>} - signature for given manifest
 */
function signManifest(signerPemFile, password, manifest, callback) {
  // reading and parsing certificates
  readFile(signerPemFile, 'utf8', (err, signerCertData) => {
    if (err) return callback(err);
    // the PEM file from P12 contains both, certificate and private key
    const pemMessages = forge.pem.decode(signerCertData);

    // getting signer certificate
    const certificate = forge.pki.certificateFromPem(signerCertData);

    // getting signer private key
    const signerKeyMessage = pemMessages.find(message =>
      message.type.includes('KEY'),
    );
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
        return callback(new Error('unable to parse key, incorrect passphrase'));
      }
    }

    // create PKCS#7 signed data
    const p7 = forge.pkcs7.createSignedData();
    p7.content = manifest;
    p7.addCertificate(certificate);
    p7.addCertificate(APPLE_CA_CERTIFICATE);
    p7.addSigner({
      key,
      certificate,
      digestAlgorithm: forge.pki.oids.sha1,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        {
          type: forge.pki.oids.messageDigest,
          // value will be auto-populated at signing time
        },
        {
          type: forge.pki.oids.signingTime,
          // value will be auto-populated at signing time
          // value: new Date('2050-01-01T00:00:00Z')
        },
      ],
    });

    p7.sign();
    p7.contentInfo.value.pop();

    return callback(
      null,
      Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary'),
    );
  });
}

module.exports = signManifest;
