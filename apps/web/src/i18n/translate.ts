import englishCatalog from './en-catalog.json';
import englishOverrides from './en-overrides.json';
import type { DisplayLanguage } from './language';

export const englishUiCatalog: Readonly<Record<string, string>> = {
  ...englishCatalog,
  ...englishOverrides,
};
const persianScript = /[\u0600-\u06ff]/;
const digits = /[\u0660-\u0669\u06f0-\u06f9]/g;

export function latinDigits(value: string): string {
  return value
    .replace(digits, (digit) =>
      String(
        digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660),
      ),
    )
    .replace(/\u066b/g, '.')
    .replace(/\u066c/g, ',')
    .replace(/\u066a/g, '%');
}

export function normalizeUiText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// Prefixes/suffixes also cover labels composed with counts, IDs and other data.
// They never change the submitted value of a form or a persisted domain enum.
const phrases = new Map<string, Array<[string, string]>>();
for (const [source, target] of Object.entries(englishUiCatalog)) {
  if (!source || !target || !persianScript.test(source)) continue;
  const firstWord = source.match(/^[^\s:،؛؟«»,.()[\]]+/)?.[0] ?? source;
  const entries = phrases.get(firstWord) ?? [];
  entries.push([source, target]);
  phrases.set(firstWord, entries);
}
for (const entries of phrases.values())
  entries.sort((a, b) => b[0].length - a[0].length);

export function translateUiText(
  value: string,
  language: DisplayLanguage,
): string {
  if (language === 'fa') return value;
  const normalized = normalizeUiText(value);
  const exact = englishUiCatalog[normalized];
  if (exact) {
    const leading = value.match(/^\s*/)?.[0] ?? '';
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    return `${leading}${latinDigits(exact)}${trailing}`;
  }
  if (!persianScript.test(value)) return latinDigits(value);
  let result = '';
  let changed = false;
  let cursor = 0;
  while (cursor < normalized.length) {
    const remaining = normalized.slice(cursor);
    const firstWord = remaining.match(/^[^\s:،؛؟«»,.()[\]]+/)?.[0];
    const entry = firstWord
      ? phrases
          .get(firstWord)
          ?.find(
            ([source]) =>
              remaining.startsWith(source) &&
              (remaining.length === source.length ||
                /[\s:،؛؟«»,.!?()[\]\d]/.test(remaining[source.length] ?? '')),
          )
      : undefined;
    if (entry) {
      changed = true;
      result += entry[1];
      cursor += entry[0].length;
    } else {
      const token =
        remaining.match(/^[^\s:،؛؟«»,.!?()[\]]+/)?.[0] ?? remaining[0] ?? '';
      result += token;
      cursor += token.length;
    }
  }
  if (!changed) return latinDigits(value);
  return latinDigits(result)
    .replace(/،/g, ',')
    .replace(/؛/g, ';')
    .replace(/؟/g, '?');
}

export function needsUiLocalization(value: unknown): value is string {
  return typeof value === 'string' && persianScript.test(value);
}
