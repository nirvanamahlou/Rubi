import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_PERMISSION_CODES,
  IAM_PERMISSION_CODES,
  IAM_PERMISSION_CONTRACT_VERSION,
  MASTER_DATA_PERMISSION_CODES,
  type AuthenticatedActor,
} from '../src';

describe('IAM public permission contract', () => {
  it('publishes the version 2 domain permission catalogs without duplicates', () => {
    expect(IAM_PERMISSION_CONTRACT_VERSION).toBe(2);
    expect(MASTER_DATA_PERMISSION_CODES).toEqual([
      'master_data.read',
      'master_data.create',
      'master_data.update',
      'master_data.status.manage',
      'master_data.export',
    ]);
    expect(CUSTOMER_PERMISSION_CODES).toEqual([
      'customers.read',
      'customers.create',
      'customers.update',
      'customers.merge',
      'customers.consent.manage',
      'customers.sensitive.read',
    ]);
    expect(new Set(IAM_PERMISSION_CODES).size).toBe(
      IAM_PERMISSION_CODES.length,
    );
  });

  it('keeps domain permissions compatible with the authenticated actor', () => {
    const actor: AuthenticatedActor = {
      userId: 'user-1',
      sessionId: 'session-1',
      permissions: ['master_data.read', 'customers.sensitive.read'],
      branchIds: ['branch-1'],
    };

    expect(actor.permissions).toEqual([
      'master_data.read',
      'customers.sensitive.read',
    ]);
  });
});
