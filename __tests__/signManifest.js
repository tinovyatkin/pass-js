'use strict';

const jsSign = require('../src/lib/signManifest-forge');
const opensslSign = require('../src/lib/signManifest-openssl');

const { randomBytes } = require('crypto');
const path = require('path');

const TEST_STRING = randomBytes(1024).toString('base64');

test('signManifest', done => {
  opensslSign(
    path.resolve(__dirname, '../keys/com.example.passbook.pem'),
    path.resolve(__dirname, '../keys/wwdr.pem'),
    'secret',
    TEST_STRING,
    (err, opensslSignedBuffer) => {
      if (err) throw err;
      jsSign(
        path.resolve(__dirname, '../keys/com.example.passbook.pem'),
        'secret',
        TEST_STRING,
        (e, jsSignedBuffer) => {
          if (e) throw e;
          // console.info(opensslSignedBuffer.toString('base64'));
          // console.info(jsSignedBuffer.toString('base64'));

          expect(Buffer.isBuffer(jsSignedBuffer)).toBeTruthy();
          // folling will never work because of signing time difference
          // expect(opensslSignedBuffer.compare(jsSignedBuffer)).toBe(0);
          done();
        },
      );
    },
  );
});
