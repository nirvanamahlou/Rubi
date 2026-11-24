import {
  reportSourceTopic,
  describeReportSources,
} from './report-source-discovery';
import { LEGAL_ENTITY_CONTEXT_ALL } from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { normalizeQuestion } from './question-text';

import { operationalMetrics as metrics } from './operational-metric-catalog';

const periods = {
  امروز: { range: 'today', label: 'امروز' },
  'این هفته': { range: 'week', label: 'هفتهٔ جاری تا اکنون' },
  'هفته جاری': { range: 'week', label: 'هفتهٔ جاری تا اکنون' },
  'این ماه': { range: 'month', label: 'ماه جاری شمسی تا اکنون' },
  'ماه جاری': { range: 'month', label: 'ماه جاری شمسی تا اکنون' },
} as const;
const currentPeriod = { range: 'current', label: 'حال حاضر' } as const;
type OperationalMetricRequest = {
  metric: (typeof metrics)[number];
  period: (typeof periods)[keyof typeof periods] | typeof currentPeriod | null;
};

const questionPrefix = /^(?:لطفا )?/u;
const questionSuffix =
  /(?: (امروز|این هفته|هفته جاری|این ماه|ماه جاری))?(?: (?:چقدر بود|چقدر است|چقدره|چند تاست|چند بود|رو بگو|را بگو|بگو))?$/u;

export function resolveOperationalMetric(
  question: string,
):
  | OperationalMetricRequest
  | { metric: { id: 'report-source' }; topic: string; period: null }
  | null {
  const topic = reportSourceTopic(question);
  if (topic) return { metric: { id: 'report-source' }, period: null, topic };
  const text = normalizeQuestion(question);
  for (const metric of metrics) {
    // Only admit complete recognized queries. Extra filters must never be ignored.
    const match = new RegExp(
      `${questionPrefix.source}(?:${metric.phrase.source})${questionSuffix.source}`,
      'u',
    ).exec(text);
    if (!match) continue;
    if ('snapshot' in metric)
      return match[1] ? null : { metric, period: currentPeriod };
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
  if (!('topic' in request) && !request.period)
    return 'بازه را مشخص کنید. امروز، هفتهٔ جاری یا ماه جاری شمسی؟';
  const { metric, period } = request;
  const base = getPublicApiBaseUrl();
  try {
    if (!base) throw new Error('Missing ERP endpoint');
    const topic = 'topic' in request ? request.topic : null;
    const query = new URLSearchParams({
      id: metric.id,
      range: period?.range ?? '',
      aggregate: String(company === LEGAL_ENTITY_CONTEXT_ALL),
    });
    const load = () =>
      fetcher(
        topic
          ? `${base}/reports/catalog`
          : `${base}/reports/nora/metric?${query}`,
        {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        },
      );
    let response = await load();
    if (
      response.status === 401 &&
      !signal.aborted &&
      (await refreshAuthenticatedSession(base))
    )
      response = await load();
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (response.status === 403)
      return topic
        ? 'حساب شما مجوز مشاهدهٔ فهرست گزارش‌ها را ندارد.'
        : 'حساب شما مجوز مشاهدهٔ این شاخص را ندارد.';
    if (!response.ok) throw new Error('ERP metric unavailable');
    const result = await response.json();
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    if ('topic' in request) {
      const answer = await describeReportSources(request.topic, result);
      if (signal.aborted)
        throw new DOMException('Request aborted', 'AbortError');
      return answer;
    }
    if (
      !period ||
      !('unit' in metric) ||
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
      metric.unit
        ? `^${decimal}$`
        : `^(?:${/[۰0]/u.source}|${money}(?: · ${money})*)$`,
      'u',
    );
    if (
      !['organization', 'authorized', 'selected-company'].includes(
        result.scope,
      ) ||
      typeof value !== 'string' ||
      !format.test(value)
    )
      return 'عدد تأییدشدهٔ این شاخص در دسترس نیست.';
    const scope =
      result.scope === 'organization'
        ? 'در کل سازمان'
        : result.scope === 'selected-company'
          ? 'در محدودهٔ مجاز شرکت انتخاب‌شده'
          : 'در محدودهٔ شعب مجاز شما';
    if (!metric.unit && /^[۰0]$/u.test(value))
      return `برای «${metric.label}» در ${period.label}، ${scope}، مبلغی ثبت نشده است.`;
    return `${metric.label} در ${period.label}، ${scope}، **${value}${metric.unit ? ' ' + metric.unit : ''}** است.`;
  } catch (error) {
    if (signal.aborted) throw error;
    return 'دریافت شاخص از ERP ناموفق بود. دوباره تلاش کنید.';
  }
}
