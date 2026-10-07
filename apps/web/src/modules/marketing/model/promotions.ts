import type {
  MarketingAssetInputV1,
  MarketingAssetViewV1,
} from '@nora/contracts';

export interface PromotionDraft {
  name: string;
  code: string;
  discountType: string;
  value: string;
  currencyCode: string;
  minimumPurchase: string;
  usageLimit: string;
  perCustomerLimit: string;
  service: string;
  combinability: string;
  description: string;
  status: string;
  startsAt: string;
  endsAt: string;
}
export function promotionDraft(row?: MarketingAssetViewV1): PromotionDraft {
  const p = row?.payload ?? {};
  return {
    name: row?.name ?? '',
    code: String(p.code ?? ''),
    discountType: String(p.discountType ?? 'PERCENT'),
    value: String(p.value ?? '10'),
    currencyCode: String(p.currencyCode ?? 'IRR'),
    minimumPurchase: String(p.minimumPurchase ?? '0'),
    usageLimit: String(p.usageLimit ?? '100'),
    perCustomerLimit: String(p.perCustomerLimit ?? '1'),
    service: String(p.service ?? 'ALL'),
    combinability: String(p.combinability ?? 'EXCLUSIVE'),
    description: String(p.description ?? ''),
    status: row?.status ?? 'DRAFT',
    startsAt: row?.scheduledAt ?? '',
    endsAt: row?.expiresAt ?? '',
  };
}
export function promotionInput(
  kind: 'COUPON' | 'OFFER',
  draft: PromotionDraft,
  target: { kind: 'customer' | 'agency'; id: string } | null,
  row?: MarketingAssetViewV1,
): MarketingAssetInputV1 {
  if (
    draft.name.trim().length < 2 ||
    !draft.startsAt ||
    !draft.endsAt ||
    !Number.isFinite(Date.parse(draft.startsAt)) ||
    !Number.isFinite(Date.parse(draft.endsAt)) ||
    Date.parse(draft.startsAt) >= Date.parse(draft.endsAt)
  )
    throw new Error('نام و بازه اعتبار پیشنهاد را کامل کنید.');
  if (
    !/^\d{1,20}(?:\.\d{1,4})?$/.test(draft.value) ||
    Number(draft.value) <= 0 ||
    (draft.discountType === 'PERCENT' && Number(draft.value) > 100)
  )
    throw new Error('مقدار تخفیف معتبر نیست.');
  if (
    !/^\d{1,20}(?:\.\d{1,4})?$/.test(draft.minimumPurchase) ||
    ![draft.usageLimit, draft.perCustomerLimit].every(
      (v) => /^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 1000000,
    ) ||
    Number(draft.perCustomerLimit) > Number(draft.usageLimit)
  )
    throw new Error('سقف استفاده و حداقل خرید معتبر نیست.');
  const code = draft.code.trim().toUpperCase();
  if (kind === 'COUPON' && !/^[A-Z0-9_-]{3,64}$/.test(code))
    throw new Error('کد تخفیف معتبر نیست.');
  return {
    kind,
    name: draft.name.trim(),
    status: draft.status,
    scheduledAt: new Date(draft.startsAt).toISOString(),
    expiresAt: new Date(draft.endsAt).toISOString(),
    targetCustomerId: target?.kind === 'customer' ? target.id : null,
    targetAgencyId: target?.kind === 'agency' ? target.id : null,
    ...(row ? { expectedVersion: row.version } : {}),
    payload: {
      code: kind === 'COUPON' ? code : '',
      discountType: draft.discountType,
      value: draft.value,
      currencyCode: draft.currencyCode,
      minimumPurchase: draft.minimumPurchase,
      usageLimit: Number(draft.usageLimit),
      perCustomerLimit: Number(draft.perCustomerLimit),
      service: draft.service,
      combinability: draft.combinability,
      description: draft.description.trim(),
    },
  };
}
export function assertPromotionSaved(
  row: MarketingAssetViewV1,
  input: MarketingAssetInputV1,
  id?: string,
  branchId?: string,
) {
  const canonicalDecimal = (value: unknown) =>
    String(value)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
  if (
    !row?.id ||
    row.kind !== input.kind ||
    row.name !== input.name ||
    row.status !== input.status ||
    (branchId && row.branchId !== branchId) ||
    !row.payload ||
    Date.parse(row.scheduledAt ?? '') !== Date.parse(input.scheduledAt ?? '') ||
    Date.parse(row.expiresAt ?? '') !== Date.parse(input.expiresAt ?? '') ||
    Object.entries(input.payload).some(([key, value]) =>
      ['value', 'minimumPurchase'].includes(key)
        ? canonicalDecimal(row.payload[key]) !== canonicalDecimal(value)
        : row.payload[key] !== value,
    ) ||
    (id && row.id !== id) ||
    !Number.isInteger(row.version) ||
    row.version < (input.expectedVersion ?? 0) + 1 ||
    row.targetCustomerId !== input.targetCustomerId ||
    row.targetAgencyId !== input.targetAgencyId
  )
    throw new Error('پاسخ ثبت معتبر نیست؛ همان درخواست را دوباره بررسی کنید.');
  return row;
}
