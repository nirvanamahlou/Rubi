import { z } from 'zod';
import { normalizeQuestion } from './question-text';

// Only claim unfiltered portfolio totals. A date, destination, branch, policy
// number or second subject must stay available to the general report planner.
export function isInsuranceSummary(message: string) {
  const text = normalizeQuestion(message);
  if (!/بیمه\s*نامه/.test(text) || !/تعداد|چند|چقد|جمع مبلغ/.test(text))
    return false;
  const remainder = text.replace(
    /بیمه\s*نامه|مسافرتی|تعداد|الان|جمع|مبلغ|کل|چند(?:تا(?:ست|ش)?|ه)?|چقدر(?:ه)?|صادر|ثبت|شده|نیازمند|بررسی|پیش نویس|ریال(?:ه)?|های|ها|است|و|رو|بده|\s+/gu,
    '',
  );
  return remainder.length === 0;
}

export function formatInsuranceSummary(payload: unknown) {
  const countValue = z.number().int().safe().nonnegative();
  const result = z
    .object({
      count: countValue,
      totals: z.array(
        z.object({
          status: z.string(),
          count: countValue,
          amount: z.string().nullable(),
          currencyCode: z.string().nullable(),
        }),
      ),
    })
    .parse(payload);
  if (result.totals.reduce((n, g) => n + g.count, 0) !== result.count)
    throw new Error('INSURANCE_TOTALS_CHANGED');
  const count = (statuses: string[]) =>
    result.totals.reduce(
      (sum, group) => sum + (statuses.includes(group.status) ? group.count : 0),
      0,
    );
  const fa = new Intl.NumberFormat('fa-IR');
  const issued = result.totals.filter((group) => group.status === 'ISSUED');
  const amounts = issued.map(
    (group) =>
      (group.amount ?? 'مبلغ نامشخص') +
      ' ' +
      (group.currencyCode ?? 'ارز نامشخص'),
  );
  return [
    'کل بیمه‌نامه‌ها: ' + fa.format(result.count),
    'صادرشده: ' + fa.format(count(['ISSUED'])),
    'پیش‌نویس: ' + fa.format(count(['DRAFT'])),
    'نیازمند بررسی: ' + fa.format(count(['INPUT_ERROR', 'PROVIDER_ERROR'])),
    'جمع مبلغ صادرشده‌ها: ' + (amounts.join('، ') || '۰'),
  ].join('\n');
}
