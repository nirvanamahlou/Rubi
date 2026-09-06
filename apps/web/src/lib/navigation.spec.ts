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

const expectedTitles = [
  'داشبورد',
  'مشتریان و مسافران',
  'امور مشتریان، سرنخ‌ها و پشتیبانی',
  'رزرواسیون و عملیات سفر',
  'مدیریت و تعریف بلیت‌ها',
  'قراردادها، فروش و تخصیص خدمات',
  'خرید و تأمین',
  'مالی و خزانه‌داری',
  'مارکتینگ',
  'آژانس‌ها و مشتریان سازمانی',
  'منابع انسانی',
  'وظایف و اتوماسیون',
  'اسناد و فایل‌ها',
  'گزارش‌ها',
  'یکپارچه‌سازی‌ها',
  'مدیریت سیستم',
  'اطلاعات پایه',
];

describe('CRM navigation', () => {
  it('contains exactly the approved 17 routes in order', () => {
    expect(navigationItems.map((item) => item.href)).toEqual(expectedRoutes);
    expect(new Set(navigationItems.map((item) => item.href)).size).toBe(17);
  });

  it('uses exactly the approved 17 Persian titles in order', () => {
    expect(navigationItems).toHaveLength(17);
    expect(navigationItems.map((item) => item.title)).toEqual(expectedTitles);
    expect(new Set(navigationItems.map((item) => item.title)).size).toBe(17);
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

  it('keeps master data active and exposes section breadcrumbs', () => {
    const pathname = '/master-data/organizations-suppliers';

    expect(isNavigationItemActive('/master-data', pathname)).toBe(true);
    expect(getNavigationItem(pathname)?.href).toBe('/master-data');
    expect(getNavigationBreadcrumbs(pathname)).toEqual([
      { href: '/master-data', title: 'اطلاعات پایه' },
      {
        href: pathname,
        title: 'سازمان‌ها و تأمین‌کنندگان',
      },
    ]);
  });

  it('shows the selected marketing section in breadcrumbs', () => {
    expect(getNavigationBreadcrumbs('/marketing', 'audiences')).toEqual([
      { href: '/marketing', title: 'مارکتینگ' },
      {
        href: '/marketing?section=audiences',
        title: 'مخاطبان',
      },
    ]);
    expect(getNavigationBreadcrumbs('/marketing', 'unknown')).toEqual([
      { href: '/marketing', title: 'مارکتینگ' },
    ]);
  });
});
