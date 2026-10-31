import type { DatePickerProps } from '@/components/ui/date-picker';
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
  firstDetail: false,
  zeroIndex: 0,
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
    if (value === 0)
      value = fixture.firstDetail
        ? fixture.zeroIndex++ === 0
          ? fixture.step
          : 0
        : fixture.step;
    return [value, vi.fn()];
  },
}));
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({ context: { legalEntity: null } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// This suite checks the parent workflow/layout; calendar rendering has its own coverage.
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: (props: DatePickerProps) => (
    <button
      type="button"
      aria-label={props['aria-label']}
      disabled={props.disabled}
    >
      {props.value || 'انتخاب تاریخ'}
    </button>
  ),
}));

describe('compact sales contract form', () => {
  it('keeps review as a non-submitting screen with an explicit final action', () => {
    fixture.step = 2;
    let html: string;
    try {
      html = renderToStaticMarkup(<SalesContractForm />);
    } finally {
      fixture.step = 0;
    }
    expect(html).toContain('ثبت و ارسال به رزرواسیون');
    expect(html).not.toMatch(/<button[^>]*type="submit"/);
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*>ثبت و ارسال به رزرواسیون<\/button>/,
    );
  });
  it('never offers an implicit submit action while advancing to review', () => {
    fixture.step = 1;
    let html: string;
    try {
      html = renderToStaticMarkup(<SalesContractForm />);
    } finally {
      fixture.step = 0;
    }
    expect(html).not.toMatch(/<button[^>]*type="submit"/);
    expect(html).not.toContain('ثبت و ارسال به رزرواسیون');
  });

  it('explains invalid final-step data without hiding the form', () => {
    fixture.step = 1;
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
    fixture.step = 1;
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
    expect(html).toContain('مبلغ کل قرارداد');
    expect(html).toContain('جمع خودکار قرارداد');
    expect(html).toContain('قیمت کل خدمات هر مسافر');
    expect(html).toContain('قیمت ریالی');
    expect(html).toContain('قیمت ارزی');
    expect(html).not.toContain('قیمت پرواز Sample');
    expect(html).not.toContain('قیمت ریالی Sample');
    expect(html).not.toContain('افزودن مبلغ با ارز دیگر');
    expect(html).not.toContain('قیمت روز فروش بلیط');
    expect(html).not.toContain('مبلغ توافق‌شده با مشتری بلیط');
  });
  it('uses the passenger table for round-trip packages without two agreement prices', () => {
    fixture.roundTrip = true;
    fixture.step = 1;
    const html = renderToStaticMarkup(<SalesContractForm />);
    fixture.roundTrip = false;
    fixture.step = 0;
    expect(html).toContain('مبلغ کل قرارداد');
    expect(html).toContain('خلاصه خدمات قرارداد');
    expect(html).not.toContain('قیمت روز فروش');
    expect(html).not.toContain('مبلغ توافق‌شده با مشتری');
  });
  it('keeps hotel guests and aggregate rooms without asking each guest for an occupancy type', () => {
    fixture.hotel = true;
    fixture.step = 0;
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
    expect(html.match(/type="number"/g)).toHaveLength(3);
    for (const label of ['بزرگسال', 'کودک', 'نوزاد'])
      expect(html).toContain(`aria-label="تعداد ${label}"`);
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
    expect(html).toContain('مرحله 1 از 3');
    expect(html).not.toContain('از 5');
    expect(html).not.toContain('جزئیات سفر');
    expect(html).toContain('مسیر سفر');
    expect(html).toContain('ویزا');
    expect(html).toContain('گشت شهری');
    expect(html).toContain('راهنما');
    expect(html).not.toContain('CIP');
    expect(html).not.toContain('تعداد مسافران');
    expect(html).not.toContain('type="number"');
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
  fixture.step = 1;
  const html = renderToStaticMarkup(<SalesContractForm />);
  fixture.step = 0;
  expect(html).toContain('یادداشت کارشناس برای رزرواسیون (اختیاری)');
  expect(html).toMatch(/maxlength="500"/i);
  expect(html).not.toContain('در توضیحات درخواست رزرواسیون نمایش داده می‌شود.');
  expect(html).toContain('یادداشت قیمت‌گذاری');
  expect(html).toContain('یادداشت قرارداد / Notice (اختیاری)');
  expect(html).toMatch(/maxlength="1000"/i);
  fixture.step = 2;
  const final = renderToStaticMarkup(<SalesContractForm />);
  fixture.step = 0;
  expect(final).not.toContain('یادداشت کارشناس برای رزرواسیون (اختیاری)');
});

it('does not block hotel details while the date rate request is still pending', () => {
  fixture.firstDetail = true;
  fixture.zeroIndex = 0;
  fixture.step = 0;
  fixture.ticketDraft = {
    ...emptySalesForm,
    serviceKinds: ['HOTEL'],
    hotel: {
      ...emptySalesForm.hotel,
      hotelId: 'hotel',
      checkIn: '2099-10-01',
      checkOut: '2099-10-05',
    },
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).not.toContain('تا دریافت موفق ادامه ندهید');
    expect(html).toContain('نوع اتاق');
  } finally {
    fixture.firstDetail = false;
    fixture.step = 0;
    fixture.ticketDraft = null;
  }
});
it('keeps flight-only passenger validation independent from stale hotel draft fields', () => {
  fixture.step = 0;
  fixture.ticketDraft = {
    ...emptySalesForm,
    customerId: 'person',
    departureDate: '2099-10-01',
    serviceKinds: ['FLIGHT'],
    passengers: [
      {
        customerId: 'person',
        displayName: 'Synthetic',
        birthDate: '1990-01-01',
      },
    ],
    hotel: {
      ...emptySalesForm.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'old',
          roomTypeNameSnapshot: 'Old',
          adults: 1,
          childAges: [null],
        },
      ],
    },
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).not.toContain(
      'هر مسافر باید حداقل یک خدمت انتخاب‌شده داشته باشد.',
    );
    expect(html).toContain('تأیید مسیر و خدمات');
  } finally {
    fixture.step = 0;
    fixture.ticketDraft = null;
  }
});

