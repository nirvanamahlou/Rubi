import {
  normalizeSalesText,
  resolvePersianSalesPeriod,
} from './persian-sales-period.mjs';
import { ServiceError } from './errors.mjs';

// Bounded whole-scope contractual-sales report. Filtered/other metrics stay with
// the ordinary agent; never silently discard an explicit business filter.
export function salesWindowRequest(request, now) {
  const text = normalizeSalesText(request.message);
  if (
    !/(?:فروش|مبلغ قرارداد)/.test(text) ||
    !/(?:چقدر|جمع|مبلغ|فروش)/.test(text)
  )
    return null;
  const ordinaryWords = new Set(
    'فروشمون فروشمان فروشم فروش شرکت ما از تا الی امسال سال چقدر چه مقدار مبلغ بوده بود است هست تعداد قرارداد قراردادها قراردادهای شماره اطلاعات اطلاعاتشان مشخصات مشخصاتشان رو را و بده بگو نمایش نشان بشه بشود کل مجموع جمع در بازه تاریخ روز جزئیات فروردین اردیبهشت خرداد تیر مرداد شهریور مهر آبان آذر دی بهمن اسفند'.split(
      ' ',
    ),
  );
  if (
    text
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .some(
        (word) => word && !/^\d{1,4}$/.test(word) && !ordinaryWords.has(word),
      )
  )
    return null;
  if (
    /(?:کارشناس|فروشنده|مقصد|آژانس|مشتری|شعبه|بلیت|هتل|دلار|یورو|ریال|وصول|خالص|سود|استرداد|پرداخت|تسویه|مقایسه|نسبت)/.test(
      text,
    )
  )
    return null;
  if (
    /\d{5,}/.test(text) ||
    /(?:تاریخ سفر|تاریخ تأیید|زمان تأیید|تاریخ ثبت نهایی)/.test(text)
  )
    return null;
  const period = resolvePersianSalesPeriod(text, now);
  return period
    ? { period, details: /(?:شماره|اطلاعات|فهرست|لیست)/.test(text) }
    : null;
}

export function salesWindowSql(period, observedAt) {
  // Only runtime-produced ISO literals; no model/user string interpolation.
  for (const date of [period.startUtc, period.endExclusiveUtc, observedAt])
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(date))
      throw new Error('INVALID_SALES_PERIOD');
  return `WITH eligible AS (
    SELECT id,contract_number,customer_name,status,created_at FROM contracts
    WHERE created_at >= '${period.startUtc}'::timestamptz
    AND created_at < '${period.endExclusiveUtc}'::timestamptz
    AND status IN ('CONFIRMED','SENT_TO_RESERVATIONS','IN_PROGRESS','COMPLETED')
    AND confirmed_at IS NOT NULL AND confirmed_at <= '${observedAt}'::timestamptz
  ), detail AS (
    SELECT c.id,c.contract_number,c.customer_name,c.status,c.created_at,a.currency_code,a.amount
    FROM eligible c LEFT JOIN amounts a ON a.contract_id=c.id
  ), totals AS (
    SELECT currency_code,sum(amount) AS amount FROM detail WHERE currency_code IS NOT NULL GROUP BY currency_code
  ), report AS (
    SELECT 0 AS kind,count(DISTINCT id)::text AS metric,
      count(*)::text AS detail_rows,count(DISTINCT currency_code)::text AS currencies,
      count(CASE WHEN currency_code IS NULL THEN 1 ELSE NULL END)::text AS missing_amounts,
      NULL::text AS contract_id,NULL::text AS contract_number,NULL::text AS customer_name,
      NULL::text AS status,NULL::text AS created_at,NULL::text AS currency_code,NULL::text AS amount FROM detail
    UNION ALL
    SELECT 1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,currency_code,amount::text FROM totals
    UNION ALL
    SELECT 2,NULL,NULL,NULL,NULL,id::text,contract_number,customer_name,status,created_at::text,currency_code,amount::text FROM detail
  ) SELECT * FROM report ORDER BY kind,contract_number,currency_code`;
}
const integer = (v) => typeof v === 'string' && /^(?:0|[1-9]\d{0,12})$/.test(v);
const decimal = (v) =>
  typeof v === 'string' && /^-?\d{1,30}(?:\.\d{1,12})?$/.test(v);
