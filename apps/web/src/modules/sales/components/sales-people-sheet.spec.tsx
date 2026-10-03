import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SalesPeopleSheet } from './sales-people-sheet';
import { emptySalesForm } from '../model/sales-form';
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
    for (const field of [
      'sales-buyer-name',
      'sales-buyer-phone',
      'sales-buyer-address',
      'sales-buyer-postal',
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
    expect(html).toContain(
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
    expect(html).toContain('شماره پاسپورت');
    expect(html).toContain('انقضای پاسپورت');
    expect(html).not.toContain('نام *');
    expect(html).not.toContain('نام خانوادگی *');
    expect(html).toContain('کد ملی *');
    expect(html).toContain('جنسیت *');
  });
});
