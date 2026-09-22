import { describe, expect, it } from 'vitest';

import { authenticatedPermissionCodes } from './authenticated-permissions';

const role = (isActive: boolean, ...codes: string[]) => ({
  role: {
    isActive,
    permissions: codes.map((code) => ({ permission: { code } })),
  },
});

describe('authenticated legal-entity baseline permissions', () => {
  it.each([
    ['staff role', [role(true, 'legal-entity.read', 'legal-entity.switch')]],
    ['no role', []],
    ['custom role', [role(true, 'customers.read')]],
    [
      'multiple roles',
      [role(true, 'customers.read'), role(true, 'master_data.read')],
    ],
    ['inactive role', [role(false, 'legal-entity.aggregate.read')]],
  ])(
    'grants read/switch to every active authenticated user with %s',
    (_, roles) => {
      const permissions = authenticatedPermissionCodes(roles);
      expect(permissions).toEqual(
        expect.arrayContaining(['legal-entity.read', 'legal-entity.switch']),
      );
    },
  );

  it('does not grant aggregate, admin, branding, audit or document permissions by baseline', () => {
    const permissions = authenticatedPermissionCodes([]);
    expect(permissions).toEqual(['legal-entity.read', 'legal-entity.switch']);
  });

  it('preserves explicitly assigned permissions without broadening branch scope', () => {
    expect(
      authenticatedPermissionCodes([
        role(true, 'legal-entity.aggregate.read', 'legal-entity.manage'),
      ]),
    ).toEqual([
      'legal-entity.read',
      'legal-entity.switch',
      'legal-entity.aggregate.read',
      'legal-entity.manage',
    ]);
  });
});
