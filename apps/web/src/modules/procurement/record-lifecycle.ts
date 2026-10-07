export const procurementRecordStages = [
  {
    id: 'sourcing',
    label: 'استعلام و سفارش',
    kinds: [
      ['quotations', 'استعلام‌ها و پیشنهادها'],
      ['orders', 'سفارش‌های خرید'],
    ],
  },
  {
    id: 'delivery',
    label: 'تحویل و کنترل',
    kinds: [
      ['receipts', 'رسید کالا'],
      ['acceptances', 'پذیرش خدمت'],
      ['adjustments', 'اصلاح رسید'],
      ['discrepancies', 'مغایرت'],
      ['returns', 'مرجوعی'],
    ],
  },
  {
    id: 'finance',
    label: 'فاکتور و مالی',
    kinds: [
      ['invoices', 'فاکتورها'],
      ['handoffs', 'ارجاع مالی'],
    ],
  },
  { id: 'history', label: 'تاریخچه', kinds: [['audit', 'تاریخچه']] },
] as const;

export function visibleProcurementRecordStages(canReadAudit: boolean) {
  return procurementRecordStages.filter(
    (stage) => stage.id !== 'history' || canReadAudit,
  );
}

export function resolveProcurementRecordStage(
  kind: string,
  canReadAudit: boolean,
) {
  const stages = visibleProcurementRecordStages(canReadAudit);
  const stage =
    stages.find((candidate) =>
      candidate.kinds.some(([value]) => value === kind),
    ) ?? stages[0]!;
  const activeKind =
    stage.kinds.find(([value]) => value === kind)?.[0] ?? stage.kinds[0]![0];
  return { stage, activeKind, stages };
}
