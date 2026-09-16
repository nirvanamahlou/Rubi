import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from './api';
import { InternalSections, SampleInvoiceForm } from './internal-sections';
import { sampleRequests } from './sample-requests';

const bootstrap: Bootstrap = {
  permissions: [],
  branches: [],
  currencies: [],
  requester: null,
  policy: 'POLICY_NOT_CONFIGURED',
  finance: 'NOT_CONNECTED',
  documents: 'UNAVAILABLE',
  travel: 'NOT_CONNECTED',
};

describe('Purchase section date filters', () => {
  it('shows the project calendar range in all seven internal sections', () => {
    for (const group of [1, 2, 3, 4, 5, 6, 7] as const) {
      const html = renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <InternalSections
            group={group}
            bootstrap={bootstrap}
            selectedId={null}
            detailPending={false}
            detailError={null}
            onRetryDetail={() => undefined}
            onOpen={() => undefined}
            onClose={() => undefined}
            onCreate={() => undefined}
            onSaved={() => undefined}
          />
        </QueryClientProvider>,
      );
      expect(html).toContain(`proc-section-${group}-from-date`);
      expect(html).toContain(`proc-section-${group}-to-date`);
      expect(html).toContain('شمسی / میلادی');
    }
  }, 40_000);

  it('renders an actionable invoice form for readable invoice rows', () => {
    const request = sampleRequests.find((item) => item.section === 7);
    expect(request).toBeDefined();
    const html = renderToStaticMarkup(
      <SampleInvoiceForm
        request={request!}
        currencies={[{ id: 'irr', code: 'IRR', name: 'ریال ایران' }]}
      />,
    );

    expect(html).toContain('sample-invoice-number');
    expect(html).toContain('sample-invoice-order');
    expect(html).toContain('sample-invoice-issued');
    expect(html).toContain('sample-invoice-amount');
    expect(html).toContain('ثبت فاکتور');
  });
});
