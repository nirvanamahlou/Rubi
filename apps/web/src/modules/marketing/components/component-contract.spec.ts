import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
const pageSource = readFileSync(
  join(process.cwd(), 'src', 'app', '(crm)', 'marketing', 'page.tsx'),
  'utf8',
);

describe('marketing workspace component contract', () => {
  it('routes marketing to its dedicated workspace', () => {
    expect(pageSource).toContain('MarketingWorkspace');
    expect(pageSource).toContain('return <MarketingWorkspace />');
  });

  it('covers the nine reference sections and all required preview states', () => {
    for (const label of [
      'داشبورد',
      'کمپین‌ها',
      'مخاطبان',
      'ارتباطات',
      'محتوا و جذب',
      'تخفیف‌ها و پیشنهادها',
      'سفر مشتری',
      'گزارش‌ها',
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
  });

  it('includes every reference subtab and routes generic sections to data', () => {
    for (const label of [
      'تقویم کمپین‌ها',
      'بودجه و هزینه‌ها',
      'گردش تأیید',
      'تست‌های A/B',
      'گروه‌ها و سگمنت‌ها',
      'ارسال‌های زمان‌بندی‌شده',
      'کتابخانه محتوا و فایل‌ها',
      'قوانین استفاده',
      'ساخت اتوماسیون',
      'ROI و ROAS',
      'کانال‌ها و سرویس‌ها',
    ]) {
      expect(referenceDataSource).toContain(label);
    }
    expect(workspaceSource).toContain('previewItemsFor(section, tab)');
    expect(workspaceSource).toContain('setDetailItem');
  });

  it('provides responsive campaign cards without a horizontal table', () => {
    expect(workspaceSource).toContain('جزئیات کامل کمپین');
    expect(workspaceSource).toContain('sm:grid-cols-2');
    expect(workspaceSource).not.toContain('overflow-x-auto');
    expect(workspaceSource).not.toContain('<table');
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

  it('provides create, view and edit flows with campaign safety fields', () => {
    for (const field of [
      'expectedVersion',
      'Segment مخاطب',
      'بودجه مصوب',
      'Offer Intent',
      'UTM Campaign',
      'محدودیت تکرار ارسال',
      'Suppression',
      'پیش‌نمایش نهایی',
    ]) {
      expect(formSource).toContain(field);
    }
    expect(workspaceSource).toContain("openCampaign('create')");
    expect(workspaceSource).toContain("onOpen('view', campaign)");
    expect(workspaceSource).toContain("onOpen('edit', campaign)");
    expect(workspaceSource).toContain('aria-live="polite"');
  });

  it('labels analytics, attribution and dispatch as contract-gated', () => {
    expect(workspaceSource).toContain('MARKETING_ANALYTICS_STATUS');
    expect(workspaceSource).toContain('MARKETING_ATTRIBUTION_STATUS');
    expect(workspaceSource).toContain('MARKETING_DISPATCH_STATUS');
  });
});
