import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import {
  ContractPaymentCurrencySelect,
  ContractPayments,
} from './contract-payments';
import { PaymentDocuments } from './payment-documents';
import { printFixture } from '../model/contract-print.fixture';

describe('saved contract payment currency control', () => {
  it('offers all-contract tracking search and a dedicated contract receipt section', () => {
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
    expect(html).toContain('آپلود رسید و مدارک پرداخت قرارداد');
    expect(html).toContain('ابتدا یک پرداخت');
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
