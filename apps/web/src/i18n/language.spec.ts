import { describe, expect, it } from 'vitest';

import {
  displayLanguageStorageKey,
  parseDisplayLanguage,
  persistDisplayLanguage,
  readDisplayLanguage,
  languageFromCookies,
} from './language';

describe('personal display language', () => {
  it('recognizes only the personal locale cookie and rejects invalid values', () => {
    expect(
      languageFromCookies(
        'session=abc; nora-display-language=en; unrelated=fa',
      ),
    ).toBe('en');
    expect(languageFromCookies('nora-display-language=enough')).toBe('fa');
    expect(languageFromCookies('nora-display-language=fa')).toBe('fa');
    expect(languageFromCookies(null)).toBe('fa');
  });
  it('accepts only supported languages without changing any system setting', () => {
    expect(parseDisplayLanguage('en')).toBe('en');
    expect(parseDisplayLanguage('fa')).toBe('fa');
    expect(parseDisplayLanguage('English')).toBeNull();
    expect(parseDisplayLanguage({ language: 'en' })).toBeNull();
  });

  it('remembers either choice, including an explicit Persian override', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    persistDisplayLanguage('en', storage);
    expect(readDisplayLanguage(storage)).toBe('en');
    persistDisplayLanguage('fa', storage);
    expect(readDisplayLanguage(storage)).toBe('fa');
    expect(values.get(displayLanguageStorageKey)).toBe('fa');
  });

  it('does not break the application when browser storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('Storage blocked');
      },
      setItem: () => {
        throw new Error('Storage blocked');
      },
    };
    expect(readDisplayLanguage(storage)).toBeNull();
    expect(() => persistDisplayLanguage('en', storage)).not.toThrow();
    expect(readDisplayLanguage(null)).toBeNull();
  });
});
