import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ManualHotelPanel, type ManualHotelRow } from './manual-hotel-panel';
const row: ManualHotelRow = {
  hotel: {
    id: 'h1',
    name: 'رویال وینگز',
    roomTypes: [
      { id: 'r1', name: 'Land View' },
      { id: 'r2', name: 'Sea View' },
    ],
  },
  selected: true,
  broker: null,
  base: '1',
  currency: 'EUR',
  inCityList: true,
  roomRates: [],
};
describe('manual hotel coefficient tables', () => {
  it('keeps both selected hotel panels mounted, hiding only the inactive hotel', () => {
    const html = renderToStaticMarkup(
      <ManualHotelPanel
        rows={[
          row,
          { ...row, hotel: { ...row.hotel, id: 'h2', name: 'هتل دوم' } },
        ]}
        hotelId="h1"
        checkIn="2026-10-01"
        checkOut="2026-11-01"
        onChoose={vi.fn()}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );
    expect(html.match(/<article /g)).toHaveLength(2);
    expect(html).toContain('hidden=""');
  });
  it('renders searchable hotel, composition selectors, room bases and purchase/sale columns', () => {
    const html = renderToStaticMarkup(
      <ManualHotelPanel
        rows={[row]}
        hotelId="h1"
        checkIn="2026-10-01"
        checkOut="2026-11-01"
        onChoose={vi.fn()}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );
    for (const text of [
      'جدول ضرایب هتل',
      'دبل',
      'سینگل',
      'کودک با تخت',
      'افزودن ردیف',
      'Land View',
      'Sea View',
      'قیمت خرید',
      'قیمت فروش',
      'ردهٔ سنی هر کودک',
    ])
      expect(html).toContain(text);
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('<select');
    expect(html).toContain('قیمت پایه Land View');
    expect(html).toContain('قیمت پایه Sea View');
  });
  it('never converts imported amounts into manual factors', () => {
    const imported = {
      ...row,
      roomRates: [
        {
          roomTypeId: 'r1',
          roomTypeName: 'Land View',
          factor: '1',
          maxAdults: '2',
          maxChildren2To6: '0',
          maxChildren6To12: '0',
          maxInfants: '0',
          occupancyRates: [
            {
              adults: 2,
              childAges: [],
              startsOn: '2026-10-01',
              endsOnExclusive: '2026-11-01',
              currencyCode: 'EUR',
              amount: '200',
              composition: 'DBL',
              board: '',
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(
      <ManualHotelPanel
        rows={[imported]}
        hotelId="h1"
        checkIn="2026-10-01"
        checkOut="2026-11-01"
        onChoose={vi.fn()}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );
    expect(html).toContain('برای حفظ نرخ‌های واردشده');
    expect(html).not.toContain('ضریب ترکیب اتاق');
  });
});
