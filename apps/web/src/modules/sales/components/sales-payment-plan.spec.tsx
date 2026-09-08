import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SalesPaymentInput } from '@rubi/contracts';
import { SalesPaymentPlan, withPaymentMethod } from './sales-payment-plan';
const currencies = [{ code: 'IRR', name: 'ریال', status: 'active' as const }];
const cash: SalesPaymentInput = {
  amount: '2500000',
  currencyCode: 'IRR',
  dueAt: '2026-10-01T10:00',
  method: 'CASH',
};
const check: SalesPaymentInput = {
  ...cash,
  method: 'CHECK',
  check: {
    bankId: '',
    secureIdentifier: 'SYNTHETIC-REFERENCE',
    ownerName: 'Synthetic Owner',
    dueDate: '2026-10-02',
  },
};
const render = (payments: SalesPaymentInput[], disabled = false) =>
  renderToStaticMarkup(
    <SalesPaymentPlan
      payments={payments}
      currencies={currencies}
      banks={[]}
      disabled={disabled}
      onChange={vi.fn()}
    />,
  );
describe('compact contract payment plan', () => {
  it('shows an actionable empty state and explains Finance confirmation', () => {
    const html = render([]);
    expect(html).toContain('هنوز پرداختی برنامه‌ریزی نشده');
    expect(html).toContain('افزودن پرداخت');
    expect(html).toContain('واحد مالی');
    expect(html).toContain('برنامهٔ پرداخت');
  });
  it('numbers rows and explicitly labels amount, currency, method and due date', () => {
    const html = render([cash, cash]);
    expect(html).toContain('aria-label="پرداخت 1"');
    expect(html).toContain('aria-label="پرداخت 2"');
    expect(html).toContain('مبلغ پرداخت');
    expect(html).toContain('سررسید پرداخت');
    expect(html).toContain('2,500,000');
    expect(html).toContain('روش پرداخت');
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('اطلاعات چک پرداخت');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('groups check details and restores controlled draft values', () => {
    const html = render([check]);
    expect(html).toContain('اطلاعات چک پرداخت 1');
    expect(html).toContain('بانک صادرکننده');
    expect(html).toContain('تاریخ سررسید چک');
    expect(html).toContain('value="SYNTHETIC-REFERENCE"');
    expect(html).toContain('value="Synthetic Owner"');
    expect(html).toContain('۱ چک');
    expect(html).toContain('aria-label="حذف پرداخت 1"');
  });
  it('does not offer to charge included-only services', () => {
    expect(render([], true)).toContain('پرداخت جدا ندارند');
    expect(render([], true)).toContain('disabled=""');
  });
  it('removes inactive check metadata on method changes without mutating the draft', () => {
    const changed = withPaymentMethod(check, 'BANK_TRANSFER');
    expect(changed.check).toBeUndefined();
    expect(changed.amount).toBe(check.amount);
    expect(changed.dueAt).toBe(check.dueAt);
    expect(check.check?.secureIdentifier).toBe('SYNTHETIC-REFERENCE');
    expect(withPaymentMethod(check, 'CHECK').check).toEqual(check.check);
  });
});
