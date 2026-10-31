import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ManualHotelPanel, type ManualHotelRow } from './manual-hotel-panel';
import type * as Controls from './controls';
vi.mock('./controls', async (importOriginal) => ({
  ...(await importOriginal<typeof Controls>()),
  Lookup: ({ kind, label }: { kind: string; label: string }) => (
    <span data-source={kind}>{label}</span>
  ),
}));
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
  it('shows all selected hotel panels stacked without hiding inactive hotels', () => {
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
    expect(html).not.toContain('hidden=""');
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
      'دبل با کودک با تخت',
      'افزودن ردیف',
      'Land View',
      'Sea View',
      'قیمت خرید',
      'ردهٔ سنی هر کودک',
    ])
      expect(html).toContain(text);
    expect(html.match(/data-room-type=/g)).toHaveLength(1);
    for (const room of ['Land View']) {
      expect(html).toContain('aria-label="جدول ضرایب هتل ' + room + '"');
      expect(html).toContain('aria-label="قیمت ترکیب‌های ' + room + '"');
    }
    expect(html).not.toContain('جدول ضرایب مشترک هتل');
    expect(html).not.toContain('قیمت فروش');
    expect(html).not.toContain('تغییر گروهی فروش');
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('<select');
    expect(html).toContain('قیمت پایه Land View');
    expect(html).not.toContain('قیمت پایه Sea View');
    expect(html).toContain('انتخاب نوع اتاق Sea View');
    expect(html).toContain('data-source="brokers"');
    expect(html).not.toContain('data-source="organizations"');
  });
  it('shows inline room type creation only when Master Data access is available', () => {
    const props = {
      rows: [row],
      hotelId: 'h1',
      checkIn: '2026-10-01',
      checkOut: '2026-11-01',
      onChoose: vi.fn(),
      onChange: vi.fn(),
      onValidityChange: vi.fn(),
      onAddRoomType: vi.fn().mockResolvedValue({ id: 'room-3', name: 'Suite' }),
    };
    const permitted = renderToStaticMarkup(
      <ManualHotelPanel {...props} canAddRoomType />,
    );
    const readOnly = renderToStaticMarkup(
      <ManualHotelPanel {...props} canAddRoomType={false} />,
    );
    expect(permitted).toContain('افزودن نوع اتاق');
    expect(readOnly).not.toContain('افزودن نوع اتاق');
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
