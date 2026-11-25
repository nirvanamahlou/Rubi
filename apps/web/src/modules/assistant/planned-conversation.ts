import { canOpenAssistantGuide } from './guide-access';
import { canViewScreen, type WorkbenchRequestItemV1 } from '@nora/contracts';
import { z } from 'zod';
import { agentResponseSchema } from './agent-response';
import { pilotGuideResponse } from './guide-pilot';
import { resolveDocumentedWorkflow } from './catalogue-search';
import { assistantGuideSection } from './assistant-guide-registry';
import {
  planQuestion,
  classify,
  mightNeedModelPlan,
  type PlannedRead,
} from './question-plan';
import { plannedAnswer, type AnswerPart } from './planned-answer';
import {
  resolveOperationalMetric,
  formatOperationalMetric,
} from './operational-metrics';
import {
  describeWorkbenchRequest,
  ownRequestLookup,
} from './workbench-request-guide';
import { proxyPlannedSales, proxyQuestionPlan } from './proxy';
import { normalizeQuestion } from './question-text';
import { describeReportSources } from './report-source-discovery';
import { runNativeReport } from './planned-native-report';
import { runOperationalPanel } from './planned-operational';
import {
  standardSalesIntent,
  standardSalesAnswer,
} from './standard-sales-summary';
import {
  analyticalSalesSources,
  ownContractCountIntent,
} from './planned-sales-intent';

const inputSchema = z
  .object({
    version: z.literal(3),
    message: z.string().trim().min(1).max(4000),
    previous: z.string().max(4000).optional(),
    salesPeriodAsOf: z.string().datetime().optional(),
  })
  .strict();

const response = (status: number, data?: unknown) =>
  new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'content-type': 'application/json',
    },
  });
const actorSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  permissions: z.array(z.string()),
  branchIds: z.array(z.string()),
});
class ReadError extends Error {
  constructor(readonly status: number) {
    super('ERP_READ_FAILED');
  }
}

