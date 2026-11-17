import { describe, expect, it } from 'vitest';
import { STRINGS, pickLanguage, translate } from './i18n';

describe('pickLanguage', () => {
  it('uses a saved choice first, then the device language, then English', () => {
    expect(pickLanguage('sw', 'en-US')).toBe('sw');
    expect(pickLanguage('en', 'sw-KE')).toBe('en');
    expect(pickLanguage(null, 'sw-KE')).toBe('sw');
    expect(pickLanguage(null, 'SW')).toBe('sw');
    expect(pickLanguage(null, 'en-GB')).toBe('en');
    expect(pickLanguage(null, undefined)).toBe('en');
    expect(pickLanguage('fr', 'fr-FR')).toBe('en');
  });
});

describe('translate', () => {
  it('returns the text for the language, and English when a key has no Swahili', () => {
    expect(translate('en', 'nav.today')).toBe('Today');
    expect(translate('sw', 'nav.today')).toBe('Leo');
  });

  it('has both languages for every string, with no empty text and no leftover English in the Swahili', () => {
    const same = new Set(['lang.english', 'lang.swahili', 'first.exampleTitle.same']);
    for (const [key, v] of Object.entries(STRINGS)) {
      expect(v.en.trim(), key).not.toBe('');
      expect(v.sw.trim(), key).not.toBe('');
      if (!same.has(key)) expect(v.sw, `${key} is not translated`).not.toBe(v.en);
    }
  });

  it('keeps the same punctuation shape in both languages for the promise and the example hint', () => {
    for (const k of ['first.promise', 'first.exampleHint'] as const) {
      expect(STRINGS[k].sw.endsWith('.')).toBe(STRINGS[k].en.endsWith('.'));
    }
  });
});
