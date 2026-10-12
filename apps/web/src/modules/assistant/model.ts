import { z } from 'zod';

export const assistantViews = [
  'overview',
  'sales',
  'finance',
  'news',
  'scenarios',
  'advisor',
] as const;
export type AssistantView = (typeof assistantViews)[number];
export function assistantView(value: unknown): AssistantView {
  return typeof value === 'string' &&
    assistantViews.includes(value as AssistantView)
    ? (value as AssistantView)
    : 'overview';
}
const source = z.enum(['calendar', 'notes', 'procurement']);
const safeHref = z
  .string()
  .max(500)
  .refine(
    (href) =>
      href === '/workbench?tab=calendar' ||
      href === '/workbench?tab=notes' ||
      /^\/purchases\?section=requests&request=[A-Za-z0-9%_.~-]+$/.test(href),
  );
export const snapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  scope: z.literal('SELF'),
  sources: z
    .array(
      z.object({
        id: source,
        status: z.enum(['READY', 'UNAVAILABLE']),
        asOf: z.iso.datetime().nullable(),
        truncated: z.boolean(),
      }),
    )
    .length(3)
    .refine((items) => new Set(items.map((item) => item.id)).size === 3),
  followUps: z
    .array(
      z.object({
        id: z.string().max(120),
        title: z.string().max(200),
        source,
        dueAt: z.iso.datetime().nullable(),
        reason: z.enum(['ASSIGNED', 'OVERDUE', 'DUE_SOON']),
        href: safeHref,
      }),
    )
    .max(30),
  truncated: z.boolean(),
  capabilities: z.object({
    forecasting: z.literal(false),
    news: z.literal(false),
    scenarios: z.literal(false),
    llm: z.literal(false),
    writes: z.literal(false),
  }),
});
export type ExecutiveSnapshot = z.infer<typeof snapshotSchema>;
export const assistantActions = [
  'daily-summary',
  'sales-analysis',
  'receivables-follow-up',
] as const;
export type AssistantAction = (typeof assistantActions)[number];
const dailySchema = z
  .object({
    version: z.literal(1),
    action: z.literal('daily-summary'),
    status: z.enum(['READY', 'PARTIAL']),
    scope: z.literal('SELF'),
    coverage: z.object({
      horizonDays: z.literal(7),
      limit: z.literal(30),
      includesOverdue: z.literal(true),
    }),
    counts: z.object({
      visible: z.number().int().min(0).max(30),
      overdue: z.number().int().min(0).max(30),
      dueSoon: z.number().int().min(0).max(30),
      assigned: z.number().int().min(0).max(30),
    }),
    recommendations: z
      .array(
        z.object({
          followUpId: z.string().max(120),
          ruleId: z.enum(['OVERDUE_V1', 'DUE_SOON_V1', 'ASSIGNED_V1']),
          priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        }),
      )
      .max(30),
    snapshot: snapshotSchema,
  })
  .refine(
    (value) => {
      const items = value.snapshot.followUps;
      return (
        new Set(items.map((item) => item.id)).size === items.length &&
        items.every((item) =>
          value.snapshot.sources.some(
            (source) => source.id === item.source && source.status === 'READY',
          ),
        ) &&
        value.counts.visible === items.length &&
        value.counts.overdue ===
          items.filter((item) => item.reason === 'OVERDUE').length &&
        value.counts.dueSoon ===
          items.filter((item) => item.reason === 'DUE_SOON').length &&
        value.counts.assigned ===
          items.filter((item) => item.reason === 'ASSIGNED').length &&
        value.recommendations.length === items.length &&
        value.recommendations.every((recommendation, index) => {
          const item = items[index]!;
          return (
            recommendation.followUpId === item.id &&
            recommendation.ruleId === `${item.reason}_V1` &&
            recommendation.priority ===
              (item.reason === 'OVERDUE'
                ? 'HIGH'
                : item.reason === 'DUE_SOON'
                  ? 'MEDIUM'
                  : 'LOW')
          );
        }) &&
        (value.status === 'READY') ===
          value.snapshot.sources.every((source) => source.status === 'READY')
      );
    },
    { message: 'Summary must reconcile with bounded source evidence' },
  );
