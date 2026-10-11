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
