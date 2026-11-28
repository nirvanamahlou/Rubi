import { z } from 'zod';
import { normalizeQuestion } from './question-text';
import type { AnswerPart } from './planned-answer';
const knownCurrencies = new Set(Intl.supportedValuesOf('currency'));

/** Accept only the owner metric, all time, with optional money-currency selection. */
export function standardSalesIntent(question: string) {
  const text = normalizeQuestion(question);
  if (
    !/فروش استاندارد|فروش قراردادی استاندارد/u.test(text) ||
    /چطور|چگونه|از کجا|آموزش|نحوه|مراحل|راهنما/u.test(text)
  )
    return null;
  const wordCurrencies = text.match(/\b[a-z]{3}\b/gu) ?? [];
  const named = [
    ...text.matchAll(/(?:^| )(دلار(?:ی)?|ریال(?:ی)?|یورو(?:یی)?)(?= |$)/gu),
  ].map((m) =>
    m[1]!.startsWith('دلار') ? 'USD' : m[1]!.startsWith('ریال') ? 'IRR' : 'EUR',
  );
  const currencies = [
    ...new Set([...wordCurrencies.map((code) => code.toUpperCase()), ...named]),
  ];
  const asksMoney =
    /مبلغ|مبالغ|ارز|جمع|مجموع/u.test(text) || currencies.length > 0;
  const asksCount = /تعداد|بشمار|چند(?:تا| تا)?/u.test(text);
  const cleaned = text
    .replace(
      /(?:صرف نظر از|به جز|بدون|با حذف) (?:پیش نویس(?: ها|ها)?|لغو(?: شده|شده)?(?: ها|ها)?|ابطال(?: شده|شده)?(?: ها|ها)?|در انتظار (?:تایید|تأیید))(?:(?: و | )(?:پیش نویس(?: ها|ها)?|لغو(?: شده|شده)?(?: ها|ها)?|ابطال(?: شده|شده)?(?: ها|ها)?|در انتظار (?:تایید|تأیید)))*/gu,
      ' ',
    )
    .replace(
      /(?:در|برای) (?:همه زمان ها|تمام زمان ها|همه دوره ها|کل دوره|تمام دوره)|از ابتدا(?: تا (?:حالا|الان|امروز))?|بدون (?:محدودیت|فیلتر) زمانی|به تفکیک ارز|در (?:همه شرکت ها|کل شرکت های مجاز)|با انتخاب همه شرکت ها/gu,
      ' ',
    )
    .replace(/\b[a-z]{3}\b|دلار(?:ی)?|ریال(?:ی)?|یورو(?:یی)?/gu, ' ');
  const supported = cleaned
    .trim()
    .split(/\s+/u)
    .every((w) =>
      /^(?:لطفا|تعداد|بشمار|جمع|مجموع|مبلغ|مبالغ|ارز|کل|قرارداد(?:ها(?:ی)?|ی)?|فروش|استاندارد|های|چقدر|چندتا|چند|تاست|تا|است|بود|هست|چنده|چقدره|رو|را|بگو|بده|و|به|گزارش|کن)$/u.test(
        w,
      ),
    );
  if (
    !supported ||
    (!asksMoney && !asksCount) ||
    currencies.length > 1 ||
    currencies.some((code) => !knownCurrencies.has(code)) ||
    (asksCount && currencies.length && !/مبلغ|مبالغ/u.test(text))
  )
    return { kind: 'qualified' as const };
  return {
    kind: 'read' as const,
    asksCount,
    asksMoney,
    currency: currencies[0],
  };
}

const receipt = z
  .object({
    version: z.literal(1),
    metric: z.literal('standard-sales'),
    observedAt: z.string().datetime(),
    total: z.number().int().nonnegative(),
    missingAmounts: z.number().int().nonnegative(),
    totals: z.array(
      z.object({
        currencyCode: z.string().regex(/^[A-Z]{3}$/u),
        amount: z.string().regex(/^-?\d+(?:\.\d+)?$/u),
      }),
    ),
  })
  .refine(
    (r) =>
      r.missingAmounts <= r.total &&
      new Set(r.totals.map((t) => t.currencyCode)).size === r.totals.length,
  );

export async function standardSalesAnswer(
  question: string,
  intent: NonNullable<ReturnType<typeof standardSalesIntent>>,
  read: (path: string) => Promise<unknown>,
): Promise<AnswerPart> {
  if (intent.kind === 'qualified')
    return {
      question,
      status: 'clarify',
      links: [],
      text: 'این گزارش تعداد و مبلغ فروش استاندارد را در کل دوره و به تفکیک ارز نشان می‌دهد. کدام شاخص را در همین محدوده می‌خواهید؟',
    };
  const result = receipt.parse(
    await read('/sales/assistant-agent/standard-sales-summary'),
  );
  const lines: string[] = [];
  if (intent.asksCount)
    lines.push(
      'تعداد قراردادهای فروش استاندارد' +
        ': ' +
        result.total.toLocaleString('fa-IR'),
    );
  if (intent.asksMoney) {
    const sums = result.totals.filter(
      (t) => !intent.currency || intent.currency === t.currencyCode,
    );
    if (sums.length)
      lines.push(
        'مبلغ قراردادی پس از تخفیف' +
          ': ' +
          sums.map((t) => t.amount + ' ' + t.currencyCode).join('، '),
      );
    else if (!result.missingAmounts)
      lines.push(
        'مبلغ قراردادی پس از تخفیف' +
          ': ' +
          (intent.currency ? '۰ ' + intent.currency : '۰'),
      );
    if (result.missingAmounts)
      lines.push(
        'تعداد قراردادهای فاقد مبلغ ثبت‌شده' +
          ': ' +
          result.missingAmounts.toLocaleString('fa-IR'),
      );
  }
  return {
    question,
    status:
      intent.asksMoney && result.missingAmounts
        ? 'partial'
        : result.total
          ? 'answer'
          : 'empty',
    text: lines.join('\n'),
    links: [],
    source: 'sales/assistant-agent/standard-sales-summary',
    observedAt: result.observedAt,
  };
}
