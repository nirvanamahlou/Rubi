import type {
  CustomerContact,
  CustomerDetail,
  CustomerMutationRequest,
} from '@rubi/contracts';

export function customerDraft(
  customer?: CustomerDetail,
): CustomerMutationRequest {
  return {
    kind: customer?.kind ?? 'person',
    organizationId: customer?.organizationId ?? null,
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    displayName: customer?.displayName ?? '',
    ...(!customer?.birthDateMasked
      ? { birthDate: customer?.birthDate ?? null }
      : {}),
    roles: customer?.roles ?? ['customer'],
    acquaintanceMethodId: customer?.acquaintanceMethodId ?? null,
    ...(customer ? { version: customer.version } : {}),
  };
}

export type CustomerUiState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'success'
  | 'conflict';

export const customerUiStates: readonly CustomerUiState[] = [
  'loading',
  'ready',
  'empty',
  'error',
  'forbidden',
  'success',
  'conflict',
];

export const customerPermissionCodes = [
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.merge',
  'customers.consent.manage',
  'customers.sensitive.read',
] as const;

export function normalizeNationalId(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function isValidIranianNationalId(value: string): boolean {
  const normalized = normalizeNationalId(value);
  if (!/^\d{10}$/.test(normalized) || /^(\d)\1{9}$/.test(normalized))
    return false;
  const remainder =
    [...normalized.slice(0, 9)].reduce(
      (sum, digit, index) => sum + Number(digit) * (10 - index),
      0,
    ) % 11;
  return Number(normalized[9]) === (remainder < 2 ? remainder : 11 - remainder);
}

export function validateCustomerMutation(input: CustomerMutationRequest) {
  const errors: Record<string, string> = {};
  if (input.displayName.trim().length < 2)
    errors.displayName = 'نام نمایشی الزامی است.';
  if (input.kind === 'person' && !input.firstName?.trim())
    errors.firstName = 'نام الزامی است.';
  if (input.kind === 'person' && !input.lastName?.trim())
    errors.lastName = 'نام خانوادگی الزامی است.';
  if (
    input.kind === 'person' &&
    !isValidIranianNationalId(input.nationalId ?? '')
  )
    errors.nationalId = 'کد ملی ده‌رقمی معتبر الزامی است.';
  if (input.kind === 'organization' && !input.organizationId)
    errors.organizationId = 'Organization الزامی است.';
  if (!input.roles.length) errors.roles = 'حداقل یک نقش لازم است.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function contactDisplayValue(
  contact: CustomerContact,
  revealed: boolean,
): string {
  return revealed && contact.value ? contact.value : contact.maskedValue;
}

export function contactCallHref(
  contact: CustomerContact,
  revealed: boolean,
): string | null {
  if (!revealed || contact.type !== 'phone' || !contact.value) return null;
  const number = contact.value.trim().replace(/[ ()-]/g, '');
  // Do not pass masked values, URI parameters or control characters to a dialer.
  return /^\+?[0-9]{7,15}$/.test(number) ? `tel:${number}` : null;
}
