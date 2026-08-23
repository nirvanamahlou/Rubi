import { describe, expect, it } from 'vitest';

import {
  getNavigationBreadcrumbs,
  getNavigationItem,
  isNavigationItemActive,
  navigationItems,
} from './navigation';

const expectedRoutes = [
  '/dashboard',
  '/customers',
  '/customer-affairs',
  '/reservations',
  '/ticket-management',
  '/sales',
  '/purchases',
  '/finance',
  '/marketing',
  '/organizations',
  '/human-resources',
  '/tasks',
  '/documents',
  '/reports',
  '/integrations',
  '/system',
  '/master-data',
];

describe('CRM navigation', () => {
  it('contains exactly the approved 17 routes in order', () => {
    expect(navigationItems.map((item) => item.href)).toEqual(expectedRoutes);
    expect(new Set(navigationItems.map((item) => item.href)).size).toBe(17);
  });

  it('resolves the Human Resources owner route', () => {
    expect(getNavigationItem('/human-resources')?.title).toBe('منابع انسانی');
  });

  it('does not create disallowed standalone sections', () => {
    const titles = navigationItems.map((item) => item.title).join(' ');
    expect(titles).not.toContain('جست‌وجو و فروش آنلاین');
    expect(titles).not.toContain('صدور اسناد');
  });

  it('keeps sales, reservation, and ticket management as separate modules', () => {
    expect(getNavigationItem('/sales')?.title).toContain('قراردادها');
    expect(getNavigationItem('/reservations')?.title).toContain('رزرواسیون');
    expect(getNavigationItem('/ticket-management')?.title).toContain('بلیت');
  });

  it('combines user administration and settings only at navigation level', () => {
    const hrefs: readonly string[] = navigationItems.map((item) => item.href);

    expect(getNavigationItem('/system')?.description).toContain('کاربران');
    expect(hrefs).not.toContain('/users');
    expect(hrefs).not.toContain('/settings');
    expect(getNavigationItem('/users')?.href).toBe('/system');
    expect(getNavigationItem('/settings')?.href).toBe('/system');
  });

  it('keeps system navigation active for IAM and settings aliases', () => {
    expect(isNavigationItemActive('/system', '/system')).toBe(true);
    expect(isNavigationItemActive('/system', '/users')).toBe(true);
    expect(isNavigationItemActive('/system', '/settings')).toBe(true);
    expect(isNavigationItemActive('/dashboard', '/users')).toBe(false);
  });

  it('identifies users and settings beneath system management', () => {
    expect(getNavigationBreadcrumbs('/users').map((item) => item.href)).toEqual(
      ['/system', '/users'],
    );
    expect(
      getNavigationBreadcrumbs('/settings').map((item) => item.href),
    ).toEqual(['/system', '/settings']);
  });
});
