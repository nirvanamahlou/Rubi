import { describe, it, expect } from 'vitest';
import {
  financePreviewRows,
  filterFinancePreview,
  previewTotals,
} from './finance-preview';
describe('isolated finance preview', () => {
  it('reconciles each currency without counting pending checks, guarantees or disputes as receipts', () => {
    expect(previewTotals('IRR')).toEqual({
      invoiced: 200000000n,
      received: 100000000n,
      outstanding: 100000000n,
    });
    expect(previewTotals('USD')).toEqual({
      invoiced: 3000n,
      received: 1000n,
      outstanding: 2000n,
    });
    for (const row of financePreviewRows.settlement)
      expect(BigInt(row.amount)).toBe(previewTotals(row.currency).outstanding);
  });
  it('filters inclusive date boundaries and currencies and rejects a reversed interval', () => {
    const filter = {
      currency: 'IRR',
      status: '',
      from: '2026-09-03',
      to: '2026-09-05',
    };
    expect(
      filterFinancePreview(financePreviewRows.statement, filter).map(
        (r) => r.id,
      ),
    ).toEqual(['DEMO-INV-002', 'DEMO-RCP-001']);
    expect(
      filterFinancePreview(financePreviewRows.statement, {
        ...filter,
        from: '2026-09-06',
      }),
    ).toEqual([]);
    expect(
      filterFinancePreview(financePreviewRows.checks, {
        currency: '',
        status: 'تضمینی',
        from: '',
        to: '',
      }).map((r) => r.id),
    ).toEqual(['DEMO-CHK-002']);
  });
});
