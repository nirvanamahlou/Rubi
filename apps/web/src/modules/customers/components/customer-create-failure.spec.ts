import { describe, expect, it } from 'vitest';

import { CustomersApiError } from '../api/client';
import { isUncertainCustomerCreateFailure } from './customer-create-failure';

describe('Customers create retry safety', () => {
  it.each([400, 401, 403, 409, 422])(
    'permits correction after a definitive HTTP %s failure',
    (status) => {
      expect(
        isUncertainCustomerCreateFailure(
          new CustomersApiError('Rejected', status),
        ),
      ).toBe(false);
    },
  );

  it.each([0, 408, 500, 502, 503])(
    'blocks duplicate retry when HTTP %s cannot prove creation failed',
    (status) => {
      expect(
        isUncertainCustomerCreateFailure(
          new CustomersApiError('Unknown outcome', status),
        ),
      ).toBe(true);
    },
  );

  it('treats a lost network response as an uncertain create', () => {
    expect(
      isUncertainCustomerCreateFailure(new TypeError('Failed to fetch')),
    ).toBe(true);
  });
});
