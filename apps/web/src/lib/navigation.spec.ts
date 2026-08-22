import { describe, expect, it } from 'vitest';

import { getNavigationItem, navigationItems } from './navigation';

const expectedRoutes = [
  '/dashboard',
  '/customers',
  '/sales',
  '/reservations',
  '/customer-service',
  '/purchases',
  '/finance',
  '/marketing',
  '/organizations',
  '/human-resources',
  '/tasks',
  '/documents',
  '/reports',
  '/integrations',
  '/users',
  '/master-data',
  '/settings',
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
});
