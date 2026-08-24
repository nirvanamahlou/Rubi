import { describe, expect, it } from 'vitest';
import {
  normalizeCustomerListQuery,
  serializeCustomerListQuery,
} from '../api/contracts';
import {
  contactDisplayValue,
  customerPermissionCodes,
  customerUiStates,
  validateCustomerMutation,
} from './customer';

describe('customer frontend live contract', () => {
  it('covers operational and conflict states with published permissions', () => {
    expect(customerUiStates).toEqual([
      'loading',
      'ready',
      'empty',
      'error',
      'forbidden',
      'success',
      'conflict',
    ]);
    expect(customerPermissionCodes).toContain('customers.sensitive.read');
  });

  it('normalizes and serializes server pagination and filters', () => {
    const query = normalizeCustomerListQuery({
      search: '  نمونه ۰۱ ',
      page: -3,
      pageSize: 500,
    });
    expect(query).toMatchObject({
      search: 'نمونه ۰۱',
      page: 1,
      pageSize: 100,
      role: 'all',
    });
    expect(serializeCustomerListQuery(query)).toContain('pageSize=100');
  });

  it('validates person, organization and role invariants before network submit', () => {
    expect(
      validateCustomerMutation({
        kind: 'person',
        displayName: '',
        firstName: '',
        lastName: '',
        roles: [],
      }).valid,
    ).toBe(false);
    expect(
      validateCustomerMutation({
        kind: 'organization',
        displayName: 'سازمان ساختگی',
        organizationId: null,
        roles: ['customer'],
      }).errors,
    ).toHaveProperty('organizationId');
  });
  it('keeps real contacts hidden until an authorized user explicitly reveals them', () => {
    const contact = {
      id: 'synthetic-contact',
      type: 'phone' as const,
      label: null,
      maskedValue: '0000•••000',
      value: '0000000000',
      isPrimary: true,
      verifiedAt: null,
      createdAt: '2026-08-24T00:00:00.000Z',
    };
    expect(contactDisplayValue(contact, false)).toBe('0000•••000');
    expect(contactDisplayValue(contact, true)).toBe('0000000000');
    expect(contactDisplayValue({ ...contact, value: null }, true)).toBe(
      '0000•••000',
    );
  });
});