export async function runPlannedConversation(
  request: Request,
  raw: string,
  cookie: string,
) {
  let input: z.infer<typeof inputSchema>;
  try {
    input = inputSchema.parse(JSON.parse(raw));
  } catch {
    return response(400);
  }
  let plan = planQuestion(input.message, input.previous);
  if (process.env.NORA_COMPOSITION_ENABLED === 'false') return response(204);
  const useModel =
    (!plan.length || plan.some((step) => step.kind === 'unknown')) &&
    process.env.NORA_MODEL_PLANNER_ENABLED === 'true' &&
    mightNeedModelPlan(
      input.message,
      resolveDocumentedWorkflow(input.message).length > 0,
    );
  if (!plan.length && !useModel) return response(204);
  const base = (
    process.env.NORA_ERP_API_BASE_URL || process.env.ERP_API_BASE_URL
  )?.replace(/\/$/, '');
  if (!base) return response(503);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)]);
  // All destinations below are fixed owner routes. Client input never selects an HTTP destination.
  async function read(path: string, body?: unknown, branchId?: string) {
    if (branchId && !firstBranches?.has(branchId)) throw new ReadError(403);
    const result = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie,
        accept: 'application/json',
        ...(branchId ? { 'x-branch-id': branchId } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!result.ok) throw new ReadError(result.status);
    return result.json();
  }
  async function scope() {
    const actor = actorSchema.parse(await read('/iam/auth/access'));
    const company = actor.permissions.includes('legal-entity.read')
      ? z
          .object({
            data: z.object({
              selection: z.string(),
              version: z.number().int(),
            }),
          })
          .parse(await read('/legal-entities/context')).data
      : null;
    return {
      actor,
      company,
      key: JSON.stringify([
        actor.userId,
        actor.sessionId,
        actor.permissions.slice().sort(),
        actor.branchIds.slice().sort(),
        company,
      ]),
    };
  }
  const issue = (
    step: PlannedRead,
    status: AnswerPart['status'],
    text: string,
  ): AnswerPart => ({ question: step.question, status, text, links: [] });
  let firstBranches: Set<string> | undefined;
  try {
    const first = await scope();
    firstBranches = new Set(first.actor.branchIds);
    const assistantRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    });
    if (useModel) {
      const plannerRequest = new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
      });
      const result = await proxyQuestionPlan(plannerRequest, input.message);
      if ([401, 403].includes(result.status)) return response(result.status);
      if (result.ok) {
        const segmented = z
          .object({
            version: z.literal(1),
            parts: z.array(z.string().min(1).max(4000)).max(5),
          })
          .safeParse(await result.json().catch(() => null));
        if (segmented.success && segmented.data.parts.length >= 2) {
          const proposed = segmented.data.parts.map(classify);
          if (
            !plan.length ||
            proposed.filter((s) => s.kind !== 'unknown').length >
              plan.filter((s) => s.kind !== 'unknown').length
          )
            plan = proposed;
        }
      }
      if (!plan.length) return response(204);
    }
    const canOpen = (href: string, permission?: string) =>
      canOpenAssistantGuide(first.actor.permissions, href, permission);
    const configuredTools = process.env.NORA_COMPOSITION_TOOLS;
    const enabledTools =
      configuredTools === undefined
        ? null
        : new Set(configuredTools.split(',').map((name) => name.trim()));
    async function execute(step: PlannedRead): Promise<AnswerPart[]> {
      const { question } = step;
      if (enabledTools && !enabledTools.has(step.kind))
        return [
          issue(
            step,
            'unavailable',
            'این بخش از پاسخ ترکیبی هنوز فعال نشده است.',
          ),
        ];
      try {
        if (step.kind === 'guide') {
          const voucherFollowup =
            plan.some((s) => s.kind === 'settled-vouchers') &&
            /^(?:از کجا|چطور) پیگیری/.test(normalizeQuestion(question));
          const lookup = question;
          const voucherGuide = assistantGuideSection(
            'reservations',
            'settled-vouchers',
          );
          const sections =
            voucherFollowup && voucherGuide
              ? [voucherGuide]
              : resolveDocumentedWorkflow(lookup);
          const selected = sections.length
            ? sections.filter((s) => canOpen(s.href, s.permission))
            : pilotGuideResponse(lookup, '', undefined, canOpen).sections;
          if (
            !selected.length ||
            (sections.length && selected.length !== sections.length)
          )
            return [
              issue(
                step,
                'unavailable',
                'برای این بخش، راهنمای مجاز و قابل استنادی پیدا نشد.',
              ),
            ];
          return selected.map((s) => ({
            question,
            status: 'answer',
            text: [
              s.title,
              (s.route ?? ('path' in s ? s.path : []))?.join(' ← '),
              ...(s.conditions ?? []),
              ...s.steps
                .filter((line) => !s.conditions?.includes(line))
                .map((line, i) => i + 1 + '. ' + line),
            ]
              .filter(Boolean)
              .join('\n'),
            links: [
              { href: s.href, label: s.title },
              { href: s.guideHref, label: 'خواندن راهنما' },
            ],
            source: s.guideHref,
          }));
        }
        if (step.kind === 'operational')
          return [
            await runOperationalPanel(
              question,
              first.actor,
              first.company,
              read,
            ),
          ];
        if (step.kind === 'report') {
          if (
            first.company?.selection === 'ALL' &&
            !first.actor.permissions.includes('legal-entity.aggregate.read')
          )
            return [
              issue(step, 'denied', 'خواندن این بخش برای حساب فعلی مجاز نیست.'),
            ];
          return [await runNativeReport(question, first.company, read)];
        }
        if (step.kind === 'metric') {
          const metric = resolveOperationalMetric(question);
          if (metric && 'topic' in metric) {
            const text = await describeReportSources(
              metric.topic,
              await read('/reports/catalog'),
            );
            return [
              {
                question,
                status: text.includes('پیدا نشد') ? 'empty' : 'answer',
                text,
                links: [],
                source: 'reports/catalog',
                observedAt: new Date().toISOString(),
              },
            ];
          }
          if (!metric)
            return [
              issue(
                step,
                'unavailable',
                'برای این بخش شاخص قابل اجرا پیدا نشد.',
              ),
            ];
          if (!metric.period)
            return [
              issue(
                step,
                'clarify',
                'بازهٔ گزارش را مشخص کنید. امروز، هفتهٔ جاری یا ماه جاری؟',
              ),
            ];
          const query = new URLSearchParams({
            id: metric.metric.id,
            range: metric.period.range,
            aggregate: String(first.company?.selection === 'ALL'),
          });
          const result = await read('/reports/nora/metric?' + query);
          const text = formatOperationalMetric(metric, result);
          if (
            result?.scope === 'aggregate-required' ||
            !text.includes(metric.metric.label)
          )
            return [issue(step, 'unavailable', text)];
          return [
            {
              question,
              status: 'answer',
              text,
              links: [],
              source: metric.metric.id,
              observedAt: new Date().toISOString(),
            },
          ];
        }
        if (step.kind === 'request') {
          if (!canViewScreen(first.actor.permissions, 'workbench.tab.requests'))
            return [
              issue(step, 'denied', 'خواندن این بخش برای حساب فعلی مجاز نیست.'),
            ];
          const lookup = ownRequestLookup(question);
          const askCode = () =>
            issue(step, 'clarify', 'کد پیگیری یک درخواست را بفرستید.');
          if (!lookup) return [askCode()];
          const tracking = lookup.trackingNumber;
          const result = await read(
            '/customer-affairs/workbench/requests/mine' +
              (tracking
                ? '?trackingNumber=' + encodeURIComponent(tracking)
                : ''),
          );
          if (
            !Array.isArray(result?.data) ||
            result?.meta?.ownership !== 'mine' ||
            typeof result.meta.hasMore !== 'boolean'
          )
            throw new Error('INVALID_ROWS');
          if (result.meta.hasMore) return [askCode()];
          const ownRows = result.data as WorkbenchRequestItemV1[];
          if (
            ownRows.some(
              (row) =>
                !['self', 'outgoing'].includes(row.direction) ||
                typeof row.trackingNumber !== 'string' ||
                (tracking && row.trackingNumber !== tracking),
            )
          )
            throw new Error('INVALID_OWN_REQUEST');
          const reply = describeWorkbenchRequest(
            question,
            ownRows.filter(
              (row) =>
                (!/مرخصی/.test(question) || row.leave) &&
                (!/م[اأ]موریت/.test(question) || row.mission),
            ),
          );
          const status = reply.text.startsWith('چند درخواست')
            ? 'clarify'
            : reply.text.includes('پیدا نشد')
              ? 'empty'
              : 'answer';
          return [
            {
              question,
              status,
              text: reply.text,
              links: [{ href: reply.href, label: 'کارتابل درخواست‌ها' }],
              source: 'customer-affairs/workbench/requests/mine',
              observedAt: new Date().toISOString(),
            },
          ];
        }
        if (step.kind === 'settled-vouchers') {
          // This owner report has no date, branch, customer or hotel filters.
          const remaining = normalizeQuestion(question)
            .replace(
              /(?:کدام|کدوم|قراردادها(?:ی|یی)?|قرارداد|هایی|های|تسویه|شده(?:اند)?|هنوز|بدون|فاقد|واچر|هتل|اقامت|ندار(?:ند|ن|د)?|نگرفت(?:ه|ن)|صادر نشده|رو|را|بده|بگو|فهرست|لیست|داریم|هستند|کدوم(?:ا|اشون)?|میشه|می شه|ببینم|لطفا|نمایش|بدهید|که|ی)(?=\s|$)/gu,
              '',
            )
            .trim();
          if (remaining)
            return [
              issue(
                step,
                'clarify',
                'این گزارش، اقامت‌های پرونده‌های تسویه‌شده را در دامنهٔ فعلی نشان می‌دهد. فیلتر دیگری در این خوانش پشتیبانی نمی‌شود.',
              ),
            ];
          return [await settledVouchers(step, read)];
        }
        if (step.kind === 'sales' || step.kind === 'rolling-sales') {
          if (!canOpen('/sales'))
            return [
              issue(
                step,
                'denied',
                'دسترسی به گزارش فروش برای این حساب تأیید نشد.',
              ),
            ];
          const standard =
            step.kind === 'sales' && standardSalesIntent(question);
          if (standard) {
            if (
              /(?:همه شرکت ها|کل شرکت های مجاز)/u.test(
                normalizeQuestion(question),
              ) &&
              first.company?.selection !== 'ALL'
            )
              return [
                issue(
                  step,
                  'clarify',
                  'برای شمارش در همهٔ شرکت‌های مجاز، ابتدا نمای «همه شرکت‌ها» را انتخاب کنید.',
                ),
              ];
            return [await standardSalesAnswer(question, standard, read)];
          }
          const ownCount =
            step.kind === 'sales' && ownContractCountIntent(question);
          if (ownCount === 'qualified')
            return [
              issue(
                step,
                'clarify',
                'شمارش قراردادهای خودتان برای همهٔ وضعیت‌ها در محدودهٔ فعلی در دسترس است. تعداد بدون فیلتر اضافه را می‌خواهید؟',
              ),
            ];
          if (ownCount === 'all-time') {
            if (
              /(?:همه شرکت ها|کل شرکت های مجاز)/u.test(
                normalizeQuestion(question),
              ) &&
              first.company?.selection !== 'ALL'
            ) {
              return [
                issue(
                  step,
                  'clarify',
                  'برای شمارش در همهٔ شرکت‌های مجاز، ابتدا نمای «همه شرکت‌ها» را انتخاب کنید.',
                ),
              ];
            }
            const receipt = z
              .object({
                version: z.literal(1),
                ownership: z.literal('mine'),
                observedAt: z.string().datetime(),
                total: z.number().int().nonnegative(),
                panelNonCancelled: z.number().int().nonnegative(),
              })
              .refine((r) => r.panelNonCancelled <= r.total)
              .parse(await read('/sales/assistant-agent/my-contract-count'));
            const countLabel =
              'تعداد قراردادهای خودتان با احتساب همهٔ وضعیت‌ها';
            const panelLabel =
              'تعداد قراردادهای خودتان در فهرست غیرابطال‌شدهٔ فروش';
            return [
              {
                question,
                status: receipt.total ? 'answer' : 'empty',
                text:
                  countLabel +
                  ': ' +
                  receipt.total.toLocaleString('fa-IR') +
                  '\n' +
                  panelLabel +
                  ': ' +
                  receipt.panelNonCancelled.toLocaleString('fa-IR'),
                links: [],
                source: 'sales/assistant-agent/my-contract-count',
                observedAt: receipt.observedAt,
              },
            ];
          }
          const usePrior = input.salesPeriodAsOf && step.reuseSalesCutoff;
          const result = await proxyPlannedSales(assistantRequest, {
            message: question,
            ...(usePrior && step.kind === 'rolling-sales'
              ? { context: { salesPeriodAsOf: input.salesPeriodAsOf! } }
              : {}),
          });
          if (!result.ok) throw new ReadError(result.status);
          const answer = agentResponseSchema.parse(await result.json());
          const cited = new Set(
            answer.sources.flatMap((entry) => entry.sources),
          );
          if (
            answer.status === 'REPLY' ||
            (answer.status === 'ANSWER' &&
              (!answer.sources.length ||
                (step.kind === 'sales' &&
                  analyticalSalesSources(question).some(
                    (source) => !cited.has(source),
                  ))))
          )
            return [
              issue(
                step,
                'unavailable',
                'منبع دادهٔ قابل استناد برای این سؤال در دسترس نیست.',
              ),
            ];
          const links = answer.reportHref
            ? [{ href: answer.reportHref, label: 'مشاهدهٔ گزارش کامل' }]
            : [];
          const facts = {
            question,
            links,
            source: answer.sources.map((s) => s.resultId).join(', '),
            observedAt: answer.sources[0]?.observedAt,
          };
          if (answer.reportParts) {
            const coverage = answer.reportCoverage;
            return Object.entries(answer.reportParts).flatMap(
              ([name, text]) => {
                if (!text) return [];
                const partial = coverage
                  ? coverage.missingAmounts > 0 ||
                    (name === 'summary'
                      ? coverage.currencyTotalsOmitted
                      : coverage.truncated || coverage.rowCurrenciesOmitted)
                  : Boolean(
                      answer.limitations.length ||
                      answer.sources.some((s) => s.truncated),
                    );
                return [
                  {
                    ...facts,
                    status:
                      coverage?.total === 0
                        ? ('empty' as const)
                        : partial
                          ? ('partial' as const)
                          : ('answer' as const),
                    text,
                  },
                ];
              },
            );
          }
          return [
            {
              ...facts,
              status:
                answer.status === 'CLARIFY'
                  ? 'clarify'
                  : answer.limitations.length ||
                      answer.sources.some((s) => s.truncated)
                    ? 'partial'
                    : 'answer',
              text: [answer.text, ...answer.limitations].join('\n'),
            },
          ];
        }
        return [
          issue(
            step,
            'unavailable',
            'برای این بخش از پرسش، منبع اجرایی مشخص نشد.',
          ),
        ];
      } catch (e) {
        if (signal.aborted || (e instanceof ReadError && e.status === 401))
          throw e;
        return [
          e instanceof ReadError && e.status === 403
            ? issue(step, 'denied', 'خواندن این بخش برای حساب فعلی مجاز نیست.')
            : issue(
                step,
                'unavailable',
                'دریافت پاسخ این بخش از ERP ممکن نشد.',
              ),
        ];
      }
    }
    const executed = await Promise.all(
      plan.map(async (step) => {
        const started = Date.now();
        const parts = await execute(step);
        if (process.env.NORA_COMPOSITION_TELEMETRY === 'true')
          console.info(
            JSON.stringify({
              event: 'nora.composition.part',
              tool: step.kind,
              status: parts.map((p) => p.status),
              durationMs: Date.now() - started,
            }),
          );
        return parts;
      }),
    );
    const parts = executed.flat();
    if (first.key !== (await scope()).key) return response(409);
    return response(200, plannedAnswer.parse({ version: 3, parts }));
  } catch (e) {
    return response(
      e instanceof ReadError && [401, 403].includes(e.status) ? e.status : 503,
    );
  }
}

