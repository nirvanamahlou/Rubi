import { browserDisplayLanguage, type DisplayLanguage } from './language';
import { englishUiCatalog, normalizeUiText } from './translate';

/** Prefer the record's official English name for display; never change its ID or fields. */
export function referenceDisplayName(
  record: { name: string; englishName?: unknown; attributes?: unknown },
  language: DisplayLanguage = browserDisplayLanguage(),
): string {
  if (language === 'en') {
    const attributes =
      record.attributes && typeof record.attributes === 'object'
        ? (record.attributes as Record<string, unknown>)
        : {};
    const name = record.englishName ?? attributes.englishName;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return language === 'en'
    ? (englishUiCatalog[normalizeUiText(record.name)] ?? record.name)
    : record.name;
}
