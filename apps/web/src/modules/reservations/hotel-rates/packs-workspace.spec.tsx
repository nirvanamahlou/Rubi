import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  availableFactors,
  HotelRatePackTable,
  OccupancyFactorFields,
} from './packs-workspace';

const callbacks = {
  opening: false,
  activeId: null,
  onOpen: vi.fn(),
  onDraftFocus: vi.fn(),
};

it('shows an unsaved new pack as a visible row in the hotel management table', () => {
  const html = renderToStaticMarkup(
    <HotelRatePackTable
      packs={[]}
      draft={{
        cityName: 'بستهٔ جدید',
        checkIn: '',
        checkOut: '',
        nights: 0,
        hotelCount: 0,
        currency: 'EUR',
      }}
      {...callbacks}
    />,
  );
  expect(html).toContain('aria-label="جدول بسته‌های نرخ هتل"');
  expect(html).toContain('بستهٔ جدید');
  expect(html).toContain('ثبت‌نشده');
  expect(html).toContain('تکمیل پیش‌نویس');
  expect(html).not.toContain('هنوز بسته‌ای ثبت نشده است');
});

it('lists city, dates, nights, selected hotels and a reopen action in columns', () => {
  const html = renderToStaticMarkup(
    <HotelRatePackTable
      draft={null}
      packs={[
        {
          id: 'pack-1',
          branchId: 'branch-1',
          cityId: 'city-1',
          cityName: 'تهران',
          checkIn: '2027-02-01',
          checkOut: '2027-02-06',
          hotelCount: 3,
          currency: 'EUR',
          method: 'STAY',
          version: 2,
          updatedAt: '2026-09-15T00:00:00Z',
        },
      ]}
      {...callbacks}
    />,
  );
  expect(html).toContain('<table');
  expect(html).toContain('تهران');
  expect(html).toContain('2027-02-01');
  expect(html).toContain('2027-02-06');
  expect(html).toContain('بازکردن و ویرایش');
  expect(html).toContain('هتل منتخب');
});

it('shows all occupancy coefficients in one optional row and keeps blank values unavailable', () => {
  const factors = {
    double: '1',
    single: '',
    triple: '1.3',
    doubleChild: '',
    doubleTwoChildren: '1.4',
    family: '',
  };
  const html = renderToStaticMarkup(
    <OccupancyFactorFields
      hotelName="رویال وینگز"
      base="250"
      currency="USD"
      factors={factors}
      onChange={vi.fn()}
    />,
  );

  for (const label of [
    'دبل',
    'سینگل',
    'تریپل',
    'دبل + ۱ بچه',
    'دبل + ۲ بچه',
    'فمیلی',
  ])
    expect(html).toContain(label);
  expect(html).toContain('placeholder="ندارد"');
  expect(html).not.toContain('required=""');
  expect(availableFactors(factors)).toEqual({
    double: '1',
    triple: '1.3',
    doubleTwoChildren: '1.4',
  });
});
