import type { CustomerMutationRequest } from '@rubi/contracts';

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

export function validateCustomerMutation(input: CustomerMutationRequest) {
  const errors: Record<string, string> = {};
  if (input.displayName.trim().length < 2)
    errors.displayName = 'نام نمایشی الزامی است.';
  if (input.kind === 'person' && !input.firstName?.trim())
    errors.firstName = 'نام الزامی است.';
  if (input.kind === 'person' && !input.lastName?.trim())
    errors.lastName = 'نام خانوادگی الزامی است.';
  if (input.kind === 'organization' && !input.organizationId)
    errors.organizationId = 'Organization الزامی است.';
  if (!input.roles.length) errors.roles = 'حداقل یک نقش لازم است.';
  return { valid: Object.keys(errors).length === 0, errors };
}
