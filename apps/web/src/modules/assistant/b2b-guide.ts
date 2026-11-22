import { masterDataApi, MasterDataApiError } from '../master-data/api/client';
import { agencyClient } from '../organizations/api/agency-client';
import { loadOrganizationMetrics } from '../organizations/model/organization-metrics';
import { cooperationLabel } from '../organizations/model/presentation';
import copy from './b2b-guide-catalog.json';
import { matchesQuestion, normalizeQuestion } from './question-text';

export const b2bGuideLink = { href: copy.href, label: copy.label };
export const b2bGuideTopics = copy.topics.map((topic) => ({
  ...topic,
  match: new RegExp(topic.pattern, 'i'),
}));
const topics = b2bGuideTopics;
type Topic = (typeof topics)[number];

export function resolveB2bQuestion(
  message: string,
  onPanel: boolean,
  previous?: string,
) {
  const text = normalizeQuestion(message);
  const last = topics.find((topic) => topic.id === previous);
  if (last && /^(بعدش|بعدش چی|مرحله بعد|بیشتر توضیح بده)$/.test(text))
    return { kind: 'guide' as const, topic: last };
  if (
    /b2c|کال سنتر|مبلغ قرارداد|وضعیت قرارداد|خرید و تامین|اطلاعات پایه/.test(
      text,
    )
  )
    return;
  const explicit =
    /b2b|آژانس ها|آژانس|ثبت آژانس|آژانس همکار|مشتری سازمانی|پرونده آژانس|اعتبار آژانس|توافق همکاری/.test(
      text,
    );
  if (
    !explicit &&
    !(onPanel && topics.some(({ match }) => matchesQuestion(text, match)))
  )
    return;
  const how = /چطور|چگونه|چرا|کجا|نحوه|یعنی|راهنما/.test(text);
  if (
    !how &&
    /تعداد|چند |چقدر سازمان|نتایج فیلتر فعلی/.test(text) &&
    !/اعتبار|مانده|پرداخت/.test(text)
  )
    return {
      kind: 'metrics' as const,
      external: /امروز|دیروز|ماه|شعبه|تاریخ/.test(text),
    };
  if (
    !how &&
    /وضعیت|فعال است|فعاله|غیرفعال/.test(text) &&
    !/اعتبار|توافق|پرداخت|مدرک/.test(text)
  ) {
    const code = /(?:^|\s)کد\s+([a-z0-9_-]{1,80})(?=\s|$)/i.exec(text)?.[1];
    return { kind: 'status' as const, code };
  }
  const exact = topics.find((topic) => normalizeQuestion(topic.title) === text);
  const actionTopics = [
    [/حذف/, 'delete'],
    [/بارگذاری|فایل امضادار|مدرک/, 'documents'],
    [/اکسل|excel/, 'excel'],
    [/ذخیره.*نامشخص|ثبت نامطمئن|ثبت ناقص/, 'uncertain-save'],
    [
      /فهرست خالی|پیدا نمیشه|پیدا نمی شه|پیدا نمی شود|مجوز مشاهده/,
      'empty-list',
    ],
    [/اسناد فروش/, 'sales-history'],
    [/ثبت مشتری سازمانی|مشتری سازمانی.*ثبت/, 'registration'],
    [/اعتبار|سقف اعتبار/, 'credit'],
    [/نرخ توافقی|نرخ های توافقی/, 'rates'],
    [
      /ویرایش امضادار|امضادار.*ویرایش|امضادار.*اضافه|افزودن امضادار/,
      'signatories',
    ],
    [/فعالیت/, 'activity'],
    [/پرداخت|تسویه|صورتحساب/, 'finance'],
  ] as const;
  const preferred = actionTopics.find(([pattern]) =>
    matchesQuestion(text, pattern),
  )?.[1];
  const candidates = topics.filter((item) => matchesQuestion(text, item.match));
  const topic =
    exact ??
    topics.find((item) => item.id === preferred) ??
    candidates.find((item) => item.id !== 'metrics' && item.id !== 'profile') ??
    candidates[0] ??
    topics[0]!;
  return { kind: 'guide' as const, topic };
}

