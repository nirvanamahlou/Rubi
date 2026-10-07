import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { displayLanguageCookieName, parseDisplayLanguage } from './language';
import { translateUiText } from './translate';

/** Page titles and descriptions follow the same request language as the shell. */
export async function localizedMetadata(metadata: Metadata): Promise<Metadata> {
  const language =
    parseDisplayLanguage(
      (await cookies()).get(displayLanguageCookieName)?.value,
    ) ?? 'fa';
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') return translateUiText(value, language);
    if (Array.isArray(value)) return value.map(visit);
    if (
      value &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype
    )
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, visit(child)]),
      );
    return value;
  };
  return visit(metadata) as Metadata;
}
