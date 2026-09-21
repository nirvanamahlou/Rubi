import type {
  ProcurementDraftV1,
  ProcurementRequestStatus,
} from '@nora/contracts';
export const statusLabels: Record<ProcurementRequestStatus, string> = {
  DRAFT: 'پیش‌نویس',
  SUBMITTED: 'ارسال‌شده',
  IN_REVIEW: 'در بررسی',
  CHANGES_REQUESTED: 'نیازمند اصلاح',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
  SOURCING: 'در حال تأمین',
  CLOSED: 'بسته‌شده',
};
export function emptyDraft(
  unitId: string | null = null,
  branchId = '',
): ProcurementDraftV1 {
  return {
    title: '',
    branchId,
    unitId,
    purchaseType: 'خرید عمومی',
    category: '',
    needReason: '',
    requiredAt: null,
    priority: 'NORMAL',
    urgent: false,
    urgencyReason: '',
    estimatedAmount: null,
    currencyCode: null,
    unknownEstimateReason: '',
    deliveryLocation: '',
    notes: '',
    documents: [],
    items: [],
    origin: { kind: 'GENERAL' },
  };
}
export function reconcileDraft(
  base: ProcurementDraftV1,
  local: ProcurementDraftV1,
  latest: ProcurementDraftV1,
) {
  const merged = structuredClone(latest);
  const conflicts: (keyof ProcurementDraftV1)[] = [];
  for (const key of Object.keys(base) as (keyof ProcurementDraftV1)[]) {
    if (JSON.stringify(local[key]) === JSON.stringify(base[key])) continue;
    if (
      JSON.stringify(latest[key]) !== JSON.stringify(base[key]) &&
      JSON.stringify(local[key]) !== JSON.stringify(latest[key])
    )
      conflicts.push(key);
    else Object.assign(merged, { [key]: local[key] });
  }
  return { merged, conflicts };
}
