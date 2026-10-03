import { CustomersApiError } from '../api/client';

/** A timed out or failed response may follow a committed create. */
export function isUncertainCustomerCreateFailure(error: unknown): boolean {
  return !(
    error instanceof CustomersApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408
  );
}
