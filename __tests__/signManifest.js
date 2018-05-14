'use strict';

const {
  signManifestFromPath,
  signManifestFromVar,
} = require('../src/lib/signManifest-forge');

const path = require('path');
const { promisify } = require('util');
const { randomBytes } = require('crypto');
const { readFile } = require('fs');

const TEST_STRING = randomBytes(1024).toString('base64');

const readFileAsync = promisify(readFile);

const password = `secret`;

test('signManifest from Path with password', async () => {
  const jsSignedBuffer = await signManifestFromPath(
    path.resolve(__dirname, '../keys/com.example.passbook.pem'),
    password,
    TEST_STRING,
  );
  expect(Buffer.isBuffer(jsSignedBuffer)).toBeTruthy();
});

test('signManifest from Path without password', async () => {
  const jsSignedBuffer = await signManifestFromPath(
    path.resolve(__dirname, '../keys/com.example.passbook-no-pass.pem'),
    null,
    TEST_STRING,
  );
  expect(Buffer.isBuffer(jsSignedBuffer)).toBeTruthy();
});

test('signManifest from Var with password', async () => {
  const signerCertData = await readFileAsync(
    path.resolve(__dirname, '../keys/com.example.passbook.pem'),
    'utf8',
  );

  const jsSignedBuffer = await signManifestFromVar(
    signerCertData,
    password,
    TEST_STRING,
  );
  expect(Buffer.isBuffer(jsSignedBuffer)).toBeTruthy();
});

test('signManifest from Var without password', async () => {
  const signerCertData = await readFileAsync(
    path.resolve(__dirname, '../keys/com.example.passbook-no-pass.pem'),
    'utf8',
  );

  const jsSignedBuffer = await signManifestFromVar(
    signerCertData,
    null,
    TEST_STRING,
  );
  expect(Buffer.isBuffer(jsSignedBuffer)).toBeTruthy();
});
