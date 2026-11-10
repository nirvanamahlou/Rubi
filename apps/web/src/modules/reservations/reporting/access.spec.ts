import { expect, it } from 'vitest';
import {
  canViewRoute,
  screenPermission,
  screenForTab,
  USER_ACCESS_SCREENS,
  MANUAL_ACCESS_VERSION,
  completeManualAccessPrerequisites,
  manualSectionForScreen,
} from '@nora/contracts';
import { navigationGroups, navigationItems } from '@/lib/navigation';

it('moves the stable report screen into its own module and keeps other ticket screens', () => {
  const report = USER_ACCESS_SCREENS.find(
    (s) => s.id === 'ticket-catalog.tab.issued',
  )!;
  expect(report).toMatchObject({
    group: 'reservation-reports',
    route: '/reservations/reports',
    title: 'گزارش رزرواسیون',
  });
  expect(manualSectionForScreen(report)).toBe('reservation-reports');
  expect(screenForTab('/ticket-management', 'issued')).toBeUndefined();
  expect(screenForTab('/ticket-management', 'catalog')?.id).toBe(
    'ticket-catalog.tab.catalog',
  );
  expect(navigationGroups.find((g) => g.id === 'operations')!.hrefs).toContain(
    '/reservations/reports',
  );
  expect(
    navigationItems.find((i) => i.href === '/reservations/reports')!.title,
  ).toBe('گزارش رزرواسیون');
});
it('allows report-only manual access without exposing ticket management or the reservation inbox', () => {
  const selection = completeManualAccessPrerequisites({
    screenIds: ['ticket-catalog.tab.issued'],
    permissionCodes: [],
    allowedControlIds: [],
  });
  const permissions = [
    MANUAL_ACCESS_VERSION,
    ...selection.permissionCodes,
    ...selection.screenIds.map(screenPermission),
  ];
  expect(canViewRoute(permissions, '/reservations/reports')).toBe(true);
  expect(canViewRoute(permissions, '/reservations')).toBe(false);
  expect(canViewRoute(permissions, '/ticket-management')).toBe(false);
  expect(
    canViewRoute(
      [
        MANUAL_ACCESS_VERSION,
        'reservations.read',
        screenPermission('reservations.home'),
      ],
      '/reservations/reports',
    ),
  ).toBe(false);
});
