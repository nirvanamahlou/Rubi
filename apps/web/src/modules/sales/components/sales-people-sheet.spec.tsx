import type { DatePickerProps } from '@/components/ui/date-picker';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesPeopleSheet } from './sales-people-sheet';
import { emptySalesForm } from '../model/sales-form';
// Keep this suite about the real table structure; calendar behavior is covered separately.
vi.mock('./sales-date-picker', () => ({
  SalesDatePicker: (props: DatePickerProps) => (
    <input
      value={props.value}
      disabled={props.disabled}
      readOnly
      data-calendar={props.calendarSystem}
    />
  ),
}));

describe('Sales uses the Customers entry spreadsheet', () => {
  it('shows birth date without a required marker while retaining the booked age hint', () => {
    const html = renderToStaticMarkup(
      <SalesPeopleSheet
        state={emptySalesForm}
        draft={null}
        onDraftChange={vi.fn()}
        onConfirmed={vi.fn()}
        onBusyChange={vi.fn()}
        onAddInfant={vi.fn()}
      />,
    );
    const header = [...html.matchAll(/<th\b[^>]*>[\s\S]*?<\/th>/g)].find((m) =>
      m[0].includes('تاریخ تولد'),
    )?.[0];
    expect(header).toBeDefined();
    expect(header).not.toContain('*');
    expect(html).not.toContain('تاریخ تولد را وارد کنید');
  });
  it('omits acquaintance selection and its loading messages for agency contracts', () => {
    const html = renderToStaticMarkup(
      <SalesPeopleSheet
        state={{
          ...emptySalesForm,
          customerKind: 'organization',
          customerId: 'agency',
          customerName: 'Synthetic Agency',
        }}
        draft={null}
        onDraftChange={vi.fn()}
        onConfirmed={vi.fn()}
        onBusyChange={vi.fn()}
        onAddInfant={vi.fn()}
      />,
    );
    expect(html).not.toContain('نحوه آشنایی');
    expect(html).not.toContain('نحوه‌های آشنایی');
    expect(html).toContain('Synthetic Agency');
    expect(html).toContain('id="sales-entry-p0-first-name"');
  });
  it('renders every requested passenger row immediately with the same columns', () => {
    const html = renderToStaticMarkup(
      <SalesPeopleSheet
        state={{
          ...emptySalesForm,
          passengerComposition: { adults: 2, children: 1, infants: 1 },
        }}
        draft={null}
        onDraftChange={vi.fn()}
        onConfirmed={vi.fn()}
        onBusyChange={vi.fn()}
        onAddInfant={vi.fn()}
      />,
    );
    expect(html).toContain('جدول ورود اطلاعات مشتری و مسافران');
    expect(html).not.toContain('تاریخ شروع سفر');
    const birthHeader = [...html.matchAll(/<th\b[^>]*>[\s\S]*?<\/th>/g)].find(
      (m) => m[0].includes('تاریخ تولد'),
    )?.[0];
    expect(birthHeader).toContain('شمسی');
    expect(birthHeader).toContain('میلادی');
    expect(html.match(/aria-label="نوع تقویم Customers"/g)).toHaveLength(1);

    for (const field of [
      'sales-buyer-name',
      'sales-buyer-phone',
      'sales-buyer-address',
      'sales-buyer-postal',
      'sales-buyer-landline',
    ]) {
      expect(html).toContain(`id="${field}"`);
      expect(html.indexOf(`id="${field}"`)).toBeLessThan(
        html.indexOf('id="sales-entry-p0-first-name"'),
      );
    }
    expect(html.match(/id="sales-entry-p\d+-first-name"/g)).toHaveLength(4);
    expect(html).not.toContain('sales-entry-primary-first-name');
    expect(
      html.match(/aria-label="نحوه آشنایی برای کل قرارداد"/g),
    ).toHaveLength(1);
    expect(html).toContain('مشتری طرف حساب همان مسافر اول است');
    expect(html).not.toContain('شماره پاسپورت');
    expect(html).toContain('تلفن');
    const landlineInput = html.match(
      /<input[^>]*id="sales-buyer-landline"[^>]*>/,
    )?.[0];
    expect(landlineInput).toBeDefined();
    expect(landlineInput).not.toContain('required');
    expect(html).toContain('ایمیل');
    expect(html).toContain('افزودن نوزاد');
    expect(html).toContain('ثبت و تأیید افراد');
    expect(html).not.toContain('بعد از ثبت ردیف قبل');
    expect(html).not.toContain('افزودن ردیف مسافر');
  });
  it('does not create an extra customer row when the first passenger is the customer', () => {
    const html = renderToStaticMarkup(
      <SalesPeopleSheet
        state={{
          ...emptySalesForm,
          firstPassengerIsCustomer: true,
          passengerComposition: { adults: 1, children: 0, infants: 0 },
        }}
        draft={null}
        onDraftChange={vi.fn()}
        onConfirmed={vi.fn()}
        onBusyChange={vi.fn()}
        onAddInfant={vi.fn()}
      />,
    );
    expect(html).toContain('مشتری و مسافر اول');
    expect(html).not.toContain('sales-entry-primary-first-name');
    expect(html).not.toContain('انقضای پاسپورت');
    expect(html).not.toContain(
      'مشتری طرف حساب را در بخش بالای جدول مسافران مشخص کنید',
    );
    expect(html).not.toContain('این مشتری مسافر اول هم هست');
    expect(html.match(/id="sales-entry-p\d+-first-name"/g)).toHaveLength(1);
  });
  it('uses passport identity instead of Persian names for every international passenger', () => {
    const html = renderToStaticMarkup(
      <SalesPeopleSheet
        state={{
          ...emptySalesForm,
          originCountryId: 'iran',
          originCountryCode: 'IR',
          destinationCountryId: 'turkey',
          destinationCountryCode: 'TR',
          serviceKinds: ['FLIGHT'] as typeof emptySalesForm.serviceKinds,
          passengerComposition: { adults: 1, children: 0, infants: 0 },
        }}
        draft={null}
        onDraftChange={vi.fn()}
        onConfirmed={vi.fn()}
        onBusyChange={vi.fn()}
        onAddInfant={vi.fn()}
      />,
    );
    expect(html).toContain('نام انگلیسی مطابق پاسپورت');
    expect(html).toContain('نام خانوادگی انگلیسی مطابق پاسپورت');
    const headers = [...html.matchAll(/<th\b[^>]*>(.*?)<\/th>/gs)].map(
      (match) => match[1]!.replace(/<[^>]*>/g, ''),
    );
    expect(
      headers.filter((h) => h !== 'بلیط رفت' && h !== 'بلیط برگشت').slice(1, 4),
    ).toEqual([
      'نام انگلیسی مطابق پاسپورت *',
      'نام خانوادگی انگلیسی مطابق پاسپورت *',
      'جنسیت *',
    ]);
    expect(html).toMatch(/id="sales-entry-p\d+-passport-first-name"/);
    expect(html).toMatch(/id="sales-entry-p\d+-national-id"/);
    expect(
      html.search(/id="sales-entry-p\d+-passport-first-name"/),
    ).toBeLessThan(html.search(/id="sales-entry-p\d+-national-id"/));
    expect(html).toContain('شماره پاسپورت');
    expect(html).toContain('انقضای پاسپورت');
    expect(html).not.toContain('نام *');
    expect(html).not.toContain('نام خانوادگی *');
    expect(html).toContain('کد ملی');
    expect(
      html.match(/<input[^>]*id="sales-entry-p\d+-national-id"[^>]*>/)?.[0],
    ).not.toContain('required');
    expect(html).toContain('جنسیت *');
  });
});

