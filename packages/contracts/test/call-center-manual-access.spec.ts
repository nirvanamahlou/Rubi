import { describe, expect, it } from 'vitest';
import {
  MANUAL_ACCESS_SECTIONS,
  MANUAL_ACCESS_VERSION,
  CALL_CENTER_SCOPED_ACCESS,
  canViewRoute,
  screenPermission,
  canViewScreen,
  mustScopeCallCenter,
  USER_ACCESS_SCREENS,
  manualSectionForPermission,
  manualSectionForScreen,
} from '../src/iam';

describe('Call Center manual section', () => {
  it('supports a scoped role template screen without granting the generic Customer Affairs parent', () => {
    const codes = [
      'ui.profile',
      CALL_CENTER_SCOPED_ACCESS,
      'customer_affairs.call_center.read',
      screenPermission('customer-affairs.call-center'),
    ];
    expect(canViewScreen(codes, 'customer-affairs.call-center')).toBe(true);
    expect(canViewRoute(codes, '/customer-affairs/call-center')).toBe(true);
    expect(canViewScreen(codes, 'customer-affairs.home')).toBe(false);
  });
  it('opts in on any explicit Call Center native/screen change, not unrelated edits', () => {
    const before = {
      permissionCodes: ['customer_affairs.call_center.read'],
      screenIds: ['customer-affairs.call-center'],
    };
    expect(
      mustScopeCallCenter(before, {
        ...before,
        permissionCodes: [...before.permissionCodes, 'customers.read'],
      }),
    ).toBe(false);
    expect(mustScopeCallCenter(before, { ...before, screenIds: [] })).toBe(
      true,
    );
    expect(
      mustScopeCallCenter(
        { permissionCodes: [], screenIds: [] },
        {
          permissionCodes: ['customer_affairs.call_center.calls.create'],
          screenIds: [],
        },
      ),
    ).toBe(true);
    expect(
      mustScopeCallCenter(
        {
          ...before,
          permissionCodes: [
            ...before.permissionCodes,
            CALL_CENTER_SCOPED_ACCESS,
          ],
        },
        before,
      ),
    ).toBe(true);
  });
  it('preserves legacy route grants but enforces a separate screen on opt-in', () => {
    const legacy = [
      MANUAL_ACCESS_VERSION,
      'customer_affairs.call_center.read',
      screenPermission('customer-affairs.home'),
    ];
    expect(canViewRoute(legacy, '/customer-affairs/call-center')).toBe(true);
    expect(
      canViewRoute(
        [...legacy, CALL_CENTER_SCOPED_ACCESS],
        '/customer-affairs/call-center',
      ),
    ).toBe(false);
    expect(
      canViewRoute(
        [
          ...legacy,
          CALL_CENTER_SCOPED_ACCESS,
          screenPermission('customer-affairs.call-center'),
        ],
        '/customer-affairs/call-center',
      ),
    ).toBe(true);
    expect(canViewRoute(legacy, '/customer-affairs')).toBe(true);
  });
  it('classifies the specific prefix before Customer Affairs', () => {
    expect(MANUAL_ACCESS_SECTIONS).toContainEqual(['call-center', 'کال سنتر']);
    expect(
      manualSectionForPermission('customer_affairs.call_center.read'),
    ).toBe('call-center');
    expect(manualSectionForPermission('customer_affairs.ticket.read')).toBe(
      'customer-affairs',
    );
  });
  it('has exactly one existing-route screen, isolated only in the editor', () => {
    const screens = USER_ACCESS_SCREENS.filter(
      (s) => s.route === '/customer-affairs/call-center',
    );
    expect(screens).toHaveLength(1);
    expect(manualSectionForScreen(screens[0]!)).toBe('call-center');
    expect(
      manualSectionForScreen(
        USER_ACCESS_SCREENS.find((s) => s.id === 'customer-affairs.home')!,
      ),
    ).toBe('customer-affairs');
  });
});
