import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import {
  ManifestExport,
  ManifestRoute,
  manifestDateTime,
} from './manifest-export';
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
  expect(html).not.toContain('بازه را انتخاب کنید، سپس');
  expect(html).not.toContain('قالب انتخاب‌شده');
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

it('shows Gregorian dates in Tehran time for manifest cards', () => {
  expect(manifestDateTime('2026-10-01T08:00:00.000Z')).toMatch(
    /^01\/10\/2026,? 11:30$/,
  );
  expect(manifestDateTime('2026-10-01T08:00:00.000Z', false)).toBe(
    '01/10/2026',
  );
});

it('renders the physical origin to destination order in the RTL table', () => {
  const html = renderToStaticMarkup(
    <ManifestRoute origin="تهران" destination="آنتالیا" />,
  );
  expect(html).toContain('dir="ltr"');
  expect(html).toContain(
    'تهران</span><span aria-hidden="true">→</span><span dir="auto">آنتالیا',
  );
});
