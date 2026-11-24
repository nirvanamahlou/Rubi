import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canViewRoute,
  screenPermission,
  USER_ACCESS_PROFILE_PERMISSION,
} from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import { pilotGuideResponse } from './guide-pilot';

const scenarios = [
  [
    'purchase/request-workflow',
    'برای درخواست خرید چیکار کنم؟',
    '/purchases',
    'apps/web/src/modules/procurement/workspace.tsx',
  ],
  [
    'purchase/supplier-quote',
    'برای استعلام خرید چیکار کنم؟',
    '/purchases',
    'apps/api/src/procurement/procurement.operations.ts',
  ],
  [
    'purchase/purchase-order',
    'برای ثبت سفارش خرید چیکار کنم؟',
    '/purchases',
    'apps/web/src/modules/procurement/orders-section.tsx',
  ],
  [
    'purchase/amend-order',
    'برای اصلاح سفارش خرید چیکار کنم؟',
    '/purchases',
    'apps/api/src/procurement/procurement.operations.ts',
  ],
  [
    'purchase/receiving',
    'برای ثبت رسید کالا چیکار کنم؟',
    '/purchases',
    'apps/web/src/modules/procurement/operation-form.tsx',
  ],
  [
    'purchase/discrepancy',
    'برای ثبت مغایرت خرید چیکار کنم؟',
    '/purchases',
    'apps/api/src/procurement/procurement.operations.ts',
  ],
  [
    'purchase/invoice-followup',
    'برای تطبیق فاکتور و تحویل چیکار کنم؟',
    '/purchases',
    'apps/web/src/modules/procurement/operation-form.tsx',
  ],
  [
    'reservation-report/metric-units',
    'برای مبنای شمارش گزارش رزرواسیون چیکار کنم؟',
    '/reservations/reports',
    'apps/web/src/modules/ticket-catalog/components/issued-tickets-workspace.tsx',
  ],
  [
    'reservation-report/date-comparison',
    'برای اختلاف مبنای تاریخ گزارش رزرواسیون چیکار کنم؟',
    '/reservations/reports',
    'apps/api/src/reservations/service-report.ts',
  ],
  [
    'reservation-report/filter-scope',
    'برای نتیجه خالی گزارش رزرواسیون چیکار کنم؟',
    '/reservations/reports',
    'apps/web/src/modules/ticket-catalog/model/issued-tickets.ts',
  ],
  [
    'reservation-report/count-difference',
    'برای اختلاف آمار گزارش رزرواسیون چیکار کنم؟',
    '/reservations/reports',
    'apps/web/src/modules/ticket-catalog/components/issued-tickets-workspace.tsx',
  ],
  [
    'reservation-report/allocation-and-status',
    'برای تفاوت تخصیص و صدور بلیت چیکار کنم؟',
    '/reservations/reports',
    'apps/api/src/reservations/service-report.ts',
  ],
] as const;

describe('purchase and reservation report guides', () => {
  it.each(scenarios)(
    '%s resolves an authorized topic with implementation evidence',
    (ref, question, href, source) => {
      const result = pilotGuideResponse(
        question,
        '/dashboard',
        undefined,
        (candidate) => candidate === href,
      );
      expect(result.status).toBe('answer');
      expect(result.sections[0]).toMatchObject({
        ref,
        href,
        guideHref: '/assistant-guides/' + ref.replace('/', '#'),
      });
      expect(existsSync(resolve('../..', source))).toBe(true);
      expect(
        pilotGuideResponse(question, '/dashboard', undefined, () => false),
      ).toEqual({ status: 'insufficient', sections: [] });
    },
  );

  it('uses the accessible purchase workspace without linking to unavailable screens', () => {
    const question = 'استعلام خرید را چطور ثبت کنم؟';
    const view = (permissions: string[]) =>
      pilotGuideResponse(question, '/ticket-purchases', undefined, (href) =>
        canViewRoute(permissions, href),
      );
    const base = [
      USER_ACCESS_PROFILE_PERMISSION,
      'procurement.read.all',
      'procurement.quote.manage',
    ];
    expect(view(base)).toEqual({ status: 'insufficient', sections: [] });
    expect(
      view([...base, screenPermission('procurement.home')]).sections[0]?.ref,
    ).toBe('purchase/supplier-quote');
  });

  it('separates metric definitions and live data questions', () => {
    const view = (q: string) =>
      pilotGuideResponse(q, '/reservations/reports', undefined, () => true);
    expect(view('معنی کارت‌های گزارش رزرواسیون چیست؟').sections[0]?.ref).toBe(
      'reservation-report/metric-units',
    );
    expect(view('تعداد بلیت‌های صادرشده چقدر است؟').status).toBe('unmatched');
    expect(view('مبنای شمارش گزارش رزرواسیون چیه؟').sections[0]?.ref).toBe(
      'reservation-report/metric-units',
    );
  });
});
