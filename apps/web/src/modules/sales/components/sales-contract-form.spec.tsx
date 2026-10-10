import type * as React from 'react';
import { emptySalesForm, type SalesFormState } from '../model/sales-form';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesContractForm } from './sales-contract-form';

const fixture = vi.hoisted(() => ({
  flight: false,
  hotel: false,
  roundTrip: false,
  step: 0,
  ticketDraft: null as SalesFormState | null,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    let value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    if (
      value &&
      typeof value === 'object' &&
      'serviceKinds' in value &&
      fixture.flight
    )
      value = { ...emptySalesForm, serviceKinds: ['FLIGHT'] };
    if (
      value &&
      typeof value === 'object' &&
      'serviceKinds' in value &&
      fixture.roundTrip
    )
      value = { ...value, tripType: 'ROUND_TRIP', serviceKinds: ['FLIGHT'] };
    if (
      value &&
      typeof value === 'object' &&
      'serviceKinds' in value &&
      fixture.hotel
    )
      value = {
        ...emptySalesForm,
        serviceKinds: ['HOTEL'],
        departureDate: '2099-10-01',
        passengers: [
          {
            customerId: 'guest',
            displayName: 'Synthetic Guest',
            birthDate: '2000-01-01',
          },
        ],
        hotel: {
          ...emptySalesForm.hotel,
          checkIn: '2099-10-01',
          checkOut: '2099-10-04',
          guestCustomerIds: ['guest'],
        },
      };
    if (
      value &&
      typeof value === 'object' &&
      'serviceKinds' in value &&
      fixture.ticketDraft
    )
      value = fixture.ticketDraft;
    if (value === 0) value = fixture.step;
    return [value, vi.fn()];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('compact sales contract form', () => {
  it('explains invalid final-step data without hiding the form', () => {
    fixture.step = 3;
    let html: string;
    try {
      html = renderToStaticMarkup(<SalesContractForm />);
    } finally {
      fixture.step = 0;
    }
    expect(html).toContain('نیازمند اصلاح قبل از ثبت');
    expect(html).toContain('disabled');
  });
  it('shows passenger package prices without catalog/day-sale or service agreement fields', () => {
    fixture.step = 3;
    fixture.ticketDraft = {
      ...emptySalesForm,
      serviceKinds: ['FLIGHT'],
      ticket: { ...emptySalesForm.ticket, outboundOfferId: 'OUT' },
      servicePricing: {},
      passengers: [
        { customerId: 'one', displayName: 'Sample', birthDate: '1990-01-01' },
      ],
      outboundOffer: {
        id: 'OUT',
        version: 1,
        branchId: 'branch',
        originId: 'origin',
        destinationId: 'destination',
        departureAt: '2099-10-01T08:00:00.000Z',
        arrivalAt: '2099-10-01T10:00:00.000Z',
        carrierName: 'Carrier',
        serviceNumber: 'OUT',
        cabinClassCode: 'ECONOMY',
        totalCapacity: 20,
        remainingCapacity: 20,
        status: 'ACTIVE',
        standaloneSalePrice: {
          revision: 1,
          amount: '125',
          currencyCode: 'IRR',
        },
      },
    };
    let html: string;
    try {
      html = renderToStaticMarkup(<SalesContractForm />);
    } finally {
      fixture.step = 0;
      fixture.ticketDraft = null;
    }
    expect(html).toContain('قیمت ریالی Sample');
    expect(html).toContain('قیمت ارزی Sample');
    expect(html).not.toContain('قیمت روز فروش بلیط');
    expect(html).not.toContain('مبلغ توافق‌شده با مشتری بلیط');
  });
  it('uses the passenger table for round-trip packages without two agreement prices', () => {
    fixture.roundTrip = true;
    fixture.step = 3;
    const html = renderToStaticMarkup(<SalesContractForm />);
    fixture.roundTrip = false;
    fixture.step = 0;
    expect(html).toContain('قیمت ریالی (IRR)');
    expect(html).toContain('قیمت ارزی');
    expect(html).not.toContain('قیمت روز فروش');
    expect(html).not.toContain('مبلغ توافق‌شده با مشتری');
  });
  it('keeps hotel guests and aggregate rooms without asking each guest for an occupancy type', () => {
    fixture.hotel = true;
    fixture.step = 2;
    const html = renderToStaticMarkup(<SalesContractForm />);
    fixture.hotel = false;
    fixture.step = 0;
    expect(html).toContain('اعضای اقامت هتل');
    expect(html).toContain('Synthetic Guest');
    expect(html).toContain('اتاق');
    expect(html).not.toContain('نوع اقامت ·');
    expect(html).not.toContain('نوع اقامت هر مسافر');
  });
  it('puts exact flight date choices after route and passenger counts in the first step', () => {
    fixture.flight = true;
    const html = renderToStaticMarkup(<SalesContractForm />);
    fixture.flight = false;
    expect(html).not.toContain('انتخاب تاریخ بلیط رفت و بلیط برگشت');
    expect(html).toContain('تاریخ بلیط رفت');
    expect(html).toContain('نقطهٔ قرمز');
    expect(html.indexOf('تعداد مسافران')).toBeLessThan(
      html.indexOf('aria-label="تاریخ بلیط رفت"'),
    );
    expect(
      html.match(/aria-label="انتخاب تاریخ بلیط رفت و برگشت"/g),
    ).toHaveLength(1);
    expect(html).not.toContain('بازه تاریخ سفر (الزامی)');
  });
  it('shows a bounded form and compact services without asking for a route date', () => {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('max-w-6xl');
    expect(html).toContain('min-w-0');
    expect(html).toContain('grid-cols-[minmax(0,1fr)]');
    expect(html).toContain('داشبورد قراردادها');
    expect(html).toContain('مراحل ثبت قرارداد');
    expect(html).toContain('مسیر سفر');
    expect(html).toContain('تعداد مسافران');
    expect(html).toContain('بزرگسال');
    expect(html).toContain('کودک');
    expect(html).toContain('نوزاد');
    expect(html.match(/type="number"/g)).toHaveLength(3);
    for (const label of ['بزرگسال', 'کودک', 'نوزاد']) {
      expect(html).toContain(`aria-label="تعداد ${label}"`);
    }
    expect(html).toContain('نوزاد لازم نیست در تعداد صندلی بلیط شمرده شود');
    expect(html).toContain('aria-label="مبدأ سفر"');
    expect(html).toContain('aria-label="مقصد سفر"');
    expect(html).toMatch(
      /aria-label="مبدأ سفر"[\s\S]*کشور مبدأ[\s\S]*شهر مبدأ[\s\S]*aria-label="مقصد سفر"[\s\S]*کشور مقصد[\s\S]*شهر مقصد/,
    );
    expect(html).not.toContain('تاریخ رفت');
    expect(html).not.toContain('min-h-[420px]');
    expect(html.indexOf('کشور مبدأ')).toBeLessThan(html.indexOf('شهر مبدأ'));
    expect(html.indexOf('شهر مبدأ')).toBeLessThan(html.indexOf('کشور مقصد'));
  });
});

it('offers the expert reservation note on sale pricing rather than only at final submission', () => {
  fixture.step = 3;
  const html = renderToStaticMarkup(<SalesContractForm />);
  fixture.step = 0;
  expect(html).toContain('یادداشت کارشناس برای رزرواسیون (اختیاری)');
  expect(html).toMatch(/maxlength="500"/i);
  expect(html).not.toContain('در توضیحات درخواست رزرواسیون نمایش داده می‌شود.');
  expect(html).toContain('یادداشت قیمت‌گذاری');
  fixture.step = 4;
  const final = renderToStaticMarkup(<SalesContractForm />);
  fixture.step = 0;
  expect(final).not.toContain('یادداشت کارشناس برای رزرواسیون (اختیاری)');
});
