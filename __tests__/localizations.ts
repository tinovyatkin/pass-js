/* eslint-disable no-shadow */
import * as path from 'path';
import { TextDecoder } from 'util';
import { execFileSync } from 'child_process';
import { randomBytes } from 'crypto';
import { unlinkSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

import * as Localization from '../src/lib/localizations';

const RU_STRINGS_FILE = path.resolve(
  __dirname,
  './resources/passes/Generic/ru.lproj/pass.strings',
);
const ZH_STRINGS_FILE = path.resolve(
  __dirname,
  './resources/passes/Generic/zh_CN.lproj/pass.strings',
);

describe('Localizations files helpers', () => {
  if (process.platform === 'darwin') {
    it('string fixtures files must pass plutil -lint', async () => {
      const stdout = execFileSync(
        'plutil',
        ['-lint', RU_STRINGS_FILE, ZH_STRINGS_FILE],
        {
          encoding: 'utf8',
        },
      );
      expect(stdout.trim().split(/\n/)).toEqual(
        expect.arrayContaining([expect.toEndWith(': OK')]),
      );
    });
  }
  it('should read pass.strings file', async () => {
    const resRu = await Localization.readLprojStrings(RU_STRINGS_FILE);
    expect([...resRu]).toMatchSnapshot();
    const resZh = await Localization.readLprojStrings(ZH_STRINGS_FILE);
    expect([...resZh]).toMatchSnapshot();
  });

  it('returns string as utf-16 .lproj buffer', async () => {
    const resRu = await Localization.readLprojStrings(RU_STRINGS_FILE);
    const buf = Localization.getLprojBuffer(resRu);
    expect(Buffer.isBuffer(buf)).toBeTruthy();
    const decoder = new TextDecoder('utf-16', { fatal: true });
    expect(decoder.decode(buf)).toMatchSnapshot();
  });

  if (process.platform === 'darwin') {
    it('output buffer passes plutil -lint', async () => {
      const resRu = await Localization.readLprojStrings(ZH_STRINGS_FILE);
      const tmd = mkdtempSync(`${tmpdir()}${path.sep}`);
      const stringsFileName = path.join(
        tmd,
        `pass-${randomBytes(10).toString('hex')}.strings`,
      );
      writeFileSync(
        stringsFileName,
        Localization.getLprojBuffer(resRu),
        'utf16le',
      );

      const stdout = execFileSync('plutil', ['-lint', stringsFileName], {
        encoding: 'utf8',
      });
      unlinkSync(stringsFileName);
      expect(stdout.trim()).toEndWith(': OK');
    });
  }

  it('loads localizations from files', async () => {
    const loc = new Localization.Localizations();
    await loc.load(path.resolve(__dirname, './resources/passes/Generic'));
    expect(loc.size).toBe(2);
    // ensure it normalizes locale
    expect(loc.has('zh-CN')).toBeTruthy();
  });

  it('should clone other instance if provided for constructor', () => {
    const loc1 = new Localization.Localizations();
    loc1
      .add('ru', { key1: 'test key 1', key2: 'test key 2' })
      .add('fr', { key1: 'test fr key1', key2: 'test fr key2' });
    const loc2 = new Localization.Localizations(loc1);
    expect(loc2.size).toBe(2);
    expect(loc2.get('fr').get('key2')).toBe('test fr key2');
    // modify a key in original loc1
    loc1.get('ru').set('key1', 'тест');
    expect(loc2.get('ru').get('key1')).toBe('test key 1');
    expect(loc1.toArray()).toMatchSnapshot();
  });
});
