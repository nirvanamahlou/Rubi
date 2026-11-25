import { canViewRoute } from '@nora/contracts';
import { z } from 'zod';
import {
  normalizeCustomerListQuery,
  serializeCustomerListQuery,
} from '../customers/api/contracts';
import { serializeMasterDataListQuery } from '../master-data/api/contracts';
import { purchaseFilters } from '../reservation-purchases/model';
import { resolvedCallCenterBranch } from '../call-center/resolve-branch';
import { panelIntent } from './planned-operational-intent';
import { normalizeQuestion } from './question-text';
import type { AnswerPart } from './planned-answer';

const count = z.number().int().nonnegative().safe();
const status = z.enum(['active', 'inactive']);
const customerMetrics = z.object({
  meta: z.object({
    metrics: z.object({
      totalCustomers: count,
      totalPassengers: count,
      newCustomersLastThreeMonths: count,
      returningCustomerRate: z.number().min(0).max(100).nullable(),
    }),
  }),
});
const purchaseSummary = z.object({
  meta: z.object({
    summary: z.object({
      total: count,
      registered: count,
      unregistered: count,
      unknown: count,
    }),
  }),
});
const kpis = z.object({
  data: z.object({
    today: count,
    week: count,
    withoutOutcome: count,
    needsFollowUp: count,
  }),
  meta: z.object({
    branchId: z.string().uuid(),
    asOf: z.string().datetime(),
    timezone: z.literal('Asia/Tehran'),
  }),
});
const branches = z.object({
  data: z.array(z.object({ id: z.string().uuid() })),
  meta: z.object({ defaultBranchId: z.string().uuid().nullable() }).optional(),
});
const routes = {
  customers: '/customers',
  organizations: '/organizations',
  purchases: '/ticket-purchases',
  calls: '/customer-affairs/call-center',
};
const customerHref = (search = '') =>
  '/customers?' +
  serializeCustomerListQuery(
    normalizeCustomerListQuery({ search, pageSize: 10 }),
  );
const agencyHref = (role: 'AGENCY' | 'CORPORATE_CUSTOMER', search = '') =>
  '/master-data/organizations?' +
  serializeMasterDataListQuery({
    search,
    organizationRole: role,
    status: 'all',
    sortBy: 'updatedAt',
    sortDirection: 'desc',
    page: 1,
    pageSize: 10,
  });

