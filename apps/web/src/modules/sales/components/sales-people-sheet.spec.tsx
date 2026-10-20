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
        onTravelDateChange={vi.fn()}
      />,
    );
    expect(html).toContain('جدول ورود اطلاعات مشتری و مسافران');
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
        onTravelDateChange={vi.fn()}
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
        onTravelDateChange={vi.fn()}
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
      'کد ملی *',
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
    expect(html).toContain('کد ملی *');
    expect(html).toContain('جنسیت *');
  });
});

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
      onTravelDateChange={vi.fn()}
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
      onTravelDateChange={vi.fn()}
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

it('shows the city tour, guide and existing visa toggles together above the passenger table', () => {
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
      onTravelDateChange={vi.fn()}
      onGuestStateChange={vi.fn()}
      onToggleVisa={vi.fn()}
    />,
  );
  const beforeTable = html.slice(0, html.indexOf('<table'));
  expect(beforeTable).toContain('گشت شهری');
  expect(beforeTable).toContain('راهنما');
  expect(beforeTable).toContain('ویزا');
  const toggles = [
    ...beforeTable.matchAll(/<input[^>]*type="checkbox"[^>]*>/g),
  ].map((m) => m[0]);
  expect(
    toggles.filter((input) => input.includes('checked')).length,
  ).toBeGreaterThanOrEqual(3);
});
