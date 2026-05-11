import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { unlinkSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

import * as constants from '../dist/constants.js';
import { Template } from '../dist/template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate a throwaway self-signed Pass Type ID cert + key for the full test
// run. Previously this depended on APPLE_PASS_* env vars that expired in 2020.
function makeTestKeypair(): { certPem: string; keyPem: string } {
  const dir = mkdtempSync(`${tmpdir()}${path.sep}`);
  const keyPath = path.join(dir, 't.key');
  const certPath = path.join(dir, 't.crt');
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} ` +
      `-days 1 -nodes -subj "/CN=Pass Type ID: pass.com.example.passbook/O=pass-js test"`,
    { stdio: 'ignore' },
  );
  return {
    certPem: readFileSync(certPath, 'utf8'),
    keyPem: readFileSync(keyPath, 'utf8'),
  };
}

function cloneExcept<T extends Record<string, unknown>>(
  object: T,
  field: string,
): Partial<T> {
  const clone: Partial<T> = {};
  for (const key in object) {
    if (key !== field) clone[key] = object[key];
  }
  return clone;
}

function unzipEntry(zipFile: string, filename: string): Buffer {
  return execFileSync('unzip', ['-p', zipFile, filename], {
    encoding: 'buffer',
  });
}

const fields = {
  serialNumber: '123456',
  organizationName: 'Acme flowers',
  description: '20% of black roses',
};

describe('Pass', () => {
  const template = new Template('coupon', {
    passTypeIdentifier: 'pass.com.example.passbook',
    teamIdentifier: 'MXL',
    labelColor: 'red',
  });

  before(() => {
    const { certPem, keyPem } = makeTestKeypair();
    template.setCertificate(certPem);
    template.setPrivateKey(keyPem);
  });

  it('from template', () => {
    const pass = template.createPass();

    assert.equal(pass.passTypeIdentifier, 'pass.com.example.passbook');
    assert.equal(pass.images.size, 0);
    assert.equal(pass.style, 'coupon');
    assert.ok(Array.isArray(pass.labelColor));
    assert.equal(pass.labelColor.length, 3);
    assert.equal(JSON.stringify(pass.labelColor), '"rgb(255, 0, 0)"');
  });

  it('barcodes as Array', () => {
    const pass = template.createPass(cloneExcept(fields, 'serialNumber'));
    assert.doesNotThrow(() => {
      pass.barcodes = [
        {
          format: 'PKBarcodeFormatQR',
          message: 'Barcode message',
          messageEncoding: 'iso-8859-1',
        },
      ];
    });
    assert.throws(() => {
      pass.barcodes = 'byaka' as unknown as typeof pass.barcodes;
    });
  });

  it('without serial number should not be valid', () => {
    const pass = template.createPass(cloneExcept(fields, 'serialNumber'));
    assert.throws(() => pass.validate(), /serialNumber is required/);
  });

  it('without organization name should not be valid', () => {
    const pass = template.createPass(cloneExcept(fields, 'organizationName'));
    assert.throws(() => pass.validate(), /organizationName is required/);
  });

  it('without description should not be valid', () => {
    const pass = template.createPass(cloneExcept(fields, 'description'));
    assert.throws(() => pass.validate(), /description is required/);
  });

  it('without icon.png should not be valid', () => {
    const pass = template.createPass(fields);
    assert.throws(() => pass.validate(), /Missing required image icon\.png/);
  });

  it('without logo.png should not be valid', async () => {
    const pass = template.createPass(fields);
    await pass.images.add(
      'icon',
      readFileSync(path.resolve(__dirname, './resources/icon.png')),
      undefined,
      'en-US',
    );
    await assert.rejects(
      () => pass.asBuffer(),
      /Missing required image logo\.png/,
    );
  });

  it('boarding pass has string-only property in structure fields', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/BoardingPass.pass/'),
    );
    assert.equal(templ.style, 'boardingPass');
    assert.deepEqual(Array.from(templ.backgroundColor!), [50, 91, 185]);
    assert.equal(templ.backFields.size, 2);
    assert.equal(templ.auxiliaryFields.size, 4);
    assert.ok(
      templ.relevantDate instanceof Date &&
        !Number.isNaN(templ.relevantDate.getTime()),
    );
    assert.equal(templ.relevantDate.getFullYear(), 2012);
    assert.ok(Array.isArray(templ.barcodes));
    assert.ok(templ.barcodes.length >= 1);
    assert.equal(typeof templ.barcodes[0].message, 'string');

    const pass = templ.createPass();
    assert.equal(pass.transitType, constants.TRANSIT.AIR);
    pass.transitType = constants.TRANSIT.BUS;
    assert.equal(pass.transitType, constants.TRANSIT.BUS);
    const json = pass.toJSON() as Record<string, { transitType: string }>;
    assert.equal(json.boardingPass.transitType, constants.TRANSIT.BUS);
  });

  it('converts back to the same pass.json', async () => {
    const t = await Template.load(
      path.resolve(__dirname, './resources/passes/Event.pass'),
    );
    const expected = JSON.parse(
      readFileSync(
        path.resolve(__dirname, './resources/passes/Event.pass/pass.json'),
        'utf8',
      ),
    );
    assert.deepEqual(JSON.parse(JSON.stringify(t)), expected);
  });

  it('eventTicket auxiliaryFields round-trip `row` key (issue #625)', () => {
    const eventTemplate = new Template('eventTicket', {
      passTypeIdentifier: 'pass.com.example.passbook',
      teamIdentifier: 'MXL',
    });
    const pass = eventTemplate.createPass(fields);
    pass.auxiliaryFields.add({ key: 'a1', label: 'A1', value: '1', row: 0 });
    pass.auxiliaryFields.add({ key: 'a2', label: 'A2', value: '2', row: 0 });
    pass.auxiliaryFields.add({ key: 'b1', label: 'B1', value: '3', row: 1 });
    pass.auxiliaryFields.add({ key: 'b2', label: 'B2', value: '4', row: 1 });
    const json = JSON.parse(JSON.stringify(pass)) as {
      eventTicket: { auxiliaryFields: { key: string; row: 0 | 1 }[] };
    };
    const aux = json.eventTicket.auxiliaryFields;
    assert.equal(aux.length, 4);
    assert.equal(aux.find(f => f.key === 'a1')?.row, 0);
    assert.equal(aux.find(f => f.key === 'a2')?.row, 0);
    assert.equal(aux.find(f => f.key === 'b1')?.row, 1);
    assert.equal(aux.find(f => f.key === 'b2')?.row, 1);
  });

  it('asBuffer returns a buffer with a valid ZIP', async () => {
    const pass = template.createPass(fields);
    await pass.images.load(path.resolve(__dirname, './resources'));
    pass.headerFields.add({ key: 'date', value: 'Date', label: 'Nov 1' });
    pass.primaryFields.add({
      key: 'location',
      label: 'Place',
      value: 'High ground',
    });
    const tmd = mkdtempSync(`${tmpdir()}${path.sep}`);
    const passFileName = path.join(
      tmd,
      `pass-${randomBytes(10).toString('hex')}.pkpass`,
    );
    const buf = await pass.asBuffer();
    assert.ok(Buffer.isBuffer(buf));
    writeFileSync(passFileName, buf);
    try {
      const stdout = execFileSync('unzip', ['-t', passFileName], {
        encoding: 'utf8',
      });
      assert.match(stdout, /No errors detected in compressed data/);
    } finally {
      unlinkSync(passFileName);
    }
  });
});

describe('generated pass bundle', () => {
  const template = new Template('coupon', {
    passTypeIdentifier: 'pass.com.example.passbook',
    teamIdentifier: 'MXL',
    labelColor: 'red',
  });

  const tmd = mkdtempSync(`${tmpdir()}${path.sep}`);
  const passFileName = path.join(
    tmd,
    `pass-${randomBytes(10).toString('hex')}.pkpass`,
  );

  before(async () => {
    const { certPem, keyPem } = makeTestKeypair();
    template.setCertificate(certPem);
    template.setPrivateKey(keyPem);

    const pass = template.createPass(fields);
    await pass.images.load(path.resolve(__dirname, './resources'));
    pass.headerFields.add({ key: 'date', label: 'Date', value: 'Nov 1' });
    pass.primaryFields.add({
      key: 'location',
      label: 'Place',
      value: 'High ground',
    });
    assert.equal(pass.images.size, 8);
    writeFileSync(passFileName, await pass.asBuffer());
  });

  after(() => {
    unlinkSync(passFileName);
  });

  it('is a valid ZIP', () => {
    const stdout = execFileSync('unzip', ['-t', passFileName], {
      encoding: 'utf8',
    });
    assert.match(stdout, /No errors detected in compressed data/);
  });

  it('contains pass.json', t => {
    const res = JSON.parse(
      unzipEntry(passFileName, 'pass.json').toString('utf8'),
    );
    t.assert.snapshot(res);
  });

  it('contains a manifest', () => {
    const res = JSON.parse(
      unzipEntry(passFileName, 'manifest.json').toString('utf8'),
    );
    // manifest values are SHA-1 hex strings keyed by filename
    for (const [entryPath, hash] of Object.entries(
      res as Record<string, string>,
    )) {
      assert.match(hash, /^[0-9a-f]{40}$/, `bad hash for ${entryPath}`);
    }
    assert.ok('pass.json' in res);
    assert.ok('icon.png' in res);
  });

  it('contains a valid PKCS#7 signature', () => {
    const sig = unzipEntry(passFileName, 'signature');
    assert.ok(sig.length > 0, 'signature present');
    // DER SEQUENCE header — pkpass signature is a CMS ContentInfo
    assert.equal(sig[0], 0x30, 'DER SEQUENCE');
  });

  it('contains the icon with the expected hash', () => {
    const buffer = unzipEntry(passFileName, 'icon.png');
    assert.equal(
      createHash('sha1').update(buffer).digest('hex'),
      'e0f0bcd503f6117bce6a1a3ff8a68e36d26ae47f',
    );
  });

  it('contains the logo with the expected hash', () => {
    const buffer = unzipEntry(passFileName, 'logo.png');
    assert.equal(
      createHash('sha1').update(buffer).digest('hex'),
      'abc97e3b2bc3b0e412ca4a853ba5fd90fe063551',
    );
  });
});
