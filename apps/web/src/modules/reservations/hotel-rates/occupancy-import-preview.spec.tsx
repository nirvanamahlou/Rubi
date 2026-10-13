import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OccupancyImportPreview } from './occupancy-import-preview';
import type { ImportedOccupancy } from './occupancy-import';

const rate: ImportedOccupancy = {
  hotel: 'TEST HOTEL',
  room: 'DOUBLE',
  board: 'BB',
  capacity: '2 AD',
  sourceRow: 6,
  adults: 2,
  childAges: [],
  composition: '2 AD',
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-11-01',
  amount: '123.45678',
  currencyCode: 'EUR',
};
describe('read-only occupancy preview', () => {
  it('reconciles data rows, valid rates, exclusions and errors without rounding prices', () => {
    const html = renderToStaticMarkup(
      <OccupancyImportPreview
        rows={[rate]}
        issues={['ردیف 7: تاریخ نامعتبر']}
        excluded={2}
      />,
    );
    expect(html).toContain('کل ردیف‌های داده</dt><dd class="font-bold">۴');
    expect(html).toContain('EUR: ۱');
    expect(html).toContain('TEST HOTEL');
    expect(html).toContain('123.45678');
    expect(html).toContain('2026-10-31');
    expect(html).toContain('ردیف 7: تاریخ نامعتبر');
    expect(html).toContain('این پیش‌نمایش ثبت نیست');
    expect(html).not.toContain('type="submit"');
  });
  it('bounds rendered records to 30 and reports distinct hotel-room pairs', () => {
    const rows = Array.from({ length: 65 }, (_, i) => ({
      ...rate,
      sourceRow: i + 6,
      room: `ROOM-${i}`,
    }));
    const html = renderToStaticMarkup(
      <OccupancyImportPreview rows={rows} issues={[]} excluded={0} />,
    );
    expect(html).toContain('ROOM-29');
    expect(html).not.toContain('ROOM-30');
    expect(html).toContain('صفحه ۱ از ۳');
    expect(html).toContain('اتاق هتل با نرخ سالم</dt><dd class="font-bold">۶۵');
  });
  it('shows invalid-only files without suggesting successful rates', () => {
    const html = renderToStaticMarkup(
      <OccupancyImportPreview
        rows={[]}
        issues={['ردیف 9: قیمت نامعتبر']}
        excluded={0}
      />,
    );
    expect(html).toContain('نرخ سالم خوانده‌شده</dt><dd class="font-bold">۰');
    expect(html).toContain('نرخ سالمی مطابق جست‌وجو پیدا نشد');
  });
});
