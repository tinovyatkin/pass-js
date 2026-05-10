import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  contextSpecificConstructed,
  encodeLength,
  extractCertificateInfo,
  objectIdentifier,
  utcTime,
} from '../dist/lib/der.js';

const CMS_OIDS = new Map([
  ['1.2.840.113549.1.9.3', '06092a864886f70d010903'],
  ['1.2.840.113549.1.9.4', '06092a864886f70d010904'],
  ['1.2.840.113549.1.9.5', '06092a864886f70d010905'],
  ['1.2.840.113549.1.7.1', '06092a864886f70d010701'],
  ['1.2.840.113549.1.7.2', '06092a864886f70d010702'],
  ['1.3.14.3.2.26', '06052b0e03021a'],
  ['1.2.840.113549.1.1.1', '06092a864886f70d010101'],
]);

test('DER length encoding uses short and long forms', () => {
  assert.equal(encodeLength(0).toString('hex'), '00');
  assert.equal(encodeLength(127).toString('hex'), '7f');
  assert.equal(encodeLength(128).toString('hex'), '8180');
  assert.equal(encodeLength(255).toString('hex'), '81ff');
  assert.equal(encodeLength(256).toString('hex'), '820100');
  assert.equal(encodeLength(65_535).toString('hex'), '82ffff');
  assert.equal(encodeLength(65_536).toString('hex'), '83010000');
});

test('DER OID encoder covers the CMS OIDs pass-js emits', () => {
  for (const [oid, expected] of CMS_OIDS)
    assert.equal(objectIdentifier(oid).toString('hex'), expected);
});

test('DER UTCTime encoder formats UTC timestamps', () => {
  const date = new Date(Date.UTC(2026, 4, 10, 11, 12, 13));
  assert.equal(utcTime(date).toString('hex'), '170d3236303531303131313231335a');
  assert.throws(
    () => utcTime(new Date(Date.UTC(2050, 0, 1))),
    /UTCTime year out of range/,
  );
});

test('DER context-specific constructed wrapper encodes [0]', () => {
  const inner = Buffer.from([0x02, 0x01, 0x01]);
  assert.equal(
    contextSpecificConstructed(0, inner).toString('hex'),
    'a003020101',
  );
});

test('X.509 extraction handles generated v1 and v3 certificates', () => {
  for (const version of [1, 3] as const) {
    const cert = makeGeneratedCertificate(version);
    const info = extractCertificateInfo(cert.der);

    assert.equal(info.rawCertificate.toString('hex'), cert.der.toString('hex'));
    assert.equal(info.serialNumber[0], 0x02);
    assert.equal(info.issuer[0], 0x30);
    assert.match(
      info.issuer.toString('utf8'),
      new RegExp(`pass-js issuer v${version}`),
    );
    assert.equal(
      serialValueHex(info.serialNumber),
      certificateSerialHex(cert.pemPath),
    );
    assert.match(
      certificateText(cert.pemPath),
      new RegExp(`Version:\\s+${version} `),
    );
  }
});

test('malformed X.509 DER throws a clear error', () => {
  assert.throws(
    () => extractCertificateInfo(Buffer.from('3003020101', 'hex')),
    /Failed to parse X\.509 certificate DER/,
  );
});

