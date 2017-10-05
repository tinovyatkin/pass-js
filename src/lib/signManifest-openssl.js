'use strict';

const { execFile } = require('child_process');

/**
 * Signs a manifest and returns the signature.
 * 
 * @param {string} signer - signing certificate filename
 * @param {string} certificate - CA certificate
 * @param {string} password - certificate password
 * @param {string} manifest - manifest to sign
 * @param {Function} callback
 * @returns {Promise.<string>} - signature for given manifest
 */
function signManifest(signer, certificate, password, manifest, callback) {
  const args = [
    'smime',
    '-sign',
    '-binary',
    '-signer',
    signer,
    '-certfile',
    certificate,
    '-passin',
    `pass:${password}`,
  ];
  const sign = execFile(
    'openssl',
    args,
    { stdio: 'pipe' },
    (error, stdout, stderr) => {
      // console.info(stdout);
      const trimmedStderr = stderr.trim();
      // Windows outputs some unhelpful error messages, but still produces a valid signature
      if (error || (trimmedStderr && trimmedStderr.indexOf('- done') < 0)) {
        callback(new Error(stderr));
      } else {
        const signature = stdout.split(/\n\n/)[3];
        callback(null, Buffer.from(signature, 'base64'));
      }
    },
  );
  sign.stdin.write(manifest);
  sign.stdin.end();
}

module.exports = signManifest;
