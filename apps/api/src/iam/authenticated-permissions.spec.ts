import { describe, expect, it } from 'vitest';
import { USER_ACCESS_ADMIN_PERMISSION } from '@nora/contracts';

import { authenticatedPermissionCodes } from './authenticated-permissions';

const role = (isActive: boolean, ...codes: string[]) => ({
  role: {
    isActive,
    permissions: codes.map((code) => ({ permission: { code } })),
  },
});

describe('administrator screen authority', () => {
  it('derives the screen marker only from active canonical administrator membership', () => {
    const admin = { role: { ...role(true).role, code: 'administrator' } };
    const permissions = authenticatedPermissionCodes([admin]);
    expect(permissions).toContain(USER_ACCESS_ADMIN_PERMISSION);
    expect(permissions).not.toContain('sales.contracts.create');
    expect(
      authenticatedPermissionCodes([
        { role: { ...admin.role, isActive: false } },
      ]),
    ).not.toContain(USER_ACCESS_ADMIN_PERMISSION);
  });
  it('ignores a stored marker or administrator title on a different role', () => {
    const namedRole = {
      role: {
        ...role(true, USER_ACCESS_ADMIN_PERMISSION).role,
        code: 'custom',
        name: 'مدیر',
      },
    };
    expect(authenticatedPermissionCodes([namedRole])).not.toContain(
      USER_ACCESS_ADMIN_PERMISSION,
    );
  });
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

describe('sales role scope', () => {
  it('narrows inherited broad grants for an active sales expert', () => {
    const expert = {
      role: {
        ...role(
          true,
          'sales.contracts.read.all',
          'sales.contracts.update.branch',
        ).role,
        code: 'personal-access-123',
        name: 'کارشناس فروش',
      },
    };
    const permissions = authenticatedPermissionCodes([
      expert,
      role(true, 'sales.contracts.read.branch'),
    ]);
    expect(permissions).toContain('sales.contracts.read.own');
    expect(permissions).toContain('sales.contracts.update.own');
    expect(permissions).not.toContain('sales.contracts.read.all');
    expect(permissions).not.toContain('sales.contracts.read.branch');
    expect(permissions).not.toContain('sales.contracts.update.branch');
  });
  it('preserves explicitly granted manager scope without granting permissions by title', () => {
    const manager = {
      role: {
        ...role(true, 'sales.contracts.read.branch').role,
        code: 'personal-access-456',
        name: 'مدیر فروش',
      },
    };
    expect(authenticatedPermissionCodes([manager])).toContain(
      'sales.contracts.read.branch',
    );
    expect(authenticatedPermissionCodes([manager])).not.toContain(
      'sales.contracts.read.all',
    );
  });
});

it('ignores an inactive expert role when resolving active manager permissions', () => {
  const expert = {
    role: {
      ...role(false, 'sales.contracts.read.all').role,
      code: 'sales_staff',
      name: 'کارشناس فروش',
    },
  };
  expect(
    authenticatedPermissionCodes([
      expert,
      role(true, 'sales.contracts.read.branch'),
    ]),
  ).toContain('sales.contracts.read.branch');
});
