import catalog from './contract-guide.generated.json';
import { matchesQuestion, normalizeQuestion } from './question-text';

/** Instructions are derived from the owning Sales controls, not from legal advice.
 * Sources are repo-relative so changes to those controls can be reviewed with the guide.
 */
export interface ContractGuide {
  id: string;
  title: string;
  route: readonly string[];
  steps: readonly string[];
  matches: RegExp;
  sources: readonly string[];
}

const contracts = ['فروش و ارتباط با مشتری', 'قرارداد'];

export const contractGuides: readonly ContractGuide[] = catalog.topics.map(
  ({ pattern, flags, ...topic }) => ({
    ...topic,
    matches: new RegExp(pattern, flags),
  }),
);

export function normalizeContractQuestion(message: string): string {
  return normalizeQuestion(message);
}

export interface ContractGuideReply {
  topicId: string;
  text: string;
}

export function contractGuidePath(route: readonly string[]): string {
  // Keep navigation arrows and Persian labels in a stable order inside RTL chat bubbles.
  return '\u2066' + route.join(' ← ') + '\u2069';
}

export function formatContractGuide(guide: ContractGuide): string {
  return [
    contractGuidePath(guide.route),
    '',
    guide.title,
    ...guide.steps.map((step, i) => `${i + 1}. ${step}`),
  ].join('\n');
}

const helpRequest =
  /چطور|چطوری|چجور|چجوری|چگونه|چه جور|چه طور|مراحل|نحوه|چیکار|چه کار|راهنما|آموزش|یادم|کمک|کجا|چیه|یعنی|چرا|نمی|نمیشه|باید|تفاوت|فرق|لازم|کنم|کنیم|میخوام|می خوام|می خواهم|بزنم|ببندم/;
const createRequest = /بزن|ببند|بستن|زدن|ایجاد|جدید|بساز|ساخت|شروع|تنظیم|ثبت/;
const followup =
  /^(?:خب\s*)?(?:حالا|بعدش|بعد از این|مرحله بعد|بعدی|بعد چه|ادامه|بیشتر|کامل تر|واضح تر|دقیق تر)/;
const outsideSales =
  /مرخصی|حضور و غیاب|حقوق کارکنان|کال سنتر|آب و هوا|گزارش فروش/;

export function isContractCountQuestion(message: string) {
  const question = normalizeContractQuestion(message);
  return (
    /قرارداد|contract/i.test(question) &&
    /تعداد|شمارش|عدد|اختلاف|محاسبه/.test(question) &&
    !/(?:چطور|چجور|چگونه|نحوه|راهنمای).*(?:ثبت|ایجاد|اصلاح|تغییر|انتخاب|وارد|بزن)/.test(
      question,
    )
  );
}

