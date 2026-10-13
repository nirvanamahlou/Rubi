import { describe, expect, it } from 'vitest';

import {
  IAM_PERMISSION_CODES,
  SYSTEM_MANAGEMENT_CONTRACT_VERSION,
  SYSTEM_PERMISSION_CODES,
} from '../src';

describe('system management public contract', () => {
  it('publishes a stable v1 contract with unique permissions', () => {
    expect(SYSTEM_MANAGEMENT_CONTRACT_VERSION).toBe(1);
    expect(SYSTEM_PERMISSION_CODES.length).toBe(30);
    expect(new Set(SYSTEM_PERMISSION_CODES).size).toBe(
      SYSTEM_PERMISSION_CODES.length,
    );
  });

  it('makes every system permission available to IAM', () => {
    expect(IAM_PERMISSION_CODES).toEqual(
      expect.arrayContaining([...SYSTEM_PERMISSION_CODES]),
    );
  });
});
