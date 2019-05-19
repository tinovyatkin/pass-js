import { normalizeLocale } from '../src/lib/normalize-locale';

describe('normalizeLocale', () => {
  it('normalizes everything good', () => {
    expect(normalizeLocale('de')).toBe('de');
    expect(normalizeLocale('en_US')).toBe('en-US');
    expect(normalizeLocale('zh_Hant-TW')).toBe('zh-Hant-TW');
    expect(normalizeLocale('En-au')).toBe('en-AU');
    expect(normalizeLocale('aZ_cYrl-aZ')).toBe('az-Cyrl-AZ');
  });

  it('throws on non-locale', () => {
    expect(() => normalizeLocale('en-Byakabukabubbe')).toThrow(TypeError);
  });
});
