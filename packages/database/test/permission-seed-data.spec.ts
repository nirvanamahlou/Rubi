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
        'master_data.import',
        'master_data.audit.read',
        'master_data.currency_rate.create',
        'master_data.currency_rate.approve',
        'master_data.sensitive_contact.read',
        'master_data.sensitive_contact.unmask',
        'master_data.delete',
        'customers.read',
        'customers.create',
        'customers.update',
        'customers.merge',
        'customers.consent.manage',
        'customers.sensitive.read',
        'legal-entity.read',
        'legal-entity.switch',
        'legal-entity.aggregate.read',
        'legal-entity.manage',
        'legal-entity.branding.manage',
        'legal-entity.audit.read',
        'legal-entity.document.issue',
        'legal-entity.document.reissue',
      ]),
    );
  });

  it('uses the owning module for every domain permission', () => {
    for (const [code, module] of PERMISSION_SEED_DATA) {
      expect(code.startsWith(`${module}.`)).toBe(true);
    }
  });
});
