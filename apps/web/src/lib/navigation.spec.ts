import { describe, expect, it } from 'vitest';

import {
  getNavigationBreadcrumbs,
  groupedNavigationItems,
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
  'مدیریت و تعریف بلیط‌ها',
  'قرارداد',
  'خرید و تأمین',
  'مالی و کارتابل درخواست‌ها',
  'مارکتینگ',
  'آژانس‌ها و مشتریان سازمانی',
  'منابع انسانی',
  'میز کار',
  'اسناد و فایل‌ها',
  'گزارش‌ها',
  'یکپارچه‌سازی‌ها',
  'مدیریت سیستم',
  'اطلاعات پایه',
];

describe('CRM navigation', () => {
  it('groups every existing module exactly once without changing routes or labels', () => {
    const grouped = groupedNavigationItems.flatMap((group) => group.items);
    expect(grouped).toHaveLength(navigationItems.length);
    expect(new Set(grouped.map((item) => item.href)).size).toBe(
      navigationItems.length,
    );
    expect(grouped.map((item) => item.href).sort()).toEqual(
      [...expectedRoutes].sort(),
    );
    for (const item of grouped)
      expect(item).toBe(
        navigationItems.find((original) => original.href === item.href),
      );
    expect(
      groupedNavigationItems
        .find((group) => group.id === 'finance')
        ?.items.map((item) => item.href),
    ).toEqual(['/finance', '/purchases']);
    expect(
      groupedNavigationItems.find((group) => group.id === 'finance')?.title,
    ).toBe('مالی');
    expect(getNavigationItem('/finance')?.title).toBe(
      'مالی و کارتابل درخواست‌ها',
    );
    expect(
      groupedNavigationItems
        .find((group) => group.id === 'hr')
        ?.items.map((item) => item.href),
    ).toEqual(['/human-resources']);
  });
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
    expect(getNavigationItem('/hr')?.title).toBe('منابع انسانی');
    expect(getNavigationBreadcrumbs('/hr')).toEqual([
      { href: '/hr', title: 'منابع انسانی' },
    ]);
  });

  it('shows the active Human Resources section or workspace in breadcrumbs', () => {
    expect(
      getNavigationBreadcrumbs('/hr', null, {
        sectionKey: 'employees',
        workspaceKey: null,
      }),
    ).toEqual([
      { href: '/hr', title: 'منابع انسانی' },
      { href: '/hr?section=employees', title: 'کارکنان' },
    ]);
    expect(
      getNavigationBreadcrumbs('/hr', null, {
        sectionKey: null,
        workspaceKey: 'payroll',
      }),
    ).toEqual([
      { href: '/hr', title: 'منابع انسانی' },
      { href: '/hr?workspace=payroll', title: 'حقوق و دستمزد' },
    ]);
    expect(
      getNavigationBreadcrumbs('/hr', null, {
        sectionKey: 'unknown',
        workspaceKey: 'unknown',
      }),
    ).toEqual([{ href: '/hr', title: 'منابع انسانی' }]);
  });

  it('keeps the personal profile outside management navigation', () => {
    expect(getNavigationItem('/profile')).toBeUndefined();
    expect(getNavigationBreadcrumbs('/profile')).toEqual([
      { href: '/profile', title: 'پروفایل من' },
    ]);
  });

  it('does not create disallowed standalone sections', () => {
    const titles = navigationItems.map((item) => item.title).join(' ');
    expect(titles).not.toContain('جست‌وجو و فروش آنلاین');
    expect(titles).not.toContain('صدور اسناد');
  });

  it('keeps sales, reservation, and ticket management as separate modules', () => {
    expect(getNavigationItem('/sales')?.title).toBe('قرارداد');
    expect(getNavigationItem('/reservations')?.title).toContain('رزرواسیون');
    expect(getNavigationItem('/ticket-management')?.title).toContain('بلیط');
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
    expect(
      getNavigationBreadcrumbs('/sales/contracts/new')
        .map((item) => item.title)
        .at(-1),
    ).toBe('قرارداد جدید');
    expect(
      getNavigationBreadcrumbs('/sales/contracts/new').map((item) => item.href),
    ).toEqual(['/sales', '/sales/contracts/new']);
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
