import { CustomersApiError } from '../api/client';

export type CustomerListFailureState = 'unauthorized' | 'forbidden' | 'error';

export function customerListFailureState(
  error: unknown,
): CustomerListFailureState {
  if (error instanceof CustomersApiError && error.status === 401)
    return 'unauthorized';
  if (error instanceof CustomersApiError && error.status === 403)
    return 'forbidden';
  return 'error';
}
