import { describe, expect, it } from 'vitest';
import { retrieveCompositeGuides } from './composite-guide';
import { routeAssistantQuestion } from './question-routing';

describe('Nora composite guide pilot', () => {
  it.each([
    [
      'مسافرهای قرارداد آژانس را وارد کردم. برای پرواز و هتل قبل از ارسال چه چیزهایی را چک کنم؟',
      ['flight', 'hotel', 'review'],
    ],
    [
      'مرخصی ساعتی چطور بگیرم و از کجا پیگیری کنم؟',
      ['leave-hourly', 'leave-approval'],
    ],
  ] as const)(
    'grounds %s in the expected sections and links',
    (question, ids) => {
      const decision = routeAssistantQuestion(question);
      expect(decision.kind).toBe('guide');
      const sections = retrieveCompositeGuides(question, decision.domain);
      expect(sections.map(({ id }) => id)).toEqual(ids);
      for (const section of sections) {
        expect(section.steps.length).toBeGreaterThan(0);
        expect(section.guideHref).toContain('#' + section.id);
        expect(section.href.startsWith('/')).toBe(true);
      }
    },
  );

  it.each(['چجوری قرارداد بزنم؟', 'مرخصی ساعتی چطور بگیرم؟'])(
    'keeps %s on direct guidance',
    (question) => {
      expect(
        retrieveCompositeGuides(
          question,
          routeAssistantQuestion(question).domain,
        ),
      ).toEqual([]);
    },
  );
});
