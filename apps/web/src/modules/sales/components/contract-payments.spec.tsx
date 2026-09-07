import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import { ContractPaymentCurrencySelect } from './contract-payments';

describe('saved contract payment currency control', () => {
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
