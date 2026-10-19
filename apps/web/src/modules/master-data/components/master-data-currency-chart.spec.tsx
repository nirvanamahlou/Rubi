import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FinanceChart } from './master-data-finance-workspace';

const rate = {
  id: 'direct-rate',
  fromCurrencyId: 'usd',
  toCurrencyId: 'irr',
  fromCurrencyCode: 'USD',
  toCurrencyCode: 'IRR',
  rate: '270000',
  rateType: 'BUY' as const,
  source: 'manual',
  observedAt: '2026-10-19T08:00:00Z',
  validFrom: '2026-10-19T08:00:00Z',
  validTo: null,
  status: 'APPROVED' as const,
  createdByUserId: 'registrant',
  approvedByUserId: 'registrant',
  approvedAt: '2026-10-19T08:00:00Z',
  version: 1,
  isAuthoritative: false as const,
};

describe('directly registered reference rate chart', () => {
  it('renders the first finalized quote as a visible point without a second approval', () => {
    const html = renderToStaticMarkup(<FinanceChart rates={[rate]} />);
    expect(html).toContain('<circle');
    expect(html).toContain('cx="50"');
    expect(html).toContain('270000');
    expect(html).not.toContain('NaN');
  });
  it('shows the trend for subsequent quotes but does not silently finalize legacy drafts', () => {
    const html = renderToStaticMarkup(
      <FinanceChart
        rates={[
          rate,
          {
            ...rate,
            id: 'next',
            rate: '280000',
            observedAt: '2026-10-19T09:00:00Z',
          },
          { ...rate, id: 'legacy', rate: '999999', status: 'DRAFT' },
        ]}
      />,
    );
    expect(html.match(/<circle/g)).toHaveLength(2);
    expect(html).not.toContain('999999');
  });
});
