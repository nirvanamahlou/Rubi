import type { InternalLetterList, InternalLetterStatus } from '@nora/contracts';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import catalog from './correspondence-guide.generated.json';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

type Topic = (typeof catalog)[number];
type Intent =
  | { kind: 'guide'; topic: Topic; followUp: boolean }
  | { kind: 'clarify'; text: string }
  | { kind: 'read'; number: string };

export const correspondenceHref = '/correspondence';
export const internalInboxHref = '/correspondence/internal/received';
const numberPattern =
  /(?:^|\s)((?:ns|jb|gr)\/\d{4}\/\d{2}\/\d{2}\/\d{6,})(?=\s|$)/i;
const labels: Record<InternalLetterStatus, string> = {
  SENT: 'ارسال‌شده',
  APPROVED: 'تأیید',
  REJECTED: 'رد',
  NEEDS_CORRECTION: 'نیازمند اصلاح',
};

export function resolveCorrespondenceGuide(
  message: string,
  pathname: string | null,
  previous?: string,
): Intent | undefined {
  const text = normalizeQuestion(message);
  if (previous && /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text)) {
    const topic = catalog.find((entry) => entry.id === previous);
    if (topic) return { kind: 'guide', topic, followUp: true };
  }

  const onPanel =
    pathname === correspondenceHref ||
    pathname?.startsWith(correspondenceHref + '/');
  const explicit = matchesQuestion(
    text,
    /مکاتبات|نامه داخلی|نامه ورودی|نامه خروجی|کارتابل نامه/,
  );
  if (
    matchesQuestion(
      text,
      /پیام میزکار|ثبت قرارداد|ارسال قرارداد|حکم کارگزینی|درخواست مرخصی/,
    )
  )
    return;
  if (!explicit && !onPanel) return;

  const internal =
    matchesQuestion(text, /نامه داخلی|مکاتبات داخلی|دریافتی داخلی/) ||
    pathname?.startsWith('/correspondence/internal');
  const otherLetter = matchesQuestion(text, /نامه ورودی|نامه خروجی/);
  if (
    internal &&
    !otherLetter &&
    matchesQuestion(
      text,
      /وضعیت نامه|وضعیت این نامه|تایید شده|تأیید شده|دست کی|خوانده شده/,
    )
  ) {
    const number = text.match(numberPattern)?.[1];
    if (number) return { kind: 'read', number };
    return {
      kind: 'clarify',
      text: 'شمارهٔ کامل نامهٔ داخلی را از کارتابل بنویسید.',
    };
  }

  const filtered = catalog.filter((topic) => {
    if (matchesQuestion(text, /نامه ورودی/))
      return topic.id.startsWith('incoming-');
    if (matchesQuestion(text, /نامه خروجی/))
      return topic.id.startsWith('outgoing-');
    if (internal && !otherLetter) return topic.id.startsWith('internal-');
    return true;
  });
  const [first, second] = filtered
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
  if (first && first.score === second?.score) {
    return {
      kind: 'clarify',
      text:
        'منظورتان «' +
        first.topic.title +
        '» است یا «' +
        second.topic.title +
        '»؟',
    };
  }
  if (first) return { kind: 'guide', topic: first.topic, followUp: false };
  if (matchesQuestion(text, /چطور|چجور|چگونه|راهنما|کجا|چرا|چیکار/)) {
    const defaultTopic =
      matchesQuestion(text, /نامه ورودی/) ||
      pathname === '/correspondence/incoming'
        ? matchesQuestion(text, /ثبت|بارگذاری|آپلود/)
          ? 'incoming-register'
          : 'incoming-find'
        : matchesQuestion(text, /نامه خروجی/) ||
            pathname === '/correspondence/outgoing'
          ? 'outgoing-compose'
          : internal && matchesQuestion(text, /ارسال|بفرستم/)
            ? 'internal-send'
            : undefined;
    const topic = catalog.find(({ id }) => id === defaultTopic);
    if (topic) return { kind: 'guide', topic, followUp: false };
  }

  if (matchesQuestion(text, /نامه|مکاتبات/)) {
    return {
      kind: 'clarify',
      text: 'منظورتان ثبت نامهٔ ورودی، تولید نامهٔ خروجی یا ارسال و پیگیری نامهٔ داخلی است؟',
    };
  }
}

export function renderCorrespondenceGuide(topic: Topic, followUp: boolean) {
  return [
    topic.route.join(' ← '),
    ...(followUp
      ? topic.steps.slice(-1)
      : topic.steps.map((step, i) => i + 1 + '. ' + step)),
  ].join('\n\n');
}

export async function readCorrespondenceStatus(
  number: string,
  signal: AbortSignal,
) {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرویس مکاتبات در دسترس نیست.');
  const query = new URLSearchParams({
    search: number.toUpperCase(),
    page: '1',
  });
  const response = await authenticatedFetch(
    base + '/correspondence/v1/internal?' + query,
    base,
    { method: 'GET', cache: 'no-store', signal },
  );
  if (response.status === 403)
    return 'دسترسی کارتابل مکاتبات داخلی برای نشست جاری فعال نیست.';
  if (response.status === 401) return 'نشست معتبر نیست. دوباره وارد ERP شوید.';
  if (!response.ok) throw new Error('دریافت کارتابل ناموفق بود.');
  const page: InternalLetterList = await response.json();
  const matches = page.items.filter(
    (row) => normalizeQuestion(row.letter.number) === number,
  );
  if (page.total > page.items.length || matches.length > 1) {
    return 'نتیجهٔ یکتا در دامنهٔ بررسی تأیید نشد. شماره را در کارتابل دریافتی جست‌وجو کنید.';
  }
  const row = matches[0];
  if (!row)
    return 'این شماره در کارتابل دریافتی قابل مشاهدهٔ نشست پیدا نشد. برای نامه‌های ارسال‌شده، وضعیت دریافت‌کننده از این کارتابل قابل بررسی نیست.';
  return (
    'وضعیت دریافت این نشست: ' +
    labels[row.delivery.status] +
    '\n' +
    'وضعیت مشاهده: ' +
    (row.delivery.readAt ? 'خوانده‌شده' : 'خوانده‌نشده')
  );
}
