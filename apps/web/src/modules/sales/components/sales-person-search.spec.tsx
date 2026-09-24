import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  SalesPersonSearch,
  salesPersonSearchQuery,
} from './sales-person-search';

describe('focused Sales person search', () => {
  it.each(['customer', 'passenger'] as const)(
    'queries only active people with the %s role',
    (purpose) => {
      expect(salesPersonSearchQuery('  synthetic  ', purpose, 2)).toMatchObject(
        {
          search: 'synthetic',
          kind: 'person',
          role: purpose,
          status: 'active',
          branchId: 'all',
          page: 2,
          pageSize: 10,
        },
      );
    },
  );
  it('uses a bounded result list and a single selection purpose with no nested form', () => {
    const html = renderToStaticMarkup(
      <SalesPersonSearch
        purpose="passenger"
        selectedIds={[]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(html).toContain('جست‌وجوی مسافر');
    expect(html).toContain('max-h-72');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('ثبت مشتری جدید');
  });
});
