import { LEGAL_ENTITY_CONTEXT_ALL } from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
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
  {
    id: 'new-leads',
    phrase: /(?:تعداد |چند )?(?:لید|سرنخ)(?: های)? (?:جدید|ثبت شده)/,
    label: 'سرنخ‌های ثبت‌شده',
    unit: 'سرنخ',
  },
  {
    id: 'collected',
    phrase: /(?:مجموع |مبلغ )?دریافت های ت[اأ]یید ?شده مشتریان/,
    label: 'دریافت‌های تأییدشدهٔ مشتریان',
    unit: null,
  },
  {
    id: 'refunded',
    phrase: /(?:مجموع |مبلغ )?استردادهای قطعی مشتریان/,
    label: 'استردادهای قطعی مشتریان',
    unit: null,
  },
  {
    id: 'registered-service-purchases',
    phrase: /(?:تعداد )?خریدهای ثبت شده خدمات/,
    label: 'خریدهای جاری ثبت‌شدهٔ خدمات رزرواسیون',
    unit: 'خرید',
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
  fetcher = fetch,
) {
  if (!request.period)
    return 'بازه را مشخص کنید. امروز، هفتهٔ جاری یا ماه جاری شمسی؟';
  const { metric, period } = request;
  const base = getPublicApiBaseUrl();
  try {
    if (!base) throw new Error('Missing ERP endpoint');
    const query = new URLSearchParams({
      id: metric.id,
      range: period.range,
      aggregate: String(company === LEGAL_ENTITY_CONTEXT_ALL),
    });
    const load = () =>
      fetcher(`${base}/reports/nora/metric?${query}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
    let response = await load();
    if (
      response.status === 401 &&
      !signal.aborted &&
      (await refreshAuthenticatedSession(base))
    )
      response = await load();
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (response.status === 403)
      return 'حساب شما مجوز مشاهدهٔ این شاخص را ندارد.';
    if (!response.ok) throw new Error('ERP metric unavailable');
    const result = await response.json();
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (
      result?.version !== 1 ||
      result.id !== metric.id ||
      result.range !== period.range
    )
      return 'عدد تأییدشدهٔ این شاخص در دسترس نیست.';
    if (result.scope === 'aggregate-required')
      return 'این شاخص در نمای «همه شرکت‌ها» و در محدودهٔ دسترسی شما قابل خواندن است.';
    const value = result.value;
    const decimal = '[۰-۹0-9]+(?:٬[۰-۹0-9]{3})*(?:٫[۰-۹0-9]+)?';
    const money = `${decimal} [A-Z]{3}`;
    const format = new RegExp(
      metric.unit ? `^${decimal}$` : `^(?:[۰0]|${money}(?: · ${money})*)$`,
      'u',
    );
    if (
      !['organization', 'authorized'].includes(result.scope) ||
      typeof value !== 'string' ||
      !format.test(value)
    )
      return 'عدد تأییدشدهٔ این شاخص در دسترس نیست.';
    const scope =
      result.scope === 'organization'
        ? 'در کل سازمان'
        : 'در محدودهٔ شعب مجاز شما';
    if (!metric.unit && /^[۰0]$/u.test(value))
      return `برای «${metric.label}» در ${period.label}، ${scope}، مبلغی ثبت نشده است.`;
    return `${metric.label} در ${period.label}، ${scope}، **${value}${metric.unit ? ' ' + metric.unit : ''}** است.`;
  } catch (error) {
    if (signal.aborted) throw error;
    return 'دریافت شاخص از ERP ناموفق بود. دوباره تلاش کنید.';
  }
}
