import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeLocale } from '../dist/lib/normalize-locale.js';

describe('normalizeLocale', () => {
  it('normalizes everything good', () => {
    assert.equal(normalizeLocale('de'), 'de');
    assert.equal(normalizeLocale('en_US'), 'en-US');
    assert.equal(normalizeLocale('zh_Hant-TW'), 'zh-Hant-TW');
    assert.equal(normalizeLocale('En-au'), 'en-AU');
    assert.equal(normalizeLocale('aZ_cYrl-aZ'), 'az-Cyrl-AZ');
  });

  it('throws on non-locale', () => {
    assert.throws(() => normalizeLocale('en-Byakabukabubbe'), TypeError);
  });
});