it('keeps hotel room and composition selection available inside a selected tour', () => {
  fixture.step = 0;
  fixture.firstDetail = true;
  fixture.zeroIndex = 0;
  fixture.ticketDraft = {
    ...emptySalesForm,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    tour: {
      id: 'tour',
      startsOn: '2099-10-01',
      endsOn: '2099-10-04',
      package: {
        id: 'package',
        name: 'Synthetic package',
        hotelIds: ['hotel'],
      },
    } as SalesFormState['tour'],
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('جست‌وجو و انتخاب تور');
    expect(html).toContain('ورود (چک‌این)');
    expect(html).toContain('خروج (چک‌اوت)');
  } finally {
    fixture.step = 0;
    fixture.firstDetail = false;
    fixture.zeroIndex = 0;
    fixture.ticketDraft = null;
  }
});

it('keeps tour selection inline without an unrelated standalone flight search calendar', () => {
  fixture.step = 0;
  fixture.firstDetail = true;
  fixture.zeroIndex = 0;
  const offer = {
    id: 'offer',
    version: 1,
    branchId: 'branch',
    originId: 'origin',
    destinationId: 'destination',
    departureAt: '2099-10-01T10:00:00Z',
    arrivalAt: '2099-10-01T12:00:00Z',
    carrierName: 'Synthetic',
    serviceNumber: 'S1',
    cabinClassCode: 'ECONOMY' as const,
    totalCapacity: 10,
    remainingCapacity: 10,
    status: 'ACTIVE' as const,
  };
  fixture.ticketDraft = {
    ...emptySalesForm,
    serviceKinds: ['FLIGHT'],
    originId: 'origin',
    destinationId: 'destination',
    departureDate: '2099-10-01',
    outboundOffer: offer,
    tour: {
      id: 'tour',
      version: 1,
      branchId: 'branch',
      startsOn: '2099-10-01',
      endsOn: '2099-10-04',
      outboundOfferId: 'offer',
      outbound: offer,
      remainingCapacity: 10,
      packageId: 'package',
      packageVersion: 1,
      package: {
        id: 'package',
        name: 'Synthetic package',
        hotelIds: [],
        version: 1,
        branchId: 'branch',
        createdAt: '2099-09-01T00:00:00Z',
        originId: 'origin',
        destinationId: 'destination',
        transferOutbound: false,
        transferReturn: false,
        visa: false,
      },
    } as SalesFormState['tour'],
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('جست‌وجو و انتخاب تور');
    expect(html).not.toContain('aria-label="انتخاب تاریخ بلیط رفت و برگشت"');
    expect(html).not.toContain('جزئیات سفر');
  } finally {
    fixture.step = 0;
    fixture.firstDetail = false;
    fixture.zeroIndex = 0;
    fixture.ticketDraft = null;
  }
});

it('places combined flight selection and stay dates before identities and hides redundant party counts', () => {
  fixture.step = 0;
  fixture.ticketDraft = {
    ...emptySalesForm,
    roomDrivenGuests: true,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    hotel: {
      ...emptySalesForm.hotel,
      hotelId: 'hotel',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          roomTypeNameSnapshot: 'Double',
          adults: 2,
          childAges: [],
        },
      ],
    },
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    const people = html.indexOf('ورود یکجای مشتری و مسافران');
    expect(people).toBeGreaterThan(0);
    expect(html.indexOf('تاریخ اقامت مهمانان')).toBeLessThan(people);
    expect(html).not.toContain('جست‌وجوی بلیط‌ها');
    expect(html).not.toContain('انتخاب بلیط پرواز');
    expect(html).not.toContain('جزئیات سفر');
    expect(html).not.toContain('>تعداد مسافران</h2>');
    expect(html).toContain('افزودن مسافر (فقط پرواز)');
  } finally {
    fixture.ticketDraft = null;
    fixture.step = 0;
  }
}, 30000);

