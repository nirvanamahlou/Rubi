import catalog from './reservation-guide.generated.json';
import {
  hotelPurchaseGuideTopic,
  resolveHotelPurchaseGuide,
  type HotelPurchaseGuideTopic,
} from './hotel-purchase-guide';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

type Topic = (typeof catalog)[number] | HotelPurchaseGuideTopic;
type ReservationGuideIntent =
  | { topic: Topic; followUp: boolean; inspection: boolean; packId?: string }
  | { clarification: string };

const panels = new Set([
  '/reservations',
  '/reservations/operations',
  '/reservations/processing',
  '/reservations/insurance',
]);

export function resolveReservationGuide(
  message: string,
  pathname: string | null,
  previous?: string,
): ReservationGuideIntent | undefined {
  const text = normalizeQuestion(message);
  const followUp = /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text);
  if (followUp && previous) {
    const topic =
      hotelPurchaseGuideTopic(previous) ??
      catalog.find(({ id }) => id === previous);
    if (topic) return { topic, followUp, inspection: false };
  }

  const hotelPurchase = resolveHotelPurchaseGuide(text, pathname);
  if (hotelPurchase) return hotelPurchase;

  if (
    pathname === '/reservations/reports' ||
    containsQuestionPhrase(text, 'گزارش رزرواسیون') ||
    matchesQuestion(
      text,
      /میزکار|کال سنتر|اطلاعات پایه|قیمت گذاری پرواز|قرارداد جدید|ثبت قرارداد جدید|تعریف تور|پرفروش ترین/,
    )
  )
    return;

  const onPanel = pathname !== null && panels.has(pathname);
  const procedure = matchesQuestion(
    text,
    /چطور|چجور|چگونه|نحوه|راهنما|کجا|فرق|فرقی|چرا|چیکار|مراحل/,
  );
  const distinctive = matchesQuestion(
    text,
    /واچر|مانیفست|manifest|اصلاحیه فروش|خرید پرواز شناور|بیمه مستقل|بیمه مسافرتی|نرخ هتل|مجوز تحویل/,
  );
  const explicit = containsQuestionPhrase(text, 'رزرواسیون');
  if (!onPanel && !explicit && !(procedure && distinctive)) return;
  if (matchesQuestion(text, /چقدر|چند|جمع فروش|پرفروش ترین|تعداد کل/)) return;

  const inspection =
    matchesQuestion(
      text,
      /این قرارداد|این پرونده|این بلیت|این واچر|صادر شده|دست کی/,
    ) || /(?:قرارداد|بلی[تط]) (?:شماره )?\d{5,}/.test(text);
  if (!procedure && !inspection) return;
  const candidates = catalog
    .map((topic) => ({
      topic,
      score: Math.max(
        0,
        ...topic.terms
          .filter((term) => containsQuestionPhrase(text, term))
          .map((term) => normalizeQuestion(term).split(' ').length),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const [first, second] = candidates;
  if (first && first.score === second?.score) {
    return {
      clarification: `منظورتان «${first.topic.title}» است یا «${second.topic.title}»؟`,
    };
  }
  if (first) return { topic: first.topic, followUp: false, inspection };
  if (explicit || onPanel) {
    return {
      clarification:
        'در رزرواسیون درباره صف، پرواز، هتل، بیمه، مانیفست یا تحویل سؤال دارید؟',
    };
  }
}

export function renderReservationGuide(
  topic: Topic,
  followUp: boolean,
  inspection: boolean,
) {
  return [
    topic.route.join(' ← '),
    ...(inspection
      ? ['برای تأیید وضعیت این پرونده، مورد را در پنل بررسی کنید.']
      : []),
    ...(followUp
      ? topic.steps.slice(-1)
      : topic.steps.map((step, i) => `${i + 1}. ${step}`)),
  ].join('\n\n');
}
