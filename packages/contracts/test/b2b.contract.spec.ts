import { describe, expect, it } from 'vitest';

import {
  B2B_API_PREFIX,
  B2B_CONTRACT_VERSION,
  B2B_PERMISSION_CODES,
  b2bEndpoints,
} from '../src';

describe('B2B public contract v1', () => {
  it('publishes stable versioned agency endpoints', () => {
    expect(B2B_CONTRACT_VERSION).toBe(1);
    expect(B2B_API_PREFIX).toBe('/api/v1/b2b');
    expect(b2bEndpoints.agency('org / 1')).toBe(
      '/api/v1/b2b/agencies/org%20%2F%201',
    );
  });

  it('keeps agency, agreement, credit and rate permissions explicit', () => {
    expect(B2B_PERMISSION_CODES).toEqual(
      expect.arrayContaining([
        'b2b.agency.read',
        'b2b.agreement.manage',
        'b2b.credit.manage',
        'b2b.rate.manage',
      ]),
    );
  });
});
