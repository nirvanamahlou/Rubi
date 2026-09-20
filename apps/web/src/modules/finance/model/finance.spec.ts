import { describe, expect, it } from 'vitest';

import { normalizeFinanceWorkspaceQuery } from '../api/contracts';
import {
  filterFinanceFeatures,
  filterFinanceRecords,
  financeFeatures,
  financePreviewRecords,
  paginateFinanceRecords,
  validateFinancePreviewDraft,
} from './finance';

describe('finance preview model', () => {
  it('contains exactly the requested 30 searchable capabilities', () => {
    expect(financeFeatures).toHaveLength(30);
    expect(financeFeatures.map((feature) => feature.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(
      filterFinanceFeatures({ search: 'صیاد', group: 'ALL' }),
    ).toHaveLength(1);
    expect(filterFinanceFeatures({ search: '', group: 'ledger' })).toHaveLength(
      8,
    );
  });

  it('normalizes filters and bounded pagination', () => {
    expect(
      normalizeFinanceWorkspaceQuery({
        search: `  ${'x'.repeat(120)}  `,
        page: 0,
        pageSize: 100,
      }),
    ).toMatchObject({
      search: 'x'.repeat(100),
      page: 1,
      pageSize: 50,
      branchReference: 'ALL',
      currencyCode: 'ALL',
    });
  });

  it('filters, sorts and paginates synthetic records', () => {
    const query = normalizeFinanceWorkspaceQuery({
      currencyCode: 'IRR',
      sortBy: 'dueAt',
      sortDirection: 'asc',
      pageSize: 2,
    });
    const results = filterFinanceRecords(financePreviewRecords, query);
    expect(results.every((record) => record.currencyCode === 'IRR')).toBe(true);
    expect(paginateFinanceRecords(results, 1, 2)).toHaveLength(2);
  });

  it('validates decimal, public references, concurrency and idempotency fields', () => {
    const valid = validateFinancePreviewDraft({
      title: 'سند نمایشی جدید',
      partyReference: 'preview-party-001',
      contractReference: 'preview-contract-001',
      amount: '1250000.50',
      currencyCode: 'IRR',
      description: 'شرح کاملاً ساختگی برای کنترل فرم',
      expectedVersion: '1',
      idempotencyKey: 'finance:journal:preview-001',
    });
    expect(valid).toEqual({ valid: true, errors: {} });

    const invalid = validateFinancePreviewDraft({
      title: 'x',
      partyReference: 'real-party',
      contractReference: 'contract',
      amount: '1,000',
      currencyCode: 'IRR',
      description: 'کوتاه',
      expectedVersion: '0',
      idempotencyKey: 'short',
    });
    expect(invalid.valid).toBe(false);
    expect(Object.keys(invalid.errors)).toEqual(
      expect.arrayContaining([
        'title',
        'partyReference',
        'contractReference',
        'amount',
        'description',
        'expectedVersion',
        'idempotencyKey',
      ]),
    );
  });
});
