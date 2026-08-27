import { describe, expect, it } from 'vitest';
import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { CustomersController } from './customers.controller';

describe('CustomersController permission metadata', () => {
  it.each([
    ['list', 'customers.read'],
    ['create', 'customers.create'],
    ['detail', 'customers.read'],
    ['statusHistory', 'customers.read'],
    ['activity', 'customers.read'],
    ['update', 'customers.update'],
    ['status', 'customers.update'],
    ['contacts', 'customers.read'],
    ['addContact', 'customers.update'],
    ['addAddress', 'customers.update'],
    ['addCompanion', 'customers.update'],
    ['addConsent', 'customers.consent.manage'],
    ['duplicates', 'customers.read'],
    ['reviewDuplicate', 'customers.merge'],
  ] as const)('%s requires %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CustomersController.prototype[method],
      ),
    ).toEqual([permission]);
  });

  it('requires customer read and IAM audit permissions for audit history', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomersController.prototype.audit),
    ).toEqual(['customers.read', 'iam.audit.read']);
  });
});
