import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { unlinkSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import * as Localization from '../dist/lib/localizations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RU_STRINGS_FILE = path.resolve(
  __dirname,
  './resources/passes/Generic/ru.lproj/pass.strings',
);
const ZH_STRINGS_FILE = path.resolve(
  __dirname,
  './resources/passes/Generic/zh_CN.lproj/pass.strings',
);

const IS_MACOS = process.platform === 'darwin';

const byLang = (a: [string, string], b: [string, string]): number =>
  a[0].localeCompare(b[0]);

describe('Localizations files helpers', () => {
  it('escapeString -> unescape', () => {
    const str = `This is "multiline" string',
      with some rare character like \\ and \\\\ 😜 inside it`;
    assert.equal(
      Localization.unescapeString(Localization.escapeString(str)),
      str,
    );
  });

  it(
    'string fixtures files must pass plutil -lint',
    { skip: !IS_MACOS },
    () => {
      const stdout = execFileSync(
        'plutil',
        ['-lint', RU_STRINGS_FILE, ZH_STRINGS_FILE],
        {
          encoding: 'utf8',
        },
      );
      for (const line of stdout.trim().split(/\n/)) {
        assert.ok(line.endsWith(': OK'), `unexpected plutil output: ${line}`);
      }
    },
  );

  it('should read pass.strings file', async t => {
    const resRu = await Localization.readLprojStrings(RU_STRINGS_FILE);
    t.assert.snapshot([...resRu]);
    const resZh = await Localization.readLprojStrings(ZH_STRINGS_FILE);
    t.assert.snapshot([...resZh]);
  });

  it('returns string as utf-16 .lproj buffer', async t => {
    const resRu = await Localization.readLprojStrings(RU_STRINGS_FILE);
    const buf = Localization.getLprojBuffer(resRu);
    assert.ok(Buffer.isBuffer(buf));
    const decoder = new TextDecoder('utf-16le', { fatal: true });
    t.assert.snapshot(decoder.decode(buf));
  });

  it('output buffer passes plutil -lint', { skip: !IS_MACOS }, async () => {
    const resZh = await Localization.readLprojStrings(ZH_STRINGS_FILE);
    const tmd = mkdtempSync(`${tmpdir()}${path.sep}`);
    const stringsFileName = path.join(
      tmd,
      `pass-${randomBytes(10).toString('hex')}.strings`,
    );
    writeFileSync(stringsFileName, Localization.getLprojBuffer(resZh));

    try {
      const stdout = execFileSync('plutil', ['-lint', stringsFileName], {
        encoding: 'utf8',
      });
      assert.ok(stdout.trim().endsWith(': OK'));
    } finally {
      unlinkSync(stringsFileName);
    }
  });

  it('loads localizations from files', async () => {
    const loc = new Localization.Localizations();
    await loc.load(path.resolve(__dirname, './resources/passes/Generic'));
    assert.equal(loc.size, 2);
    // ensure it normalizes locale
    assert.ok(loc.has('zh-CN'));
  });

  it('read -> write -> compare', async () => {
    const resRu = await Localization.readLprojStrings(RU_STRINGS_FILE);
    const tmd = mkdtempSync(`${tmpdir()}${path.sep}`);
    const stringsFileName = path.join(
      tmd,
      `pass-${randomBytes(10).toString('hex')}.strings`,
    );
    writeFileSync(stringsFileName, Localization.getLprojBuffer(resRu));

    try {
      const resRu2 = await Localization.readLprojStrings(stringsFileName);

      if (IS_MACOS) {
        const stdout = execFileSync('plutil', ['-lint', stringsFileName], {
          encoding: 'utf8',
        });
        assert.ok(stdout.trim().endsWith(': OK'));
      }
      // Order-independent equality: compare by sorted entries.
      assert.deepEqual(
        new Map([...resRu].toSorted(byLang)),
        new Map([...resRu2].toSorted(byLang)),
      );
    } finally {
      unlinkSync(stringsFileName);
    }
  });

  it('should clone other instance if provided for constructor', t => {
    const loc1 = new Localization.Localizations();
    loc1
      .add('ru', { key1: 'test key 1', key2: 'test key 2' })
      .add('fr', { key1: 'test fr key1', key2: 'test fr key2' });
    const loc2 = new Localization.Localizations(loc1);
    assert.equal(loc2.size, 2);
    assert.equal(loc2.get('fr').get('key2'), 'test fr key2');
    // modify a key in original loc1
    loc1.get('ru').set('key1', 'тест');
    assert.equal(loc2.get('ru').get('key1'), 'test key 1');
    t.assert.snapshot(loc1.toArray());
  });
});
