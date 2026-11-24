import { randomUUID } from 'node:crypto';
import { validCountBreakdown } from './contract-count-breakdown.mjs';

// Exact, context-free intents only. Dates, qualifiers, follow-ups and selected
// records must continue through the normal model interpretation path.
export function nativeCountRoute(request) {
  if (request.history.length || request.context) return null;
  const question = request.message.trim().replace(/[؟?]$/, '').trim();
  if (
    ![
      'تعداد کل قراردادها',
      'تعداد کل قراردادها چقدر است',
      'تعداد کل قراردادها چند است',
      'کل قراردادها چند تاست',
    ].includes(question)
  )
    return null;
  let stage = 0;
  return (messages) => {
    const base = { id: 'native_' + randomUUID(), tokens: 0, native: true };
    if (stage++ === 0)
      return {
        ...base,
        name: 'set_plan',
        args: { steps: ['شمارش قراردادها در محدوده دسترسی فعلی'] },
      };
    if (stage === 2)
      return { ...base, name: 'contract_count_breakdown', args: {} };
    const output = JSON.parse(messages.at(-1).content);
    if (!validCountBreakdown(output.rows) || output.truncated !== false)
      throw new Error('INVALID_NATIVE_COUNT_EVIDENCE');
    const row = output.rows[0];
    const n = (value) => value.toLocaleString('fa-IR');
    return {
      ...base,
      name: 'finish_answer',
      args: {
        status: 'ANSWER',
        text: `تعداد کل قراردادها: ${n(row.total)}`,
        resultIds: [output.resultId],
        limitations: [],
        calculationExplanation: `شمارش تمام‌وقت قراردادهای قابل مشاهده در شرکت و محدوده دسترسی فعلی شما، شامل وضعیت‌های لغوشده است؛ فیلترهای سفارشی فهرست اعمال نشده‌اند. جمع گروه‌های بدون هم‌پوشانی: ${n(row.panel_non_cancelled)} غیرلغوشده + ${n(row.sales_cancelled)} لغوشده در فروش + ${n(row.reservation_cancelled_only)} فقط لغوشده در رزرواسیون = ${n(row.total)} قرارداد.`,
      },
    };
  };
}
