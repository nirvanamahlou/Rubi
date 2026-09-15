import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from './api';
import { InternalSections } from './internal-sections';

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
  }, 20_000);
});