it.each([['HOTEL'], ['FLIGHT'], ['FLIGHT', 'HOTEL']] as const)(
  'shows shared international fields and optional passport documents for %j',
  (...serviceKinds) => {
    const html = renderToStaticMarkup(
      <SalesPeopleSheet
        state={{
          ...emptySalesForm,
          serviceKinds: [...serviceKinds],
          originCountryCode: 'IRN',
          destinationCountryCode: 'TUR',
          passengerComposition: { adults: 1, children: 0, infants: 0 },
        }}
        draft={null}
        onDraftChange={vi.fn()}
        onConfirmed={vi.fn()}
        onBusyChange={vi.fn()}
        onAddInfant={vi.fn()}
      />,
    );
    expect(html).toContain('sales-entry-p0-passport-first-name');
    expect(html).toContain('sales-entry-p0-passport-last-name');
    const cells = [...html.matchAll(/<th\b[^>]*>(.*?)<\/th>/gs)].map((m) =>
      m[1]!.replace(/<[^>]*>/g, ''),
    );
    expect(cells.indexOf('جنسیت *')).toBeLessThan(
      cells.findIndex((c) => c.includes('تاریخ تولد')),
    );
    expect(cells.indexOf('کد ملی')).toBeGreaterThan(
      cells.indexOf('انقضای پاسپورت'),
    );
    expect(cells).not.toContain('شماره پاسپورت *');
    expect(cells).not.toContain('انقضای پاسپورت *');
    const passport = html.match(
      /<input[^>]*id="sales-entry-p0-passport-number"[^>]*>/,
    )?.[0];
    expect(passport).toBeDefined();
    expect(passport).not.toMatch(/\brequired(?:=|\s|>)/);
  },
);

