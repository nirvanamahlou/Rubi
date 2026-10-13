import { describe, expect, it } from 'vitest';
import {
  procurementRecordStages,
  resolveProcurementRecordStage,
  visibleProcurementRecordStages,
} from './record-lifecycle';

describe('Procurement record lifecycle navigation', () => {
  it('consolidates all record types into the four business stages', () => {
    expect(procurementRecordStages.map(({ label }) => label)).toEqual([
      'استعلام و سفارش',
      'تحویل و کنترل',
      'فاکتور و مالی',
      'تاریخچه',
    ]);
    expect(
      procurementRecordStages.flatMap((stage) =>
        stage.kinds.map(([kind]) => kind),
      ),
    ).toEqual([
      'quotations',
      'orders',
      'receipts',
      'acceptances',
      'adjustments',
      'discrepancies',
      'returns',
      'invoices',
      'handoffs',
      'audit',
    ]);
  });

  it('keeps history permission-gated and resolves inaccessible history safely', () => {
    expect(visibleProcurementRecordStages(false).map(({ id }) => id)).toEqual([
      'sourcing',
      'delivery',
      'finance',
    ]);
    expect(resolveProcurementRecordStage('audit', false)).toMatchObject({
      stage: { id: 'sourcing' },
      activeKind: 'quotations',
    });
    expect(resolveProcurementRecordStage('audit', true)).toMatchObject({
      stage: { id: 'history' },
      activeKind: 'audit',
    });
  });
});
