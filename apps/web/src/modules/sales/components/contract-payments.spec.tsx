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
import type { MasterDataRecord } from '@nora/contracts';
import {
  ContractPaymentAccountSelect,
  ContractPaymentCurrencySelect,
  ContractPaymentShareSummary,
  ContractPayments,
} from './contract-payments';
import { PaymentDocuments } from './payment-documents';
import { printFixture } from '../model/contract-print.fixture';

describe('saved contract payment currency control', () => {
  it('shows a required searchable destination using only accounts matching the payment currency', () => {
    const html = renderToStaticMarkup(
      <ContractPaymentAccountSelect
        accounts={[
          {
            id: 'irr',
            title: 'Company IRR',
            currencyCode: 'IRR',
            kind: 'BANK',
            maskedIdentifier: '****1234',
          },
          {
            id: 'usd',
            title: 'Company USD',
            currencyCode: 'USD',
            kind: 'BANK',
            maskedIdentifier: null,
          },
        ]}
        currencyCode="IRR"
        value="irr"
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('حساب مقصد پرداخت');
    expect(html).toContain('Company IRR');
    expect(html).not.toContain('Company USD');
    expect(html).toContain('****1234');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('required');
  });
  it('does not silently choose an incompatible account when the currency has no accounts', () => {
    const html = renderToStaticMarkup(
      <ContractPaymentAccountSelect
        accounts={[]}
        currencyCode="USD"
        value=""
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('disabled');
    expect(html).toContain('حساب فعالی برای ارز پرداخت');
  });
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
    expect(html).not.toContain('هزینه خرید و سود قرارداد');
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
  it('renders an inline searchable combobox for registered currencies', () => {
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
    expect(html).toMatch(/<input[^>]*role="combobox"/);
    expect(html).toContain('data-search-select="true"');
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
  it('shows total, entered share, pending amount and projected remainder for the selected currency', () => {
    const html = renderToStaticMarkup(
      <ContractPaymentShareSummary
        balances={[
          {
            amount: '192000000',
            currencyCode: 'IRR',
            confirmedPaid: '32000000',
            pendingFinance: '10000000',
            outstanding: '160000000',
          },
          {
            amount: '1000',
            currencyCode: 'USD',
            confirmedPaid: '0',
            pendingFinance: '0',
            outstanding: '1000',
          },
        ]}
        currencyCode="IRR"
        amount="48000000"
      />,
    );
    expect(html).toContain('مبلغ کل قرارداد');
    expect(html).toContain('192,000,000 ﷼');
    expect(html).toContain('48,000,000 ﷼');
    expect(html).toContain('25٪ از کل قرارداد');
    expect(html).toContain('در انتظار مالی: 10,000,000 ﷼');
    expect(html).toContain('112,000,000 ﷼');
    expect(html).not.toContain('1,000 $');
  });
});

it('shows the named company destination and full bank identifiers for the selected currency', () => {
  const account = {
    id: 'account',
    title: 'Operating account',
    bankName: 'Example Bank',
    currencyCode: 'IRR',
    kind: 'BANK',
    maskedIdentifier: '••001',
    accountNumber: '123456789012',
    cardNumber: '6037990000000000',
    iban: 'IR000000000000000000000001',
  };
  const html = renderToStaticMarkup(
    <ContractPaymentAccountSelect
      accounts={[
        account,
        {
          ...account,
          id: 'other',
          title: 'Foreign account',
          currencyCode: 'USD',
        },
      ]}
      currencyCode="IRR"
      value="account"
      onChange={() => undefined}
    />,
  );
  for (const text of [
    account.title,
    account.bankName,
    account.accountNumber,
    account.cardNumber,
    account.iban,
  ])
    expect(html).toContain(text);
  expect(html).toContain('dir="ltr"');
  expect(html).not.toContain('Foreign account');
  expect(html).not.toContain('••001');
});
it('keeps older masked account responses usable and hides stale selections after currency changes', () => {
  const account = {
    id: 'account',
    title: 'Legacy account',
    currencyCode: 'IRR',
    kind: 'BANK',
    maskedIdentifier: '••001',
  };
  const render = (currencyCode: string) =>
    renderToStaticMarkup(
      <ContractPaymentAccountSelect
        accounts={[account]}
        currencyCode={currencyCode}
        value="account"
        onChange={() => undefined}
      />,
    );
  expect(render('IRR')).toContain('••001');
  expect(render('USD')).not.toContain('Legacy account');
  expect(render('USD')).toContain('disabled');
});
