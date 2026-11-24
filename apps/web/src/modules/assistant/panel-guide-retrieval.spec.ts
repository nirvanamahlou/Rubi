import { describe, expect, it } from 'vitest';
import { retrievePanelGuidance } from './panel-guide-retrieval';

describe('procedural guide retrieval', () => {
  it.each([
    ['صدور بليت چطور انجام می‌شود؟', 'travel-issuance#ticket'],
    ['نحوه ثبت درخواست امور مشتریان', 'customer-affairs#requests'],
    ['ازکجا خروجی پک بگیرم؟', 'package-generator#review'],
    ['چجور ثبت هزینه تنخواه انجام بدم', 'petty-cash#expense'],
    ['نحوه ثبت نامه وارده', 'correspondence#incoming'],
  ])('retrieves grounded guides for %s', (question, section) => {
    const [answer] = retrievePanelGuidance(question, null, () => true);
    expect(answer?.guideHref).toBe('/assistant-guides/' + section);
  });

  it('only includes related guidance when its destination is allowed', () => {
    const question = 'نحوه صدور واچر هتل';
    const allowed = retrievePanelGuidance(
      question,
      '/reservations',
      (href) => href === '/reservations',
    );
    expect(allowed.map(({ id }) => id)).toEqual(['voucher']);
    expect(
      retrievePanelGuidance(question, '/reservations', () => true).map(
        ({ id }) => id,
      ),
    ).toEqual(['voucher', 'delivery']);
  });

  it('leaves record questions and ambiguous procedures to existing routing', () => {
    for (const question of [
      'وضعیت قرارداد ۱۲۳۴۵ را از کجا ببینم؟',
      'مراحل نامه وارده و نامه صادره',
      'موجودی تنخواه چقدر است؟',
    ])
      expect(retrievePanelGuidance(question, null, () => true)).toEqual([]);
  });
});