/** Return grounded instructions for the current Sales workflow; unknown topics get a local clarification. */
export function resolveContractGuide(
  message: string,
  onSalesPage: boolean,
  previousTopicId?: string,
  recordAlreadyRead = false,
  dataAgentAvailable = false,
): ContractGuideReply | undefined {
  const question = normalizeContractQuestion(message);
  const explicitContract = /قرارداد|contract/i.test(question);
  const continuing = Boolean(previousTopicId && followup.test(question));
  if (!onSalesPage && !explicitContract && !continuing) return;
  if (outsideSales.test(question) && !explicitContract) return;

  // Count/evidence follow-ups are analytics, even when they contain "why/where".
  if (dataAgentAvailable && isContractCountQuestion(question)) return;

  // A concrete record question belongs to the authorized reader, including follow-ups.
  if (!recordAlreadyRead && /قرارداد\s*(?:شماره\s*)?[A-Za-z0-9]/.test(question))
    return;
  const procedure =
    /چطور|چجور|چگونه|چه جور|چه طور|کجا|راهنما|آموزش|وارد|انتخاب|ثبت|اصلاح|بزن|ببند/.test(
      question,
    );
  if (
    !recordAlreadyRead &&
    explicitContract &&
    /چقدر|چند تا|چنده|مانده|وضعیت/.test(question) &&
    !procedure
  ) {
    // The data Agent can answer portfolio questions without a contract number.
    // Keep the legacy clarification for callers without that reader.
    if (dataAgentAvailable) return;
    return {
      topicId: 'record',
      text: [
        contractGuidePath(contracts),
        'برای خواندن اطلاعات واقعی، شماره کامل قرارداد را بنویسید؛ برای نمونه «قرارداد ۱۲۳ را بررسی کن» و شماره پرونده خودتان را جایگزین کنید.',
      ].join('\n'),
    };
  }
  const completed =
    /زدم|کردم|انجام دادم|کامل کردم|تکمیل کردم|شد/.test(question) &&
    /بعد|حالا|ادامه/.test(question);
  const isHelp =
    helpRequest.test(question) ||
    (explicitContract && createRequest.test(question)) ||
    continuing ||
    completed;
  if (!isHelp) return;

  const transitions = [
    { matches: /ثبت و ارسال|قرارداد.*ثبت شد/, topic: 'reservation' },
    { matches: /ت[أا]یید مسیر و خدمات/, topic: 'price' },
    { matches: /ثبت و ت[أا]یید افراد/, topic: 'allocation' },
    { matches: /قیمت.*(?:وارد|کامل|تکمیل)/, topic: 'review' },
  ];
  const nextTopic = completed
    ? transitions.find((item) => item.matches.test(question))?.topic
    : undefined;
  if (nextTopic) {
    const guide = contractGuides.find((item) => item.id === nextTopic)!;
    return { topicId: guide.id, text: formatContractGuide(guide) };
  }
  const candidates = contractGuides.filter(
    (guide) =>
      guide.id !== 'create' && matchesQuestion(question, guide.matches),
  );
  // Prefer specific subtopics over their parents (e.g. multi-hotel before hotel).
  const specific = [
    'multi-hotel',
    'passport',
    'allocation',
    'agency',
    'commission',
    'cheque',
    'receipt',
    'notes',
    'legacy',
    'draft',
    'review',
    'correction',
    'price',
    'documents',
    'output',
    'purchase',
    'package',
    'flight',
    'visa',
    'insurance',
    'transfer',
  ];
  const topic =
    specific
      .map((id) => candidates.find((guide) => guide.id === id))
      .find(Boolean) ??
    candidates.find((guide) => guide.id !== 'blocked') ??
    (continuing
      ? contractGuides.find((guide) => guide.id === previousTopicId)
      : undefined) ??
    (explicitContract &&
    (createRequest.test(question) ||
      /راهنمای.*قرارداد|آموزش.*قرارداد|چطور|چجور|چگونه|چه کار|چیکار|نحوه|مراحل/.test(
        question,
      ))
      ? contractGuides.find((guide) => guide.id === 'create')
      : undefined) ??
    candidates[0];
  if (topic) return { topicId: topic.id, text: formatContractGuide(topic) };
  if (!explicitContract && !/این صفحه|این بخش|این فرم|اینجا/.test(question))
    return;
  return {
    topicId: 'create',
    text: [
      contractGuidePath(contracts),
      'درباره کدام بخش قرارداد راهنمای مرحله‌به‌مرحله می‌خواهید؟',
      'ایجاد قرارداد، مشتری و آژانس، مسیر و بلیت، مسافران، هتل، بیمه، قیمت و پرداخت، اصلاح، خروجی یا مدارک را مشخص کنید.',
      'برای شروع از ابتدا بپرسید «چجور قرارداد بزنم؟».',
    ].join('\n'),
  };
}

/** Compatibility for saved-record guidance, which has its own conversational context. */
export function contractGuideAnswer(
  message: string,
  onSalesPage: boolean,
  recordAlreadyRead = false,
) {
  return resolveContractGuide(
    message,
    onSalesPage,
    undefined,
    recordAlreadyRead,
  )?.text;
}