const exact = (value) => {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  return BigInt(whole + fraction.padEnd(12, '0')) * (negative ? -1n : 1n);
};
export function validateSalesWindow(result) {
  const rows = result.rows;
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows[0].kind !== 0 ||
    rows.filter((r) => r.kind === 0).length !== 1
  )
    throw new ServiceError(502, 'INVALID_SALES_EVIDENCE');
  const first = rows[0];
  if (
    !['metric', 'detail_rows', 'currencies', 'missing_amounts'].every((k) =>
      integer(first[k]),
    )
  )
    throw new ServiceError(502, 'INVALID_SALES_EVIDENCE');
  const totals = rows.filter((r) => r.kind === 1),
    details = rows.filter((r) => r.kind === 2);
  if (
    totals.length !== Number(first.currencies) ||
    new Set(totals.map((r) => r.currency_code)).size !== totals.length ||
    rows.some((r) => ![0, 1, 2].includes(r.kind)) ||
    totals.some((r) => !decimal(r.amount) || !validCurrency(r.currency_code)) ||
    details.some(
      (r) =>
        typeof r.contract_id !== 'string' ||
        typeof r.contract_number !== 'string' ||
        !validStatus(r.status) ||
        !Number.isFinite(Date.parse(r.created_at)) ||
        (r.amount !== null && !decimal(r.amount)) ||
        (r.currency_code !== null && !validCurrency(r.currency_code)),
    ) ||
    (!result.truncated &&
      (details.length !== Number(first.detail_rows) ||
        new Set(details.map((r) => r.contract_id)).size !==
          Number(first.metric))) ||
    Number(first.metric) > Number(first.detail_rows) ||
    Number(first.missing_amounts) > Number(first.metric)
  )
    throw new ServiceError(502, 'INVALID_SALES_EVIDENCE');
  if (!result.truncated) {
    const identities = details.map(
      (r) => r.contract_id + ':' + r.currency_code,
    );
    const sums = new Map();
    for (const row of details)
      if (row.currency_code !== null) {
        if (row.amount === null)
          throw new ServiceError(502, 'INVALID_SALES_EVIDENCE');
        sums.set(
          row.currency_code,
          (sums.get(row.currency_code) ?? 0n) + exact(row.amount),
        );
      }
    if (
      new Set(identities).size !== identities.length ||
      details.filter((r) => r.currency_code === null).length !==
        Number(first.missing_amounts) ||
      sums.size !== totals.length ||
      totals.some((r) => sums.get(r.currency_code) !== exact(r.amount))
    )
      throw new ServiceError(502, 'INVALID_SALES_EVIDENCE');
  }
  return {
    count: first.metric,
    totals,
    details,
    missing: first.missing_amounts,
    complete: !result.truncated,
    resultId: result.resultId,
  };
}
const statusNames = {
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال‌شده به رزرواسیون',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل‌شده',
};
const validStatus = (s) => Object.hasOwn(statusNames, s);
const validCurrency = (c) => typeof c === 'string' && /^[A-Z]{3}$/.test(c);
const currencyNames = {
  IRR: 'ریال',
  USD: 'دلار آمریکا',
  EUR: 'یورو',
  AED: 'درهم امارات',
  TRY: 'لیر ترکیه',
};
const digits = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const amount = (s) => {
  const [whole, fraction] = s.split('.');
  return digits(
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') +
      (fraction ? '.' + fraction : ''),
  );
};
const safe = (s) =>
  String(s ?? '—')
    .replace(/[\r\n|<>[\]{}]/g, ' ')
    .slice(0, 160);
export const SALES_FACT_INSTRUCTION = `The runtime will reconcile this explicit Persian whole-scope contractual-sales period through the same authorized query boundary, after your first database_query. You must still set_plan, describe sources and author SQL. Use canonicalPeriod exactly, not mental calendar conversion. Count DISTINCT contract identities, never contract/currency rows. On receiving verifiedSalesReport, its resultId is authoritative for count, date and discounted amounts. For ANSWER, choose layout and order using ONLY these exact markers in text: [[sales:summary:table]] OR [[sales:summary:list]] OR [[sales:summary:prose]], then optionally [[sales:details:table]] OR [[sales:details:list]], and [[sales:method]]. Include exactly one summary and one method; include details when requested. These typed blocks bind labels and values together, preventing unsupported numeric/calendar claims while you choose the layout. No other prose, numbers or limitations outside the blocks. Set calculationExplanation=null (the method block supplies it), cite the verified resultId, and limitations=[]. Do not re-run SQL just to repair final formatting. CLARIFY/REPLY cannot assert financial results.`;

