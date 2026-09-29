import { describe, expect, it } from 'vitest';
import {
  canViewRoute,
  canViewScreen,
  screenForTab,
  screenPermission,
  USER_ACCESS_PROFILE_PERMISSION,
  USER_ACCESS_SCREENS,
} from '@nora/contracts';
describe('per-user screen visibility', () => {
  it('preserves legacy role navigation without the managed-profile marker', () => {
    expect(canViewRoute(['iam.users.read'], '/system')).toBe(true);
    expect(canViewScreen([], 'ticket-catalog.tab.issued')).toBe(true);
  });
  it('hides whole modules with no selected child and permits only the checked children', () => {
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('ticket-catalog.tab.catalog'),
    ];
    expect(canViewRoute(permissions, '/ticket-management')).toBe(true);
    expect(canViewRoute(permissions, '/finance')).toBe(false);
    expect(canViewScreen(permissions, 'ticket-catalog.tab.catalog')).toBe(true);
    expect(canViewScreen(permissions, 'ticket-catalog.tab.issued')).toBe(false);
  });
  it('does not leak a denied deep route through its permitted parent', () => {
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('sales.home'),
    ];
    expect(canViewRoute(permissions, '/sales')).toBe(true);
    expect(canViewRoute(permissions, '/sales/ticket-prices')).toBe(false);
  });
  it('matches actual tab keys and uses unique stable screen identifiers', () => {
    expect(screenForTab('/ticket-management', 'catalog')?.id).toBe(
      'ticket-catalog.tab.catalog',
    );
    expect(new Set(USER_ACCESS_SCREENS.map((s) => s.id)).size).toBe(
      USER_ACCESS_SCREENS.length,
    );
  });
});

describe('query route isolation', () => {
  it('does not allow a parent section to override a denied explicit tab', () => {
    const section = USER_ACCESS_SCREENS.find(
      (s) => s.group === 'hr' && s.query?.section === 'time' && !s.query.tab,
    )!;
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission(section.id),
    ];
    expect(canViewRoute(permissions, '/hr?section=time')).toBe(true);
    expect(canViewRoute(permissions, '/hr?section=time&tab=attendance')).toBe(
      false,
    );
  });
  it('rejects unregistered subsection queries and all modules for an empty managed profile', () => {
    expect(canViewRoute([USER_ACCESS_PROFILE_PERMISSION], '/finance')).toBe(
      false,
    );
    expect(
      canViewRoute(
        [USER_ACCESS_PROFILE_PERMISSION, screenPermission('hr.home')],
        '/hr?section=unknown',
      ),
    ).toBe(false);
  });
  it('normalizes the existing users route without allowing other system pages', () => {
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('system.users'),
    ];
    expect(canViewRoute(permissions, '/users')).toBe(true);
    expect(canViewRoute(permissions, '/system/users')).toBe(true);
    expect(canViewRoute(permissions, '/system/operations')).toBe(false);
  });
});
