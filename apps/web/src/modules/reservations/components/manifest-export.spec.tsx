import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ManifestExport } from './manifest-export';

it('starts with a date-range ticket search before showing manifest cards', () => {
  const html = renderToStaticMarkup(<ManifestExport />);
  expect(html).toContain('مبدأ مسیر');
  expect(html).toContain('کشور مبدأ');
  expect(html).toContain('کشور مقصد');
  expect(html).toContain('شهر مبدأ');
  expect(html).toContain('شهر مقصد');
  expect(html).toContain('مقصد مسیر');
  expect(html).toContain('از تاریخ حرکت');
  expect(html).toContain('تا تاریخ حرکت');
  expect(html).toContain('جست‌وجوی بلیط‌ها');
  expect(html).toContain('پیش‌فرض');
  expect(html).toContain('اتوبوس یا قطار');
  expect(html).toContain('قالب انتخاب‌شده');
  expect(html).not.toContain('MANIFEST ایران ایرتور');
});
