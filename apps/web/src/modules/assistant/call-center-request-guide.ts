import type { AuthenticatedActor } from '@nora/contracts';
import { resolvedCallCenterBranch } from '@/modules/call-center/branch-context';
import { readApi } from '@/modules/call-center/read-client';
import { requestLabels } from '@/modules/call-center/workflow';
import { workflowApi } from '@/modules/call-center/workflow-client';
import { containsQuestionPhrase, normalizeQuestion } from './question-text';

export async function readCallCenterRequestStatus(
  message: string,
  actor: AuthenticatedActor,
  signal: AbortSignal,
) {
  const bootstrap = actor.branchIds[0];
  if (
    !bootstrap ||
    !actor.permissions.includes('customer_affairs.call_center.read')
  )
    return 'دسترسی به صف کال‌سنتر در این حساب مشخص نیست.';
  const branch = resolvedCallCenterBranch(
    actor.branchIds,
    await readApi.branches(bootstrap, signal),
  );
  if (!branch) return 'شعبهٔ مجاز کال‌سنتر برای خواندن صف مشخص نشد.';
  const text = normalizeQuestion(message);
  const { data, meta } = await workflowApi.queue(branch, 'MINE', 1, signal);
  const matches = data.filter((row) => containsQuestionPhrase(text, row.title));
  if (/«[^»]+»|"[^"]+"/.test(message) && matches.length === 0)
    return 'عنوان در صفحهٔ اول «کارهای من» پیدا نشد. در صف مجاز، عنوان و فیلترهای درخواست را بررسی کنید.';
  const options = matches.length ? matches : data;
  if (!data.length)
    return 'در صف «کارهای من» کال‌سنتر موردی برای نمایش پیدا نشد.';
  if (options.length !== 1 || meta.total > data.length)
    return 'در صف «کارهای من» بیش از یک درخواست وجود دارد یا جست‌وجو به صفحهٔ اول محدود است. برای دیدن مسئول و وضعیت مورد دقیق، عنوان درخواست را در صف باز کنید.';
  const row = options[0]!;
  return [
    row.title,
    `وضعیت ثبت‌شده: ${requestLabels[row.status] ?? 'تعیین نشده'}`,
    `کارشناس مسئول: ${row.ownerName || 'در صف مشخص نشده'}`,
    'منبع: آخرین خواندن صف «کارهای من» کال‌سنتر',
  ].join('\n');
}
