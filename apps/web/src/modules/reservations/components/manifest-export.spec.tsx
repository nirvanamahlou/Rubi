import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ManifestExport } from './manifest-export';
import { manifestReferenceQuery } from './manifest-reference-filter';

it('starts with a date-range ticket search before showing manifest cards', () => {
  const html = renderToStaticMarkup(<ManifestExport />);
  expect(html).toContain('کشور مبدأ');
  expect(html).toContain('کشور مقصد');
  expect(html).toContain('شهر مبدأ');
  expect(html).toContain('شهر مقصد');
  expect(html.match(/data-search-select="true"/g)).toHaveLength(4);
  expect(html).not.toContain('<select');
  expect(html).toContain('ابتدا کشور را انتخاب کنید');
  expect(html).toContain('از تاریخ حرکت');
  expect(html).toContain('تا تاریخ حرکت');
  expect(html).toContain('جست‌وجوی بلیط‌ها');
  expect(html).toContain('پیش‌فرض');
  expect(html).toContain('اتوبوس یا قطار');
  expect(html).toContain('قالب انتخاب‌شده');
  expect(html).not.toContain('MANIFEST ایران ایرتور');
});

it('queries active Master Data and scopes city search to the selected country', () => {
  expect(manifestReferenceQuery('تهران', 'country-ir')).toEqual({
    search: 'تهران',
    status: 'active',
    sortBy: 'name',
    sortDirection: 'asc',
    page: 1,
    pageSize: 25,
    countryId: 'country-ir',
  });
});
