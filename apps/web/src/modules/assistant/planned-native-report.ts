import { LEGAL_ENTITY_CODES } from '@nora/contracts';
import { z } from 'zod';
import { reportCatalog } from '../reports/model/reporting';
import { reportingOperationConfigurationHref } from '../reports/model/navigation';
import { reportDateRangeUtc } from '../reports/model/report-dates';
import type { AnswerPart } from './planned-answer';
import { normalizeQuestion } from './question-text';

const catalog = z
  .array(
    z.object({
      code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
      title: z.string().min(1).max(400),
      producerStatus: z.enum(['READY', 'PENDING_CONNECTION']),
      approvedView: z.string().min(1).max(160),
    }),
  )
  .max(1000);
const count = z.number().int().nonnegative().safe();
const resultSchema = z.object({
  reportCode: z.string(),
  sourceProjection: z.string(),
  total: count,
  page: count,
  pageSize: count,
  generatedAtUtc: z.string().datetime(),
  sourceDataAsOfUtc: z.string().datetime().nullable(),
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string().min(1).max(160),
      kind: z.string(),
    }),
  ),
  rows: z.array(z.unknown()).max(5),
  totalsByCurrency: z.array(z.record(z.string(), z.unknown())),
  filterSnapshot: z.object({
    reportCode: z.string(),
    timezone: z.literal('Asia/Tehran'),
    legalEntityId: z.string().optional(),
    filters: z.record(z.string(), z.unknown()),
  }),
});
const currency = /^[A-Z]{3}$/;
const decimal = /^-?\d{1,40}(?:\.\d{1,16})?$/;
const moneyKeys = new Set([
  'salesAmount',
  'purchaseAmount',
  'refundAmount',
  'grossProfit',
  'settlementBalance',
]);
const countKeys = new Set([
  'orderCount',
  'passengerCount',
  'ticketCount',
  'recordCount',
  'pendingReservationActions',
  'capacity',
  'availableCapacity',
  'allocatedCapacity',
  'employeeCount',
  'daysRemaining',
  'quantity',
]);

