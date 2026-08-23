import { describe, expect, it } from 'vitest';

import { PERMISSION_SEED_DATA } from '../src/permission-seed-data';

describe('permission seed catalog', () => {
  it('contains unique permission codes for every published domain permission', () => {
    const codes = PERMISSION_SEED_DATA.map(([code]) => code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(
      expect.arrayContaining([
        'master_data.read',
        'master_data.create',
        'master_data.update',
        'master_data.status.manage',
        'master_data.export',
        'customers.read',
        'customers.create',
        'customers.update',
        'customers.merge',
        'customers.consent.manage',
        'customers.sensitive.read',
      ]),
    );
  });

  it('uses the owning module for every domain permission', () => {
    for (const [code, module] of PERMISSION_SEED_DATA) {
      expect(code.startsWith(`${module}.`)).toBe(true);
    }
  });
});
