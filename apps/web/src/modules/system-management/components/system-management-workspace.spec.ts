import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./system-management-workspace.tsx', import.meta.url),
  'utf8',
);

describe('system management workspace contract', () => {
  it('covers every requested administration area without creating a new main navigation item', () => {
    for (const title of [
      'کاربران',
      'نقش‌ها',
      'مجوزها و دامنه دسترسی',
      'شعب و دسترسی سازمانی',
      'شعب فعال',
      'شرکت‌ها و سربرگ‌ها',
      'تنظیمات عمومی',
      'تنظیمات امنیتی',
      'نشست‌ها و دستگاه‌ها',
      'شماره‌گذاری و شناسه‌ها',
      'تقویم، تاریخ و زمان',
      'اعلان‌ها',
      'قالب‌های سیستمی',
      'Audit و رخدادهای امنیتی',
      'وضعیت سرویس‌ها و Jobها',
      'Feature Flagها',
      'نگهداری و درخواست پشتیبان',
      'تاریخچه تغییرات تنظیمات',
    ])
      expect(source).toContain(title);
    expect(source).not.toContain('mainNavigation');
  });

  it('reads only public owner APIs and keeps unimplemented health sources explicit', () => {
    for (const endpoint of [
      '/iam/users',
      '/iam/access-options',
      '/legal-entities',
      '/iam/audit-events',
      '/health',
    ])
      expect(source).toContain(endpoint);
    expect(source).toContain('بدون projection عمومی');
    expect(source).toContain('API مالک منتشر نشده');
  });

  it('keeps sensitive values and dangerous server actions out of the UI', () => {
    expect(source).toContain('Token، Cookie، Secret، رمز عبور و IP خام');
    expect(source).toContain(
      'امکان اجرای فرمان سرور، حذف داده یا بازیابی مستقیم را ارائه نمی‌کند',
    );
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('Math.random');
  });

  it('has keyboard-operable filters and the full UI state vocabulary', () => {
    expect(source).toContain('aria-pressed={activeSection === section}');
    expect(source).toContain('aria-label="جست‌وجوی بخش مدیریت سیستم"');
    expect(source).toContain('در حال بارگذاری مدیریت سیستم');
    expect(source).toContain('نیازمند ورود');
    expect(source).toContain('بدون مجوز');
    expect(source).toContain('در دسترس نیست');
  });
});
