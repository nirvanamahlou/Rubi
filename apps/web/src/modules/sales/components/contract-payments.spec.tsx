import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

// Render dialog content for the server-side initial-state checks; Radix portals
// otherwise intentionally render nothing without a DOM.
vi.mock('@/components/ui/overlays', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <section role="dialog">{children}</section>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
import type { MasterDataRecord } from '@rubi/contracts';
import {
  ContractPaymentCurrencySelect,
  ContractPayments,
} from './contract-payments';
import { PaymentDocuments } from './payment-documents';
import { printFixture } from '../model/contract-print.fixture';

describe('saved contract payment currency control', () => {
  it('opens history separately without showing an unsaved payment or unrelated receipt picker', () => {
    const html = renderToStaticMarkup(
      <ContractPayments
        id="sample"
        onClose={() => undefined}
        onSaved={() => undefined}
        onSearchContracts={() => undefined}
      />,
    );
    expect(html).toContain('جست‌وجوی شماره پیگیری در همه قراردادها');
    expect(html).toContain('پیدا کردن قرارداد');
    expect(html).not.toContain(
      'جست‌وجوی شماره پیگیری در پرداخت‌های این قرارداد',
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('پرداخت‌ها و اقساط قرارداد');
    expect(html).toContain('در حال دریافت پرداخت‌ها');
    expect(html).not.toContain('ثبت پرداخت و ادامه برای رسید');
    expect(html).not.toContain('پرداخت مربوط به مدرک');
  });
  it('shows file selection/upload without an extra expand click in the receipt section', () => {
    const html = renderToStaticMarkup(
      <PaymentDocuments
        contract={printFixture.contract}
        paymentId="sample-payment"
        expanded
      />,
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('انتخاب فایل مدرک پرداخت');
    expect(html).toContain('application/pdf,image/jpeg,image/png');
    expect(html).toContain('تأیید');
  });
  it('renders a themed button combobox rather than an editable currency textbox', () => {
    const currencies = [
      { code: 'IRR', name: 'ریال', status: 'active' },
    ] as MasterDataRecord[];
    const html = renderToStaticMarkup(
      <ContractPaymentCurrencySelect
        currencies={currencies}
        value="IRR"
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="ارز پرداخت"');
    expect(html).toContain('<button');
    expect(html).not.toContain('<input');
  });
  it('disables the selector when registered active currencies are unavailable', () => {
    const html = renderToStaticMarkup(
      <ContractPaymentCurrencySelect
        currencies={[]}
        value=""
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('disabled');
    expect(html).toContain('فهرست ارزهای فعال در دسترس نیست');
  });
});
