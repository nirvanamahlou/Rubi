import { catalogueQuestions } from '../../../tests/fixtures/catalogue-questions';
import { describe, expect, it } from 'vitest';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import { canOpenAssistantGuide } from './guide-access';
import { pilotGuideResponse } from './guide-pilot';
import { routeAssistantQuestion } from './question-routing';
import {
  catalogueLookupMode,
  findCatalogueTopics,
  resolveDocumentedWorkflow,
  retrieveDocumentSections,
  workflowDestination,
} from './catalogue-search';

const open = () => true;

describe('cross-panel workflow arbitration', () => {
  it.each([
    ['پی دی اف قرارداد رو چجوری بگیرم؟', ['output']],
    ['اکسل کارکنان رو از کجا بگیرم؟', ['employees']],
    ['شرکت فعال رو چطور تغییر بدم؟', ['company-scope']],
    ['درخاست داخلی ویزا رو کجا ثپت کنم؟', ['request-create', 'request-status']],
    ['در گزارش رزرو تاریخ صدور رو کجا بزنم؟', ['dates']],
    ['کد پیگیری HR-123 الان کجاست؟', []],
    ['از کجا قرارداد فروش جدید ثبت کنم و به رزرواسیون بفرستم؟', ['create']],
    [
      'چطور قراردادهای معطل ارسال به رزرواسیون را پیدا کنم؟',
      ['list', 'reservation'],
    ],
    ['در کارتابل مالی دریافت مشتری را از کجا ثبت کنم؟', ['customer-receipt']],
    [
      'پرداخت مشتری را از کجا ثبت کنم و تطبیق دریافت را کجا ببینم؟',
      ['customer-receipt'],
    ],
    [
      'برای صدور یا لغو مجوز تحویل مدارک چه تأییدهایی لازم است؟',
      ['issue', 'receipt', 'settlement', 'revoke'],
    ],
    ['مجوز تحویل مدارک با استثنای مدیر چطور صادر می‌شود؟', ['exception']],
    [
      'در رزرواسیون چطور بلیت صادرشده را پیدا کنم و استردادش را پیگیری کنم؟',
      ['flight', 'cancellation'],
    ],
    [
      'در گزارش رزرواسیون چگونه خدمات مسترد یا ابطال‌شده را پیدا کنم؟',
      ['dates', 'filters', 'allocation-and-status'],
    ],
    ['مانیفست پرواز را از کجا بگیرم؟', ['manifest']],
    ['منظورم MANIFEST است.', ['manifest']],
    [
      'گردش تأیید درخواست مرخصی از مدیر واحد تا منابع انسانی چطور است؟',
      ['leave-approval', 'requests'],
    ],
    ['گزارش تردد و کارکرد را چطور بگیرم؟', ['time', 'reports']],
    [
      'چطور مدرک جدید بارگذاری کنم و آرشیو آن را پیدا کنم؟',
      ['upload', 'archive'],
    ],
    [
      'فروش امروز را با دیروز مقایسه کن، فقط تعداد قراردادها و بازه گزارش را بگو.',
      [],
    ],
    ['وضعیت مجوز تحویل مدارک قرارداد ۱۲۰۵۸۳ چیست؟', []],
    [
      'در گزارش عملکرد فروش چطور بازه و شعبه را برای مقایسه انتخاب کنم؟',
      ['branch-sales'],
    ],
    [
      'گزارش مانده مطالبات مشتریان را از کجا با فیلتر شعبه و بازه زمانی بگیرم؟',
      ['receivables'],
    ],
    [
      'در داشبورد مدیریت، گزارش مقایسه فروش و رزرواسیون شعب را از کجا ببینم؟',
      ['branch-sales', 'branch-reservations'],
    ],
    [
      'اگر بخواهم وضعیت مطالبات و تحویل مدارک را در سطح شرکت پیگیری کنم، از کدام گزارش‌ها شروع کنم؟',
      ['receivables', 'delivery'],
    ],
    [
      'برای تشکیل پرونده ویزا از کدام پنل شروع کنم و نقص مدارک را چطور پیگیری کنم؟',
      ['visa'],
    ],
    [
      'چطور بفهمم پاسخ نورا از کدام منبع داخلی ERP آمده و جزئیات شواهد آن را کجا ببینم؟',
      ['evidence'],
    ],
    [
      'اگر نورا نتوانست گزارش ERP را پیدا کند یا به آن دسترسی نداشت، برای عیب‌یابی چه چیزی را بررسی کنم؟',
      ['troubleshoot'],
    ],
  ])('resolves %s from its business action', (question, ids) => {
    expect(
      resolveDocumentedWorkflow(question).map((section) => section.id),
    ).toEqual(ids);
  });
});

describe('catalogue discovery', () => {
  it('combines documented procedures across panels without leaking restricted sections', () => {
    const q =
      'مانیفست پرواز را از کجا بگیرم؟ در اسناد چطور مدرک جدید بارگذاری کنم و آرشیو آن را پیدا کنم؟';
    expect(retrieveDocumentSections(q, '/hr', open).map((s) => s.id)).toEqual([
      'manifest',
      'upload',
      'archive',
    ]);
    expect(
      retrieveDocumentSections(q, '/hr', (s) => s.id !== 'archive'),
    ).toEqual([]);
    expect(
      retrieveDocumentSections(
        'مانیفست پرواز را از کجا بگیرم؟ فروش امروز چقدر بود؟',
        '/hr',
        open,
      ),
    ).toEqual([]);
  });
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

const voucherPermissions = [
  'ui.manual.v3',
  'ui.screen.finance.delivery',
  'ui.screen.reservations.home',
  'finance.read',
  'finance.financial_release.read',
  'reservations.read',
];
describe('settled voucher report guide', () => {
  const href = '/reservations?report=settled-vouchers';
  const question = 'راهنمای گزارش کسری واچر';
  it('opens the report guide with the same read grants as the report controller', () => {
    expect(canOpenAssistantGuide(voucherPermissions, href)).toBe(true);
    const result = pilotGuideResponse(
      question,
      '/assistant',
      undefined,
      (link, permission) =>
        canOpenAssistantGuide(voucherPermissions, link, permission),
    );
    expect(result.sections.map((section) => section.guideHref)).toEqual([
      '/assistant-guides/reservations#settled-vouchers',
    ]);
    expect(result.sections[0]?.href).toBe(href);
    expect(result.sections[0]?.steps.join(' ')).toContain('۲۵ ردیف');
  });
  it.each(voucherPermissions.slice(1))(
    'withholds the report link without %s',
    (grant) => {
      const scoped = voucherPermissions.filter((p) => p !== grant);
      for (const link of [
        href,
        '/reservations?Report=Settled-Vouchers',
        '/reservations?x=1&report=settled-vouchers#report',
      ]) {
        expect(canOpenAssistantGuide(scoped, link)).toBe(false);
      }
      expect(
        pilotGuideResponse(
          question,
          '/assistant',
          undefined,
          (link, permission) => canOpenAssistantGuide(scoped, link, permission),
        ).sections.some((section) => section.href === href),
      ).toBe(false);
    },
  );
});
