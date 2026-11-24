import { LEGAL_ENTITY_CONTEXT_ALL } from '@nora/contracts';
import { dashboardProjectionClient } from '@/modules/dashboard/model/projection-client';
import { defaultDashboardFilters } from '@/modules/dashboard/model/query';
import { normalizeQuestion } from './question-text';

const metrics = [
  {
    id: 'employee-overtime',
    phrase: /(?:مجموع |ساعت |چند ساعت )?اضافه کاری(?: ثبت شده)? کارکنان/,
    label: 'اضافه‌کاری ثبت‌شدهٔ کارکنان',
    unit: 'ساعت',
  },
  {
    id: 'employee-workdays',
    phrase: /(?:تعداد )?روزهای کارکرد کارکنان/,
    label: 'روزهای کارکرد ثبت‌شدهٔ کارکنان',
    unit: 'روز',
  },
  {
    id: 'issued-documents',
    phrase: /(?:تعداد |چند )?(?:سند|اسناد) (?:صدور|صادر شده) رزرواسیون/,
    label: 'اسناد صدور ثبت‌شدهٔ رزرواسیون',
    unit: 'سند',
  },
  {
    id: 'document-count',
    phrase: /(?:تعداد |چند )?(?:سند|اسناد) (?:ثبت شده |ایجاد شده )?آرشیو/,
    label: 'اسناد ایجادشده در آرشیو',
    unit: 'سند',
  },
  {
    id: 'registered-customers',
    phrase: /(?:تعداد |چند )?(?:مشتری|مشتریان) ثبت نام شده/,
    label: 'مشتریان ثبت‌نام‌شده',
    unit: 'مشتری',
  },
  {
    id: 'support-ticket-count',
    phrase: /(?:تعداد |چند )?(?:درخواست|درخواست های|تیکت) پشتیبانی مشتریان/,
    label: 'درخواست‌های پشتیبانی ثبت‌شدهٔ مشتریان',
    unit: 'درخواست',
  },
] as const;

const periods = {
  امروز: { range: 'today', label: 'امروز' },
  'این هفته': { range: 'week', label: 'هفتهٔ جاری تا اکنون' },
  'هفته جاری': { range: 'week', label: 'هفتهٔ جاری تا اکنون' },
  'این ماه': { range: 'month', label: 'ماه جاری شمسی تا اکنون' },
  'ماه جاری': { range: 'month', label: 'ماه جاری شمسی تا اکنون' },
} as const;

const questionPrefix = /^(?:لطفا )?/u;
const questionSuffix =
  /(?: (امروز|این هفته|هفته جاری|این ماه|ماه جاری))?(?: (?:چقدر بود|چقدر است|چقدره|چند تاست|چند بود|رو بگو|را بگو|بگو))?$/u;

export function resolveOperationalMetric(question: string) {
  const text = normalizeQuestion(question);
  for (const metric of metrics) {
    // Only admit complete recognized queries. Extra filters must never be ignored.
    const match = new RegExp(
      `${questionPrefix.source}(?:${metric.phrase.source})${questionSuffix.source}`,
      'u',
    ).exec(text);
    if (!match) continue;
    const period = periods[match[1] as keyof typeof periods];
    return period ? { metric, period } : { metric, period: null };
  }
  return null;
}

export async function readOperationalMetric(
  request: NonNullable<ReturnType<typeof resolveOperationalMetric>>,
  company: string | undefined,
  signal: AbortSignal,
  client = dashboardProjectionClient,
) {
  if (!request.period)
    return 'بازه را مشخص کنید. امروز، هفتهٔ جاری یا ماه جاری شمسی؟';
  // Native operational projections are branch-scoped. Issuer selection does
  // not filter those producers, so never present one as a single-company total.
  if (company !== LEGAL_ENTITY_CONTEXT_ALL)
    return 'این شاخص فقط در نمای «همه شرکت‌ها» و در محدودهٔ دسترسی شما قابل خواندن است.';
  const { metric, period } = request;
  try {
    const result = await client.load({
      filters: { ...defaultDashboardFilters, range: period.range },
      legalEntity: company,
      kpiIds: [metric.id],
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (
      result.state === 'forbidden' ||
      result.unavailableMetrics?.[metric.id] === 'SOURCE_PERMISSION_REQUIRED'
    )
      return 'حساب شما مجوز مشاهدهٔ این شاخص را ندارد.';
    const value = result.metrics?.[metric.id]?.value;
    if (
      result.state !== 'ready' ||
      result.metadata?.reportVersion !== 'reporting.dashboard.native.v1' ||
      result.unavailableMetrics?.[metric.id] ||
      typeof value !== 'string' ||
      !/^[۰-۹0-9]+(?:٬[۰-۹0-9]{3})*(?:٫[۰-۹0-9]+)?$/u.test(value)
    )
      return 'عدد تأییدشدهٔ این شاخص در دسترس نیست.';
    return `${metric.label} در ${period.label}، در محدودهٔ شعب مجاز شما، **${value} ${metric.unit}** است.`;
  } catch (error) {
    if (signal.aborted) throw error;
    return 'دریافت شاخص از ERP ناموفق بود. دوباره تلاش کنید.';
  }
}
