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
    expect(html.match(/id="sales-entry-p\d+-first-name"/g)).toHaveLength(4);
    expect(html).toContain('sales-entry-primary-first-name');
    expect(html).toContain('پاسپورت');
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
    expect(html).toContain('sales-entry-primary-first-name');
    expect(html).toContain('انقضای پاسپورت');
    expect(html).toContain('این مشتری مسافر اول هم هست');
    expect(html.match(/id="sales-entry-p\d+-first-name"/g)).toHaveLength(1);
  });
});
