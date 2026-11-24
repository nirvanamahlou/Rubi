import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assistantGuideSection } from './assistant-guide-registry';

const scenarios = [
  [
    'flight-pricing',
    'publish',
    'apps/web/src/modules/sales/components/ticket-prices-workspace.tsx',
    'در بررسی اختلاف قیمت سایت',
  ],
  [
    'flight-pricing',
    'tiers',
    'apps/web/src/modules/sales/components/ticket-prices-workspace.tsx',
    'اگر مجموع صندلی پله‌ها خطا می‌دهد',
  ],
  [
    'b2c',
    'register',
    'apps/web/src/modules/customers/components/customer-workspace.tsx',
    'اگر پیام می‌گوید پرونده اصلی ایجاد شده اما اطلاعات جانبی کامل نشده‌اند',
  ],
  [
    'b2c',
    'duplicate',
    'apps/web/src/modules/customers/components/customer-workspace.tsx',
    'پس از «ثبت پیشنهاد ادغام» وضعیت بررسی همان پیشنهاد را بخوانید',
  ],
  [
    'tour',
    'price',
    'apps/web/src/modules/ticket-catalog/components/tour-inline-prices.tsx',
    'زیر تعریف همان تور',
  ],
  [
    'tour',
    'period',
    'apps/web/src/modules/ticket-catalog/components/tour-inline-prices.tsx',
    'پیش از توقف یا حذف',
  ],
  [
    'call-center',
    'call-center-assignment',
    'apps/web/src/modules/call-center/workflow-client.ts',
    'قبل از اعلام نبود درخواست در صف',
  ],
  [
    'call-center',
    'call-center-notification',
    'apps/web/src/modules/call-center/workflow.tsx',
    'پس از ندیدن اعلان',
  ],
  [
    'master-data',
    'hotels',
    'apps/web/src/modules/master-data/components/hotel-images.tsx',
    'هنگام افزودن تصویر هتل',
  ],
  [
    'documents',
    'upload',
    'apps/web/src/modules/documents/components/documents-workspace.tsx',
    'پس از بارگذاری',
  ],
  [
    'documents',
    'download',
    'apps/web/src/modules/documents/components/documents-workspace.tsx',
    'در انتظار اسکن',
  ],
  [
    'workbench',
    'daily-packages',
    'apps/web/src/modules/workbench/workbench-daily-packages.tsx',
    'فیلتر روز',
  ],
  [
    'b2b',
    'credit',
    'apps/web/src/modules/organizations/model/temporary-credit.ts',
    'در فرم افزایش موقت',
  ],
  [
    'b2b',
    'finance',
    'apps/web/src/modules/organizations/model/credit-projection.ts',
    'اگر اعتبار قابل استفاده در دسترس نیست',
  ],
] as const;

describe('audited Nora guidance', () => {
  it.each(scenarios)(
    '%s/%s preserves its anchor and includes the verified recovery step',
    (domain, id, source, expected) => {
      const topic = assistantGuideSection(domain, id);
      expect(topic?.guideHref).toBe('/assistant-guides/' + domain + '#' + id);
      expect(topic?.steps.at(-1)).toContain(expected);
      expect(existsSync(resolve('../..', source))).toBe(true);
    },
  );
});
