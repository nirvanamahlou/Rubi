import { describe, expect, it } from 'vitest';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import { findCatalogueTopics, workflowDestination } from './catalogue-search';

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
  it.each([
    ['ساخت کمپین رو از کجا شروع کنم؟', 'marketing#campaign'],
    ['از کجا برای همکارم کاربر جدید بسازم؟', 'system-management#accounts'],
    ['چطوری مدارک پرسنلی رو پیدا کنم؟', 'human-resources#employees'],
    ['ترکیب هتل پکیج رو کجا اصلاح می‌کنن؟', 'package-management#compose'],
    ['چطور فرودگاه پکیج شناور رو عوض کنم؟', 'floating-packages#flights'],
    ['چجوری یه بلیت جدید معرفی کنم؟', 'flight-capacity#create'],
    [
      'می‌خوام ثبت بسته نرخ رو دستی انجام بدم',
      'hotel-purchase-rates#hotel-purchase-manual',
    ],
    ['پذیرش قرارداد رو از کجای رزرواسیون شروع کنم؟', 'reservations#handoff'],
    ['یه واچر هتل لازمه، چطور صادرش کنم؟', 'travel-issuance#voucher'],
    ['تو امور مشتریان ارجاع به فروش رو کجا بزنم؟', 'customer-affairs#handoffs'],
    ['خروجی پک رو از کجا تحویل بگیرم؟', 'package-generator#review'],
    ['نامه صادره رو چجوری بفرستم؟', 'correspondence#outgoing'],
    ['تو تنخواه درخواست خرید جدید رو کجا بزنم؟', 'petty-cash#request'],
    [
      'ثبت و اصلاح هویت رو تو مشتریان سازمانی چطور انجام بدم؟',
      'b2b#registration',
    ],
    ['تعریف تور جدید رو کجا شروع کنم؟', 'tour#create'],
    [
      'توی قیمت‌گذاری پرواز فهرست و فیلترهای قیمت کجاست؟',
      'flight-pricing#filters',
    ],
    ['مبنای تاریخ توی گزارش رزرواسیون چیه؟', 'reservation-report#dates'],
    ['وضعیت مجوز رو از کجای تحویل مدارک نگاه کنم؟', 'finance-delivery#status'],
    ['نرخ ارز رو تو اطلاعات پایه کجا ببینم؟', 'master-data#exchange-rates'],
    ['پیگیری مالی خرید رو از کجا شروع کنم؟', 'purchase#finance'],
    ['تو اسناد و مدیریت فایل برم کجا که همه اسناد رو ببینم؟', 'documents#all'],
    ['درخواست بدم از کجای میزکار من؟', 'workbench#request-create'],
    [
      'توی کال‌سنتر تعداد تماس هفته رو از کجا می‌شمرن؟',
      'call-center#call-center-period',
    ],
    ['فهرست و جست‌وجو برای مشتریان حقیقی کجاست؟', 'b2c#list'],
    ['پیداکردن قرارداد و استفاده از فهرست از کجا شروع میشه؟', 'sales#list'],
  ])('resolves %s', (q, ref) => {
    expect(
      findCatalogueTopics(q, '/unrelated', open).map((t) => t.guideHref),
    ).toEqual(['/assistant-guides/' + ref]);
  });

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
