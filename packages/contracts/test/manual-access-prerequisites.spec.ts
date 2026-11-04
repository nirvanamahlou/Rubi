import { describe, expect, it } from 'vitest';
import {
  completeManualAccessPrerequisites,
  canViewRoute,
  MANUAL_ACCESS_VERSION,
  screenPermission,
  visibleIntegrationSections,
} from '../src';

const empty = { screenIds: [], permissionCodes: [], allowedControlIds: [] };
describe('manual view prerequisites for every user', () => {
  it('makes a newly checked Call Center panel usable with only own-data reads', () => {
    const next = completeManualAccessPrerequisites(
      { ...empty, screenIds: ['customer-affairs.call-center'] },
      empty,
    );
    expect(next.permissionCodes.sort()).toEqual([
      'customer_affairs.call_center.contacts.read.own',
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.reports.read.own',
    ]);
    expect(
      canViewRoute(
        [
          MANUAL_ACCESS_VERSION,
          ...next.permissionCodes,
          ...next.screenIds.map(screenPermission),
        ],
        '/customer-affairs/call-center',
      ),
    ).toBe(true);
    expect(next.allowedControlIds).toEqual([]);
  });
  it('does not change an existing legacy scope or restore deliberately removed scopes', () => {
    const legacy = {
      ...empty,
      screenIds: ['customer-affairs.call-center'],
      permissionCodes: ['customer_affairs.call_center.read'],
    };
    expect(completeManualAccessPrerequisites(legacy, legacy)).toEqual(legacy);
    const removed = {
      ...legacy,
      permissionCodes: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.scope.v1',
      ],
    };
    expect(completeManualAccessPrerequisites(removed, removed)).toEqual(
      removed,
    );
  });
  it('preserves explicit team read scopes without creating any team or write permission', () => {
    const selection = {
      ...empty,
      screenIds: ['customer-affairs.call-center'],
      permissionCodes: [
        'customer_affairs.call_center.contacts.read.team',
        'customer_affairs.call_center.reports.read.team',
      ],
    };
    expect(
      completeManualAccessPrerequisites(
        selection,
        empty,
      ).permissionCodes.sort(),
    ).toEqual(
      [
        ...selection.permissionCodes,
        'customer_affairs.call_center.read',
      ].sort(),
    );
  });
  it('opens a checked Integrations child without enabling siblings or registry writes', () => {
    const next = completeManualAccessPrerequisites(
      { ...empty, screenIds: ['integrations.section.connections'] },
      empty,
    );
    expect(next.screenIds.sort()).toEqual([
      'integrations.home',
      'integrations.section.connections',
    ]);
    const permissions = [
      MANUAL_ACCESS_VERSION,
      ...next.screenIds.map(screenPermission),
    ];
    expect(canViewRoute(permissions, '/integrations')).toBe(true);
    expect(visibleIntegrationSections(permissions)).toEqual(['connections']);
    expect(next.permissionCodes).toEqual([]);
    expect(next.allowedControlIds).toEqual([]);
  });
  it('new Integrations root selection opens brands only; unrelated updates stay unchanged', () => {
    const next = completeManualAccessPrerequisites(
      { ...empty, screenIds: ['integrations.home'] },
      empty,
    );
    expect(next.screenIds).toEqual([
      'integrations.home',
      'integrations.section.brands',
    ]);
    expect(completeManualAccessPrerequisites(empty, empty)).toEqual(empty);
    const existing = { ...empty, screenIds: ['integrations.home'] };
    expect(completeManualAccessPrerequisites(existing, existing)).toEqual(
      existing,
    );
  });
});