export function renderSalesWindow(answer, report, request) {
  if (answer.status !== 'ANSWER') return null;
  const text = answer.text.trim();
  const markers =
    text.match(
      /\[\[sales:(?:summary:(?:table|list|prose)|details:(?:table|list)|method)\]\]/g,
    ) ?? [];
  if (
    text
      .replace(
        /\[\[sales:(?:summary:(?:table|list|prose)|details:(?:table|list)|method)\]\]/g,
        '',
      )
      .trim() ||
    markers.filter((m) => m.includes(':summary:')).length !== 1 ||
    markers.filter((m) => m === '[[sales:method]]').length !== 1 ||
    markers.filter((m) => m.includes(':details:')).length !==
      (request.details ? 1 : 0) ||
    !answer.resultIds.includes(report.resultId) ||
    answer.limitations.length ||
    answer.calculationExplanation
  )
    throw new ServiceError(502, 'SALES_FACT_BINDING_REQUIRED');
  const p = request.period;
  const summaryRows = [
    ['تعداد قراردادهای یکتا', digits(report.count)],
    ...report.totals.map((r) => [
      'فروش قراردادی به ' + (currencyNames[r.currency_code] ?? r.currency_code),
      amount(r.amount),
    ]),
  ];
  const table = (header, rows) =>
    '| ' +
    header.join(' | ') +
    ' |\n| ' +
    header.map(() => '---').join(' | ') +
    ' |\n' +
    rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n');
  const summary = (layout) =>
    layout === 'table'
      ? table(['شاخص', 'مقدار'], summaryRows)
      : layout === 'prose'
        ? summaryRows.map((r) => r.join(': ')).join('؛ ')
        : summaryRows.map((r) => '- ' + r.join(': ')).join('\n');
  const detailRows = report.details
    .slice(0, 30)
    .map((r) => [
      digits(safe(r.contract_number)),
      safe(r.customer_name),
      statusNames[r.status],
      r.amount === null
        ? 'مبلغ ثبت نشده'
        : amount(r.amount) +
          ' ' +
          (currencyNames[r.currency_code] ?? r.currency_code),
    ]);
  const details = (layout) => {
    const shown = [...detailRows];
    const render = () =>
      !shown.length
        ? 'قراردادی با این معیارها یافت نشد.'
        : layout === 'table'
          ? table(
              ['شماره قرارداد', 'مشتری', 'وضعیت فروش', 'مبلغ پس از تخفیف'],
              shown,
            )
          : shown.map((r) => '- ' + r.join('؛ ')).join('\n');
    while (shown.length > 1 && render().length > 3500) shown.pop();
    return (
      '**قراردادها**\n' +
      render() +
      (report.details.length > shown.length || !report.complete
        ? '\nفهرست جزئیات کامل نیست؛ تعداد و جمع ارزها از کل جامعه محاسبه شده‌اند.'
        : '') +
      '\nتکرار شماره قرارداد در چند ارز، قرارداد جدید محسوب نمی‌شود.'
    );
  };
  const method =
    `**بازه و روش محاسبه**\nتاریخ شمسی: ${digits(p.startDay)} ${p.startMonth} تا ${digits(p.endDay)} ${p.endMonth} ${digits(p.year)}، شامل هر دو روز.\nتاریخ میلادی: ${digits(p.startDate)} تا ${digits(p.endDate)}.\nساعت: از ۰۰:۰۰ روز شروع تا پیش از ۰۰:۰۰ روز پس از پایان؛ منطقه زمانی تهران.\nمبنا: زمان ایجاد قرارداد، در محدوده دسترسی و شرکت انتخاب‌شده فعلی. تعداد، شمارش شناسه‌های یکتای قرارداد است؛ هر مبلغ جداگانه برای ارز خودش جمع می‌شود. تخفیف‌های قراردادی از قبل کسر شده‌اند؛ استرداد و مانده حسابداری در این منبع موجود نیست.\nفقط قراردادهای تأییدشده تا زمان مشاهده، ارسال‌شده به رزرواسیون، در حال انجام و تکمیل‌شده وارد فروش شده‌اند؛ پیش‌نویس، در انتظار تأیید و لغوشده در فروش حذف شده‌اند. این معیار فروش قراردادی است؛ با تعداد فعال پنل و آخرین وضعیت لغو رزرواسیون یکسان نیست.` +
    (report.missing !== '0'
      ? `\nبرای ${digits(report.missing)} قرارداد مبلغی در منبع وجود ندارد؛ جمع مالی پوشش کامل آن قراردادها را ندارد.`
      : '');
  const displayed = markers
    .map((m) =>
      m === '[[sales:method]]'
        ? method
        : m.includes(':summary:')
          ? summary(m.split(':')[2].slice(0, -2))
          : details(m.split(':')[2].slice(0, -2)),
    )
    .join('\n\n');
  if (displayed.length > 6000)
    throw new ServiceError(502, 'SALES_FACT_BINDING_REQUIRED');
  return displayed;
}