function makeGeneratedCertificate(version: 1 | 3): {
  der: Buffer;
  pemPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), `pass-js-x509-v${version}-`));
  const keyPath = join(dir, 'key.pem');
  const pemPath = join(dir, 'cert.pem');
  const derPath = join(dir, 'cert.der');
  const subject = `/CN=pass-js issuer v${version}/O=pass-js test`;

  if (version === 1) {
    const publicKeyPath = join(dir, 'public.der');
    execFileSync(
      'openssl',
      [
        'genpkey',
        '-algorithm',
        'RSA',
        '-pkeyopt',
        'rsa_keygen_bits:2048',
        '-out',
        keyPath,
      ],
      { stdio: 'ignore' },
    );
    execFileSync('openssl', [
      'pkey',
      '-in',
      keyPath,
      '-pubout',
      '-outform',
      'DER',
      '-out',
      publicKeyPath,
    ]);

    const der = makeV1CertificateDer(
      readFileSync(keyPath),
      readFileSync(publicKeyPath),
    );
    writeFileSync(derPath, der);
    execFileSync('openssl', [
      'x509',
      '-inform',
      'DER',
      '-in',
      derPath,
      '-out',
      pemPath,
    ]);
  } else {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-keyout',
        keyPath,
        '-out',
        pemPath,
        '-days',
        '1',
        '-nodes',
        '-subj',
        subject,
        '-addext',
        'basicConstraints=critical,CA:false',
      ],
      { stdio: 'ignore' },
    );
  }

  execFileSync('openssl', [
    'x509',
    '-in',
    pemPath,
    '-outform',
    'DER',
    '-out',
    derPath,
  ]);

  return { der: readFileSync(derPath), pemPath };
}

function makeV1CertificateDer(
  privateKey: Buffer,
  publicKeyInfo: Buffer,
): Buffer {
  const signatureAlgorithm = Buffer.from(
    '300d06092a864886f70d01010b0500',
    'hex',
  );
  const issuer = testName('pass-js issuer v1');
  const validity = testSequence(
    testUtcTime('260101000000Z'),
    testUtcTime('270101000000Z'),
  );
  const serialNumber = Buffer.from('02021234', 'hex');
  const tbsCertificate = testSequence(
    serialNumber,
    signatureAlgorithm,
    issuer,
    validity,
    issuer,
    publicKeyInfo,
  );
  const signature = createSign('sha256')
    .update(tbsCertificate)
    .sign(privateKey);

  return testSequence(
    tbsCertificate,
    signatureAlgorithm,
    testTlv(0x03, Buffer.concat([Buffer.from([0]), signature])),
  );
}

function testName(commonName: string): Buffer {
  return testSequence(
    testSet(
      testSequence(
        Buffer.from('0603550403', 'hex'),
        testUtf8String(commonName),
      ),
    ),
    testSet(
      testSequence(
        Buffer.from('060355040a', 'hex'),
        testUtf8String('pass-js test'),
      ),
    ),
  );
}

function testUtf8String(value: string): Buffer {
  return testTlv(0x0c, Buffer.from(value, 'utf8'));
}

function testUtcTime(value: string): Buffer {
  return testTlv(0x17, Buffer.from(value, 'ascii'));
}

function testSequence(...values: Buffer[]): Buffer {
  return testTlv(0x30, Buffer.concat(values));
}

function testSet(...values: Buffer[]): Buffer {
  return testTlv(0x31, Buffer.concat(values));
}

function testTlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from([tag]),
    testLength(content.length),
    content,
  ]);
}

function testLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);

  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 0x100);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function certificateSerialHex(pemPath: string): string {
  return execFileSync(
    'openssl',
    ['x509', '-in', pemPath, '-noout', '-serial'],
    {
      encoding: 'utf8',
    },
  )
    .trim()
    .replace(/^serial=/, '')
    .toLowerCase();
}

function certificateText(pemPath: string): string {
  return execFileSync('openssl', ['x509', '-in', pemPath, '-noout', '-text'], {
    encoding: 'utf8',
  });
}

function serialValueHex(serialDer: Buffer): string {
  const firstLength = serialDer[1];
  if (firstLength === undefined) throw new Error('Missing serial DER length');

  let offset = 2;
  let length = firstLength;
  if ((firstLength & 0x80) !== 0) {
    const lengthOctets = firstLength & 0x7f;
    length = 0;
    for (let i = 0; i < lengthOctets; i += 1) {
      const byte = serialDer[offset + i];
      if (byte === undefined) throw new Error('Truncated serial DER length');
      length = length * 0x100 + byte;
    }
    offset += lengthOctets;
  }

  return serialDer
    .subarray(offset, offset + length)
    .toString('hex')
    .replace(/^00/, '');
}
