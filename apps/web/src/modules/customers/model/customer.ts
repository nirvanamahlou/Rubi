import type {
  ConsentStatus,
  CustomerListQuery,
  CustomerSummary,
} from '../api/contracts';

export type CustomerPreviewState =
  'preview' | 'loading' | 'empty' | 'error' | 'forbidden';
export const customerStateOptions: readonly [CustomerPreviewState, string][] = [
  ['preview', 'پیش‌نمایش'],
  ['loading', 'در حال بارگذاری'],
  ['empty', 'بدون نتیجه'],
  ['error', 'خطا'],
  ['forbidden', 'بدون دسترسی'],
];
export const customerPermissionCodes = [
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.merge',
  'customers.consent.manage',
  'customers.sensitive.read',
] as const;
export const previewCustomers: readonly CustomerSummary[] = [
  {
    id: 'preview-customer-01',
    displayName: 'مشتری نمونه ۰۱',
    maskedContact: '۰۹۱۲•••۱۲۳۴',
    status: 'active',
    consent: 'granted',
    companionCount: 2,
    updatedAt: '2026-08-23T06:30:00.000Z',
  },
  {
    id: 'preview-customer-02',
    displayName: 'مسافر نمونه ۰۲',
    maskedContact: '۰۹۳۵•••۵۶۷۸',
    status: 'inactive',
    consent: 'not-recorded',
    companionCount: 0,
    updatedAt: '2026-08-22T09:00:00.000Z',
  },
];
const consentLabels: Record<ConsentStatus, string> = {
  granted: 'ثبت‌شده',
  revoked: 'لغوشده',
  'not-recorded': 'ثبت‌نشده',
};
export const getConsentLabel = (consent: ConsentStatus) =>
  consentLabels[consent];

export function filterPreviewCustomers(
  customers: readonly CustomerSummary[],
  query: CustomerListQuery,
) {
  const search = query.search.toLocaleLowerCase('fa-IR');
  return [...customers]
    .filter(
      (customer) =>
        (!search ||
          customer.displayName.toLocaleLowerCase('fa-IR').includes(search) ||
          customer.maskedContact.includes(search)) &&
        (query.status === 'all' || customer.status === query.status) &&
        (query.consent === 'all' || customer.consent === query.consent),
    )
    .sort((left, right) => {
      const comparison =
        query.sortBy === 'displayName'
          ? left.displayName.localeCompare(right.displayName, 'fa-IR')
          : left.updatedAt.localeCompare(right.updatedAt);
      return query.sortDirection === 'asc' ? comparison : -comparison;
    });
}
export interface CustomerDraft {
  displayName: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email: string;
  addressLabel: string;
}
export function validateCustomerDraft(draft: CustomerDraft) {
  const errors: Partial<Record<keyof CustomerDraft, string>> = {};
  if (draft.displayName.trim().length < 2)
    errors.displayName = 'نام نمایشی باید حداقل دو نویسه باشد.';
  if (!draft.firstName.trim()) errors.firstName = 'نام الزامی است.';
  if (!draft.lastName.trim()) errors.lastName = 'نام خانوادگی الزامی است.';
  if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email))
    errors.email = 'ایمیل معتبر نیست.';
  if (draft.primaryPhone && !/^\+?[0-9]{10,15}$/.test(draft.primaryPhone))
    errors.primaryPhone = 'شماره تماس معتبر نیست.';
  return { valid: Object.keys(errors).length === 0, errors };
}
