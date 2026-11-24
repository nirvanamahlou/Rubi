import { catalogueQuestions } from '../../../tests/fixtures/catalogue-questions';
import { describe, expect, it } from 'vitest';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import { routeAssistantQuestion } from './question-routing';
import {
  catalogueLookupMode,
  findCatalogueTopics,
  workflowDestination,
} from './catalogue-search';

const open = () => true;

describe('catalogue discovery', () => {
  for (const [domain, catalogue] of Object.entries(assistantGuideCatalogues)) {
    it(
      'locates every documented title in ' + domain + ' from outside its panel',
      () => {
        for (const topic of catalogue.topics) {
          for (const question of [
            catalogue.title + '، ' + topic.title,
            'توی ' +
              catalogue.title.replace(/^راهنمای /, '') +
              ' ' +
              topic.title +
              ' رو کجا ببینم؟',
          ]) {
            expect(
              findCatalogueTopics(question, '/unrelated', open).map(
                (t) => t.guideHref,
              ),
              question,
            ).toContain(topic.guideHref);
          }
        }
      },
    );
  }
  it.each(catalogueQuestions)('resolves %s', (q, ref) => {
    expect(
      findCatalogueTopics(q, '/unrelated', open).map((t) => t.guideHref),
    ).toEqual(['/assistant-guides/' + ref]);
  });

  it.each([
    'چرا این عدد با پنل فرق داره؟',
    'پرسیدم این عدد رو از کجا آوردی؟',
    'وضعیت قرارداد ۱۲۳۴۵ را از کجا بیارم؟',
    'این مبلغ از کجا آمده و از کجا اصلاحش کنم؟',
    'چرا همین کمپین منتشر نشده؟',
  ])(
    'keeps real records and source follow-ups out of the catalogue fast path: %s',
    (q) => {
      expect(catalogueLookupMode(q, routeAssistantQuestion(q))).toBeUndefined();
    },
  );

  it('checks both endpoints and distinguishes prerequisites from next steps', () => {
    const from = '/assistant-guides/reservations#hotel-rates';
    expect(workflowDestination('قبلش چی لازمه؟', from, open)?.id).toBe(
      'hotels',
    );
    expect(workflowDestination('بعدش چی؟', from, open)?.id).toBe(
      'hotel-purchase-start',
    );
    for (const denied of [from, '/assistant-guides/master-data#hotels']) {
      expect(
        workflowDestination('قبلش چی؟', from, (s) => s.guideHref !== denied),
      ).toBeNull();
    }
    expect(
      workflowDestination('این هتل چقدر فروش داشت؟', from, open),
    ).toBeUndefined();
    expect(
      findCatalogueTopics('ساخت کمپین', '/marketing', () => false),
    ).toEqual([]);
  });
});