async function settledVouchers(
  step: PlannedRead,
  read: (path: string) => Promise<unknown>,
): Promise<AnswerPart> {
  const schema = z.object({
    version: z.literal(1),
    observedAt: z.string().datetime(),
    total: z.number().int().nonnegative(),
    unknownStayCount: z.number().int().nonnegative(),
    rows: z
      .array(
        z.object({
          contractNumber: z.string(),
          hotelName: z.string().nullable(),
        }),
      )
      .max(10),
  });
  const report = schema.parse(
    await read('/reports/nora/settled-vouchers?page=1&pageSize=10'),
  );
  if (report.rows.length !== Math.min(report.total, 10))
    throw new Error('INVALID_VOUCHER_PAGE');
  const truncated = report.rows.length < report.total;
  const text = [
    'اقامت‌های بدون واچر در قراردادهای تسویه‌شده: ' +
      report.total.toLocaleString('fa-IR'),
    ...report.rows.map((r) => r.contractNumber + ' — ' + (r.hotelName ?? '—')),
    ...(truncated
      ? ['۱۰ ردیف اول نمایش داده شد. سایر اقامت‌ها در گزارش کامل در دسترس‌اند.']
      : []),
    ...(report.unknownStayCount
      ? [
          'وضعیت واچر برای ' +
            report.unknownStayCount.toLocaleString('fa-IR') +
            ' اقامت از سوابق موجود قابل تعیین نیست.',
        ]
      : []),
  ].join('\n');
  return {
    question: step.question,
    status:
      report.unknownStayCount || truncated
        ? 'partial'
        : report.total
          ? 'answer'
          : 'empty',
    text,
    links: [
      {
        href: '/reservations?report=settled-vouchers',
        label: 'مشاهدهٔ گزارش کامل',
      },
    ],
    source: 'reports/nora/settled-vouchers',
    observedAt: report.observedAt,
  };
}
