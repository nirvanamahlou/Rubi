import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TaxReferenceWorkspace } from './tax-reference-workspace';
import { parseTaxReferenceCsv } from '@nora/contracts';

describe('official tax reference import and selection', () => {
  it('shows unassigned Nora sources and exposes import only to a manager', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(['seasonal-mappings', 'book', 'CURRENCY'], {
      release: null,
      entries: [],
      sources: [
        {
          id: 'local',
          code: 'AAA',
          title: 'Synthetic currency',
          entryId: null,
        },
      ],
    });
    const render = (manage: boolean) =>
      renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <TaxReferenceWorkspace bookId="book" canManage={manage} />
        </QueryClientProvider>,
      );
    expect(render(false)).toContain('Synthetic currency');
    expect(render(false)).toContain('تعیین نشده');
    expect(render(false)).not.toContain('type="file"');
    expect(render(true)).toContain('type="file"');
    client.clear();
  });
  it('previews quoted UTF-8 CSV with leading zeroes and rejects a broken or duplicate row', () => {
    expect(
      parseTaxReferenceCsv('\uFEFFcode,title\r\n0004,"A, ""B"""\r\n'),
    ).toEqual([{ code: '0004', title: 'A, "B"' }]);
    for (const csv of [
      'code,title\n001,A\n001,B',
      'code,title\n',
      'wrong,title\n001,A',
      'code,title\n001,"unfinished',
      'code,title\n001,A\u0000B',
    ])
      expect(() => parseTaxReferenceCsv(csv)).toThrow();
  });
});
