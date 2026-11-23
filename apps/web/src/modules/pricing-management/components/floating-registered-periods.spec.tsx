import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { FloatingTourSaleSet } from '@nora/contracts';
import {
  FloatingRegisteredPeriods,
  floatingRegisteredPeriods,
} from './floating-registered-periods';
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
const row = {
  sourceRows: [2],
  startsOn: '2027-01-01',
  endsOn: '2027-01-08',
  nights: 7,
  stays: [
    {
      hotelId: 'h1',
      hotelName: 'Hotel One',
      cityId: 'city',
      room: 'Standard',
      service: 'BB',
      location: '',
      nights: 7,
    },
  ],
  prices: { double: [{ currency: 'EUR' as const, amount: '100' }] },
  commission: [],
};
const catalog: FloatingTourSaleSet = {
  version: 1,
  dated: [
    row,
    { ...row, stays: [{ ...row.stays[0]!, hotelName: 'Hotel Two' }] },
    { ...row, startsOn: '2027-02-01', salesStopped: true },
  ],
  monthly: null,
};
it('groups hotels into separate date/night cards and shows their saved prices and sale status', () => {
  expect(floatingRegisteredPeriods(catalog).map((p) => p.rows.length)).toEqual([
    2, 1,
  ]);
  const html = renderToStaticMarkup(
    <FloatingRegisteredPeriods
      catalog={catalog}
      tourId="tour"
      session={{} as never}
      canManage
      busy={false}
      periodFilter=""
      onChange={() => {}}
    />,
  );
  expect(html).toContain('Hotel One');
  expect(html).toContain('Hotel Two');
  expect(html).toContain('فروش بازه متوقف است');
  expect(html).toContain('ادامه فروش بازه');
  expect(html).toContain('تغییر گروهی قیمت‌های همین بازه');
  expect(html.match(/value="100"/g)).toHaveLength(3);
});
it('filters dated cards and prevents read-only users editing or stopping prices', () => {
  const html = renderToStaticMarkup(
    <FloatingRegisteredPeriods
      catalog={catalog}
      tourId="tour"
      session={{} as never}
      canManage={false}
      busy={false}
      periodFilter="2027-01-01/7"
      onChange={() => {}}
    />,
  );
  expect(html).not.toContain('فروش بازه متوقف است');
  expect(
    html.match(/<button[^>]*disabled=""[^>]*>توقف فروش بازه/),
  ).not.toBeNull();
  expect(html.match(/<input[^>]*value="100"[^>]*>/)?.[0]).toContain(
    'disabled=""',
  );
});