function isoDay(value: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function explicitFilters(qualifier: string, now: Date) {
  let fromDate = '',
    toDate = '',
    currencyCode = '';
  const code = /(?:^| )(?:با |به )?ارز ([a-z]{3})$/u.exec(qualifier);
  if (code) {
    currencyCode = code[1]!.toUpperCase();
    qualifier = qualifier.slice(0, code.index).trim().replace(/ و$/u, '');
  }
  if (qualifier) {
    const dates = /^از (\d{4}-\d{2}-\d{2}) تا (\d{4}-\d{2}-\d{2})$/u.exec(
      qualifier,
    );
    if (dates) {
      fromDate = dates[1]!;
      toDate = dates[2]!;
      if (!isoDay(fromDate) || !isoDay(toDate) || fromDate > toDate)
        return null;
    } else {
      const relative =
        /^(?:برای )?(امروز|دیروز|دو هفته اخیر|14 روز اخیر)$/u.exec(qualifier);
      if (!relative) return null;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      const offsetDay = (delta: number) =>
        new Date(Date.parse(today + 'T00:00:00Z') + delta * 86400000)
          .toISOString()
          .slice(0, 10);
      toDate = relative[1] === 'دیروز' ? offsetDay(-1) : today;
      fromDate = ['دو هفته اخیر', '14 روز اخیر'].includes(relative[1]!)
        ? offsetDay(-13)
        : toDate;
    }
  }
  return { fromDate, toDate, currencyCode };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Execute only a full catalog title/code recognized in this actor's own authenticated catalog. */
export async function runNativeReport(
  question: string,
  company: { selection: string } | null,
  read: (path: string, body?: unknown) => Promise<unknown>,
  now = new Date(),
): Promise<AnswerPart> {
  const issue = (status: AnswerPart['status'], text: string): AnswerPart => ({
    question,
    status,
    text,
    links: [],
  });
  if (!company || !['ALL', ...LEGAL_ENTITY_CODES].includes(company.selection))
    return issue(
      'unavailable',
      'محدودهٔ شرکت فعال برای اجرای گزارش مشخص نیست.',
    );
  const input = normalizeQuestion(question)
    .replace(/^(?:لطفا )?(?:اجرای )?گزارش /u, '')
    .replace(
      /(?: (?:را|رو))? (?:اجرا کن|نشون بده|نشان بده|نمایش بده|بگیر|بده)$/u,
      '',
    )
    .trim();
  const authorized = catalog.parse(await read('/reports/catalog'));
  const matches = authorized
    .flatMap((report) => {
      const panel = reportCatalog.find((r) => r.code === report.code);
      const names = [
        report.title,
        report.code,
        panel?.title,
        panel?.displayCode,
      ]
        .filter((n): n is string => Boolean(n))
        .map(normalizeQuestion)
        .filter((n) => input === n || input.startsWith(n + ' '))
        .sort((a, b) => b.length - a.length);
      return names[0]
        ? [
            {
              report,
              panel,
              qualifier: input.slice(names[0].length).trim(),
              matched: names[0].length,
            },
          ]
        : [];
    })
    .sort((a, b) => b.matched - a.matched);
  const match = matches[0];
  if (!match || matches[1]?.matched === match.matched)
    return issue(
      'clarify',
      'نام یا کد دقیق گزارش را از فهرست گزارش‌های در دسترس خود وارد کنید.',
    );
  const { report, panel } = match;
  if (report.producerStatus !== 'READY')
    return issue(
      'unavailable',
      'منبع این گزارش در سامانه هنوز آمادهٔ اجرا نیست.',
    );
  const parsed = explicitFilters(match.qualifier, now);
  if (
    !parsed ||
    (parsed.currencyCode && !panel?.filters.includes('ارز')) ||
    (parsed.fromDate && !panel?.filters.includes('بازه تاریخ'))
  )
    return issue(
      'clarify',
      'این ترکیب فیلتر قابل اجرا نیست. نام گزارش را با بازهٔ تاریخ یا کد ارز پشتیبانی‌شده وارد کنید.',
    );
  const { fromDate, toDate, currencyCode } = parsed;
  const filters = {
    ...reportDateRangeUtc(fromDate, toDate),
    ...(currencyCode ? { currencyCode } : {}),
  };
  const companyId = company.selection === 'ALL' ? undefined : company.selection;
  const body = {
    filters,
    ...(companyId ? { legalEntityId: companyId } : {}),
    page: 1,
    pageSize: 5,
    timezone: 'Asia/Tehran',
  };
  const result = resultSchema.parse(
    await read('/reports/' + report.code + '/query', body),
  );
  const snapshot = result.filterSnapshot;
  if (
    result.reportCode !== report.code ||
    result.sourceProjection !== report.approvedView ||
    result.page !== 1 ||
    result.pageSize !== 5 ||
    result.rows.length !== Math.min(5, result.total) ||
    snapshot.reportCode !== report.code ||
    snapshot.legalEntityId !== companyId ||
    Object.keys(snapshot.filters).length !== Object.keys(filters).length ||
    Object.entries(filters).some(
      ([key, value]) => snapshot.filters[key] !== value,
    )
  )
    return issue(
      'unavailable',
      'منبع گزارش یا فیلترهای نتیجه با درخواست مطابقت ندارد.',
    );
  const lines = [
    report.title,
    `تعداد ردیف‌های گزارش: ${result.total.toLocaleString('fa-IR')}`,
  ];
  if (fromDate) lines.push('بازهٔ تهران: ' + fromDate + ' تا ' + toDate);
  if (currencyCode) lines.push('ارز: ' + currencyCode);
  for (const item of result.totalsByCurrency) {
    if (
      typeof item.currencyCode !== 'string' ||
      !currency.test(item.currencyCode)
    )
      continue;
    for (const column of result.columns.filter((c) => moneyKeys.has(c.key))) {
      const amount = item[column.key];
      if (typeof amount === 'string' && decimal.test(amount))
        lines.push(`${column.label}: ${amount} ${item.currencyCode}`);
    }
  }
  for (const [index, value] of result.rows.entries()) {
    const row = record(value);
    const values =
      row.sourceValues === undefined ? row : record(row.sourceValues);
    const measures = result.columns.flatMap((c) => {
      const n = values[c.key];
      if (
        countKeys.has(c.key) &&
        c.kind === 'NUMBER' &&
        (typeof n === 'number' || typeof n === 'string') &&
        /^\d{1,12}$/.test(String(n))
      )
        return [c.label + ' ' + n];
      return [];
    });
    if (measures.length)
      lines.push(
        `ردیف ${(index + 1).toLocaleString('fa-IR')}: ${measures.join('، ')}`,
      );
  }
  if (result.rows.length)
    lines.push('جزئیات ردیف‌ها در گزارش سامانه در دسترس است.');
  return {
    question,
    status: result.total ? 'answer' : 'empty',
    text: lines.join('\n'),
    source: report.approvedView,
    observedAt: result.sourceDataAsOfUtc ?? result.generatedAtUtc,
    links: panel
      ? [
          {
            href: reportingOperationConfigurationHref('catalog', 'all', {
              reportCode: report.code,
              fromDate,
              toDate,
              legalEntity: company.selection,
              currency: currencyCode || 'ALL',
              filterValues: {},
            }),
            label: 'مشاهده همین گزارش و فیلترها',
          },
        ]
      : [],
  };
}
