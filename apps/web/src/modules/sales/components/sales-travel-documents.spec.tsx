import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

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
}));

import {
  SalesContractTermsDownload,
  SalesTravelDocuments,
} from './sales-travel-documents';

describe('Sales contract terms download', () => {
  it('downloads the shared contract terms PDF with a clear filename', () => {
    const html = renderToStaticMarkup(<SalesContractTermsDownload />);

    expect(html).toContain('href="/contracts/terms.pdf"');
    expect(html).toContain('download="مفاد-قرارداد.pdf"');
    expect(html).toContain('aria-label="دانلود PDF مفاد قرارداد"');
    expect(html).toContain('دانلود مفاد قرارداد');
  });

  it('does not expose travel documents before the authorized server read succeeds', () => {
    const html = renderToStaticMarkup(
      <SalesTravelDocuments contractId="synthetic-contract" />,
    );

    expect(html).not.toContain('/contracts/terms.pdf');
    expect(html).toContain('مدارک مسافر · تأیید مالی');
  });
});
