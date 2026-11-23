import { customersApi, CustomersApiError } from '../customers/api/client';
import { normalizeCustomerListQuery } from '../customers/api/contracts';
import catalog from './customer-guide-catalog.json';
import { normalizeQuestion } from './question-text';

export const customerGuideLink = { href: '/customers', label: 'مشتریان B2C' };
const topics = catalog.map(({ id, title, pattern, text, guideHref }) => ({
  id,
  title,
  pattern: new RegExp(pattern, 'i'),
  text,
  guideHref,
}));
type Topic = (typeof topics)[number];

export function resolveCustomerQuestion(
  message: string,
  onPanel: boolean,
  previous?: string,
) {
  const text = normalizeQuestion(message);
  const last = topics.find((topic) => topic.id === previous);
  if (last && /^(بعدش|بعدش چی|مرحله بعد|بیشتر توضیح بده)$/.test(text))
    return { kind: 'guide' as const, topic: last };
  if (
    /\bb2b\b|آژانس همکار|مشتری سازمانی|کال سنتر|امور مشتریان|وضعیت قرارداد|قیمت قرارداد|خرید و تامین|مشتری.*قرارداد|مسافر.*قرارداد/.test(
      text,
    )
  )
    return;
  if (!onPanel && !/مشتری|مسافر|b2c/.test(text)) return;
  const topic = topics.find((entry) => normalizeQuestion(entry.title) === text);
  if (topic) return { kind: 'guide' as const, topic };
  const how = /چطور|چگونه|کجا|راهنما|نحوه|چرا|معنی|یعنی/.test(text);
  if (!how && /تعداد|چند |نرخ بازگشت/.test(text) && /مشتری|مسافر/.test(text)) {
    const externalFilters =
      /امروز|دیروز|هفته|ماه|سال|شعبه|از تاریخ|تا تاریخ|نحوه آشنایی/.test(
        text.replace(/سه ماه اخیر/g, ''),
      );
    return {
      kind: 'metrics' as const,
      externalFilters,
      metric: /نرخ بازگشت/.test(text)
        ? ('rate' as const)
        : /سه ماه اخیر|مشتریان جدید/.test(text)
          ? ('new' as const)
          : /مسافر/.test(text) && !/مشتری/.test(text)
            ? ('passengers' as const)
            : ('all' as const),
    };
  }
  if (!how && /وضعیت.*(?:پرونده|مشتری)|پرونده.*(?:فعاله|فعال است)/.test(text)) {
    const name =
      /(?:پرونده|مشتری)\s+(.+?)(?:\s+(?:چیست|چیه|فعاله|فعال است))?$/.exec(
        text,
      )?.[1];
    return { kind: 'status' as const, name };
  }
  if (
    !onPanel &&
    !/مشتریان|b2c|مشتری حقیقی|پرونده مشتری|مدرک مشتری|ثبت مشتری|مشتری جدید|اکسل مشتری/.test(
      text,
    )
  )
    return;
  const specific = [
    'import',
    'export',
    'documents',
    'duplicate',
    'audit',
    'consent',
    'companions',
  ];
  const matching =
    specific
      .map((id) =>
        topics.find((entry) => entry.id === id && entry.pattern.test(text)),
      )
      .find(Boolean) ?? topics.find((entry) => entry.pattern.test(text));
  if (matching) return { kind: 'guide' as const, topic: matching };
  if (/مشتریان|b2c|این بخش/.test(text))
    return { kind: 'guide' as const, topic: topics[1]! };
}

export function renderCustomerGuide(topic: Topic) {
  return [
    topic.title,
    customerGuideLink.label + ' ← ' + topic.title,
    topic.text,
  ].join('\n\n');
}

type ReadIntent = Extract<
  ReturnType<typeof resolveCustomerQuestion>,
  { kind: 'metrics' | 'status' }
>;
export async function readCustomerGuide(
  intent: ReadIntent,
  filters: URLSearchParams,
  signal: AbortSignal,
) {
  const query = normalizeCustomerListQuery({
    kind: 'all',
    status: 'all',
    role: 'all',
    search: filters.get('search') ?? '',
    branchId: filters.get('branchId') ?? 'all',
    acquaintanceMethodId: filters.get('acquaintanceMethodId') ?? 'all',
    createdFrom: filters.get('createdFrom'),
    createdTo: filters.get('createdTo'),
    updatedFrom: filters.get('updatedFrom'),
    updatedTo: filters.get('updatedTo'),
    sortBy: 'updatedAt',
    sortDirection: 'desc',
    page: 1,
    pageSize: 10,
  });
  if (intent.kind === 'metrics' && intent.externalFilters)
    return {
      text: 'فیلتر موردنظر را در پنل مشتریان تنظیم کنید و از همان صفحه دوباره بپرسید.',
      href: customerGuideLink.href,
    };
  try {
    if (intent.kind === 'metrics') {
      const {
        meta: { metrics },
      } = await customersApi.list(query, signal);
      const format = new Intl.NumberFormat('fa-IR');
      const counts = [
        'تعداد کل مشتریان ' + format.format(metrics.totalCustomers),
        'تعداد کل مسافران ' + format.format(metrics.totalPassengers),
        'مشتریان جدید سه ماه اخیر ' +
          format.format(metrics.newCustomersLastThreeMonths),
      ];
      const value =
        intent.metric === 'rate'
          ? metrics.returningCustomerRate === null
            ? 'نرخ بازگشت مشتری در دسترس نیست.'
            : 'نرخ بازگشت مشتری ' +
              format.format(metrics.returningCustomerRate) +
              '٪'
          : intent.metric === 'new'
            ? counts[2]
            : intent.metric === 'passengers'
              ? counts[1]
              : counts.join('\n');
      return {
        text:
          value + '\n\n' + 'دامنه پاسخ، فیلترهای جاری و شعب مجاز حساب شماست.',
        href: customerGuideLink.href,
      };
    }
    const id = filters.get('customerId');
    if (id && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) {
      const { data } = await customersApi.detail(id, undefined, signal);
      if (data.id === id) return customerStatus(data.id, data.status);
    } else if (intent.name) {
      const result = await customersApi.list(
        { ...query, search: intent.name },
        signal,
      );
      const record = result.data[0];
      if (
        result.meta.total === 1 &&
        record &&
        normalizeQuestion(record.displayName) === intent.name
      )
        return customerStatus(record.id, record.status);
      if (result.meta.total === 0)
        return {
          text: 'در محدوده مجاز پرونده‌ای پیدا نشد.',
          href: customerGuideLink.href,
        };
    }
    return {
      text: 'برای بررسی وضعیت، پرونده درست را در پنل مشتریان انتخاب کنید.',
      href: customerGuideLink.href,
    };
  } catch (error) {
    if (signal.aborted) throw error;
    const status = error instanceof CustomersApiError ? error.status : 0;
    return {
      href: customerGuideLink.href,
      text:
        status === 401
          ? 'نشست معتبر نیست؛ دوباره وارد شوید.'
          : status === 403
            ? 'مجوز customers.read برای مشاهده لازم است.'
            : status === 404
              ? 'در محدوده مجاز پرونده‌ای پیدا نشد.'
              : 'دریافت اطلاعات مشتریان ناموفق بود. دوباره تلاش کنید.',
    };
  }
}

function customerStatus(id: string, status: 'active' | 'inactive') {
  return {
    text: status === 'active' ? 'پرونده فعال است.' : 'پرونده غیرفعال است.',
    href: '/customers?' + new URLSearchParams({ customerId: id }),
  };
}
