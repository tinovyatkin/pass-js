import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PassBase } from '../dist/lib/base-pass.js';
import { FieldsMap } from '../dist/lib/fieldsMap.js';
import { barcodeFormat as BARCODE } from '../dist/constants.js';
import type { BarcodeFormat } from '../dist/interfaces.js';
import { Template } from '../dist/template.js';
import { writeZip } from '../dist/lib/zip.js';

describe('posterGeneric passes', () => {
  it('preserves the generic fallback when hydrating and cloning a template', () => {
    const fields = {
      generic: { primaryFields: [{ key: 'legacy', value: 'Legacy' }] },
      posterGeneric: { footerFields: [{ key: 'tier', value: 'Family' }] },
    };
    const template = new Template('posterGeneric', fields);
    assert.equal(template.style, 'posterGeneric');
    assert.deepEqual(
      JSON.parse(JSON.stringify(template.createPass())).generic,
      fields.generic,
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(template)).posterGeneric,
      fields.posterGeneric,
    );
    template.style = 'generic';
    assert.equal(template.style, 'generic');
    assert.equal(JSON.parse(JSON.stringify(template)).posterGeneric, undefined);
  });

  it('does not reapply boarding transitType after posterGeneric becomes active', () => {
    const pass = new PassBase({
      boardingPass: { transitType: 'PKTransitTypeAir' },
      posterGeneric: { footerFields: [{ key: 'tier', value: 'Family' }] },
    });

    assert.equal(pass.style, 'posterGeneric');
    const serialized = JSON.parse(JSON.stringify(pass));
    assert.equal(serialized.boardingPass, undefined);
    assert.deepEqual(serialized.posterGeneric.footerFields, [
      { key: 'tier', value: 'Family' },
    ]);
  });

  it('loads both styles from a folder and ZIP, preferring the poster', async () => {
    const fields = {
      generic: { primaryFields: [{ key: 'legacy', value: 'Legacy' }] },
      posterGeneric: { footerFields: [{ key: 'tier', value: 'Family' }] },
    };
    const folder = await mkdtemp(join(tmpdir(), 'pass-js-poster-'));
    try {
      await writeFile(join(folder, 'pass.json'), JSON.stringify(fields));
      const loaded = await Template.load(folder);
      const zipped = await Template.fromBuffer(
        writeZip([
          { path: 'pass.json', data: Buffer.from(JSON.stringify(fields)) },
        ]),
      );
      for (const template of [loaded, zipped]) {
        assert.equal(template.style, 'posterGeneric');
        const pass = JSON.parse(JSON.stringify(template.createPass()));
        assert.deepEqual(pass.generic, fields.generic);
        assert.deepEqual(pass.posterGeneric, fields.posterGeneric);
      }
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('hydrates and serializes poster fields without dropping footer fields', () => {
    const pass = new PassBase({
      posterGeneric: {
        headerFields: [{ key: 'member', value: '123' }],
        primaryFields: [{ key: 'name', value: 'Museum membership' }],
        footerFields: [{ key: 'tier', value: 'Family' }],
        additionalInfoFields: [{ key: 'info', value: 'Admission included' }],
      },
    });
    assert.equal(pass.style, 'posterGeneric');
    assert.ok(pass.footerFields instanceof FieldsMap);
    pass.footerFields.add({ key: 'expiry', value: '2027' });
    assert.deepEqual(JSON.parse(JSON.stringify(pass)).posterGeneric, {
      headerFields: [{ key: 'member', value: '123' }],
      primaryFields: [{ key: 'name', value: 'Museum membership' }],
      footerFields: [
        { key: 'tier', value: 'Family' },
        { key: 'expiry', value: '2027' },
      ],
      additionalInfoFields: [{ key: 'info', value: 'Admission included' }],
    });
  });

  it('hydrates footer fields from a FieldsMap and follows style changes', () => {
    const footerFields = new FieldsMap();
    footerFields.add({ key: 'tier', value: 'Family' });
    const pass = new PassBase({ posterGeneric: { footerFields } });
    assert.equal(pass.footerFields.size, 1);
    pass.style = 'generic';
    assert.throws(() => pass.footerFields, ReferenceError);
    assert.equal(JSON.parse(JSON.stringify(pass)).posterGeneric, undefined);
    pass.style = 'posterGeneric';
    pass.footerFields.add({ key: 'new', value: 'Individual' });
    assert.deepEqual(
      JSON.parse(JSON.stringify(pass)).posterGeneric.footerFields,
      [{ key: 'new', value: 'Individual' }],
    );
  });

  it('round-trips the documented Code39 barcode with a QR fallback', () => {
    const pass = new PassBase({
      posterGeneric: {},
      barcodes: [
        {
          format: BARCODE.Code39,
          message: 'MEMBER123',
          messageEncoding: 'iso-8859-1',
        },
        {
          format: BARCODE.QR,
          message: 'MEMBER123',
          messageEncoding: 'iso-8859-1',
        },
      ],
    });
    assert.equal(BARCODE.Code39, 'PKBarcodeFormatCode39');
    assert.deepEqual(JSON.parse(JSON.stringify(pass)).barcodes, pass.barcodes);
    assert.throws(() => {
      pass.barcodes = [
        {
          format: 'PKBarcodeFormat39' as BarcodeFormat,
          message: 'MEMBER123',
          messageEncoding: 'iso-8859-1',
        },
      ];
    }, TypeError);
  });

  it('rejects footer fields outside posterGeneric and retains existing style validation', () => {
    assert.throws(() => new PassBase().footerFields, ReferenceError);
    assert.throws(
      () =>
        new PassBase({
          generic: {
            footerFields: [{ key: 'invalid', value: 'not allowed' }],
          },
        }),
      ReferenceError,
    );
    assert.throws(
      () => new PassBase({ generic: {} }).footerFields,
      ReferenceError,
    );
    assert.throws(
      () => new PassBase({ generic: {} }).additionalInfoFields,
      ReferenceError,
    );
    const event = new PassBase({ eventTicket: {} });
    event.additionalInfoFields.add({
      key: 'info',
      value: 'Existing event field',
    });
    assert.equal(event.additionalInfoFields.size, 1);
  });
});
