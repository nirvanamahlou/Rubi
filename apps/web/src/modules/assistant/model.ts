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
    reason: z.literal('SALES_DEFINITION_REQUIRED'),
    observedAt: z.iso.datetime(),
  }),
  z.object({
    version: z.literal(1),
    action: z.literal('receivables-follow-up'),
    status: z.literal('BLOCKED'),
    scope: z.literal('NONE'),
    reason: z.literal('RECEIVABLES_SOURCE_PENDING'),
    observedAt: z.iso.datetime(),
  }),
]);
export const assistantActionSchema = z.union([dailySchema, blockedSchema]);
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
