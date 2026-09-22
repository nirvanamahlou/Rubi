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
const navigation = readFileSync(
  new URL('../../../lib/navigation.ts', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('./system-management-workspace.module.css', import.meta.url),
  'utf8',
);

describe('system management reference implementation', () => {
  it('includes the overview, primary category filters, and module hub', () => {
    for (const label of [
      'نمای کلی',
      'بررسی تغییرات',
      'تاریخچه تغییرات',
      'جست‌وجوی تنظیمات',
    ])
      expect(workspace).toContain(label);

    for (const category of [
      'فضای کار',
      'فروش و ارتباط با مشتری',
      'رزرواسیون و تأمین سفر',
      'مالی',
      'سرمایه انسانی',
      'اسناد و گزارش‌ها',
      'تنظیمات شرکت',
    ])
      expect(navigation).toContain(category);

    expect(workspace).not.toContain('تنظیمات بخش‌ها');
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
      'میزکار',
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
    expect(catalog).not.toContain('برند و اسناد صادره');
    expect(catalog).not.toContain("'branding'");
    expect(catalog).not.toContain('شرکت صادرکننده پیش‌فرض');
    expect(catalog).not.toContain('سربرگ پیش‌فرض');
    expect(catalog).not.toContain('پیگیری و تحویل سرنخ');
    expect(catalog).not.toContain("'leads'");
    expect(catalog).not.toContain("g('contact', 'ارتباط با مشتری'");
    expect(catalog).not.toContain('کانال ترجیحی');
    expect(catalog).not.toContain('یادآوری تکمیل پرونده');
    expect(catalog).not.toContain('مرجع تأیید ادغام');
    expect(catalog).not.toContain('زبان ارتباط');
    expect(catalog).not.toContain('هشدار مصرف مهلت');
    expect(catalog).not.toContain('بستن و رضایت‌سنجی');
    expect(catalog).not.toContain('ارسال نظرسنجی پس از حل');
    expect(catalog).not.toContain('فاصله ارسال نظرسنجی');
    expect(catalog).not.toContain('نمایش کاتالوگ‌ها');
    expect(catalog).not.toContain('میزکار و اتوماسیون');
    expect(catalog).not.toContain("g('catalog', 'نمایش کاتالوگ‌ها'");
    expect(catalog).toContain(
      'در حال بررسی|در انتظار تکمیل مدارک|تأیید مشروط|فعال|معلق|غیرفعال|ردشده',
    );
    expect(catalog).toContain(
      'مدیر تأمین|سرپرست اطلاعات پایه|مدیر عملیات|مدیر مالی|مدیر ارشد اجرایی|کمیته ارزیابی تأمین‌کنندگان',
    );
    expect(catalog).toContain(
      'مدیر مالی|مسئول نرخ ارز|سرپرست خزانه‌داری|مدیر حسابداری|مدیر ارشد مالی|کمیته نرخ ارز',
    );
    expect(catalog).toContain('بستن درخواست');
    expect(catalog).not.toContain('رضایت و حریم خصوصی');
    expect(catalog).not.toContain("'consentChannel'");
    expect(catalog).not.toContain('ثبت رضایت از طریق');
    expect(catalog).not.toContain('اعلان خروجی حساس به مسئول');
    expect(catalog).not.toContain('قیمت کانال‌های فروش');
    expect(catalog).not.toContain("g('channels'");
    expect(catalog).not.toContain('کانال مشمول');
    expect(catalog).not.toContain('درصد افزایش قیمت');
    expect(catalog).not.toContain('هوایی، قطار و اتوبوس');
    expect(catalog).not.toContain("g('transport'");
    expect(catalog).not.toContain('حمل‌ونقل پیش‌فرض');
    expect(catalog).not.toContain('هشدار اتصال کوتاه سفر');
    expect(catalog).not.toContain('پکیج و نوبت تور');
    expect(catalog).not.toContain("g('tour'");
    expect(catalog).not.toContain('الگوی برنامه سفر');
    expect(catalog).not.toContain('اجرای خودکار');
    expect(catalog).not.toContain("g('execution'");
    expect(catalog).not.toContain('گیرنده خطای اجرا');
    expect(catalog).not.toContain('چیدمان پیش‌فرض');
    expect(catalog).not.toContain("'layout'");
    expect(catalog).not.toContain('درخواست و تأیید داخلی');
    expect(catalog).not.toContain("g('approval'");
    expect(catalog).not.toContain('مهلت پاسخ مدیر');
    expect(catalog).not.toContain('انتساب و رهگیری');
    expect(catalog).not.toContain("g('attribution'");
    expect(catalog).not.toContain('الزام UTM برای لینک کمپین');
    expect(catalog).not.toContain('کاربران و همکاری');
    expect(catalog).not.toContain("g('portal'");
    expect(catalog).not.toContain('تأیید کاربر سازمان');
    expect(catalog).not.toContain('استعلام و تأمین‌کننده');
    expect(catalog).not.toContain("g('quotations'");
    expect(catalog).not.toContain('خرید اضطراری و برآورد');
    expect(catalog).not.toContain("g('emergency'");
    expect(catalog).toContain("t('templateName', 'نام قالب'");
    expect(catalog).toContain("'templateFile'");
    expect(catalog).toContain("type: 'file'");
    expect(catalog).not.toContain(
      "s(\n          'template',\n          'قالب قرارداد'",
    );
  });

  it('uses the real application navigation labels without a duplicated child-link row', () => {
    expect(workspace).toContain('navigationGroups');
    expect(workspace).not.toContain('categoryExtraLinks');
    expect(workspace).not.toContain('رفتن به ${link.title}');
    expect(workspace).not.toContain('styles.categoryPanel');
    expect(workspace).not.toContain('styles.categoryChild');
    expect(navigation).toContain("hrefs: ['/workbench', '/dashboard']");
    expect(navigation).toContain("hrefs: ['/human-resources', '/purchases']");
    expect(navigation).toContain(
      "hrefs: ['/reservations', '/reservations/hotel-rates', '/ticket-management']",
    );
    expect(navigation).toContain("'/ticket-management'");
    expect(navigation).toContain("'/purchases'");
    expect(workspace).toContain(
      "'reservations-supply': ['catalog', 'operations']",
    );
    expect(workspace).toContain("'human-resources': ['hr', 'procurement']");
    expect(workspace).not.toContain(
      "'reservations-supply': ['catalog', 'operations', 'procurement']",
    );
  });

  it('persists real versioned JSON settings with an automatic audit reason and optimistic version', () => {
    expect(workspace).toContain('systemManagementApi.writeSetting');
    expect(workspace).toContain('systemPreferencesChangedEvent');
    expect(workspace).toContain("valueType: 'JSON'");
    expect(workspace).toContain('expectedVersion');
    expect(workspace).toContain('ویرایش تنظیمات ${editing.module.title}');
    expect(workspace).not.toContain('<span>دلیل تغییر</span>');
    expect(workspace).toContain('وضعیت ساختگی ایجاد');
    expect(workspace).not.toContain('localStorage');
    expect(workspace).not.toContain('Math.random');
  });

  it('registers module navigation in browser history and restores it on Back or Forward', () => {
    expect(workspace).toContain("window.addEventListener('popstate'");
    expect(workspace).toContain("window.removeEventListener('popstate'");
    expect(workspace).toContain('window.history.pushState(');
    expect(workspace).toContain("url.searchParams.set('module', module.id)");
    expect(workspace).toContain("searchParams.get('module')");
    expect(workspace).toContain("setPage('overview')");
    expect(workspace).toContain("url.searchParams.delete('module')");
    expect(workspace).toContain("usePageBreadcrumbs('/system', breadcrumbs)");
    expect(workspace).toContain('title: selectedModule.title');
    expect(workspace).toContain("page !== 'module'");
  });

  it('uses the collection-wide scope without header scope controls', () => {
    expect(workspace).not.toContain('legalEntitiesApi.selectable');
    expect(workspace).not.toContain("scope: 'LEGAL_ENTITY'");
    expect(workspace).toContain("scope: 'GLOBAL'");
    expect(workspace).toContain('scopeId: scope.scopeId');
    expect(workspace).not.toContain('scopeLoadError');
    expect(workspace).not.toContain('aria-label="دامنه تنظیمات"');
  });

  it('inherits the shared application theme and remains responsive', () => {
    expect(styles).toContain('var(--primary)');
    expect(styles).toContain(
      'background: color-mix(in srgb, var(--primary) 6%, var(--surface))',
    );
    expect(styles).toContain('var(--surface)');
    expect(styles).toContain('var(--foreground)');
    expect(styles).toContain('var(--border)');
    expect(styles).toContain(
      'color-mix(in srgb, var(--accent) 14%, transparent)',
    );
    expect(styles).toContain('grid-template-columns: repeat(3');
    expect(styles).toContain('@media (max-width: 820px)');
    expect(styles).toContain('@media (max-width: 580px)');
    expect(styles).toContain('border-inline-start: 4px solid var(--primary)');
    expect(styles).toContain(
      'background: color-mix(in srgb, var(--primary) 5%, var(--surface))',
    );
    expect(workspace).not.toContain('styles.pageNav');
    expect(workspace).not.toContain('styles.sidebar');
    expect(workspace).not.toContain('styles.topbar');
    expect(workspace).toContain('aria-modal="true"');
    expect(workspace).toContain("aria-pressed={category === 'all'}");
    expect(workspace).not.toContain('aria-expanded={expanded}');
    expect(navigation).toContain('رزرواسیون و تأمین سفر');
    expect(navigation).toContain('فروش و ارتباط با مشتری');
    expect(workspace).not.toContain(
      'زیرمجموعه‌های ${systemCategoryGroups.find',
    );
    expect(workspace).not.toContain('styles.categoryPanel');
    expect(workspace).not.toContain('داده‌های عملیاتی');
    expect(workspace).not.toContain('مقادیر مرجع');
    expect(workspace).toContain('با ثبت خودکار Audit');
    expect(workspace).toContain('مشاهده تنظیمات');
    expect(workspace).toContain('ویرایش تنظیمات');
    expect(workspace).not.toContain('styles.hero');
    expect(workspace).not.toContain('apiNotice');
    expect(workspace).not.toContain("history: 'تاریخچه این بخش'");
    expect(workspace).toContain("history: 'تاریخچه'");
    expect(workspace).toContain("history: 'History'");
    expect(workspace).not.toContain("navigate('modules')");
    expect(workspace).not.toContain('<LayoutGrid');
    expect(workspace).not.toContain('styles.categoryDot');
    expect(styles).not.toContain('.categoryDot');
    expect(styles).toContain('border-radius: 14px');
    expect(styles).toContain('grid-template-columns: repeat(4');
    expect(styles).toContain('min-height: 208px');
    expect(styles).toContain('transform: translateY(-4px)');
    expect(styles).toContain('border-radius: 999px');
    expect(styles).toContain('.hubCard::before');
    expect(styles).toContain('width: 56px');
    expect(styles).toContain('--text-muted: var(--muted-foreground)');
    expect(styles).not.toContain('--muted: var(--muted-foreground)');
    expect(styles).toContain('background: var(--muted)');
    expect(workspace).not.toContain('copy.version');
    expect(workspace).not.toContain('styles.pillBlue');
    expect(styles).not.toContain('.pillBlue');
    expect(workspace).not.toContain(
      'کاتالوگ و چرخهٔ خروجی گزارش را Reporting مالک است.',
    );
    expect(workspace).not.toContain('ادامه در Reporting: گزارش‌ها و خروجی‌ها');
    expect(workspace).toContain('styles.fieldLabel');
    expect(workspace).toContain('styles.fieldUnit');
    expect(styles).toContain('.fieldUnit');
    expect(workspace).toContain('systemManagementApi.uploadContractTemplate');
    expect(workspace).toContain("form.set('file', pendingFile)");
    expect(workspace).toContain('type="file"');
    expect(styles).toContain("input[type='file']::file-selector-button");
  });
});
