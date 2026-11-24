import { assistantGuideCatalogues } from './assistant-guide-registry';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

const topics = assistantGuideCatalogues['system-management'].topics;
type Topic = (typeof topics)[number];

export function resolveSystemManagementGuide(
  message: string,
  pathname: string | null,
  previous?: string,
):
  | { topic: Topic; followUp: boolean; inspect: boolean }
  | { clarification: string }
  | undefined {
  const text = normalizeQuestion(message);
  if (previous && /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text)) {
    const topic = topics.find(({ id }) => id === previous);
    if (topic) return { topic, followUp: true, inspect: false };
  }

  const explicit = matchesQuestion(text, /مدیریت سیستم|مدیریت کاربران/);
  const onSystem = pathname === '/system' || pathname === '/system/users';
  const distinctive = matchesQuestion(
    text,
    /نقش ارث رسیده|پنهان سازی قرارداد|پنهان کردن قراردادها|شروع سفر قبل از|بازگردانی قرارداد|چه کسی دسترسی|تعریف کاربر جدید|تعریف نقش جدید/,
  );
  if (!explicit && !onSystem && !distinctive) return;
  if (
    !explicit &&
    matchesQuestion(
      text,
      /میزکار من|فعالیت های من|منابع انسانی|گزارش رزرواسیون|فروش این هفته|تعداد قرارداد|مبلغ فروش/,
    )
  )
    return;

  const inspect = matchesQuestion(
    text,
    /چه کسی|کی (?:دسترسی|نقش)|این (?:کاربر|قرارداد|حساب)|همین (?:کاربر|قرارداد|حساب)/,
  );
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
  if (first && first.score > (second?.score ?? 0)) {
    return { topic: first.topic, followUp: false, inspect };
  }
  if (first && second) {
    return {
      clarification:
        'منظورتان «' +
        first.topic.title +
        '» است یا «' +
        second.topic.title +
        '»؟',
    };
  }
  if ((explicit || onSystem) && inspect && matchesQuestion(text, /قرارداد/)) {
    const topic = topics.find(({ id }) => id === 'archive');
    if (topic) return { topic, followUp: false, inspect };
  }
  if (explicit) {
    return {
      clarification:
        'کدام بخش مدیریت سیستم را می‌خواهید بررسی کنید؟ مدیریت کاربران، تاریخچه یا محتوا؟',
    };
  }
}

export function renderSystemManagementGuide(
  topic: Topic,
  followUp: boolean,
  inspect: boolean,
) {
  return [
    topic.route.join(' ← '),
    ...(inspect
      ? [
          'جزئیات این مورد در چت بررسی نشده است. برای بررسی همان مورد، از نمای مجاز ERP استفاده کنید.',
        ]
      : []),
    ...(followUp
      ? topic.steps.slice(-1)
      : topic.steps.map((step, index) => index + 1 + '. ' + step)),
  ].join('\n\n');
}
