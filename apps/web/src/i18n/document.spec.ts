import { describe, expect, it } from 'vitest';
import { localizeDocumentHtml } from './document';

describe('English document output', () => {
  const html =
    '<!doctype html><html lang="fa" dir="rtl"><head><style>.x{direction:rtl}</style></head><body><h1>قرارداد</h1><button title="چاپ">چاپ</button><p>۱۲۳٫۴۵</p><p>&lt;img src=x onerror=alert(1)&gt;</p><script>const label="فارسی";</script></body></html>';
  it('localizes print text and direction without executing or changing code', () => {
    const result = localizeDocumentHtml(html, 'en');
    expect(result).toContain('lang="en" dir="ltr"');
    expect(result).toContain('<h1>Contract</h1>');
    expect(result).toContain('title="Print">Print');
    expect(result).toContain('123.45');
    expect(result).toContain('<style>.x{direction:rtl}</style>');
    expect(result).toContain('<script>const label="فارسی";</script>');
    expect(result).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result).not.toContain('<img');
  });
  it('keeps Persian output byte-for-byte compatible', () => {
    expect(localizeDocumentHtml(html, 'fa')).toBe(html);
  });
});
