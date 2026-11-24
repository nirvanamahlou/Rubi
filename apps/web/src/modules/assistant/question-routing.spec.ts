import { describe, expect, it } from 'vitest';
import { routeAssistantQuestion, type AnswerContext } from './question-routing';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';
import { resolveContractGuide } from './contract-guides';
import { resolveWorkbenchGuide } from './workbench-guides';

const data: AnswerContext = {
  kind: 'data',
  domain: 'sales',
  question: 'تعداد قراردادهای فعال را بگو',
  resultIds: ['synthetic-result'],
};
const guide: AnswerContext = {
  kind: 'guide',
  domain: 'sales',
  question: 'چجور قرارداد بزنم؟',
  topicId: 'create',
};

describe('shared intent arbitration before every guide', () => {
  it.each([
    ['داداش چی بلدی؟', 'capabilities', undefined],
    ['سند های مالی برای قرار داد صادر شده؟', 'clarify', undefined],
    ['رویه ی کار بین واحد فروش', 'guide', undefined],
    [
      'رویه ی کار بین واحد فروش و رزرواسیون رو به من بگو و بکش',
      'guide',
      'travel-document-workflow',
    ],
    ['روند قرارداد زدن در واحد فروش چطور هست؟', 'guide', 'create'],
    ['چجوری گزارش فروش بگیریم', 'sales-report-guide', undefined],
    [
      'فرض کنیم اصل چک هنوز به شرکت نرسیده، اما مالی اجازه صدور زودهنگام بلیط و واچر را داده است. آیا همین مجوز باید باعث شود مشتری هم بتواند بلیط و واچر را در سایت مشاهده و دانلود کند؟',
      'guide',
      'travel-document-workflow',
    ],
  ])(
    'checks approved ERP sources before handling %s',
    (message, kind, guideTopicId) => {
      const decision = routeAssistantQuestion(message);
      expect(decision.kind).toBe(kind);
      expect(decision.guideTopicId).toBe(guideTopicId);
    },
  );
  it('clarifies competing workflow domains and lets an explicit form problem override a data follow-up', () => {
    expect(
      routeAssistantQuestion('قرارداد و مرخصی را چطور ثبت کنم؟', data, true)
        .kind,
    ).toBe('clarify');
    const result = routeAssistantQuestion(
      'چرا پروازم تو فهرست نیست؟',
      data,
      true,
    );
    expect(result.kind).toBe('guide');
    expect(resolveContractGuide(result.guideQuestion!, true)?.topicId).toBe(
      'flight',
    );
  });
  it('applies lexical boundaries to evidence keywords as well as guide aliases', () => {
    expect(routeAssistantQuestion('نامنبع', undefined, true).kind).toBe(
      'guide',
    );
    expect(routeAssistantQuestion('منبعش؟', data, true).kind).toBe('follow-up');
  });
  it('preserves explicit date ranges and hyphenated identifiers for existing native readers', () => {
    expect(normalizeQuestion('قرارداد AB-12 از ۲۰۲۶/۱۱/۰۱ تا ۲۰۲۶-۱۱-۰۳')).toBe(
      'قرارداد ab-12 از 2026/11/01 تا 2026-11-03',
    );
  });
  it('keeps conceptual definitions out of SQL even when they contain status or amount words', () => {
    expect(
      routeAssistantQuestion('وضعیت تسویه قرارداد یعنی چی؟', data, true).kind,
    ).toBe('guide');
    expect(
      routeAssistantQuestion(
        'تفاوت پیش‌نویس و ثبت نهایی قرارداد چیه؟',
        data,
        true,
      ).kind,
    ).toBe('guide');
  });
  it('recognizes explicit editing and source-field instructions instead of treating field names as evidence requests', () => {
    expect(
      routeAssistantQuestion('میخوام اطلاعات قرارداد رو تغییر بدم', data, true)
        .kind,
    ).toBe('guide');
    expect(
      routeAssistantQuestion('از کجا منبع آشنایی را انتخاب کنم؟', data, true)
        .kind,
    ).toBe('guide');
  });
  it.each([
    'از کجا آوردی؟',
    'از كجا آوردي؟',
    'چرا؟',
    'فرقش چیه؟',
    'از کجا میاری؟',
    'این عدد ۳۴ قرارداد فعال را از کجا میاری؟',
    'این عدد 34 قرارداد فعال ار کجا میاری؟',
    'من ۳۲ قرارداد فعال می‌بینم ولی تو ۳۴ میگی، چرا فرق داره؟',
    'تو پنل ۳۲ قرارداد میبینم ولی وقتی پرسیدم تعداد قراردادها رو بگو گفتی ۵۲ تا قرارداد، چرا ۵۲ بجای ۳۲؟',
  ])(
    'sends evidence follow-up to fresh data, never a procedural fallback: %s',
    (message) => {
      const result = routeAssistantQuestion(message, data, true);
      expect(['data', 'follow-up']).toContain(result.kind);
      expect(result.dataMessage).toContain(message);
      expect(result.dataMessage).toContain(data.question);
    },
  );
  it.each(['از کجا آوردی؟', 'چرا؟', 'فرقش چیه؟'])(
    'clarifies a missing referent: %s',
    (message) => {
      expect(routeAssistantQuestion(message).kind).toBe('clarify');
    },
  );
  it.each([
    'از کجا رسید بارگذاری کنم؟',
    'رسید پرداخت را چطور ثبت کنم؟',
    'رسیدها را از کجا بارگذاری کنم؟',
    'از کجا رسیدهای پرداخت رو آپلود کنم؟',
  ])('retains real receipt instructions: %s', (message) => {
    const result = routeAssistantQuestion(message, data, true);
    expect(result.kind).toBe('guide');
    expect(
      resolveContractGuide(result.guideQuestion ?? message, true)?.topicId,
    ).toBe('receipt');
  });
  it('does not match a payment receipt inside another Persian word', () => {
    expect(matchesQuestion(normalizeQuestion('پرسیدم'), /رسید/)).toBe(false);
    expect(matchesQuestion(normalizeQuestion('رسیدگی'), /رسید/)).toBe(false);
    expect(matchesQuestion(normalizeQuestion('رسیدهایشان'), /رسید/)).toBe(true);
    expect(
      containsQuestionPhrase(normalizeQuestion('همیادداشت'), 'یادداشت'),
    ).toBe(false);
    expect(
      resolveContractGuide('ازش پرسیدم چجور قرارداد بزنم؟', true)?.topicId,
    ).toBe('create');
  });
  it('does not route personal Workbench facts to the Sales data reader', () => {
    expect(
      routeAssistantQuestion('مبلغ حقوق من از کجا آمده؟', data, true),
    ).toMatchObject({ kind: 'guide', domain: 'workbench' });
  });
  it.each([
    'این مبلغ از کجا آمده و از کجا اصلاحش کنم؟',
    'مبنای این مبلغ چیست و چطور اصلاحش کنم؟',
  ])(
    'reads data before offering grounded correction instructions: %s',
    (message) => {
      const result = routeAssistantQuestion(message, data, true);
      expect(result.kind).toBe('data-with-guide');
      expect(result.dataMessage).toContain(data.question);
      expect(resolveContractGuide(result.guideQuestion!, true)?.topicId).toBe(
        'correction',
      );
    },
  );
  it('follows a guide without switching to SQL, and honors an explicit Workbench topic change', () => {
    const next = routeAssistantQuestion('بعدش چی؟', guide);
    expect(next.kind).toBe('guide');
    expect(
      resolveContractGuide(next.guideQuestion!, false, guide.topicId),
    ).toBeTruthy();
    const leave = routeAssistantQuestion(
      'چطور مرخصی ساعتی ثبت کنم؟',
      data,
      true,
    );
    expect(leave).toMatchObject({ kind: 'guide', domain: 'workbench' });
    expect(resolveWorkbenchGuide('چطور مرخصی ساعتی ثبت کنم؟')?.topic?.id).toBe(
      'leave-hourly',
    );
  });
  it('keeps data intent after navigation but allows a new contract guide', () => {
    expect(routeAssistantQuestion('از کجا آوردی؟', data, false).kind).toBe(
      'follow-up',
    );
    expect(routeAssistantQuestion('چجور قرارداد بزنم؟', data, false).kind).toBe(
      'guide',
    );
  });
  it('bounds follow-up text without promoting stored result IDs to evidence', () => {
    const result = routeAssistantQuestion('این عدد را از کجا آوردی؟', {
      ...data,
      question: 'a'.repeat(4000),
    });
    expect(result.dataMessage.length).toBeLessThanOrEqual(4000);
    expect(result.dataMessage).not.toContain('synthetic-result');
    expect(result.dataMessage).toContain('شواهد تازه');
  });
});
it.each([
  'پرفروش ترین هتل هارا که باهاشون قرارداد بستیمو بده',
  'هتل هایی که بیشترین قرارداد را دارندو بده',
])('routes informal hotel rankings from Workbench to Sales: %s', (message) => {
  expect(routeAssistantQuestion(message)).toEqual({
    kind: 'data',
    domain: 'sales',
    dataMessage: message,
  });
});
