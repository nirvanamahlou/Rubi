import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  marketingSections,
  marketingSectionTabs,
} from '../model/reference-data';

const workspaceSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'components',
    'marketing-workspace.tsx',
  ),
  'utf8',
);
const formSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'components',
    'campaign-form.tsx',
  ),
  'utf8',
);
const calendarSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'components',
    'campaign-calendar.tsx',
  ),
  'utf8',
);
const referenceDataSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'model',
    'reference-data.ts',
  ),
  'utf8',
);
const referencePagesSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'components',
    'marketing-reference-pages.tsx',
  ),
  'utf8',
);
const pageSource = readFileSync(
  join(process.cwd(), 'src', 'app', '(crm)', 'marketing', 'page.tsx'),
  'utf8',
);
const appShellSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'layout', 'app-shell.tsx'),
  'utf8',
);

describe('marketing workspace component contract', () => {
  it('routes marketing to its dedicated workspace', () => {
    expect(pageSource).toContain('MarketingWorkspace');
    expect(pageSource).toContain('initialSection=');
    expect(pageSource).toContain("typeof section === 'string'");
    expect(pageSource).toContain("key={initialSection ?? 'marketing-hub'}");
  });

  it('covers the eight active sections and all required preview states', () => {
    for (const label of [
      'داشبورد',
      'کمپین‌ها',
      'مخاطبان',
      'ارتباطات',
      'محتوا و جذب',
      'تخفیف‌ها و پیشنهادها',
      'سفر مشتری',
      'تنظیمات',
    ]) {
      expect(referenceDataSource).toContain(label);
    }
    for (const state of [
      'preview',
      'loading',
      'empty',
      'error',
      'unauthorized',
      'forbidden',
      'conflict',
      'awaiting-integration',
    ]) {
      expect(workspaceSource).toContain(state);
    }
    expect(marketingSections.map((section) => section.key)).not.toContain(
      'reports',
    );
    expect(marketingSections.map((section) => section.key)).toContain(
      'communications',
    );
  });

  it('implements every reference subtab with its dedicated inner page', () => {
    for (const label of [
      'تقویم کمپین‌ها',
      'بودجه و هزینه‌ها',
      'گردش تأیید',
      'گروه‌ها و سگمنت‌ها',
      'مخاطبان کمپین',
      'منابع ورود',
      'ارسال پیام',
      'ارسال‌های زمان‌بندی‌شده',
      'تاریخچه ارسال‌ها',
      'قالب‌های پیام',
      'کتابخانه محتوا و فایل‌ها',
      'ساخت اتوماسیون',
      'کانال‌ها و سرویس‌ها',
    ]) {
      expect(referenceDataSource).toContain(label);
    }
    for (const pageMarker of [
      'سازنده سگمنت پویا',
      'سرنخ‌های مارکتینگ',
      'افزودن مخاطبان کمپین',
      'افزودن منبع ورود',
      'marketing-message-composer',
      'قالب‌های پیام',
      'کتابخانه محتوا',
      'صفحات فرود',
      'پیشنهادهای ویژه',
      'سازنده سفر مشتری',
      'کانال‌ها و سرویس‌ها',
      'لاگ‌ها و خطاهای عملیاتی',
    ]) {
      expect(referencePagesSource).toContain(pageMarker);
    }
    expect(workspaceSource).toContain('MarketingReferenceSection');
    expect(workspaceSource).toContain('setDetailItem');
    expect(marketingSectionTabs.audiences.map((item) => item[0])).not.toContain(
      'subscriptions',
    );
    expect(marketingSectionTabs.communications.map((item) => item[0])).toEqual([
      'send',
      'scheduled',
      'history',
      'templates',
    ]);
    expect(referencePagesSource).toContain("label: 'قالب جدید'");
    expect(marketingSectionTabs.offers.map((item) => item[0])).not.toContain(
      'rules',
    );
  });

  it('provides responsive campaign cards and Rubi-styled reference tables', () => {
    expect(workspaceSource).toContain('جزئیات کامل کمپین');
    expect(workspaceSource).toContain('sm:grid-cols-2');
    expect(referencePagesSource).toContain('overflow-x-auto');
    expect(referencePagesSource).toContain('<table');
    expect(referencePagesSource).toContain('PaginationShell');
  });

  it('uses Rubi filters and calendars for date-aware campaign controls', () => {
    expect(workspaceSource).toContain('@/components/ui/date-picker');
    expect(workspaceSource).toContain('startsAfter');
    expect(workspaceSource).toContain('endsBefore');
    expect(calendarSource).toContain('calendarMonthDays');
    expect(calendarSource).toContain('moveCalendarMonth');
    expect(calendarSource).toContain('تقویم شمسی');
    expect(calendarSource).toContain('تقویم میلادی');
    expect(calendarSource).toContain('onOpen(campaign)');
  });

  it('provides the simplified eight-step create, view and edit flows', () => {
    for (const field of [
      'Segment مخاطب',
      'بودجه مصوب',
      'UTM Campaign',
      'محدودیت تکرار ارسال',
      'پیش‌نمایش نهایی',
    ]) {
      expect(formSource).toContain(field);
    }
    for (const removedCopy of [
      'Preview امن و بدون PII',
      'محافظت از حریم خصوصی',
      'ذخیره به UTC',
      'Offer Intent',
      'campaign-offer',
      'campaign-coupon',
      'نسخه مورد انتظار',
      'campaign-version',
      'description=',
    ]) {
      expect(formSource).not.toContain(removedCopy);
    }
    expect(formSource).toContain('lg:grid-cols-8');
    expect(formSource).toContain('{step === 7 ? (');
    expect(formSource).not.toContain('{step === 8 ? (');
    expect(workspaceSource).toContain("onOpen('create')");
    expect(workspaceSource).toContain("onOpen('view', campaign)");
    expect(workspaceSource).toContain("onOpen('edit', campaign)");
    expect(workspaceSource).toContain('CampaignDetailReference');
    expect(referencePagesSource).toContain('صفحات جزئیات کمپین');
    expect(workspaceSource).toContain('aria-live="polite"');
  });

  it('keeps marketing chrome clean and pushes section changes into browser history', () => {
    for (const removedCopy of [
      'محیط Preview غیرعملیاتی',
      'داده‌های آزمایشی مرجع مارکتینگ آماده نمایش است.',
      'CRM / Marketing',
      'MARKETING_UI_VERSION',
      'MARKETING_PREVIEW_NOTICE',
      'MARKETING-001C',
    ]) {
      expect(workspaceSource).not.toContain(removedCopy);
    }
    expect(workspaceSource).toContain("window.addEventListener('popstate'");
    expect(workspaceSource).not.toContain('requestAnimationFrame');
    expect(workspaceSource).toContain(
      'resolveMarketingSection(initialSection)',
    );
    expect(workspaceSource).toContain("url.searchParams.set('section'");
    expect(workspaceSource).toContain('const router = useRouter()');
    expect(workspaceSource).toContain('router.push(nextUrl');
    expect(workspaceSource).toContain('router.replace(nextUrl');
    expect(workspaceSource).toContain(
      'new CustomEvent(MARKETING_SECTION_CHANGE_EVENT',
    );
    expect(appShellSource).toContain('window.addEventListener(');
    expect(appShellSource).toContain('MARKETING_SECTION_CHANGE_EVENT');
    expect(appShellSource).toContain('new URL(window.location.href)');
    expect(workspaceSource).not.toContain('window.history[method]');
    expect(workspaceSource).not.toContain('ایجاد کمپین');
    expect(workspaceSource).toContain('افزودن کمپین جدید');
    expect(workspaceSource).not.toContain('بازگشت به بخش‌های مارکتینگ');
    expect(referenceDataSource).not.toContain('تست‌های A/B');
  });

  it('renders every marketing page RTL and shows two dashboard chart series', () => {
    expect(workspaceSource).toContain('[&_td]:text-right [&_th]:text-right');
    expect(referencePagesSource).toContain('className="text-right" dir="rtl"');
    expect(referencePagesSource).toContain('data-series="leads"');
    expect(referencePagesSource).toContain('data-series="attributed-sales"');
    expect(referencePagesSource).toContain('سرنخ جدید');
    expect(referencePagesSource).toContain('فروش منتسب');
    expect(referencePagesSource).not.toContain('title="داشبورد نمایشی"');
  });

  it('keeps reference filters, forms and interactive actions on shared Rubi controls', () => {
    expect(referencePagesSource).toContain('@/components/ui/date-picker');
    expect(referencePagesSource).toContain('FilterBar');
    expect(referencePagesSource).toContain('onValueChange={setTab}');
    expect(referencePagesSource).toContain('role="switch"');
    expect(referencePagesSource).toContain('onClick={() => onNotice');
    expect(referencePagesSource).toContain('محتوای جدید');
    expect(referencePagesSource).toContain('documentsApi.upload');
    expect(referencePagesSource).toContain(
      "form.set('sourceModule', 'marketing')",
    );
    expect(referencePagesSource).toContain('ثبت در محتوا و اسناد');
    expect(referencePagesSource).toContain('افزودن مخاطبان کمپین');
    expect(referencePagesSource).toContain('افزودن منبع ورود');
    expect(referencePagesSource).toContain('حداقل مبلغ خرید');
    expect(referencePagesSource).toContain('سقف استفاده هر مشتری');
    expect(referencePagesSource).not.toContain('قوانین استفاده');
    expect(referencePagesSource).not.toContain('MoreHorizontal');
    expect(referencePagesSource).toContain('downloadRowsAsExcel');
    expect(referencePagesSource).toContain('غیرفعال‌سازی');
    expect(referencePagesSource).toContain('segmentFieldOptions');
    expect(referencePagesSource).toContain('LeadScoringPage');
    expect(workspaceSource).not.toContain('خروجی داشبورد');
    expect(referencePagesSource).not.toContain('در محیط آزمایشی باز شد');
  });

  it('keeps attribution and dispatch contract gates in their relevant details', () => {
    expect(workspaceSource).toContain('MARKETING_ATTRIBUTION_STATUS');
    expect(workspaceSource).toContain('MARKETING_DISPATCH_STATUS');
  });
});
