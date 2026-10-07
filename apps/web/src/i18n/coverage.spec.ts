import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { englishUiCatalog } from './translate';

const require = createRequire(import.meta.url);
const { inventory } = require('../../scripts/i18n-inventory.cjs') as {
  inventory: () => Array<{ text: string; files: string[] }>;
};

describe('English UI completeness', () => {
  it('requires an English translation for every new application label or visible error', () => {
    const missing = inventory().filter(({ text }) => !englishUiCatalog[text]);
    expect(missing.map(({ text, files }) => ({ text, files }))).toEqual([]);
  }, 30000);

  it('does not accept empty, Persian or placeholder English translations', () => {
    const invalid = Object.entries(englishUiCatalog).filter(
      ([, text]) =>
        !text.trim() || /[\u0600-\u06ff]|\b(?:TODO|TRANSLATE_ME)\b/.test(text),
    );
    expect(invalid).toEqual([]);
  });

  it('keeps offline API and standalone editor display catalogues in sync', () => {
    const api = JSON.parse(
      readFileSync(
        resolve(process.cwd(), '../api/src/common/i18n/en-catalog.json'),
        'utf8',
      ),
    ) as Record<string, string>;
    const legacySource = readFileSync(
      resolve(process.cwd(), 'public/package-generator/i18n-catalog.js'),
      'utf8',
    );
    const legacy = JSON.parse(
      legacySource
        .slice('window.RUBI_ENGLISH_UI = '.length)
        .trim()
        .slice(0, -1),
    ) as Record<string, string>;
    for (const { text, files } of inventory()) {
      if (files.some((file) => file.startsWith('apps/api/src/')))
        expect(api[text], text).toBe(englishUiCatalog[text]);
      if (files.some((file) => file.startsWith('apps/web/public/')))
        expect(legacy[text], text).toBe(englishUiCatalog[text]);
    }
  }, 30000);
});
