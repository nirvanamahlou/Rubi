export const B2B_SIGNATORY_DOCUMENT_TYPES = [
  'FRAMEWORK_AGREEMENT',
  'SALES_CONTRACT',
  'FINANCIAL_DOCUMENT',
  'OTHER',
] as const;
export type B2bSignatoryDocumentType =
  (typeof B2B_SIGNATORY_DOCUMENT_TYPES)[number];
export interface B2bSignatoryInputV1 {
  branchId: string;
  contactId: string;
  documentTypes: B2bSignatoryDocumentType[];
  authorityLimit: string | null;
  currencyCode: string | null;
  validFrom: string;
  validTo: string | null;
  documentId: string | null;
  documentVersionId: string | null;
  isActive: boolean;
  notes: string;
  version?: number;
}
export interface B2bSignatoryV1 extends B2bSignatoryInputV1 {
  contactName: string;
  contactActive: boolean;
  id: string;
  organizationId: string;
  version: number;
  updatedAt: string;
}
export function b2bSignatoryIssue(
  value: B2bSignatoryInputV1,
): string | undefined {
  if (!value.contactId) return 'شخص امضادار را انتخاب کنید.';
  if (
    !Array.isArray(value.documentTypes) ||
    !value.documentTypes.length ||
    value.documentTypes.some(
      (type) => !B2B_SIGNATORY_DOCUMENT_TYPES.includes(type),
    )
  )
    return 'حداقل یک نوع سند قابل امضا را انتخاب کنید.';
  const day = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (
    !day(value.validFrom) ||
    (value.validTo && (!day(value.validTo) || value.validTo < value.validFrom))
  )
    return 'بازه اعتبار امضادار معتبر نیست.';
  if (
    value.authorityLimit !== null &&
    !/^\d{1,20}(?:\.\d{1,4})?$/.test(value.authorityLimit)
  )
    return 'سقف اختیار باید مبلغ نامنفی با حداکثر چهار رقم اعشار باشد.';
  if (
    (value.authorityLimit !== null) !== Boolean(value.currencyCode) ||
    (value.currencyCode && !/^[A-Z]{3}$/.test(value.currencyCode))
  )
    return 'مبلغ سقف اختیار و ارز آن را با هم تعیین کنید.';
  if (value.isActive && !value.documentId)
    return 'برای فعال‌کردن امضادار، مدرک اختیار معتبر را انتخاب کنید.';
  if (value.notes.length > 1000) return 'توضیحات حداکثر ۱۰۰۰ نویسه است.';
}
