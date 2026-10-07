import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ExistingPacksBrowser,
  SavedPackHotelPrices,
} from './existing-packs-browser';
import { OccupancyImportPanel } from './occupancy-import-panel';
import { savedPack } from './existing-packs.fixture';

it('renders a separate city/date saved-pack section with themed search choices', () => {
  const html = renderToStaticMarkup(
    <ExistingPacksBrowser
      branchId="branch-1"
      revision={0}
      canWrite={false}
      onSaved={vi.fn()}
      onLockChange={vi.fn()}
    />,
  );
  expect(html).toContain('بسته‌های موجود');
  expect(html).toContain('شهر بسته‌های موجود');
  expect(html).toContain('تاریخ بسته‌های شهر');
  expect(html).toContain('combobox');
  expect(html).toContain('فقط مشاهده');
  expect(html).not.toContain('<select');
});
it('renders only searched hotels but keeps exact prices, age bands and room context visible', () => {
  const html = renderToStaticMarkup(
    <SavedPackHotelPrices
      pack={savedPack()}
      search="رویال"
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('هتل رویال');
  expect(html).not.toContain('هتل دوم');
  expect(html).toContain('123.456789012');
  expect(html).toContain('3 تا کمتر از 7');
  expect(html).toContain('قیمت واقعی ترکیبی');
  expect(html).toContain('استاندارد');
});
it('makes legacy bases editable only with write permission and does not mislabel compatibility base as an exact price', () => {
  const readonly = renderToStaticMarkup(
    <SavedPackHotelPrices
      pack={savedPack()}
      search="دوم"
      disabled
      onChange={vi.fn()}
    />,
  );
  const editable = renderToStaticMarkup(
    <SavedPackHotelPrices
      pack={savedPack()}
      search="دوم"
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  expect(readonly).toContain('disabled=""');
  expect(editable).not.toContain('disabled=""');
  expect(editable).toContain('قیمت پایهٔ هر نفر / هر شب');
  const exact = renderToStaticMarkup(
    <SavedPackHotelPrices
      pack={savedPack()}
      search="رویال"
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  expect(exact).toContain('پایهٔ سازگاری');
  expect(exact).toContain('disabled=""');
});
it('requires an explicit preview click instead of reading immediately on file selection', () => {
  const html = renderToStaticMarkup(
    <OccupancyImportPanel
      hotels={[]}
      checkIn=""
      checkOut=""
      currency="EUR"
      disabled
      onApply={vi.fn()}
    />,
  );
  expect(html).toContain('دیدن پیش‌نمایش اکسل');
  expect(html).toContain('ابتدا بستهٔ جدید');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain('پیش‌نمایش ردیف');
});

it('keeps a genuine legacy base editable when exact and legacy rooms coexist in one hotel', () => {
  const pack = savedPack();
  pack.rows[0]!.roomRates.push({
    ...pack.rows[1]!.roomRates[0]!,
    roomTypeId: 'legacy-room',
  });
  const html = renderToStaticMarkup(
    <SavedPackHotelPrices
      pack={pack}
      search="رویال"
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('قیمت پایهٔ هر نفر / هر شب');
  expect(html).not.toContain('پایهٔ سازگاری نرخ قدیمی');
  const baseInput = html.match(
    /<input[^>]*aria-label="قیمت پایهٔ هتل رویال"[^>]*>/,
  )?.[0];
  expect(baseInput).toBeDefined();
  expect(baseInput).not.toContain('disabled');
});