const blockedSchema = z.discriminatedUnion('action', [
  z.object({
    version: z.literal(1),
    action: z.literal('sales-analysis'),
    status: z.literal('BLOCKED'),
    scope: z.literal('NONE'),
    reason: z.literal('SALES_SOURCE_UNAVAILABLE'),
    failure: z
      .enum([
        'SOURCE_NOT_CONNECTED',
        'SOURCE_NOT_READY',
        'SOURCE_CAP_EXCEEDED',
        'SOURCE_TOO_LARGE',
        'INVALID_SOURCE',
        'SOURCE_TIMEOUT',
        'SOURCE_UNAVAILABLE',
      ])
      .optional(),
    observedAt: z.iso.datetime(),
  }),
  z.object({
    version: z.literal(1),
    action: z.literal('receivables-follow-up'),
    status: z.literal('BLOCKED'),
    scope: z.literal('NONE'),
    reason: z.literal('RECEIVABLES_SOURCE_PENDING'),
    failure: z
      .enum([
        'SOURCE_NOT_CONNECTED',
        'SOURCE_NOT_READY',
        'SOURCE_CAP_EXCEEDED',
        'SOURCE_TOO_LARGE',
        'INVALID_SOURCE',
        'SOURCE_TIMEOUT',
        'SOURCE_UNAVAILABLE',
      ])
      .optional(),
    observedAt: z.iso.datetime(),
  }),
]);
const salesPeriod = z
  .object({
    contractAmountsBeforeRefunds: z
      .array(
        z.object({
          currencyCode: z.string().regex(/^[A-Z]{3}$/),
          amount: z.string().regex(/^-?\d{1,24}(?:\.\d{1,4})?$/),
        }),
      )
      .max(100)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.currencyCode)).size === rows.length,
      )
      .optional(),
    startUtc: z.iso.datetime(),
    endUtc: z.iso.datetime(),
    contractCount: z.number().int().min(0).max(5000),
    passengerCount: z.number().int().nonnegative(),
    routes: z
      .array(
        z.object({
          originId: z.uuid(),
          destinationId: z.uuid(),
          originName: z.string().trim().min(1).max(200).nullable(),
          destinationName: z.string().trim().min(1).max(200).nullable(),
          contractCount: z.number().int().positive(),
          passengerCount: z.number().int().nonnegative(),
        }),
      )
      .max(5000),
  })
  .refine(
    (period) =>
      period.routes.reduce((total, row) => total + row.contractCount, 0) ===
        period.contractCount &&
      period.routes.reduce((total, row) => total + row.passengerCount, 0) ===
        period.passengerCount &&
      new Set(
        period.routes.map((row) => `${row.originId}:${row.destinationId}`),
      ).size === period.routes.length &&
      (Date.parse(period.endUtc) - Date.parse(period.startUtc)) / 86400000 >=
        6.95 &&
      (Date.parse(period.endUtc) - Date.parse(period.startUtc)) / 86400000 <=
        7.05,
  );
const conversionPeriod = z
  .object({
    startUtc: z.iso.datetime(),
    endUtc: z.iso.datetime(),
    contactedLeads: z.number().int().min(0).max(5000),
    convertedLeads: z.number().int().min(0).max(5000),
    conversionBasisPoints: z.number().int().min(0).max(10000).nullable(),
  })
  .refine(
    (period) =>
      period.convertedLeads <= period.contactedLeads &&
      period.conversionBasisPoints ===
        (period.contactedLeads
          ? Math.round((period.convertedLeads * 10000) / period.contactedLeads)
          : null) &&
      Math.abs(
        (Date.parse(period.endUtc) - Date.parse(period.startUtc)) / 86400000 -
          7,
      ) <= 0.05,
  );
