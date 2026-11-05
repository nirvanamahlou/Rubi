import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { FinanceRequestReceipts } from './finance-request-receipts';

it('shows only the selected payment evidence and keeps unscanned downloads disabled', () => {
  const client = new QueryClient();
  client.setQueryData(['finance-request-receipts', 'contract', 'payment', 1], {
    data: [
      {
        id: 'doc',
        capabilities: { download: true },
        currentVersion: {
          id: 'v1',
          originalFileName: 'receipt.pdf',
          safeDownloadName: 'receipt.pdf',
          detectedMimeType: 'application/pdf',
          scanStatus: 'PENDING',
        },
      },
    ],
    meta: { totalPages: 1 },
  });
  client.setQueryData(['finance-request-receipts', 'other', 'payment', 1], {
    data: [{ currentVersion: { originalFileName: 'private-other.pdf' } }],
    meta: { totalPages: 1 },
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <FinanceRequestReceipts contractId="contract" paymentId="payment" />
    </QueryClientProvider>,
  );
  expect(html).toContain('receipt.pdf');
  expect(html).not.toContain('private-other.pdf');
  expect(html).toMatch(/disabled=""[^>]*>دریافت مدرک/);
});
