import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Template } from '../dist/template.js';
import { readZip, writeZip } from '../dist/lib/zip.js';
import type { Pass } from '../dist/pass.js';
import type { Personalization } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const icon = readFileSync(path.resolve(__dirname, './resources/icon.png'));
const logo = readFileSync(path.resolve(__dirname, './resources/logo.png'));

const baseFields = {
  passTypeIdentifier: 'pass.com.example.passbook',
  teamIdentifier: 'MXL',
  serialNumber: 'personalization-1',
  organizationName: 'Acme rewards',
  description: 'Acme rewards signup',
};

const personalization: Personalization = {
  description: 'Join Acme Rewards',
  requiredPersonalizationFields: [
    'PKPassPersonalizationFieldName',
    'PKPassPersonalizationFieldEmailAddress',
  ],
  termsAndConditions: '<a href="https://example.com/terms">Terms</a>',
};

let certPem: string;
let keyPem: string;

function makeTestKeypair(): { certPem: string; keyPem: string } {
  const dir = mkdtempSync(`${tmpdir()}${path.sep}`);
  const keyPath = path.join(dir, 't.key');
  const certPath = path.join(dir, 't.crt');
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
      certPath,
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=Pass Type ID: pass.com.example.passbook/O=pass-js test',
    ],
    { stdio: 'ignore' },
  );
  return {
    certPem: readFileSync(certPath, 'utf8'),
    keyPem: readFileSync(keyPath, 'utf8'),
  };
}

function signedTemplate(style: 'coupon' | 'storeCard' = 'storeCard'): Template {
  const template = new Template(style, baseFields);
  template.setCertificate(certPem);
  template.setPrivateKey(keyPem);
  return template;
}

async function addRequiredImages(pass: Pass): Promise<void> {
  await pass.images.add('icon', icon);
  await pass.images.add('logo', logo);
}

function readEntry(buffer: Buffer, filename: string): Buffer {
  const zip = readZip(buffer);
  const entry = zip.entries.find(e => e.filename === filename);
  assert.ok(entry, `${filename} is present`);
  return zip.getBuffer(entry);
}

function entryNames(buffer: Buffer): string[] {
  return readZip(buffer).entries.map(entry => entry.filename);
}

describe('personalization', () => {
  before(() => {
    ({ certPem, keyPem } = makeTestKeypair());
  });

  it('emits personalization.json and logo when all requirements are met', async () => {
    const pass = signedTemplate('storeCard').createPass();
    pass.nfc.message = 'acme-rewards-member';
    pass.personalization = personalization;
    await addRequiredImages(pass);
    await pass.images.add('personalizationLogo', logo);

    const buffer = await pass.asBuffer();
    const names = entryNames(buffer);
    assert.ok(names.includes('personalization.json'));
    assert.ok(names.includes('personalizationLogo.png'));

    assert.deepEqual(
      JSON.parse(readEntry(buffer, 'personalization.json').toString('utf8')),
      personalization,
    );

    const manifest = JSON.parse(
      readEntry(buffer, 'manifest.json').toString('utf8'),
    ) as Record<string, string>;
    assert.ok('personalization.json' in manifest);
    assert.ok('personalizationLogo.png' in manifest);

    const passJson = JSON.parse(
      readEntry(buffer, 'pass.json').toString('utf8'),
    );
    assert.deepEqual(passJson.nfc, { message: 'acme-rewards-member' });
  });

  it('strips personalization files unless every requirement is met', async () => {
    const cases: {
      name: string;
      setup(pass: Pass): Promise<void> | void;
    }[] = [
      {
        name: 'missing nfc',
        async setup(pass) {
          pass.personalization = personalization;
          await pass.images.add('personalizationLogo', logo);
        },
      },
      {
        name: 'missing personalization.json',
        async setup(pass) {
          pass.nfc.message = 'acme-rewards-member';
          await pass.images.add('personalizationLogo', logo);
        },
      },
      {
        name: 'missing personalizationLogo',
        setup(pass) {
          pass.nfc.message = 'acme-rewards-member';
          pass.personalization = personalization;
        },
      },
      {
        name: 'empty nfc message',
        async setup(pass) {
          pass.nfc.message = '';
          pass.personalization = personalization;
          await pass.images.add('personalizationLogo', logo);
        },
      },
    ];

    for (const testCase of cases) {
      const pass = signedTemplate('storeCard').createPass({
        serialNumber: `personalization-${testCase.name}`,
      });
      await addRequiredImages(pass);
      await testCase.setup(pass);

      const names = entryNames(await pass.asBuffer());
      assert.ok(
        !names.includes('personalization.json'),
        `${testCase.name}: personalization.json omitted`,
      );
      assert.ok(
        !names.some(name => name.startsWith('personalizationLogo')),
        `${testCase.name}: personalization logos omitted`,
      );
    }
  });

  it('loads personalization from ZIP templates', async () => {
    const buffer = writeZip([
      {
        path: 'pass.json',
        data: JSON.stringify({
          formatVersion: 1,
          ...baseFields,
          storeCard: {},
          nfc: { message: 'template-member' },
        }),
      },
      { path: 'icon.png', data: icon },
      { path: 'logo.png', data: logo },
      { path: 'personalizationLogo.png', data: logo },
      { path: 'personalization.json', data: JSON.stringify(personalization) },
    ]);

    const template = await Template.fromBuffer(buffer);
    assert.deepEqual(template.personalization, personalization);
    assert.ok(template.images.has('personalizationLogo.png'));

    template.setCertificate(certPem);
    template.setPrivateKey(keyPem);
    const passBuffer = await template.createPass().asBuffer();
    assert.ok(entryNames(passBuffer).includes('personalization.json'));
  });

  it('loads personalization from folder templates', async () => {
    const folder = mkdtempSync(`${tmpdir()}${path.sep}`);
    writeFileSync(
      path.join(folder, 'pass.json'),
      JSON.stringify({
        formatVersion: 1,
        ...baseFields,
        storeCard: {},
        nfc: { message: 'folder-member' },
      }),
    );
    writeFileSync(path.join(folder, 'icon.png'), icon);
    writeFileSync(path.join(folder, 'logo.png'), logo);
    writeFileSync(path.join(folder, 'personalizationLogo.png'), logo);
    writeFileSync(
      path.join(folder, 'personalization.json'),
      JSON.stringify(personalization),
    );

    const template = await Template.load(folder);
    assert.deepEqual(template.personalization, personalization);
    assert.ok(template.images.has('personalizationLogo.png'));
  });

  it('validates personalization payloads', () => {
    const template = signedTemplate('storeCard');
    assert.throws(() => {
      template.personalization = {
        description: 'Join',
        requiredPersonalizationFields: ['not-a-field'],
      } as unknown as Personalization;
    }, /requiredPersonalizationFields\[0\] is invalid/);
    assert.throws(() => {
      template.personalization = {
        description: 'Join',
        requiredPersonalizationFields: [],
      };
    }, /requiredPersonalizationFields must contain at least one field/);
  });
});