const conversionReport = z
  .object({
    version: z.literal(1),
    source: z.literal('customer-affairs.assistant.call-conversion.v1'),
    scope: z.literal('AUTHORIZED_BRANCHES'),
    branchCount: z.number().int().nonnegative(),
    timeZone: z.literal('Asia/Tehran'),
    observedAt: z.iso.datetime(),
    sourceUpdatedAt: z.iso.datetime().nullable(),
    current: conversionPeriod,
    previous: conversionPeriod,
    basis: z.literal(
      'UNIQUE_LEADS_WITH_LOGGED_CALL_TO_ACCEPTED_CONFIRMED_CONTRACT_AS_OF_REQUEST',
    ),
    coverage: z.object({
      rowLimitPerPeriod: z.literal(5000),
      answeredCallVerified: z.literal(false),
      attributionComplete: z.literal(false),
    }),
  })
  .refine((report) => report.previous.endUtc === report.current.startUtc);
const conversionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('READY'), report: conversionReport }),
  z.object({ status: z.literal('DENIED') }),
  z.object({ status: z.literal('UNAVAILABLE') }),
]);
const salesSchema = z.object({
  conversion: conversionSchema.optional(),
  version: z.literal(1),
  action: z.literal('sales-analysis'),
  status: z.literal('PARTIAL'),
  scope: z.literal('ALL_AUTHORIZED_SALES'),
  report: z
    .object({
      version: z.literal(1),
      source: z.literal('sales.assistant.weekly.v1'),
      scope: z.literal('ALL_AUTHORIZED_SALES'),
      timeBasis: z.literal('CREATED_AT'),
      timeZone: z.literal('Asia/Tehran'),
      observedAt: z.iso.datetime(),
      sourceUpdatedAt: z.iso.datetime().nullable(),
      routeNamesComplete: z.boolean(),
      current: salesPeriod,
      previous: salesPeriod,
      coverage: z.object({
        rowLimit: z.literal(5000),
        routeBasis: z.literal('PRIMARY_CONTRACT_ROUTE'),
        truncated: z.literal(false),
      }),
      unavailable: z.tuple([
        z.literal('NET_SALES_REFUND_SOURCE_PENDING'),
        z.literal('CONTACT_COHORT_SOURCE_PENDING'),
        z.literal('MULTI_ROUTE_PROJECTION_PENDING'),
      ]),
    })
    .refine(
      (report) =>
        report.previous.endUtc === report.current.startUtc &&
        report.current.contractCount + report.previous.contractCount <= 5000 &&
        report.routeNamesComplete ===
          [...report.current.routes, ...report.previous.routes].every(
            (row) => row.originName !== null && row.destinationName !== null,
          ),
    ),
});
const exactAmount = z.string().regex(/^-?\d{1,24}(?:\.\d{1,4})?$/);
const amountUnits = (value: string) => {
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  return (
    (value.startsWith('-') ? -1n : 1n) * BigInt(whole + fraction.padEnd(4, '0'))
  );
};
const contractBalance = z
  .object({
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    amount: exactAmount,
    confirmedPaid: exactAmount,
    pendingFinance: exactAmount,
    outstanding: exactAmount,
  })
  .refine(
    (row) =>
      amountUnits(row.confirmedPaid) >= 0n &&
      amountUnits(row.pendingFinance) >= 0n &&
      amountUnits(row.amount) - amountUnits(row.confirmedPaid) ===
        amountUnits(row.outstanding),
  );
const balances = z
  .array(contractBalance)
  .max(100)
  .refine(
    (rows) => new Set(rows.map((row) => row.currencyCode)).size === rows.length,
  );
