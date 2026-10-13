import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_AFFAIRS_CONTRACT_VERSION,
  CUSTOMER_AFFAIRS_PERMISSIONS,
  IAM_PERMISSION_CODES,
} from '../src';

describe('customer affairs public contract', () => {
  it('publishes the operational v1 contract from the root package', () => {
    expect(CUSTOMER_AFFAIRS_CONTRACT_VERSION).toBe('customer-affairs.v1');
  });

  it('keeps every customer affairs permission in the IAM allowlist', () => {
    for (const permission of Object.values(CUSTOMER_AFFAIRS_PERMISSIONS)) {
      expect(IAM_PERMISSION_CODES).toContain(permission);
    }
  });

  it('separates reading satisfaction from recording customer-provided answers', () => {
    expect(CUSTOMER_AFFAIRS_PERMISSIONS.satisfactionRead).not.toBe(
      CUSTOMER_AFFAIRS_PERMISSIONS.satisfactionRecord,
    );
  });
});
