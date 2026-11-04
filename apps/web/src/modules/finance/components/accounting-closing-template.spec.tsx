import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { TooltipProvider } from '@/components/ui/overlays';
import { AccountingDocumentTemplate } from './accounting-document-template';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./accounting-setup-notes', () => ({
  parseSetupNotes: () => [],
  AccountingSetupNotes: () => null,
}));
describe('observed closing template', () => {
  it('renders counterpart and closable grids without inferred header fields', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <AccountingDocumentTemplate
          kind="CLOSING"
          busy={false}
          run={vi.fn()}
          book={
            {
              templates: [],
              accounts: [],
              details: [],
            } as unknown as AccountingSnapshotV1
          }
        />
      </TooltipProvider>,
    );
    for (const text of [
      'حساب های طرف مقابل',
      'حساب های قابل بستن',
      'شمول/عدم شمول',
      'درصد',
      'شرح پیش فرض',
      'فعال',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('سود و زیان انباشته');
    expect(html).not.toContain('نوع سند');
    expect(html).not.toContain('سمت');
  });
});
