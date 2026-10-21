import { describe, expect, it } from 'vitest';
import {
  MANUAL_ACCESS_ROLE_PREFIX,
  MANUAL_ACCESS_VERSION,
  canViewScreen,
  hasAccessControl,
  changedDeniedFields,
  canViewRoute,
  USER_ACCESS_SCREENS,
  manualSectionForPermission,
} from '@nora/contracts';
import { authenticatedPermissionCodes } from './authenticated-permissions';
import {
  manualAccessRevision,
  manualSnapshotCodes,
  previewManualConversion,
  type ManualAccessUser,
} from './manual-access-policy';

const role = (code: string, grants: string[], active = true, name = code) => ({
  role: {
    id: code,
    code,
    name,
    isActive: active,
    permissions: grants.map((code) => ({ permission: { code } })),
  },
});
const user = (roles: ManualAccessUser['roles']): ManualAccessUser => ({
  id: 'one',
  status: 'ACTIVE',
  roles,
  branches: [{ branchId: 'branch-one' }],
});
const snapshot = (codes: string[]) =>
  role(MANUAL_ACCESS_ROLE_PREFIX + 'one', codes);

describe('manual access migration and enforcement', () => {
  it('shows the effective legacy Call Center screen without silently opting existing users into new scope', () => {
    const codes = [
      MANUAL_ACCESS_VERSION,
      'ui.profile',
      'customer_affairs.call_center.read',
      'ui.screen.customer-affairs.home',
    ];
    const before = user([snapshot(codes)]);
    const preview = previewManualConversion(before);
    expect(preview.selection.screenIds).toContain(
      'customer-affairs.call-center',
    );
    expect(preview.selection.permissionCodes).not.toContain(
      'customer_affairs.call_center.scope.v1',
    );
    expect(canViewRoute(codes, '/customer-affairs/call-center')).toBe(true);
    expect(
      canViewRoute(
        manualSnapshotCodes(preview.selection),
        '/customer-affairs/call-center',
      ),
    ).toBe(true);
    expect(preview.selection.permissionCodes).not.toContain(
      'customer_affairs.call_center.contacts.read.team',
    );
  });
  it('keeps extension permissions visible and pricing operations in their actual section', () => {
    expect(manualSectionForPermission('extension.read')).toBe('system');
    expect(manualSectionForPermission('finance.ticket_pricing.manage')).toBe(
      'flight-pricing',
    );
  });
  it('makes travel purchasing a revocable independent screen while retaining its native operation requirement', () => {
    const selected = manualSnapshotCodes({
      permissionCodes: ['reservations.read'],
      screenIds: ['ticket-purchases.home'],
      allowedControlIds: ['ticket-purchases.home'],
    });
    expect(canViewRoute(selected, '/ticket-purchases')).toBe(true);
    expect(
      canViewRoute(
        selected.filter((p) => p !== 'ui.screen.ticket-purchases.home'),
        '/ticket-purchases',
      ),
    ).toBe(false);
    expect(
      canViewRoute(
        selected.filter((p) => p !== 'reservations.read'),
        '/ticket-purchases',
      ),
    ).toBe(false);
    for (const codes of [
      ['ui.administrator', 'ui.profile'],
      ['ui.administrator', 'ui.profile', 'reservations.read'],
      ['reservations.read'],
      ['procurement.quote.manage'],
      ['ui.profile', 'reservations.read', 'ui.screen.reservations.home'],
    ]) {
      const before = user([role('travel', codes)]);
      const after = manualSnapshotCodes(
        previewManualConversion(before).selection,
      );
      expect(canViewRoute(after, '/ticket-purchases')).toBe(
        canViewRoute(
          authenticatedPermissionCodes(before.roles),
          '/ticket-purchases',
        ),
      );
    }
  });
  it.each([
    user([]),
    user([role('staff', ['customers.read', 'customers.update'])]),
    user([role('administrator', ['iam.users.manage', 'master_data.update'])]),
    user([
      role('staff', [
        'customers.read',
        'ui.profile',
        'ui.screen.customers.home',
        'ui.deny.field.customers.nationalId',
      ]),
    ]),
    user([
      role('sales_staff', [
        'sales.contracts.read.all',
        'sales.contracts.update.branch',
      ]),
    ]),
    user([role('inactive', ['customers.update'], false)]),
  ])(
    'maps the previous effective selection without adding native permissions',
    (original) => {
      const preview = previewManualConversion(original);
      const codes = authenticatedPermissionCodes([
        snapshot(manualSnapshotCodes(preview.selection)),
        ...original.roles,
      ]);
      expect(codes.filter((c) => !c.startsWith('ui.')).sort()).toEqual(
        preview.selection.permissionCodes,
      );
      for (const screen of USER_ACCESS_SCREENS)
        expect(canViewScreen(codes, screen.id), screen.id).toBe(
          preview.selection.screenIds.includes(screen.id),
        );
    },
  );

  it('does not let a shared administrator role resurrect an unchecked permission or field', () => {
    const codes = authenticatedPermissionCodes([
      role('administrator', ['customers.update', 'customers.sensitive.read']),
      snapshot(
        manualSnapshotCodes({
          permissionCodes: ['customers.read'],
          screenIds: ['customers.home'],
          allowedControlIds: [],
        }),
      ),
    ]);
    expect(codes).not.toContain('customers.update');
    expect(codes).not.toContain('customers.sensitive.read');
    expect(codes).not.toContain('ui.administrator');
    expect(hasAccessControl(codes, 'field.customers.nationalId')).toBe(false);
    expect(
      changedDeniedFields(
        codes,
        'field.customers',
        { firstName: 'changed' },
        { firstName: 'old' },
      ),
    ).toEqual(['firstName']);
  });

  it('allows unchanged protected values but rejects actual changes and future fields', () => {
    const codes = manualSnapshotCodes({
      permissionCodes: [],
      screenIds: [],
      allowedControlIds: ['field.customers.birthDate'],
    });
    expect(
      changedDeniedFields(
        codes,
        'field.customers',
        { firstName: 'old' },
        { firstName: 'old' },
      ),
    ).toEqual([]);
    expect(
      changedDeniedFields(codes, 'field.customers', {
        birthDate: '2000-01-01',
      }),
    ).toEqual([]);
    expect(hasAccessControl(codes, 'field.customers.future')).toBe(false);
  });

  it('revokes the formerly authenticated assistant and correspondence pages', () => {
    const codes = manualSnapshotCodes({
      permissionCodes: [],
      screenIds: [],
      allowedControlIds: [],
    });
    expect(canViewScreen(codes, 'assistant.executive')).toBe(false);
    expect(canViewRoute(codes, '/assistant')).toBe(false);
    expect(canViewRoute(codes, '/correspondence')).toBe(false);
  });

  it('enforces the sales expert own scope within a valid manual snapshot', () => {
    const profile = snapshot(
      manualSnapshotCodes({
        permissionCodes: ['sales.contracts.read.branch'],
        screenIds: [],
        allowedControlIds: [],
      }),
    );
    profile.role.name = 'کارشناس فروش';
    expect(
      authenticatedPermissionCodes([
        profile,
        role('sales_staff', ['sales.contracts.read.all']),
      ]),
    ).toContain('sales.contracts.read.own');
    expect(authenticatedPermissionCodes([profile])).not.toContain(
      'sales.contracts.read.all',
    );
  });

  it('fails closed for disabled or multiple snapshots instead of falling back to old roles', () => {
    const disabled = snapshot([MANUAL_ACCESS_VERSION]);
    disabled.role.isActive = false;
    expect(
      authenticatedPermissionCodes([
        disabled,
        role('administrator', ['customers.update']),
      ]),
    ).toEqual([]);
    expect(
      authenticatedPermissionCodes([
        snapshot([MANUAL_ACCESS_VERSION]),
        snapshot([MANUAL_ACCESS_VERSION]),
      ]),
    ).toEqual([]);
  });

  it('ignores a manual marker stored in an ordinary shared role', () => {
    expect(
      authenticatedPermissionCodes([
        role('shared', [MANUAL_ACCESS_VERSION, 'customers.read']),
      ]),
    ).toContain('customers.read');
  });

  it('detects stale role, permission and branch snapshots independently of input ordering', () => {
    const source = user([
      role('staff', ['customers.read', 'customers.update']),
    ]);
    const reordered = user([
      role('staff', ['customers.update', 'customers.read']),
    ]);
    expect(manualAccessRevision(source)).toBe(manualAccessRevision(reordered));
    reordered.branches.push({ branchId: 'new-branch' });
    expect(manualAccessRevision(source)).not.toBe(
      manualAccessRevision(reordered),
    );
  });
});
