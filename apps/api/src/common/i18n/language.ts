import catalog from './en-catalog.json';

export type DisplayLanguage = 'fa' | 'en';
const translations = catalog as Record<string, string>;
const phrases = Object.keys(translations)
  .sort((a, b) => b.length - a.length)
  .map((source) => ({
    source,
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}])${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`,
      'gu',
    ),
  }));
export function requestDisplayLanguage(request: {
  headers?: Record<string, unknown>;
}): DisplayLanguage {
  const headers = request.headers ?? {};
  const accepted =
    typeof headers['accept-language'] === 'string'
      ? headers['accept-language']
      : '';
  if (/^en(?:[-,;]|$)/i.test(accepted)) return 'en';
  if (/^fa(?:[-,;]|$)/i.test(accepted)) return 'fa';
  return typeof headers.cookie === 'string' &&
    /(?:^|;\s*)nora-display-language=en(?:;|$)/.test(headers.cookie)
    ? 'en'
    : 'fa';
}

/** Only explicit display labels use this; stored record fields and wire values stay intact. */
export function displayText(text: string, language: DisplayLanguage): string {
  if (language === 'fa') return text;
  const exact = translations[text.replace(/\s+/g, ' ').trim()];
  if (exact) return exact;
  let value = text;
  for (const { source, pattern } of phrases) {
    if (value.includes(source))
      value = value.replace(pattern, () => translations[source]!);
  }
  return value;
}
