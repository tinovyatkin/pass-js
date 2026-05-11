import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renameSync, existsSync } from 'node:fs';

import {
  getAddToWalletButton,
  type AddToWalletLocale,
} from '../dist/add-to-wallet-button.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.resolve(__dirname, '../dist/assets/add-to-wallet');
const EN_US = path.join(ASSET_DIR, 'en-US.svg');
const EN_US_BAK = path.join(ASSET_DIR, 'en-US.svg.bak');

function looksLikeSvg(buf: Buffer): boolean {
  const head = buf.subarray(0, 256).toString('utf8').trimStart();
  return head.startsWith('<?xml') || head.startsWith('<svg');
}

describe('getAddToWalletButton', () => {
  it('returns a Buffer with SVG bytes when called with no arguments', () => {
    const buf = getAddToWalletButton();
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 0);
    assert.ok(
      looksLikeSvg(buf),
      `expected SVG-like bytes, got: ${buf.subarray(0, 32).toString('utf8')}`,
    );
  });

  it('returns the en-US asset for the default locale', () => {
    const buf = getAddToWalletButton({ locale: 'en-US' });
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(looksLikeSvg(buf));
  });

  it('falls back to en-US when given an unrecognized locale string', () => {
    // 'xx-ZZ' parses through normalizeLocale but is not in the supported
    // set, so the resolver should quietly reach for the en-US placeholder.
    const bogus = getAddToWalletButton({
      locale: 'xx-ZZ' as unknown as AddToWalletLocale,
    });
    const enUs = getAddToWalletButton({ locale: 'en-US' });
    assert.deepEqual(bogus, enUs);
  });

  it('falls back to en-US when the locale is syntactically invalid', () => {
    // A value normalizeLocale outright rejects should not blow up — the
    // resolver swallows the TypeError and serves the default placeholder.
    const bogus = getAddToWalletButton({
      locale: '@not-a-locale' as unknown as AddToWalletLocale,
    });
    const enUs = getAddToWalletButton({ locale: 'en-US' });
    assert.deepEqual(bogus, enUs);
  });

  it('throws a clear error when the requested supported locale is not on disk', () => {
    // 'de-DE' is in AddToWalletLocale but the SVG is not yet committed;
    // the helper is required to surface a maintainer-directed error
    // instead of silently falling back, so the gap is noisy.
    assert.throws(
      () => getAddToWalletButton({ locale: 'de-DE' }),
      /Apple-branded SVG assets must be added to src\/assets\/add-to-wallet\//,
    );
  });

  describe('when the en-US asset is missing', () => {
    before(() => {
      if (existsSync(EN_US)) renameSync(EN_US, EN_US_BAK);
    });
    after(() => {
      if (existsSync(EN_US_BAK)) renameSync(EN_US_BAK, EN_US);
    });

    it('throws a clear error directing the maintainer to add the SVGs', () => {
      assert.throws(
        () => getAddToWalletButton(),
        /Apple-branded SVG assets must be added to src\/assets\/add-to-wallet\//,
      );
    });
  });
});
