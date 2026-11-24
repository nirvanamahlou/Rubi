import { assistantGuideCatalogues } from './assistant-guide-registry';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

const topics = assistantGuideCatalogues['human-resources'].topics;
type Topic = (typeof topics)[number];
type Intent = { topic: Topic; followUp: boolean } | { clarification: string };

export function resolveHrGuide(
  message: string,
  pathname: string | null,
  previous?: string,
): Intent | undefined {
  const text = normalizeQuestion(message);
  if (previous && /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text)) {
    const topic = topics.find(({ id }) => id === previous);
    return topic ? { topic, followUp: true } : undefined;
  }

  const onHr = pathname === '/hr' || pathname === '/human-resources';
  const explicit = matchesQuestion(text, /منابع انسانی|کارگزینی/);
  const distinctive = matchesQuestion(
    text,
    /قرارداد کاری|فیش حقوقی|مدیر مستقیم|عودت تجهیز|دستگاه تردد|پرونده کارمند|سیاست جانشین|پیشنهاد استخدام|هزینه ماموریت|هزینه مأموریت/,
  );
  if (!onHr && !explicit && !distinctive) return;
  if (
    matchesQuestion(
      text,
      /قرارداد فروش|قرارداد مشتری|تحویل مالی|خرید بلیت|نامه داخلی/,
    ) ||
    (matchesQuestion(text, /میزکار من/) && !explicit)
  )
    return;
  const procedure = matchesQuestion(
    text,
    /چطور|چجور|چگونه|نحوه|راهنما|کجا|کجاست|چرا|چیکار|فرق|چه چیزی/,
  );
  const personal = matchesQuestion(
    text,
    /درخواست من|درخواستم|مرخصی من|ماموریت من|مأموریت من|کد پیگیری/,
  );
  if (personal && !procedure) return;
  if (
    procedure &&
    matchesQuestion(text, /ثبت مرخصی|درخواست مرخصی|ثبت درخواست مرخصی/) &&
    !matchesQuestion(text, /مرکز درخواست|کارتابل|تایید مدیر|تأیید مدیر|کارشناس/)
  )
    return;

  if (
    matchesQuestion(
      text,
      /حقوق من|حقوق این کارمند|حساب بانکی|اطلاعات پزشکی|مدرک پزشکی|مبلغ فیش/,
    )
  ) {
    return {
      clarification:
        'جزئیات محرمانه را از پرونده، فیش یا درخواست در نمای مجاز ERP بررسی کنید.',
    };
  }
  if (!procedure && matchesQuestion(text, /چقدر|چند|وضعیت|دست کی/)) {
    if (matchesQuestion(text, /این درخواست|این پرونده|مانده/)) {
      return {
        clarification:
          'برای استعلام درخواست شخصی، کد پیگیری را در میزکار من مشخص کنید. وضعیت پروندهٔ دیگر را از نمای مجاز منابع انسانی بررسی کنید.',
      };
    }
    return;
  }

  const ranked = topics
    .map((topic) => ({
      topic,
      score: Math.max(
        0,
        ...topic.aliases
          .filter((alias) => containsQuestionPhrase(text, alias))
          .map((alias) => normalizeQuestion(alias).split(' ').length),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  const [first, second] = ranked;
  if (first && first.score === second?.score) {
    return {
      clarification:
        'منظورتان «' +
        first.topic.title +
        '» است یا «' +
        second.topic.title +
        '»؟',
    };
  }
  if (first) return { topic: first.topic, followUp: false };
  if (
    explicit ||
    (onHr && matchesQuestion(text, /قرارداد|مانده|تایید|تأیید/))
  ) {
    return {
      clarification:
        'کدام بخش منابع انسانی را می‌خواهید بررسی کنید؟ نوع درخواست، قرارداد کاری، کارکرد یا حقوق را مشخص کنید.',
    };
  }
}

export function renderHrGuide(topic: Topic, followUp: boolean) {
  return [
    topic.route.join(' ← '),
    ...(followUp
      ? topic.steps.slice(-1)
      : topic.steps.map((step, index) => index + 1 + '. ' + step)),
  ].join('\n\n');
}
