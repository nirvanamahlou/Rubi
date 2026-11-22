import guideCatalogue from './document-guide.generated.json';
import { documentsApi, DocumentsApiError } from '../documents/api/client';
import { containsQuestionPhrase, normalizeQuestion } from './question-text';

const root = '/documents';
const guides = guideCatalogue;

export const documentGuideTopics = guides;
const generic =
  'موردی با این مشخصات در اسناد قابل مشاهده پیدا نشد. کد آرشیو، شعبه یا فهرست اسناد را بررسی کنید.';
const protectedDocument = (item: {
  confidentiality: string;
  requiresConfidentialAccessCode?: boolean;
}) =>
  ['CONFIDENTIAL', 'RESTRICTED'].includes(item.confidentiality) ||
  item.requiresConfidentialAccessCode;
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function resolveDocumentQuestion(
  message: string,
  onPanel: boolean,
  previous?: string,
  selected?: string | null,
) {
  const question = normalizeQuestion(message);
  const code = question.match(
    /(?:^|\s)(doc-[a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/i,
  )?.[1];
  const link = message.match(
    /(?:https:\/\/[^/\s]+)?\/documents\?[^\s<>]+/,
  )?.[0];
  let id: string | null = null;
  const origin = globalThis.location?.origin ?? 'https://avinaofficial.ir';
  if (link) {
    const url = URL.parse(link, origin);
    if (url?.origin === origin && url.pathname === root)
      id = url.searchParams.get('document');
  }
  const panelTopic = /اسناد و فایل|پنل اسناد|آرشیو اسناد|کد آرشیو/.test(
    question,
  );
  const documentContext = /سند|مدرک/.test(question);
  const procedural = /چطور|چجور|چگونه|کجا|نحوه|راهنما|نمیشه|نمی شه/.test(
    question,
  );
  const status = /وضعیت|منقضی|ناقص|نسخه|مالک|دست کیه|اسکن|بایگانی/.test(
    question,
  );
  const title = message
    .match(/(?:سند|مدرک)\s*[«"]([^«»"\r\n]{2,120})[»"]/)?.[1]
    ?.trim();
  if (
    code ||
    (id && uuid.test(id)) ||
    ((onPanel || documentContext) && status && !procedural)
  ) {
    const target = id ?? (onPanel ? selected : null);
    if (code || title || (target && uuid.test(target)))
      return {
        kind: 'record' as const,
        code,
        title,
        id: target && uuid.test(target) ? target : undefined,
      };
    if (documentContext || (onPanel && /وضعیت|دست کیه/.test(question)))
      return {
        kind: 'clarify' as const,
        text: 'برای بررسی سند، کد آرشیو، لینک داخلی یا عنوان سند را داخل «» بنویسید.',
      };
  }
  const matched = guides
    .flatMap((topic) =>
      [topic.title, ...topic.aliases]
        .filter((alias) => containsQuestionPhrase(question, alias))
        .filter(
          (alias) =>
            onPanel ||
            panelTopic ||
            documentContext ||
            normalizeQuestion(alias) === question,
        )
        .map((alias) => ({ topic, score: normalizeQuestion(alias).length })),
    )
    .sort((a, b) => b.score - a.score)[0]?.topic;
  const upload =
    (onPanel || panelTopic) &&
    /بارگذاری|آپلود/.test(question) &&
    /فایل|سند|مدرک/.test(question) &&
    (!matched || matched === guides[0])
      ? guides.find((item) => item.title === 'بارگذاری فایل')
      : undefined;
  const continuation = /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(
    question,
  );
  const topic =
    (continuation && guides.find((item) => item.title === previous)) ||
    upload ||
    matched ||
    ((onPanel || panelTopic) && /راهنما|این صفحه|اینجا/.test(question)
      ? guides[0]
      : undefined);
  if (topic) return { kind: 'guide' as const, topic, continuation };
  if (onPanel && documentContext && (procedural || status))
    return {
      kind: 'clarify' as const,
      text: 'نام بخش یا اقدام را بگویید؛ برای نمونه بارگذاری، پیش‌نمایش، نسخهٔ جدید، اشتراک یا بازیابی.',
    };
  if (!onPanel && procedural && /فایل من|فایلم/.test(question))
    return {
      kind: 'clarify' as const,
      text: 'منظورتان فایل در «اسناد و فایل‌ها»، «میزکار من» یا پیوست مکاتبه است؟',
    };
}

export function renderDocumentGuide(
  topic: (typeof guides)[number],
  continuation: boolean,
) {
  return [
    ['اسناد و گزارش‌ها', 'اسناد و فایل‌ها', topic.parent, topic.title]
      .filter(Boolean)
      .join(' ← '),
    ...(continuation
      ? [topic.steps.at(-1)]
      : topic.steps.map((step, i) => `${i + 1}. ${step}`)),
    topic.trouble,
  ].join('\n');
}

const scanLabels = {
  PENDING_SCAN: 'در انتظار اسکن',
  CLEAN: 'پاک',
  INFECTED: 'آلوده',
  SCAN_FAILED: 'اسکن ناموفق',
  QUARANTINED: 'قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار سرویس اسکن',
};
const archiveLabels = {
  ACTIVE: 'فعال',
  ARCHIVED: 'آرشیوشده',
  DELETED: 'حذف‌شده',
};

export async function readDocumentGuide(
  intent: Extract<
    ReturnType<typeof resolveDocumentQuestion>,
    { kind: 'record' }
  >,
  api: Pick<typeof documentsApi, 'list' | 'detail'> = documentsApi,
  now = Date.now(),
) {
  const key = intent.code ?? intent.title;
  const lookup = key
    ? await api.list({ search: key, isIncomingLetter: false, pageSize: 10 })
    : undefined;
  const matches = lookup?.data.filter(
    (item) =>
      !protectedDocument(item) &&
      (intent.code
        ? item.archiveCode.toLowerCase() === intent.code
        : normalizeQuestion(item.title).includes(normalizeQuestion(key!))),
  );
  if (
    !intent.code &&
    lookup &&
    (lookup.meta.totalPages > 1 || (matches?.length ?? 0) > 1)
  )
    return {
      text: 'برای تعیین سند دقیق، کد آرشیو یا لینک داخلی آن را از فهرست اسناد بفرستید.',
      href: root,
    };
  const id = key ? matches?.[0]?.id : intent.id;
  if (!id) return { text: generic, href: root };
  const result = await api.detail(id).catch((error: unknown) => {
    if (error instanceof DocumentsApiError && [403, 404].includes(error.status))
      return undefined;
    throw error;
  });
  if (!result) return { text: generic, href: root };
  const { data } = result;
  if (
    protectedDocument(data) ||
    data.isIncomingLetter ||
    data.archiveStatus === 'DELETED'
  )
    return { text: generic, href: root };
  const expiry = data.validUntil ? Date.parse(data.validUntil) : NaN;
  const validity = Number.isFinite(expiry)
    ? `${new Date(expiry).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })} (${expiry < now ? 'منقضی' : 'معتبر'})`
    : 'تاریخ ثبت نشده';
  return {
    text: [
      `کد آرشیو ${data.archiveCode}`,
      `وضعیت سند ${archiveLabels[data.archiveStatus]} · ${data.isIncomplete ? 'ناقص' : 'کامل'}`,
      `نسخهٔ جاری ${data.currentVersion.versionNumber} · اسکن ${scanLabels[data.currentVersion.scanStatus]}`,
      `اعتبار ${validity}`,
      `مالک ثبت‌شده ${data.owner.displayName}`,
    ].join('\n'),
    href: `${root}?document=${encodeURIComponent(data.id)}`,
  };
}
