import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const workspace = readFileSync(
  new URL('./system-management-workspace.tsx', import.meta.url),
  'utf8',
);
const catalog = readFileSync(
  new URL('../model/settings-catalog.ts', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('./system-management-workspace.module.css', import.meta.url),
  'utf8',
);

describe('system management reference implementation', () => {
  it('groups the module hub under the seven primary system sections', () => {
    for (const label of [
      'فضای کار',
      'فروش و ارتباط با مشتری',
      'رزرواسیون و تامین سفر',
      'مالی',
      'سرمایه انسانی',
      'اسناد و گزارش',
      'تنظیمات شرکت',
      'بررسی تغییرات',
      'تاریخچه تغییرات',
      'جست‌وجوی تنظیمات',
    ])
      expect(workspace).toContain(label);

    expect(workspace).not.toContain('تنظیمات بخش‌ها');
    expect(workspace).not.toContain("page: 'modules'");
    expect(workspace).toContain("moduleIds: ['tasks', 'messages']");
    expect(workspace).toContain("moduleIds: ['documents', 'reports']");
  });

  it('includes every settings module and its reference card catalog', () => {
    for (const title of [
      'سازمان و نمایش',
      'کاربران و امنیت',
      'مشتریان و مسافران',
      'امور مشتریان و پشتیبانی',
      'فروش، قرارداد و قیمت‌گذاری',
      'بلیت و برنامه سفر',
      'رزرواسیون و خدمات سفر',
      'خرید و تأمین',
      'مالی و خزانه‌داری',
      'بازاریابی',
      'آژانس‌ها و مشتریان سازمانی',
      'منابع انسانی',
      'میزکار و اتوماسیون',
      'پیام و اعلان',
      'اسناد و فایل‌ها',
      'گزارش و نمای مدیریتی',
      'اتصال‌ها و دو سایت',
      'اطلاعات پایه',
    ])
      expect(catalog).toContain(title);

    expect(catalog).toContain('شماره‌گذاری اسناد');
    expect(catalog).toContain('سلامت و هشدار سرویس');
    expect(catalog).toContain('خروجی و فایل گزارش');
  });

  it('persists real versioned JSON settings with reason and optimistic version', () => {
    expect(workspace).toContain('systemManagementApi.writeSetting');
    expect(workspace).toContain("valueType: 'JSON'");
    expect(workspace).toContain('expectedVersion');
    expect(workspace).toContain('دلیل تغییر را وارد کنید');
    expect(workspace).toContain('وضعیت ساختگی ایجاد');
    expect(workspace).not.toContain('localStorage');
    expect(workspace).not.toContain('Math.random');
  });

  it('inherits the shared application theme and remains responsive', () => {
    expect(styles).toContain('var(--primary)');
    expect(styles).toContain('var(--surface)');
    expect(styles).toContain('var(--foreground)');
    expect(styles).toContain('var(--border)');
    expect(styles).toContain('.pageNav');
    expect(styles).toContain(
      'color-mix(in srgb, var(--accent) 9%, var(--surface))',
    );
    expect(styles).toContain('grid-template-columns: repeat(3');
    expect(styles).toContain('@media (max-width: 820px)');
    expect(styles).toContain('@media (max-width: 580px)');
    expect(workspace).toContain('styles.pageNav');
    expect(workspace).not.toContain('styles.sidebar');
    expect(workspace).not.toContain('styles.topbar');
    expect(workspace).toContain('aria-modal="true"');
    expect(workspace).toContain('aria-pressed={active}');
    expect(workspace).toContain('داده‌های عملیاتی');
    expect(workspace).toContain('مقادیر مرجع');
    expect(workspace).toContain('مشاهده تنظیمات');
    expect(workspace).toContain('ویرایش تنظیمات');
    expect(workspace).not.toContain('styles.hero');
    expect(workspace).not.toContain('apiNotice');
  });
});