export function renderB2bGuide(topic: Topic) {
  return [
    topic.title,
    topic.path.join(' ← '),
    'پیش‌نیاز:' + ' ' + topic.prerequisite,
    topic.text,
    'اقدام بعدی ' + topic.next,
  ].join('\n\n');
}

export function b2bDirectoryContext() {
  const panel = document.querySelector<HTMLElement>('[data-b2b-directory]');
  const data = panel?.dataset;
  return {
    search:
      panel?.querySelector<HTMLInputElement>('[data-b2b-search]')?.value ?? '',
    status:
      data?.status === 'active' || data?.status === 'inactive'
        ? data.status
        : 'all',
    role: data?.role === 'CORPORATE_CUSTOMER' ? 'CORPORATE_CUSTOMER' : 'AGENCY',
    selected: data?.selected ?? '',
    branch: data?.branch ?? '',
  } as const;
}

type Intent = Extract<
  ReturnType<typeof resolveB2bQuestion>,
  { kind: 'metrics' | 'status' }
>;
export async function readB2bGuide(
  intent: Intent,
  context: ReturnType<typeof b2bDirectoryContext>,
  isCurrent: () => boolean,
) {
  if (intent.kind === 'metrics' && intent.external) return copy.filters;
  const query = { search: context.search, status: context.status };
  try {
    if (intent.kind === 'metrics') {
      const [counts, current] = await Promise.all([
        loadOrganizationMetrics(query, isCurrent),
        agencyClient.list({
          ...query,
          role: context.role,
          page: 1,
          pageSize: 10,
        }),
      ]);
      const n = (count: number) => count.toLocaleString('fa-IR');
      return [
        'نتایج فیلتر فعلی ' + n(current.meta.total),
        'آژانس همکار ' + n(counts.agencies),
        'مشتری سازمانی ' + n(counts.corporateCustomers),
        'نیازمند تکمیل هویت ' + n(counts.incompleteIdentity),
        copy.scope,
      ].join('\n');
    }
    if (context.selected && !intent.code) {
      const { data } = await masterDataApi.detail(
        'organizations',
        context.selected,
      );
      return data.id === context.selected && data.resource === 'organizations'
        ? projectStatus(data)
        : copy.missing;
    }
    if (!intent.code) return copy.choose;
    const searches = await Promise.all(
      (['AGENCY', 'CORPORATE_CUSTOMER'] as const).map((role) =>
        agencyClient.list({
          search: intent.code!,
          status: 'all',
          role,
          page: 1,
          pageSize: 10,
        }),
      ),
    );
    if (searches.some(({ data, meta }) => meta.total > data.length))
      return copy.ambiguous;
    const records = new Map(
      searches.flatMap(({ data }) =>
        data
          .filter(
            (row) =>
              row.resource === 'organizations' &&
              normalizeQuestion(row.code) === intent.code,
          )
          .map((row) => [row.id, row] as const),
      ),
    );
    const record = records.values().next().value;
    if (records.size > 1) return copy.ambiguous;
    return record ? projectStatus(record) : copy.missing;
  } catch (error) {
    if (
      error instanceof MasterDataApiError ||
      (error instanceof Error && 'status' in error)
    ) {
      if (error.status === 401) return copy.login;
      if (error.status === 403) return copy.denied;
      if (error.status === 404) return copy.missing;
    }
    return copy.failed;
  }
}

function projectStatus(
  record: Awaited<ReturnType<typeof masterDataApi.detail>>['data'],
) {
  return [
    record.name,
    record.code,
    cooperationLabel(record.attributes.roleCodes),
    copy[record.status],
  ].join(' · ');
}
