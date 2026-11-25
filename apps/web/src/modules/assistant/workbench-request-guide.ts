import type { WorkbenchRequestItemV1 } from '@nora/contracts';
import {
  workbenchApprovalProgressLabel,
  workbenchRequestStatusLabel,
} from '@/modules/workbench/workbench-request-status';
import { containsQuestionPhrase, normalizeQuestion } from './question-text';

// Native workbench tickets use CA-T-YYYY-<eight hexadecimal characters>.
const trackingToken = /^[a-z]+(?:-[a-z0-9]+)+$/i;
const lookupWord =
  /^(?:لطفا|الان|حالا|فعلا|درخواستم?|من|خودم|مرخصیم?|م[اأ]موریتم?|میز|کار|میزکار|کارتابل|با|کد|پیگیری|شماره|دست|کی|کیه|کیست|چه|کسی|هستش?|است|کجاست|کجا|رسیده?|وضعیتش?|چیه|چیست|مسئولش?|گیرنده|گیرندش|اش|کدوم|مرحله|ای|در|به|رو|را|بگو|میشه|ببینم|شده?|ت[اأ]یید|رد|یا)$/u;

export function ownRequestLookup(question: string) {
  const words = normalizeQuestion(question).split(' ');
  const codes = words.filter((w) => trackingToken.test(w));
  if (
    new Set(codes).size > 1 ||
    codes.some((code) => code.length > 32) ||
    words.some((w) => !trackingToken.test(w) && !lookupWord.test(w)) ||
    (!codes.length &&
      words.some((w) => ['کد', 'شماره', 'پیگیری'].includes(w))) ||
    (/مرخصی/.test(question) && /م[اأ]موریت/.test(question))
  )
    return null;
  return { trackingNumber: codes[0]?.toUpperCase() };
}

export function asksWorkbenchRequestStatus(
  message: string,
  onWorkbench: boolean,
) {
  const text = normalizeQuestion(message);
  if (onWorkbench && trackingToken.test(text.replace(/^کد پیگیری\s+/, '')))
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
  statusOnly = false,
) {
  const text = normalizeQuestion(message);
  const inQuestion = (value?: string | null) =>
    Boolean(value && containsQuestionPhrase(text, value));
  const own = rows.filter(
    (row) => row.direction === 'outgoing' || row.direction === 'self',
  );
  const codes = text.split(' ').filter((w) => trackingToken.test(w));
  const explicit = rows.filter((row) =>
    codes.includes(row.trackingNumber.toLowerCase()),
  );
  const suppliedCode =
    codes.length > 0 || /کد پیگیری\s+[\p{L}\d-]*\d/iu.test(text);
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
  if (statusOnly && candidates.length !== 1)
    return {
      text: 'نتیجهٔ یکتا پیدا نشد. کد را در کارتابل درخواست‌ها بررسی کنید.',
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
  if (statusOnly) {
    return {
      text: 'وضعیت ثبت‌شده: ' + workbenchRequestStatusLabel(status),
      href: '/workbench?tab=requests&request=' + encodeURIComponent(row.id),
    };
  }
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
            `تأیید مدیر واحد: ${workbenchApprovalProgressLabel(row.progress?.managerApproved)}`,
            `تأیید منابع انسانی: ${workbenchApprovalProgressLabel(row.progress?.hrApproved)}`,
          ]
        : []),
      'منبع: آخرین خواندن کارتابل درخواست‌ها',
    ].join('\n'),
    href: `/workbench?tab=requests&request=${encodeURIComponent(row.id)}`,
  };
}
