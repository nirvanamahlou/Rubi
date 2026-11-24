import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pilotGuideResponse } from './guide-pilot';

const scenarios = [
  [
    'travel-issuance/voucher-readiness',
    'برای واچر آماده نیست چیکار کنم؟',
    'apps/web/src/modules/reservations/model/voucher-readiness.ts',
  ],
  [
    'travel-issuance/document-correction',
    'برای مغایرت واچر چیکار کنم؟',
    'apps/api/src/reservations/reservation-ticket-documents.ts',
  ],
  [
    'travel-issuance/delivery-exception',
    'برای انقضای استثنای تحویل چیکار کنم؟',
    'docs/assistant/guides/finance-delivery.md',
  ],
  [
    'customer-affairs/sales-response',
    'برای پذیرش ارجاع فروش چیکار کنم؟',
    'apps/web/src/modules/customer-affairs/components/sales-handoff-response.tsx',
  ],
  [
    'customer-affairs/ticket-escalation',
    'برای تشدید تیکت چیکار کنم؟',
    'apps/api/src/customer-affairs/customer-affairs.controller.ts',
  ],
  [
    'customer-affairs/corrective-action',
    'برای اقدام اصلاحی مشتری چیکار کنم؟',
    'apps/api/src/customer-affairs/customer-affairs.controller.ts',
  ],
  [
    'package-generator/missing-rate',
    'برای نرخ پک خالی چیکار کنم؟',
    'apps/web/src/modules/pricing-management/model/package-generator-data.ts',
  ],
  [
    'package-generator/visual-output',
    'برای بنر پک چیکار کنم؟',
    'apps/web/src/modules/pricing-management/components/package-generator-workspace.tsx',
  ],
  [
    'package-generator/daily-publication',
    'برای ارسال به پکیج های روز چیکار کنم؟',
    'apps/web/src/modules/pricing-management/components/generator-daily-package-publisher.tsx',
  ],
  [
    'petty-cash/recharge',
    'برای شارژ تنخواه چیکار کنم؟',
    'apps/web/src/modules/procurement/petty-fund-card.tsx',
  ],
  [
    'petty-cash/expense-proof',
    'برای فیش هزینه تنخواه چیکار کنم؟',
    'apps/web/src/modules/procurement/petty-registrations.tsx',
  ],
  [
    'petty-cash/settlement-policy',
    'برای بستن تنخواه چیکار کنم؟',
    'apps/api/src/procurement/procurement.petty-cash.ts',
  ],
  [
    'correspondence/archive-search',
    'برای کد آرشیو نامه چیکار کنم؟',
    'apps/web/src/modules/correspondence/incoming-letter-workspace.tsx',
  ],
  [
    'correspondence/letter-export',
    'برای چاپ نامه صادره چیکار کنم؟',
    'apps/web/src/modules/correspondence/outgoing-letter-workspace.tsx',
  ],
  [
    'correspondence/internal-actions',
    'برای بازارسال نامه داخلی چیکار کنم؟',
    'apps/web/src/modules/correspondence/internal-letter-inbox.tsx',
  ],
] as const;

describe('expanded Nora panel guidance', () => {
  it.each(scenarios)(
    '%s resolves a documented action and respects access',
    (ref, question, source) => {
      const answer = pilotGuideResponse(
        question,
        '/dashboard',
        undefined,
        () => true,
      );
      expect(answer.status).toBe('answer');
      const section = answer.sections[0];
      expect(section?.ref).toBe(ref);
      expect(section?.guideHref).toBe(
        '/assistant-guides/' + ref.replace('/', '#'),
      );
      expect(section?.steps.length).toBeGreaterThanOrEqual(3);
      expect(existsSync(resolve('../..', source))).toBe(true);
      expect(
        pilotGuideResponse(question, '/dashboard', undefined, () => false),
      ).toEqual({ status: 'insufficient', sections: [] });
    },
  );

  it('keeps financial delivery exceptions scoped even on the reservations page', () => {
    const question = 'استثنای تحویل مدرک رو از کجا بررسی کنم؟';
    expect(
      pilotGuideResponse(
        question,
        '/reservations',
        undefined,
        (href) => href === '/reservations',
      ),
    ).toEqual({ status: 'insufficient', sections: [] });
  });

  it('does not resolve the operational status of an identified expenditure as a guide', () => {
    expect(
      pilotGuideResponse(
        'وضعیت ثبت هزینه تنخواه 123456 را از کجا ببینم؟',
        '/purchases',
        undefined,
        () => true,
      ).status,
    ).toBe('unmatched');
  });
});