it('allows passport entry for an existing floating-flight passenger before profile hydration', () => {
  const html = renderToStaticMarkup(
    <SalesPeopleSheet
      state={{
        ...emptySalesForm,
        customerId: 'person',
        customerName: 'Synthetic Person',
        passengers: [
          {
            customerId: 'person',
            displayName: 'Synthetic Person',
            birthDate: '1990-01-01',
          },
        ],
        originCountryCode: 'IR',
        destinationCountryCode: 'TR',
        serviceKinds: ['FLIGHT'],
        passengerComposition: { adults: 1, children: 0, infants: 0 },
        contractFlights: {
          OUTBOUND: {
            departureAt: '',
            arrivalAt: '',
            carrierName: '',
            serviceNumber: '',
            cabinClassCode: 'ECONOMY',
          },
        },
      }}
      draft={null}
      onDraftChange={vi.fn()}
      onConfirmed={vi.fn()}
      onBusyChange={vi.fn()}
      onAddInfant={vi.fn()}
    />,
  );
  for (const field of [
    'passport-first-name',
    'passport-last-name',
    'passport-number',
  ]) {
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((x) => x[0]);
    const input = inputs.find((x) => x.includes(field));
    expect(input).toBeDefined();
    expect(input).not.toContain('disabled=');
    expect(input).not.toContain('readOnly');
  }
});

it('keeps transfer selections and places the three hotel stay columns last in the actual people sheet', () => {
  const html = renderToStaticMarkup(
    <SalesPeopleSheet
      state={{
        ...emptySalesForm,
        passengerComposition: { adults: 2, children: 0, infants: 0 },
        serviceKinds: ['FLIGHT', 'HOTEL', 'TRANSFER'],
        roomDrivenGuests: true,
        tripType: 'ROUND_TRIP',
        hotel: {
          ...emptySalesForm.hotel,
          rooms: [
            {
              ordinal: 1,
              roomTypeId: 'room',
              roomTypeNameSnapshot: 'Standard',
              adults: 2,
              childAges: [],
            },
          ],
          checkIn: '2026-11-01',
          checkOut: '2026-11-08',
        },
      }}
      draft={null}
      onDraftChange={vi.fn()}
      onConfirmed={vi.fn()}
      onBusyChange={vi.fn()}
      onAddInfant={vi.fn()}
      onGuestStateChange={vi.fn()}
    />,
  );
  const headers = html.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? '';
  expect(headers.indexOf('چک‌این هتل')).toBeGreaterThan(
    headers.indexOf('جزئیات'),
  );
  expect(headers.indexOf('چک‌اوت هتل')).toBeGreaterThan(
    headers.indexOf('چک‌این هتل'),
  );
  expect(headers.indexOf('اقامت متفاوت')).toBeGreaterThan(
    headers.indexOf('چک‌اوت هتل'),
  );
  expect(html).not.toContain('مبلغ اقامت متفاوت');
  expect(headers.indexOf('ترانسفر برگشت')).toBeGreaterThan(
    headers.indexOf('ترانسفر رفت'),
  );
  expect(headers).toContain('ترانسفر برگشت');
  const transfers = [...html.matchAll(/<input[^>]+aria-label="ترانسفر[^>]*>/g)];
  expect(transfers).toHaveLength(4);
  for (const input of transfers) expect(input[0]).toContain('checked');
});

it('keeps all duplicate service toggles out of the passenger header', () => {
  const html = renderToStaticMarkup(
    <SalesPeopleSheet
      state={{
        ...emptySalesForm,
        serviceKinds: ['VISA'],
        additionalServices: ['CITY_TOUR', 'TOUR_GUIDE'],
      }}
      draft={null}
      onDraftChange={vi.fn()}
      onConfirmed={vi.fn()}
      onBusyChange={vi.fn()}
      onAddInfant={vi.fn()}
      onGuestStateChange={vi.fn()}
    />,
  );
  const beforeTable = html.slice(0, html.indexOf('<table'));
  expect(beforeTable).not.toContain('گشت شهری');
  expect(beforeTable).not.toContain('راهنما');
  expect(beforeTable).not.toContain('ویزا');
});

it('legacy contracts show customer controls without passenger spreadsheet or composition', () => {
  const html = renderToStaticMarkup(
    <SalesPeopleSheet
      state={{ ...emptySalesForm, legacyContract: true }}
      draft={null}
      onDraftChange={vi.fn()}
      onConfirmed={vi.fn()}
      onBusyChange={vi.fn()}
      onAddInfant={vi.fn()}
    />,
  );
  expect(html).toContain('مشتری قرارداد قدیمی');
  expect(html).not.toContain('<table');
  expect(html).not.toContain('مشتری طرف حساب همان مسافر اول است');
  expect(html).not.toContain('ردیف مسافر');
  expect(html).toContain('نام مشتری');
});
