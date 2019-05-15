/* eslint-disable no-shadow */
import * as path from 'path';
import { TextDecoder } from 'util';

import * as Localization from '../src/lib/localizations';

describe('Localizations files helpers', () => {
  it('should read pass.strings file', async () => {
    const resRu = await Localization.readLprojStrings(
      path.resolve(
        __dirname,
        './resources/passes/Generic/ru.lproj/pass.strings',
      ),
    );
    expect([...resRu]).toMatchSnapshot();
    const resZh = await Localization.readLprojStrings(
      path.resolve(
        __dirname,
        './resources/passes/Generic/zh_CN.lproj/pass.strings',
      ),
    );
    expect([...resZh]).toMatchSnapshot();
  });

  it('returns string as utf-16 .lproj buffer', async () => {
    const resRu = await Localization.readLprojStrings(
      path.resolve(
        __dirname,
        './resources/passes/Generic/ru.lproj/pass.strings',
      ),
    );
    const buf = Localization.getLprojBuffer(resRu);
    expect(Buffer.isBuffer(buf)).toBeTruthy();
    const decoder = new TextDecoder('utf-16', { fatal: true });
    expect(decoder.decode(buf)).toMatchSnapshot();
  });

  it('loads localizations from files', async () => {
    const loc = new Localization.Localizations();
    await loc.load(path.resolve(__dirname, './resources/passes/Generic'));
    expect(loc.size).toBe(2);
    // ensure it normalizes locale
    expect(loc.has('zh-CN')).toBeTruthy();
  });
});
