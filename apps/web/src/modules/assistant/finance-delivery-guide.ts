import {
  FinanceInboxApiError,
  financeInboxApi,
} from '@/modules/finance/api/finance-inbox-api';
import catalog from './finance-delivery-guide.json';
import { normalizeQuestion } from './question-text';

export const financeDeliveryHref = '/finance/delivery';
export const financeDeliveryCopy = catalog.copy;
type Topic = keyof typeof catalog.topics;

const basisLabels = {
  AFTER_RECEIPT: 'پس از تأیید این دریافت مشتری',
  FULL_SETTLEMENT: 'فقط پس از تسویه کامل قرارداد',
  MANAGER_EXCEPTION: 'استثنای مدیر',
  RESERVATION_PERMISSION: 'با مجوز رزرواسیون',
};
const settlementLabels = {
  UNPAID: 'تسویه‌نشده',
  PARTIALLY_SETTLED: 'بخشی تسویه شده',
  SETTLED: 'تسویه کامل',
  OVERPAID: 'بیش‌پرداخت',
};

export function resolveFinanceDeliveryQuestion(
  message: string,
  onPanel: boolean,
  previous?: Topic,
) {
  const text = normalizeQuestion(message);
  if (/^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text) && previous)
    return { kind: 'guide' as const, topic: previous, followUp: true };
  if (
    /آپلود|نسخه سند|ثبت قرارداد|ثبت خرید/.test(text) ||
    (/بارگذاری/.test(text) && !/مجوز تحویل|تحویل مدارک/.test(text))
  )
    return;
  if (!onPanel && !/تحویل مدارک|مجوز تحویل/.test(text)) return;

  const number = text.match(
    /(?:^|\s)(sc-\d{4}-[a-z\d-]{1,32}|\d{5,14})(?=\s|$)/i,
  )?.[1];
  const procedure = /چطور|چگونه|چجور|نحوه|راهنما|مراحل|چیکار/.test(text);
  if (
    onPanel &&
    !number &&
    !/مدارک|مجوز|قرارداد|تسویه|دریافت|رسید|استثنا|انقضا|راهنما|اینجا/.test(text)
  )
    return;
  if (number && !procedure) return { kind: 'record' as const, number };
  if (
    !procedure &&
    /وضعیت|مجاز|می تونم تحویل|مسدود|منقضی|مجوزش|اعتبار مجوز|این قرارداد/.test(
      text,
    ) &&
    !/تسویه|رسید|استثنا|رزرواسیون/.test(text)
  )
    return { kind: 'clarify' as const };
  const topic: Topic = /لغو مجوز|مجوز (?:را )?لغو|ابطال|هم زمان تغییر/.test(
    text,
  )
    ? 'revoke'
    : /استثنا|تاییدکننده دوم|تأییدکننده دوم|utc/.test(text)
      ? 'exception'
      : /مجوز رزرواسیون/.test(text)
        ? 'reservation'
        : /تسویه کامل|پرداخت جزئی|مانده/.test(text)
          ? 'settlement'
          : /دریافت|رسید/.test(text)
            ? 'receipt'
            : /صدور|صادر|ثبت مجوز/.test(text)
              ? 'issue'
              : /وضعیت|مجاز|مسدود/.test(text)
                ? 'status'
                : 'search';
  return { kind: 'guide' as const, topic, followUp: false };
}

export function renderFinanceDeliveryGuide(topic: Topic, followUp: boolean) {
  const [title, steps, recovery] = catalog.topics[topic];
  return [
    catalog.path,
    title,
    ...(followUp ? [recovery] : [steps, recovery]),
  ].join('\n\n');
}

export async function readFinanceDeliveryStatus(
  number: string,
  signal: AbortSignal,
  read = financeInboxApi.customerDocumentDeliveries,
  now = Date.now(),
) {
  try {
    const rows = await read(number, signal);
    signal.throwIfAborted();
    const matches = rows.filter(
      (row) => normalizeQuestion(row.contractNumber) === number,
    );
    if (matches.length !== 1)
      return rows.length ? catalog.copy.identify : catalog.copy.unavailable;
    const row = matches[0]!;
    const { approved, basis, exceptionExpiresAt } = row.delivery;
    const expired =
      approved &&
      basis === 'MANAGER_EXCEPTION' &&
      exceptionExpiresAt &&
      Date.parse(exceptionExpiresAt) <= now;
    return [
      row.contractNumber,
      `${catalog.copy.recorded}: ${approved ? catalog.copy.approved : catalog.copy.blocked}`,
      settlementLabels[row.settlementStatus],
      row.hasConfirmedPayment
        ? catalog.copy.confirmed
        : catalog.copy.unconfirmed,
      ...(basis ? [`${catalog.copy.basis}: ${basisLabels[basis]}`] : []),
      ...(exceptionExpiresAt
        ? [`${catalog.copy.expiry}: ${exceptionExpiresAt}`]
        : []),
      ...(expired ? [catalog.copy.expired] : []),
    ].join('\n');
  } catch (error) {
    signal.throwIfAborted();
    if (
      error instanceof FinanceInboxApiError &&
      [403, 404].includes(error.status)
    )
      return catalog.copy.unavailable;
    return catalog.copy.failed;
  }
}
