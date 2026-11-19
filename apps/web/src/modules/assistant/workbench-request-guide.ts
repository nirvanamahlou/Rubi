import type { WorkbenchRequestItemV1 } from '@nora/contracts';
import { workbenchRequestStatusLabel } from '@/modules/workbench/workbench-request-status';
import { containsQuestionPhrase, normalizeQuestion } from './question-text';

export function asksWorkbenchRequestStatus(
  message: string,
  onWorkbench: boolean,
) {
  const text = normalizeQuestion(message);
  if (onWorkbench && /^(?:کد پیگیری\s+)?[a-z]+(?:-[a-z\d]+)*-\d+$/i.test(text))
    return true;
  if (/کال سنتر|تماس مجدد|قرارداد/.test(text)) return false;
  if (/چطور|چگونه|چجوری|نحوه|راهنما|مراحل/.test(text)) return false;
  return (
    /درخواست|مرخصی|ماموریت|مأموریت|مساعده/.test(text) &&
    /دست (?:کی|چه کس)|کجاست|وضعیت|ت[اأ]یید شد|رد شد|به کجا رسید|مسئولش/.test(
      text,
    ) &&
    (onWorkbench ||
      /درخواستم|درخواست من|درخواست خودم|مرخصی من|م[اأ]موریت من|میز\s*کار|کد پیگیری/.test(
        text,
      ))
  );
}

export function describeWorkbenchRequest(
  message: string,
  rows: readonly WorkbenchRequestItemV1[],
  selectedId?: string | null,
) {
  const text = normalizeQuestion(message);
  const inQuestion = (value?: string | null) =>
    Boolean(value && containsQuestionPhrase(text, value));
  const own = rows.filter(
    (row) => row.direction === 'outgoing' || row.direction === 'self',
  );
  const explicit = rows.filter((row) => inQuestion(row.trackingNumber));
  const suppliedCode =
    /کد پیگیری\s+[\p{L}\d-]*\d|\b[a-z]+(?:-[a-z\d]+)*-\d+/iu.test(text);
  const titleMatches = own.filter((row) => inQuestion(row.subject));
  const byKind = /مرخصی/.test(text)
    ? own.filter((row) => row.leave)
    : /م[اأ]موریت/.test(text)
      ? own.filter((row) => row.mission)
      : undefined;
  const contextual = selectedId
    ? rows.find((row) => row.id === selectedId)
    : undefined;
  const candidates =
    explicit.length || suppliedCode
      ? explicit
      : titleMatches.length
        ? titleMatches
        : (byKind ?? (contextual ? [contextual] : selectedId ? [] : own));
  if (!candidates.length)
    return {
      text: 'در کارتابل مجاز شما درخواستی مطابق این پرسش پیدا نشد. کد پیگیری را بررسی کنید.',
      href: '/workbench?tab=requests',
    };
  if (candidates.length !== 1)
    return {
      text: [
        'چند درخواست مطابق پرسش پیدا شد. کد پیگیری یکی را بگویید:',
        ...candidates
          .slice(0, 5)
          .map((row) => `• ${row.trackingNumber} — ${row.subject}`),
      ].join('\n'),
      href: '/workbench?tab=requests',
    };
  const row = candidates[0]!;
  const status = row.status?.trim().toUpperCase();
  const holder = [row.recipientName, row.destinationUnit]
    .filter(Boolean)
    .join('، ');
  const terminal = ['APPROVED', 'REJECTED', 'DONE', 'CLOSED'].includes(
    status ?? '',
  );
  return {
    text: [
      `${row.subject} (${row.trackingNumber})`,
      `وضعیت ثبت‌شده: ${workbenchRequestStatusLabel(status)}`,
      ...(holder
        ? [
            `${terminal ? 'گیرندهٔ ثبت‌شده' : 'مسئول یا واحد ثبت‌شده'}: ${holder}`,
          ]
        : ['مسئول یا واحد در کارتابل مشخص نشده است.']),
      ...(row.leave
        ? [
            `تأیید مدیر واحد: ${row.progress?.managerApproved ? 'ثبت شده' : 'در کارتابل ثبت نشده'}`,
            `تأیید منابع انسانی: ${row.progress?.hrApproved ? 'ثبت شده' : 'در کارتابل ثبت نشده'}`,
          ]
        : []),
      'منبع: آخرین خواندن کارتابل درخواست‌ها',
    ].join('\n'),
    href: `/workbench?tab=requests&request=${encodeURIComponent(row.id)}`,
  };
}