export async function runOperationalPanel(
  question: string,
  actor: { permissions: readonly string[]; branchIds: readonly string[] },
  company: { selection: string } | null,
  read: (path: string, body?: unknown, branchId?: string) => Promise<unknown>,
): Promise<AnswerPart> {
  const issue = (status: AnswerPart['status'], text: string): AnswerPart => ({
    question,
    status,
    text,
    links: [],
  });
  const intent = panelIntent(question);
  if (!intent || intent.kind === 'unsupported')
    return issue(
      'clarify',
      'این ترکیب شرط‌ها با یکی از شاخص‌های پنل تطبیق ندارد. نام شاخص یا وضعیت پرونده را مشخص کنید.',
    );
  // These directory/queue owners expose branch scope, but do not apply an issuer-company filter.
  if (company?.selection !== 'ALL')
    return issue(
      'unavailable',
      'منبع این شاخص تفکیک شرکت صادرکننده ندارد. نتیجه در نمای همه شرکت‌ها و در محدودهٔ مجاز حساب قابل بررسی است.',
    );
  const denied = () =>
    issue(
      'denied',
      'حساب شما برای مشاهدهٔ این داده در محدودهٔ انتخاب‌شده مجوز ندارد.',
    );
  if (!actor.permissions.includes('legal-entity.aggregate.read'))
    return denied();
  function answer(
    text: string,
    source: string,
    href?: string,
    observedAt = new Date().toISOString(),
  ): AnswerPart {
    return {
      question,
      status: 'answer',
      text,
      source,
      observedAt,
      links: href ? [{ href, label: 'مشاهده شاخص در پنل' }] : [],
    };
  }
  const show = (label: string, value: number) =>
    label + ' ' + value.toLocaleString('fa-IR');
  if (
    intent.kind === 'b2b-status' ||
    (intent.kind === 'card' &&
      ['agencies', 'corporations'].includes(intent.key))
  ) {
    if (!canViewRoute(actor.permissions, routes.organizations)) return denied();
    const role =
      intent.kind === 'b2b-status'
        ? intent.role
        : intent.key === 'agencies'
          ? 'AGENCY'
          : 'CORPORATE_CUSTOMER';
    const payload = await read(
      agencyHref(role, intent.kind === 'b2b-status' ? intent.code : ''),
    );
    const { meta } = z
      .object({ meta: z.object({ total: count }) })
      .parse(payload);
    if (intent.kind === 'card')
      return answer(
        show(intent.label, meta.total),
        'master-data.organizations',
        routes.organizations,
      );
    if (meta.total === 0)
      return issue('empty', 'در فهرست مجاز سازمانی با این کد پیدا نشد.');
    const { data } = z
      .object({
        data: z.array(
          z.object({
            code: z.string(),
            resource: z.literal('organizations'),
            status,
          }),
        ),
      })
      .parse(payload);
    if (meta.total !== data.length)
      return issue(
        'clarify',
        'نتایج جست‌وجوی این کد بیشتر از یک صفحه است. کد دقیق‌تری وارد کنید.',
      );
    const matches = data.filter(
      (row) => normalizeQuestion(row.code) === intent.code,
    );
    if (matches.length !== 1)
      return issue(
        matches.length ? 'clarify' : 'empty',
        'برای این کد در محدودهٔ مجاز تطبیق یکتا پیدا نشد.',
      );
    return answer(
      matches[0]!.status === 'active'
        ? 'پرونده سازمان فعال است.'
        : 'پرونده سازمان غیرفعال است.',
      'master-data.organizations',
    );
  }
  if (
    intent.kind === 'b2c-status' ||
    (intent.kind === 'card' &&
      ['customers', 'passengers', 'newCustomers', 'returnRate'].includes(
        intent.key,
      ))
  ) {
    if (
      !canViewRoute(actor.permissions, routes.customers) ||
      !actor.permissions.includes('customers.read')
    )
      return denied();
    const payload = await read(
      customerHref(intent.kind === 'b2c-status' ? intent.name : ''),
    );
    if (intent.kind === 'b2c-status') {
      const { data, meta } = z
        .object({
          data: z.array(z.object({ displayName: z.string(), status })),
          meta: z.object({ total: count }),
        })
        .parse(payload);
      if (meta.total === 0)
        return issue('empty', 'در محدوده مجاز مشتری با این نام پیدا نشد.');
      if (
        meta.total !== 1 ||
        data.length !== 1 ||
        normalizeQuestion(data[0]!.displayName) !==
          normalizeQuestion(intent.name)
      )
        return issue(
          'clarify',
          'نام واردشده به پروندهٔ یکتایی نمی‌رسد. نام کامل پرونده را وارد کنید.',
        );
      return answer(
        data[0]!.status === 'active'
          ? 'پرونده مشتری فعال است.'
          : 'پرونده مشتری غیرفعال است.',
        'customers.list',
      );
    }
    const m = customerMetrics.parse(payload).meta.metrics;
    const value =
      intent.key === 'customers'
        ? m.totalCustomers
        : intent.key === 'passengers'
          ? m.totalPassengers
          : intent.key === 'newCustomers'
            ? m.newCustomersLastThreeMonths
            : m.returningCustomerRate;
    if (value === null)
      return issue(
        'unavailable',
        'نرخ بازگشت مشتری در کارت پنل فعلاً محاسبه نشده است.',
      );
    return answer(
      show(intent.label, value) + (intent.key === 'returnRate' ? '٪' : ''),
      'customers.list.metrics',
      routes.customers,
    );
  }
  if (intent.kind !== 'card')
    return issue('unavailable', 'منبع این شاخص در دسترس نیست.');
  if (
    ['purchases', 'pending', 'registered', 'uncertain'].includes(intent.key)
  ) {
    if (
      !canViewRoute(actor.permissions, routes.purchases) ||
      !canViewRoute(actor.permissions, '/reservations') ||
      !actor.permissions.includes('reservations.read')
    )
      return denied();
    const query = new URLSearchParams({
      kind: 'ALL',
      page: '1',
      contractNumber: '',
      ...purchaseFilters(null),
    });
    const m = purchaseSummary.parse(
      await read('/reservations/requests/purchases?' + query),
    ).meta.summary;
    if (m.total !== m.registered + m.unregistered + m.unknown)
      return issue(
        'unavailable',
        'جمع وضعیت‌های خرید با کل خدمات در منبع تطبیق ندارد.',
      );
    const value =
      intent.key === 'purchases'
        ? m.total
        : intent.key === 'pending'
          ? m.unregistered
          : intent.key === 'registered'
            ? m.registered
            : m.unknown;
    return answer(
      show(intent.label, value),
      'reservations.purchases.summary',
      routes.purchases,
    );
  }
  if (
    !canViewRoute(actor.permissions, routes.calls) ||
    !actor.permissions.includes('customer_affairs.call_center.read')
  )
    return denied();
  const first = actor.branchIds[0];
  if (!first || !z.string().uuid().safeParse(first).success) return denied();
  const current = branches.parse(
    await read('/customer-affairs/call-center/branches', undefined, first),
  );
  const branch = resolvedCallCenterBranch(actor.branchIds, current);
  if (!branch)
    return issue(
      'unavailable',
      'شعبهٔ جاری کال‌سنتر در محدودهٔ مجاز مشخص نیست.',
    );
  const { data, meta } = kpis.parse(
    await read('/customer-affairs/call-center/kpis', undefined, branch),
  );
  if (meta.branchId !== branch)
    return issue(
      'unavailable',
      'شعبهٔ کارت کال‌سنتر با شعبهٔ مجاز انتخاب‌شده مطابقت ندارد.',
    );
  if (
    intent.key !== 'today' &&
    intent.key !== 'week' &&
    intent.key !== 'withoutOutcome' &&
    intent.key !== 'needsFollowUp'
  )
    return issue('unavailable', 'منبع این شاخص در دسترس نیست.');
  return answer(
    show(intent.label, data[intent.key]) + ' در شعبهٔ جاری کال‌سنتر',
    'call-center.kpis',
    routes.calls,
    meta.asOf,
  );
}
