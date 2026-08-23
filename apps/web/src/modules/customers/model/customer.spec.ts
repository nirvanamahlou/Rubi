import { describe, expect, it } from 'vitest';
import { normalizeCustomerListQuery } from '../api/contracts';
import {
  customerPermissionCodes,
  customerStateOptions,
  filterPreviewCustomers,
  previewCustomers,
  validateCustomerDraft,
} from './customer';

describe('customer frontend foundation', () => {
  it('covers required UI states and published permissions', () => {
    expect(customerStateOptions.map(([state]) => state)).toEqual([
      'preview',
      'loading',
      'empty',
      'error',
      'forbidden',
    ]);
    expect(customerPermissionCodes).toEqual([
      'customers.read',
      'customers.create',
      'customers.update',
      'customers.merge',
      'customers.consent.manage',
      'customers.sensitive.read',
    ]);
  });
  it('normalizes pagination and filters preview records', () => {
    const query = normalizeCustomerListQuery({
      search: '  نمونه ۰۱ ',
      page: -3,
      pageSize: 500,
    });
    expect(query).toMatchObject({ search: 'نمونه ۰۱', page: 1, pageSize: 100 });
    expect(filterPreviewCustomers(previewCustomers, query)).toHaveLength(1);
  });
  it('validates forms without submitting data', () => {
    expect(
      validateCustomerDraft({
        displayName: '',
        firstName: '',
        lastName: '',
        primaryPhone: 'invalid',
        email: 'invalid',
        addressLabel: '',
      }).valid,
    ).toBe(false);
  });
  it('uses only synthetic ids and masked contacts', () => {
    expect(
      previewCustomers.every(
        (customer) =>
          customer.id.startsWith('preview-') &&
          customer.maskedContact.includes('•••'),
      ),
    ).toBe(true);
  });
});