const balanceSchema = z.object({
  version: z.literal(1),
  action: z.literal('receivables-follow-up'),
  status: z.literal('PARTIAL'),
  scope: z.literal('ALL_AUTHORIZED_SALES'),
  report: z
    .object({
      version: z.literal(1),
      source: z.literal('sales.assistant.contract-balances.v1'),
      scope: z.literal('ALL_AUTHORIZED_SALES'),
      observedAt: z.iso.datetime(),
      sourceUpdatedAt: z.iso.datetime().nullable(),
      contractCount: z.number().int().min(0).max(5000),
      totals: balances,
      items: z
        .array(
          z.object({
            contractId: z.uuid(),
            contractNumber: z.string().min(1).max(40),
            href: z.literal('/sales'),
            balances: balances.refine((rows) =>
              rows.some((row) => amountUnits(row.outstanding) > 0n),
            ),
          }),
        )
        .max(30),
      coverage: z.object({
        rowLimit: z.literal(5000),
        itemLimit: z.literal(30),
        itemsTruncated: z.boolean(),
        basis: z.literal('CURRENT_CONFIRMED_CONTRACTS'),
        refundsIncluded: z.literal(false),
      }),
      unavailable: z.tuple([
        z.literal('ACCOUNTING_RECEIVABLES_SOURCE_PENDING'),
        z.literal('DUE_SCHEDULE_SOURCE_PENDING'),
        z.literal('REFUND_ADJUSTMENT_SOURCE_PENDING'),
      ]),
    })
    .refine(
      (report) =>
        report.items.length <= report.contractCount &&
        new Set(report.items.map((row) => row.contractId)).size ===
          report.items.length &&
        (!report.coverage.itemsTruncated || report.items.length === 30),
    ),
});
export const assistantActionSchema = z.union([
  dailySchema.safeExtend({
    corporate: z
      .object({
        sales: z.discriminatedUnion('status', [
          z.object({
            status: z.literal('READY'),
            report: salesSchema.shape.report,
          }),
          z.object({ status: z.literal('DENIED') }),
          z.object({ status: z.literal('UNAVAILABLE') }),
        ]),
        balances: z.discriminatedUnion('status', [
          z.object({
            status: z.literal('READY'),
            report: balanceSchema.shape.report,
          }),
          z.object({ status: z.literal('DENIED') }),
          z.object({ status: z.literal('UNAVAILABLE') }),
        ]),
      })
      .optional(),
  }),
  blockedSchema,
  salesSchema,
  balanceSchema,
]);
export type AssistantActionResult = z.infer<typeof assistantActionSchema>;

export async function loadAssistantAction(
  action: AssistantAction,
  signal: AbortSignal,
): Promise<AssistantActionResult> {
  const response = await fetch(`/api/assistant/actions/${action}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok)
    throw new Error(
      [401, 403, 429].includes(response.status)
        ? `HTTP_${response.status}`
        : 'UNAVAILABLE',
    );
  const parsed = assistantActionSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.action !== action)
    throw new Error('INVALID_RESPONSE');
  return parsed.data;
}
export type AssistantLoadState =
  | 'loading'
  | 'ready'
  | 'not-configured'
  | 'unavailable'
  | 'forbidden'
  | 'unauthenticated'
  | 'rate-limited';

export async function loadExecutiveSnapshot(
  signal: AbortSignal,
): Promise<{ state: AssistantLoadState; snapshot: ExecutiveSnapshot | null }> {
  const response = await fetch('/api/assistant/executive', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    if (response.status === 401)
      return { state: 'unauthenticated', snapshot: null };
    if (response.status === 403) return { state: 'forbidden', snapshot: null };
    if (response.status === 429)
      return { state: 'rate-limited', snapshot: null };
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    return {
      state:
        body?.error?.code === 'NOT_CONFIGURED'
          ? 'not-configured'
          : 'unavailable',
      snapshot: null,
    };
  }
  const parsed = snapshotSchema.safeParse(await response.json());
  return parsed.success
    ? { state: 'ready', snapshot: parsed.data }
    : { state: 'unavailable', snapshot: null };
}
