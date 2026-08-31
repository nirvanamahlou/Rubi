import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_ERROR_CODES,
  CUSTOMERS_API_PREFIX,
  CUSTOMERS_CONTRACT_VERSION,
  customerEndpoints,
} from '../src';
import type { CustomerListResponse } from '../src';

describe('Customers public contract v1', () => {
  it('publishes stable versioned endpoints and conflict errors', () => {
    expect(CUSTOMERS_CONTRACT_VERSION).toBe(2);
    expect(CUSTOMERS_API_PREFIX).toBe('/api/v1/customers');
    expect(customerEndpoints.contacts('customer id')).toContain(
      'customer%20id/contacts',
    );
    expect(CUSTOMER_ERROR_CODES).toContain('CONCURRENT_MODIFICATION');
    expect(CUSTOMER_ERROR_CODES).toContain('CUSTOMER_NATIONAL_ID_INVALID');
    expect(CUSTOMER_ERROR_CODES).toContain('CUSTOMER_NATIONAL_ID_EXISTS');
    expect(CUSTOMER_ERROR_CODES).toContain('MERGE_BLOCKED_BY_OPEN_DECISION');
  });

  it('publishes additive timeline endpoints without changing the v2 consumer contract', () => {
    const id = '10000000-0000-4000-8000-000000000001';
    expect(customerEndpoints.statusHistory(id)).toContain('/status-history');
    expect(customerEndpoints.activity(id)).toContain('/activity');
    expect(customerEndpoints.audit(id)).toContain('/audit');
  });

  it('publishes additive filter-scoped KPI metadata', () => {
    const metrics: CustomerListResponse['meta']['metrics'] = {
      totalCustomers: 10,
      totalPassengers: 14,
      newCustomersLastThreeMonths: 3,
      returningCustomerRate: null,
      returningCustomerRateStatus: 'awaiting-sales-public-contract',
    };
    expect(metrics.totalCustomers).toBe(10);
    expect(metrics.returningCustomerRate).toBeNull();
  });
});
