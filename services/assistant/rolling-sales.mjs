import { normalizeSalesText } from './persian-sales-period.mjs';
import { ServiceError } from './errors.mjs';

const words = new Set(
  'لطفا لطفاً فروش فروشمون فروشمان چقدر چقد چقدره بوده بود هست است شده شد چنده جمع مجموع مبلغ کل تعداد و اطلاعات مشخصات جزئیات فهرست لیست شماره قرارداد قراردادها قراردادهای قراردادارو قراردادا های ها این همین اخیر گذشته دو 2 هفته هفته ی 14 چهارده روز برای در از تا الان رو را بده بگو بهم هم نشون نمایش نشان بدهید بدید میخوام ببینم'.split(
    ' ',
  ),
);

export function rollingSalesRequest(request) {
  if (request.context?.selectedContractId) return null;
  const text = normalizeSalesText(request.message)
    .replace(/(?:همین|همون|همان) (?:بازه|دوره)/gu, (phrase) =>
      request.context?.salesPeriodAsOf ? 'دو هفته اخیر' : phrase,
    )
    .replace(/[؟?،؛.!]/gu, ' ')
    .trim();
  if (
    !/(?:دو|2) هفته(?: ی)? (?:اخیر|گذشته)|(?:چهارده|14) روز (?:اخیر|گذشته)/u.test(
      text,
    ) ||
    /چطور|چگونه|چجور|راهنما|مراحل|از کجا/u.test(text)
  )
    return null;
  const contracts =
    /(?:قرارداد|قراردادا)/u.test(text) &&
    /اطلاعات|مشخصات|جزئیات|فهرست|لیست|شماره|قراردادارو/u.test(text);
  if (!/فروش/u.test(text) && !contracts) return null;
  if (text.split(/\s+/u).some((word) => !words.has(word)))
    return { unsupported: true };
  return { contracts };
}

const statusNames = {
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال‌شده به رزرواسیون',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل‌شده',
};
const dateFormat = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const digits = (value) =>
  String(value).replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]);
const money = ({ amount, currencyCode }) => {
  const [whole, fraction] = amount.split('.');
  return (
    digits(
      whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') +
        (fraction ? '.' + fraction : ''),
    ) +
    ' ' +
    currencyCode
  );
};
const utc = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
const currencies = (values) =>
  Array.isArray(values) &&
  values.length <= 100 &&
  values.every(
    (x) =>
      x &&
      /^[A-Z]{3}$/.test(x.currencyCode) &&
      typeof x.amount === 'string' &&
      /^-?\d{1,30}(?:\.\d{1,12})?$/.test(x.amount),
  ) &&
  new Set(values.map((v) => v.currencyCode)).size === values.length;
const clean = (text) => text.replace(/[\r\n|<>[\]{}]/g, ' ').slice(0, 120);

export function renderRollingSales(result, needs, requestId) {
  if (
    !utc(result.start) ||
    !utc(result.end) ||
    !utc(result.observedAt) ||
    !(Date.parse(result.start) < Date.parse(result.end)) ||
    !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(result.resultId) ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    !Number.isSafeInteger(result.missingAmounts) ||
    result.missingAmounts < 0 ||
    result.missingAmounts > result.total ||
    !currencies(result.totals) ||
    (result.total === result.missingAmounts) !== (result.totals.length === 0) ||
    !Array.isArray(result.rows) ||
    result.rows.length !== Math.min(10, result.total) ||
    result.truncated !== result.total > result.rows.length ||
    result.rows.some(
      (r) =>
        !r ||
        typeof r.number !== 'string' ||
        typeof r.customer !== 'string' ||
        !Object.hasOwn(statusNames, r.status) ||
        !currencies(r.amounts),
    )
  )
    throw new ServiceError(502, 'INVALID_SALES_EVIDENCE');
  const summary = [
    'فروش قراردادی پس از تخفیف از ' +
      dateFormat.format(new Date(result.start)) +
      ' تا ' +
      dateFormat.format(new Date(result.end)) +
      ' به وقت تهران (روز آخر تا ساعت درج‌شده)',
    digits(result.total) + ' قرارداد تأییدشده و لغونشده',
    ...result.totals.slice(0, 30).map(money),
    ...(result.totals.length > 30
      ? [
          '۳۰ ارز نخست نمایش داده شده‌اند. جزئیات باقی ارزها در گزارش کامل در دسترس است.',
        ]
      : []),
    ...(result.missingAmounts
      ? [
          'مبلغ ' +
            digits(result.missingAmounts) +
            ' قرارداد در منبع ثبت نشده است.',
        ]
      : []),
  ].join('\n');
  const contracts = needs.contracts
    ? [
        'فهرست قراردادها (' +
          digits(result.rows.length) +
          ' از ' +
          digits(result.total) +
          ')',
        ...result.rows.map(
          (row) =>
            clean(row.number) +
            ' | ' +
            clean(row.customer) +
            ' | ' +
            statusNames[row.status] +
            ' | ' +
            (row.amounts.slice(0, 3).map(money).join('، ') || 'مبلغ ثبت نشده') +
            (row.amounts.length > 3 ? '، …' : ''),
        ),
        ...(result.total
          ? []
          : ['در محدودهٔ دسترسی شما قراردادی با این معیارها پیدا نشد.']),
      ].join('\n')
    : undefined;
  const reportParts = { summary, ...(contracts ? { contracts } : {}) };
  return {
    version: 3,
    status: 'ANSWER',
    requestId,
    plan: [],
    sources: [
      {
        resultId: result.resultId,
        observedAt: result.observedAt,
        truncated: result.truncated,
        sources: ['contracts', 'amounts'],
      },
    ],
    limitations: [],
    text: Object.values(reportParts).join('\n\n'),
    reportParts,
    reportCoverage: {
      total: result.total,
      listed: needs.contracts ? result.rows.length : 0,
      missingAmounts: result.missingAmounts,
      truncated: needs.contracts && result.truncated,
      currencyTotalsOmitted: result.totals.length > 30,
      rowCurrenciesOmitted:
        needs.contracts && result.rows.some((row) => row.amounts.length > 3),
    },
    reportHref: '/sales?salesPeriodAsOf=' + encodeURIComponent(result.end),
  };
}