it('keeps only the service toggle in the transfer card and moves leg choices to passenger rows', () => {
  fixture.step = 0;
  fixture.ticketDraft = {
    ...emptySalesForm,
    serviceKinds: ['TRANSFER'],
    tripType: 'ROUND_TRIP',
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    const card =
      [...html.matchAll(/<fieldset[^>]*>[\s\S]*?<\/fieldset>/g)].find((m) =>
        m[0].includes('ترانسفر'),
      )?.[0] ?? '';
    expect(card).toContain('ترانسفر');
    expect(card.match(/<input/g)).toHaveLength(1);
    expect(card).not.toContain('تعداد مسافران ترانسفر');
    expect(card).not.toContain('sales-directions-TRANSFER');
    expect(html).toContain('ترانسفر رفت');
    expect(html).toContain('ترانسفر برگشت');
  } finally {
    fixture.ticketDraft = null;
    fixture.step = 0;
  }
});

it.each([0, 1, 2])(
  'uses the same three-step model for the header and navigation at stage %s',
  (step) => {
    fixture.step = step;
    try {
      const html = renderToStaticMarkup(<SalesContractForm />);
      expect(html).toContain(`مرحله ${step + 1} از 3`);
      const progress =
        html.match(
          /<ol[^>]*aria-label="مراحل ثبت قرارداد"[\s\S]*?<\/ol>/,
        )?.[0] ?? '';
      expect(progress.match(/<li\b/g)).toHaveLength(3);
      expect(html).not.toContain('جزئیات سفر');
      expect(html).not.toContain('از 5');
    } finally {
      fixture.step = 0;
    }
  },
);

it.each([
  [false, '1960-01-01', false],
  [true, '1960-01-01', true],
  [true, '2000-01-01', false],
] as const)(
  'scopes the age-insurance notice to selected insurance and the current passenger (%s, %s)',
  (insured, birthDate, visible) => {
    fixture.step = 0;
    fixture.ticketDraft = {
      ...emptySalesForm,
      serviceKinds: insured ? ['OTHER', 'INSURANCE'] : ['OTHER'],
      departureDate: '2030-10-01',
      passengers: [
        { customerId: 'current', displayName: 'Synthetic Current', birthDate },
      ],
      insuranceExtraToman: { removed: '100' },
    };
    try {
      const html = renderToStaticMarkup(<SalesContractForm />);
      expect(html.includes('هزینه بیمه ممکن است بیشتر باشد.')).toBe(visible);
      expect(html.includes('هزینه اضافه بیمه همین مسافر')).toBe(visible);
      expect(html).not.toContain(
        'در صورت انتخاب بیمه، فیلد هزینه اضافه فعال می‌شود.',
      );
    } finally {
      fixture.ticketDraft = null;
      fixture.step = 0;
    }
  },
);

it('legacy flow keeps services and age counts but still requires complete travel data without a passenger table', () => {
  fixture.ticketDraft = {
    ...emptySalesForm,
    legacyContract: true,
    serviceKinds: ['FLIGHT'],
    customerId: 'buyer',
    customerName: 'Synthetic Buyer',
    originId: 'origin',
    destinationId: 'destination',
    departureDate: '2026-10-01',
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('قرارداد قدیمی');
    expect(html).toContain('مسیر سفر');
    expect(html).not.toContain('تاریخ سفر');
    expect(html).not.toContain('تاریخ شروع سفر');
    expect(html).toContain('تعداد مسافران');
    expect(html).not.toContain('<table');
    const next = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(
      (match) => match[0].includes('تأیید مسیر و خدمات'),
    )?.[0];
    expect(next).toBeDefined();
    expect(next).toMatch(/ disabled(?:=|>|\s)/);
  } finally {
    fixture.ticketDraft = null;
  }
});

it('shows historical prices once in the customer table, with rial, foreign, discount and commission', () => {
  fixture.step = 1;
  fixture.ticketDraft = {
    ...emptySalesForm,
    legacyContract: true,
    customerId: 'buyer',
    customerName: 'Synthetic Historical Buyer',
    serviceKinds: ['HOTEL', 'FLIGHT'],
    contractPrices: [{ amount: '100', currencyCode: 'EUR' }],
  };
  try {
    const html = renderToStaticMarkup(<SalesContractForm />);
    expect(html).toContain('Synthetic Historical Buyer');
    expect(html).toContain('aria-label="قیمت ریالی"');
    expect(html).toContain('aria-label="قیمت ارزی"');
    expect(html).toContain('aria-label="تخفیف"');
    expect(html).toContain('aria-label="کمیسیون"');
    expect(html).not.toContain('قیمت روز فروش');
    expect(html).not.toContain('مبلغ توافق‌شده با مشتری');
  } finally {
    fixture.step = 0;
    fixture.ticketDraft = null;
  }
});
