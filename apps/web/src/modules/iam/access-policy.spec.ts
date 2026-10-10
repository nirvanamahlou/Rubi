import { describe, expect, it } from 'vitest';
import {
  canViewRoute,
  canViewScreen,
  screenForTab,
  screenPermission,
  USER_ACCESS_PROFILE_PERMISSION,
  USER_ACCESS_ADMIN_PERMISSION,
  USER_ACCESS_SCREENS,
} from '@nora/contracts';
describe('per-user screen visibility', () => {
  it('shows every catalogued screen to a system administrator, including screens without native operations', () => {
    const permissions = [
      USER_ACCESS_ADMIN_PERMISSION,
      USER_ACCESS_PROFILE_PERMISSION,
    ];
    expect(
      USER_ACCESS_SCREENS.every((s) => canViewScreen(permissions, s.id)),
    ).toBe(true);
    for (const route of [
      '/workbench',
      '/dashboard',
      '/reports',
      '/integrations',
      '/marketing',
    ]) {
      expect(canViewRoute(permissions, route)).toBe(true);
    }
    expect(canViewScreen(permissions, 'unknown.future.screen')).toBe(false);
  });
  it('limits legacy navigation to operational grants', () => {
    expect(canViewRoute(['iam.users.read'], '/system')).toBe(true);
    expect(canViewRoute([], '/finance')).toBe(false);
    expect(
      canViewRoute(['legal-entity.read', 'legal-entity.switch'], '/system'),
    ).toBe(false);
    expect(canViewRoute(['sales.contracts.read.own'], '/sales')).toBe(true);
    expect(
      canViewRoute(['sales.contracts.read.own'], '/sales/contracts/new'),
    ).toBe(false);
    expect(canViewScreen([], 'ticket-catalog.tab.issued')).toBe(false);
  });
  it('hides whole modules with no selected child and permits only the checked children', () => {
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      'iam.users.read',
      'ticket_catalog.read',
      'sales.contracts.read.own',
      'package_pricing.read',
      'hr.read',
      'reservations.read',
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
      'iam.users.read',
      'ticket_catalog.read',
      'sales.contracts.read.own',
      'package_pricing.read',
      'hr.read',
      'reservations.read',
      screenPermission('sales.home'),
    ];
    expect(canViewRoute(permissions, '/sales')).toBe(true);
    expect(canViewRoute(permissions, '/sales/ticket-prices')).toBe(false);
    expect(canViewRoute(permissions, '/sales/tours')).toBe(false);
    expect(
      canViewRoute(
        [
          USER_ACCESS_PROFILE_PERMISSION,
          'iam.users.read',
          'ticket_catalog.read',
          'sales.contracts.read.own',
          'package_pricing.read',
          'hr.read',
          'reservations.read',
          screenPermission('ticket-catalog.tab.tours'),
        ],
        '/sales/tours',
      ),
    ).toBe(true);
    expect(
      USER_ACCESS_SCREENS.find(
        (screen) => screen.id === 'ticket-catalog.tab.tours',
      ),
    ).toMatchObject({ group: 'sales', route: '/sales/tours' });
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
      'iam.users.read',
      'ticket_catalog.read',
      'sales.contracts.read.own',
      'package_pricing.read',
      'hr.read',
      'reservations.read',
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
        [
          USER_ACCESS_PROFILE_PERMISSION,
          'iam.users.read',
          'ticket_catalog.read',
          'sales.contracts.read.own',
          'package_pricing.read',
          'hr.read',
          'reservations.read',
          screenPermission('hr.home'),
        ],
        '/hr?section=unknown',
      ),
    ).toBe(false);
  });
  it('normalizes the existing users route without allowing other system pages', () => {
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      'iam.users.read',
      'ticket_catalog.read',
      'sales.contracts.read.own',
      'package_pricing.read',
      'hr.read',
      'reservations.read',
      screenPermission('system.users'),
    ];
    expect(canViewRoute(permissions, '/users')).toBe(true);
    expect(canViewRoute(permissions, '/system/users')).toBe(true);
    expect(canViewRoute(permissions, '/system/operations')).toBe(false);
  });
});

it('requires operational grants even when a managed screen was selected', () => {
  const screensOnly = [
    USER_ACCESS_PROFILE_PERMISSION,
    screenPermission('finance.home'),
  ];
  expect(canViewRoute(screensOnly, '/finance')).toBe(false);
  expect(canViewScreen(screensOnly, 'finance.home')).toBe(false);
  expect(canViewRoute([...screensOnly, 'finance.read'], '/finance')).toBe(true);
});

it('shows explicitly selected owner-scoped workbench screens without a nonexistent native grant', () => {
  const permissions = [
    USER_ACCESS_PROFILE_PERMISSION,
    screenPermission('workbench.home'),
    screenPermission('workbench.tab.notes'),
  ];
  expect(canViewScreen(permissions, 'workbench.home')).toBe(true);
  expect(canViewRoute(permissions, '/workbench')).toBe(true);
  expect(canViewScreen(permissions, 'workbench.tab.calendar')).toBe(false);
});
