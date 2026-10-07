import type { DisplayLanguage } from './language';
import { translateUiText } from './translate';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeText(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, key: string) => {
    if (key[0] !== '#') return entities[key.toLowerCase()] ?? original;
    const code = key[1]?.toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
  });
}
function escapeText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Localize already escaped print HTML; scripts, styles and all URLs stay intact. */
export function localizeDocumentHtml(html: string, language: DisplayLanguage): string {
  if (language === 'fa') return html;
  return html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi, (token) => {
    if (/^<(?:script|style|!)/i.test(token)) return token;
    if (token.startsWith('<')) {
      let tag = token.replace(/\bdir=("|')rtl\1/gi, 'dir="ltr"');
      if (/^<html\b/i.test(tag)) {
        tag = tag.replace(/\blang=("|')[^"']*\1/gi, 'lang="en"');
        if (!/\blang=/.test(tag)) tag = tag.replace(/^<html/i, '<html lang="en"');
        if (!/\bdir=/.test(tag)) tag = tag.replace(/^<html/i, '<html dir="ltr"');
      }
      return tag.replace(/\b(title|placeholder|alt|aria-label)=("|')([^"']*)\2/gi,
        (_original, attribute: string, _quote: string, value: string) => `${attribute}="${escapeText(translateUiText(decodeText(value), language))}"`,
      );
    }
    const value = decodeText(token);
    const translated = translateUiText(value, language);
    return translated === value ? token : escapeText(translated);
  });
}
