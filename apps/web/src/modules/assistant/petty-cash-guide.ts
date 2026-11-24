import type { ProcurementListV1, ProcurementRequestV1 } from '@nora/contracts';
import {
  ProcurementApiError,
  procurementRequest,
  type Bootstrap,
} from '@/modules/procurement/api';
import { statusLabels } from '@/modules/procurement/model';
import catalog from './petty-cash.generated.json';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

type Topic = (typeof catalog)[number];
type Intent =
  | { kind: 'guide'; topic: Topic; followUp: boolean }
  | { kind: 'clarify'; text: string }
  | { kind: 'request'; code: string }
  | { kind: 'fund'; branchQuery: string };

export const pettyCashHref = '/purchases';
const uuidSource =
  '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const requestCode = new RegExp(
  '(?:^|\\s)(pr-' + uuidSource + ')(?=\\s|$)',
  'i',
);
const recordId = new RegExp('^' + uuidSource + '$', 'i');

export function resolvePettyCashGuide(
  message: string,
  pathname: string | null,
  previous?: string,
  selectedRequest?: string | null,
): Intent | undefined {
  const text = normalizeQuestion(message);
  if (previous && /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text)) {
    const topic = catalog.find(({ id }) => id === previous);
    if (topic) return { kind: 'guide', topic, followUp: true };
  }
  const onPanel = pathname === pettyCashHref;
  const explicit = matchesQuestion(text, /تنخواه/);
  const code = text.match(requestCode)?.[1];
  if (
    matchesQuestion(text, /قرارداد فروش|تحویل مالی|درخواست مرخصی|کال سنتر/) ||
    (!explicit && matchesQuestion(text, /خرید بلیت|خرید بلیط|خرید رزرواسیون/))
  )
    return;
  if (!onPanel && !explicit && !code) return;

  const procedure = matchesQuestion(
    text,
    /چطور|چجور|چگونه|نحوه|راهنما|از کجا|کجا|فرق|چیکار|چرا/,
  );
  const amount =
    matchesQuestion(text, /چقدر|چقدره|چنده|بگو|چند ریال|وضعیت/) &&
    matchesQuestion(text, /موجودی|مانده/);
  if (amount && !procedure) {
    if (!matchesQuestion(text, /شعبه/)) {
      return {
        kind: 'clarify',
        text: 'نام دقیق شعبه را برای بررسی موجودی تنخواه بنویسید.',
      };
    }
    return { kind: 'fund', branchQuery: text };
  }
  if (
    code ||
    (!procedure &&
      matchesQuestion(text, /وضعیت درخواست|در چه مرحله|دست کی|درخواست من/))
  ) {
    const exact =
      code ??
      (onPanel && selectedRequest && recordId.test(selectedRequest)
        ? selectedRequest
        : null);
    return exact
      ? { kind: 'request', code: exact }
      : {
          kind: 'clarify',
          text: 'کد کامل درخواست خرید را بنویسید یا همان پرونده را در تنخواه باز کنید.',
        };
  }

  const ranked = catalog
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
  const [first, second] = ranked;
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
  if (explicit)
    return {
      kind: 'clarify',
      text: 'راهنمای درخواست خرید، ثبت هزینه، شارژ یا خروجی تنخواه را می‌خواهید؟',
    };
}

export function renderPettyCashGuide(topic: Topic, followUp: boolean) {
  return [
    topic.route.join(' ← '),
    ...(followUp
      ? topic.steps.slice(-1)
      : topic.steps.map((step, index) => index + 1 + '. ' + step)),
  ].join('\n\n');
}

export async function readPettyCashGuide(
  intent: Extract<Intent, { kind: 'fund' | 'request' }>,
  signal: AbortSignal,
) {
  if (intent.kind === 'fund') {
    const { branches } = await procurementRequest<Pick<Bootstrap, 'branches'>>(
      '/bootstrap',
      { signal },
    );
    if (signal.aborted) return { text: '', href: pettyCashHref };
    const known = branches.filter((branch) =>
      containsQuestionPhrase(intent.branchQuery, branch.label),
    );
    if (known.length !== 1)
      return {
        text: 'نام شعبه را با عنوان دقیقِ قابل مشاهده در پنل مشخص کنید.',
        href: pettyCashHref,
      };
    const branch = known[0]!;
    const params = new URLSearchParams({ branchId: branch.id });
    const fund = await procurementRequest<{
      balance: string;
      currencyCode: string;
    } | null>('/petty-fund?' + params, { signal });
    return {
      text: fund
        ? 'موجودی تنخواه «' +
          branch.label +
          '»: ' +
          fund.balance +
          ' ' +
          fund.currencyCode
        : 'برای این شعبه حساب تنخواه تنظیم نشده است.',
      href: pettyCashHref,
    };
  }

  let request: ProcurementRequestV1 | undefined;
  if (recordId.test(intent.code)) {
    request = await procurementRequest<ProcurementRequestV1>(
      '/requests/' + encodeURIComponent(intent.code),
      { signal },
    );
  } else {
    const query = new URLSearchParams({ search: intent.code, page: '1' });
    const page = await procurementRequest<
      ProcurementListV1<ProcurementRequestV1>
    >('/requests?' + query, { signal });
    const matches = page.items.filter(
      (row) => normalizeQuestion(row.number) === intent.code,
    );
    if (page.hasMore || matches.length > 1)
      return {
        text: 'جست‌وجو نتیجهٔ یکتای قابل تأیید نداشت. پرونده را در تنخواه باز کنید و دوباره بپرسید.',
        href: pettyCashHref,
      };
    request = matches[0];
  }
  if (!request)
    return {
      text: 'درخواست در دامنهٔ قابل مشاهدهٔ این نشست پیدا نشد.',
      href: pettyCashHref,
    };
  return {
    text: request.number + ' · ' + statusLabels[request.status],
    href:
      '/purchases?section=requests&request=' + encodeURIComponent(request.id),
  };
}

export function pettyCashReadError(error: unknown) {
  if (error instanceof ProcurementApiError) {
    if (error.status === 403)
      return 'دسترسی خواندن این مورد در نشست جاری وجود ندارد.';
    if (error.status === 404)
      return 'درخواست در دامنهٔ قابل مشاهدهٔ این نشست پیدا نشد.';
    if (error.status === 401)
      return 'نشست پایان یافته است. دوباره وارد ERP شوید.';
  }
  return 'دریافت اطلاعات تنخواه ناموفق بود. وضعیت اتصال و پیام پنل را بررسی کنید.';
}
