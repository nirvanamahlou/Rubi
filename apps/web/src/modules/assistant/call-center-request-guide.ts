import type { AuthenticatedActor } from '@nora/contracts';
import { resolvedCallCenterBranch } from '@/modules/call-center/branch-context';
import { CallCenterHttpError } from '@/modules/call-center/client';
import { readApi } from '@/modules/call-center/read-client';
import { requestLabels } from '@/modules/call-center/workflow';
import { workflowApi } from '@/modules/call-center/workflow-client';
import { normalizeQuestion } from './question-text';

export const callCenterQueueHref =
  '/customer-affairs/call-center#cc-follow-up-queue';
const unavailable = 'در صف مجاز کال‌سنتر درخواستی با این مشخصات پیدا نشد.';
const ambiguous =
  'عنوان درخواست داخل «» یا شناسهٔ دقیق را بفرستید، یا مورد را در صف کال‌سنتر باز کنید.';
const uuid = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const requestIdPattern = new RegExp(
  `(?:^|[^a-z0-9-])(${uuid})(?=$|[^a-z0-9-])`,
  'i',
);
const procedural = /چطور|چگونه|چجور|نحوه|راهنما|مراحل|چرا/;

export function callCenterIntent(message: string, onPanel: boolean) {
  const text = normalizeQuestion(message);
  if (
    procedural.test(text) ||
    /مرخصی|مأموریت|ماموریت|مساعده|میز ?کار/.test(text)
  )
    return;
  if (!onPanel && !/کال سنتر|صف رسیدگی/.test(text)) return;
  if (
    /درخواست|پیگیری|صف رسیدگی/.test(text) &&
    /دست (?:کی|چه کس)|کجاست|وضعیت|مسئول|ت[اأ]یید شد|رد شد|به کجا رسید|بررسی شد/.test(
      text,
    )
  )
    return 'request';
  if (!/چند|تعداد/.test(text) || !/تماس/.test(text)) return;
  // Filtered and person-specific metrics cannot be inferred from the cards.
  if (
    /داشتم|خودم|تماس هام|تماس های من|ورودی|خروجی|بی پاسخ|پاسخ داده|کارشناس|ماه|دیروز|دیشب/.test(
      text,
    )
  )
    return 'report';
  if (/بدون نتیجه|نتیجه ثبت نشده/.test(text)) return 'withoutOutcome';
  if (/تماس مجدد|از دست رفته|ازدست رفته/.test(text)) return 'needsFollowUp';
  if (/امروز/.test(text)) return 'today';
  if (/هفته/.test(text)) return 'week';
  return 'report';
}

async function allowedBranch(actor: AuthenticatedActor, signal: AbortSignal) {
  const bootstrap = actor.branchIds[0];
  if (
    !bootstrap ||
    !actor.permissions.includes('customer_affairs.call_center.read')
  )
    return;
  const branches = await readApi.branches(bootstrap, signal);
  signal.throwIfAborted();
  return resolvedCallCenterBranch(actor.branchIds, branches);
}

function summarize(
  row: { status: string; ownerName: string | null },
  pending?: boolean,
  source = 'صف کارهای من',
) {
  return [
    `وضعیت ثبت‌شده ${requestLabels[row.status] ?? 'تعیین نشده'}`,
    `کارشناس مسئول ${row.ownerName || 'تعیین نشده'}`,
    ...(pending ? ['پیگیری در انتظار بررسی مدیر ایجادکننده است.'] : []),
    `منبع: خوانش جاری ${source} کال‌سنتر`,
  ].join('\n');
}

export async function readCallCenterRequestStatus(
  message: string,
  actor: AuthenticatedActor,
  signal: AbortSignal,
) {
  const branch = await allowedBranch(actor, signal);
  if (!branch)
    return 'شعبه یا مجوز لازم برای خواندن صف کال‌سنتر در دسترس نیست.';
  const exactId = message.match(requestIdPattern)?.[1]?.toLowerCase();
  const title = message.match(/[«"]([^»"\r\n]{2,120})[»"]/)?.[1];
  const view = exactId || title ? 'ALL' : 'MINE';
  const first = await workflowApi.queue(branch, view, 1, signal);
  signal.throwIfAborted();
  if (!first.meta.total) return unavailable;
  if (!exactId && !title) {
    const only = first.data[0];
    return first.meta.total === 1 && first.data.length === 1 && only
      ? summarize(only, only.pendingReview)
      : ambiguous;
  }

  const rows = new Map(first.data.map((row) => [row.id, row]));
  for (let page = 2; page <= 3 && rows.size < first.meta.total; page++) {
    if (exactId && rows.has(exactId)) break;
    const next = await workflowApi.queue(branch, view, page, signal);
    signal.throwIfAborted();
    if (next.meta.total !== first.meta.total) return ambiguous;
    if (!next.data.length) break;
    for (const row of next.data) rows.set(row.id, row);
  }
  const matches = [...rows.values()].filter((row) =>
    exactId
      ? row.id === exactId
      : normalizeQuestion(row.title) === normalizeQuestion(title!),
  );
  if (matches.length > 1 || (!exactId && rows.size !== first.meta.total))
    return ambiguous;
  const row = matches[0];
  if (!row) return rows.size === first.meta.total ? unavailable : ambiguous;
  if (
    !actor.branchIds.includes(row.branchId) ||
    !new RegExp(`^${uuid}$`, 'i').test(row.contactId) ||
    !new RegExp(`^${uuid}$`, 'i').test(row.id)
  )
    return unavailable;
  try {
    const detail = await workflowApi.list(
      row.branchId,
      row.contactId,
      signal,
      1,
      1,
      row.id,
    );
    signal.throwIfAborted();
    const item = detail.data.find((request) => request.id === row.id);
    return item
      ? summarize(item, item.review?.pending, 'جزئیات درخواست')
      : unavailable;
  } catch (error) {
    if (
      error instanceof CallCenterHttpError &&
      [403, 404].includes(error.status)
    )
      return unavailable;
    throw error;
  }
}

const metricLabels = {
  today: 'تماس‌های امروز',
  week: 'تماس‌های این هفته',
  withoutOutcome: 'تماس‌های بدون نتیجه',
  needsFollowUp: 'تماس‌های ازدست‌رفتهٔ نیازمند تماس مجدد',
};
export async function readCallCenterMetric(
  metric: keyof typeof metricLabels,
  actor: AuthenticatedActor,
  signal: AbortSignal,
) {
  const branch = await allowedBranch(actor, signal);
  if (!branch)
    return 'شعبه یا مجوز لازم برای خواندن کارت‌های کال‌سنتر در دسترس نیست.';
  const { data, meta } = await readApi.kpis(branch, signal);
  signal.throwIfAborted();
  if (meta.branchId !== branch)
    return 'اطلاعات کارت با شعبهٔ جاری مطابقت ندارد.';
  const time = new Date(meta.asOf).toLocaleString('fa-IR', {
    timeZone: 'Asia/Tehran',
  });
  return `${metricLabels[metric]} در محدودهٔ مجاز کارت ${data[metric].toLocaleString('fa-IR')}\nآخرین خوانش ${time} به وقت تهران`;
}
