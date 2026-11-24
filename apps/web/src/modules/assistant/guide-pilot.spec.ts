import { describe, expect, it } from 'vitest';
import { pilotGuideResponse } from './guide-pilot';

describe('shared pilot guide evidence', () => {
  it.each([
    ['چجور قرارداد بزنم؟', '/sales', 'sales/create'],
    ['رسید رو از کجا بذارم؟', '/sales', 'sales/receipt'],
    [
      'واچر هتل دوم رو از کجا بگیرم؟',
      '/reservations',
      'travel-issuance/voucher',
    ],
    [
      'درخواست مشتری رو چجوری ثبت کنم؟',
      '/customer-affairs',
      'customer-affairs/requests',
    ],
    [
      'از کجا درخواست رو به فروش ارجاع بدم؟',
      '/customer-affairs',
      'customer-affairs/handoffs',
    ],
    [
      'تیکت معوق رو کجا ببینم؟',
      '/customer-affairs',
      'customer-affairs/tickets',
    ],
  ])('cites the authored section for %s', (question, panel, ref) => {
    const result = pilotGuideResponse(question, panel, undefined, () => true);
    expect(result.status).toBe('answer');
    expect(result.sections[0]?.ref).toBe(ref);
  });

  it('combines flight, hotel and review evidence', () => {
    const answer = pilotGuideResponse(
      'قبل ارسال رزرواسیون بلیت و هتل رو چطور چک کنم؟',
      '/sales',
      undefined,
      () => true,
    );
    expect(answer.sections.map(({ ref }) => ref)).toEqual([
      'sales/flight',
      'sales/hotel',
      'sales/review',
    ]);
  });

  it('enforces related destinations and refuses unknown policy', () => {
    const answer = pilotGuideResponse(
      'بلیت پرواز رو چطور صادر کنم؟',
      '/reservations',
      undefined,
      (href) => href === '/reservations',
    );
    expect(answer.sections.map(({ ref }) => ref)).toEqual([
      'travel-issuance/ticket',
    ]);
    expect(
      pilotGuideResponse(
        'سقف تخفیف شرکت برای کارشناس چقدره؟',
        '/sales',
        undefined,
        () => true,
      ).status,
    ).toBe('insufficient');
    expect(
      pilotGuideResponse('پیگیری رو از کجا ببینم؟', '', undefined, () => true)
        .status,
    ).toBe('clarify');
    expect(
      pilotGuideResponse(
        'وضعیت همین قرارداد چیه؟',
        '/sales',
        undefined,
        () => true,
      ).status,
    ).toBe('unmatched');
  });
});

describe('additional fixed pilot questions', () => {
  it.each([
    [
      'I03',
      'بلیت صادر شده ولی تحویل بسته است، چیکار کنم؟',
      '/reservations',
      'answer',
      'travel-issuance/delivery',
    ],
    [
      'I05',
      'چطور واچر صادرشده رو باطل و دوباره صادر کنم؟',
      '/reservations',
      'insufficient',
      undefined,
    ],
    [
      'C04',
      'درخواست مشتری من الان دست کیه؟',
      '/customer-affairs',
      'unmatched',
      undefined,
    ],
    [
      'C05',
      'نتیجه رضایت مشتری رو چطور بررسی کنم؟',
      '/customer-affairs',
      'answer',
      'customer-affairs/reports',
    ],
    ['C06', 'پیگیری رو از کجا ببینم؟', '', 'clarify', undefined],
  ])(
    '%s returns the expected disposition',
    (_id, question, panel, status, ref) => {
      const result = pilotGuideResponse(question, panel, undefined, () => true);
      expect(result.status).toBe(status);
      expect(result.sections[0]?.ref).toBe(ref);
    },
  );
});
