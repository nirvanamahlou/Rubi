import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PurchaseFxSummary } from './purchase-fx';
const entry = {
  referenceId: 'purchase',
  currencyCode: 'EUR',
  foreignAmount: '915',
  rateToIrr: '300000',
  source: 'SYSTEM_SELL',
  baselineAt: '2026-10-17T00:00:00Z',
  baselineEquivalent: '274500000',
  paidForeignAmount: '915',
  paidBaselineEquivalent: '274500000',
  actualPaidEquivalent: '284500000',
  realizedGainLoss: '-10000000',
};
describe('purchase FX display', () => {
  it('shows baseline, real payment and a red loss without treating unspent foreign balance as profit', () => {
    const html = renderToStaticMarkup(<PurchaseFxSummary entries={[entry]} />);
    expect(html).toContain('274,500,000');
    expect(html).toContain('284,500,000');
    expect(html).toContain('-10,000,000');
    expect(html).toContain('text-rose-600');
  });
  it('keeps unavailable baseline and gain/loss unknown', () => {
    const html = renderToStaticMarkup(
      <PurchaseFxSummary
        entries={[
          {
            ...entry,
            rateToIrr: null,
            baselineEquivalent: null,
            realizedGainLoss: null,
          },
        ]}
      />,
    );
    expect(html).toContain('—');
    expect(html).not.toContain('-10,000,000');
  });
});
