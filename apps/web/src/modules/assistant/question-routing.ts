import { matchesQuestion, normalizeQuestion } from './question-text';

export type AnswerContext = {
  kind: 'data' | 'guide';
  domain: 'sales' | 'workbench';
  question: string;
  topicId?: string | undefined;
  contractId?: string | undefined;
  resultIds?: readonly string[];
};
export type QuestionDecision = {
  kind:
    | 'guide'
    | 'data'
    | 'follow-up'
    | 'data-with-guide'
    | 'clarify'
    | 'conversation';
  domain?: AnswerContext['domain'] | undefined;
  guideQuestion?: string;
  dataMessage: string;
  clarification?: string;
};

const metric =
  /عدد|تعداد|شمارش|مبلغ|درآمد|فروش|مانده|جمع|محاسبه|اختلاف|چقدر|چند|چنده|وضعیت|اطلاعات|آمار/;
const procedure =
  /چطور|چطوری|چجور|چجوری|چگونه|چه طور|نحوه|مراحل|راهنما|آموزش|یادم بده|چیکار|چه کار/;
const action =
  /ثبت|ایجاد|بارگذاری|آپلود|انتخاب|وارد|اصلاح|تغییر|بزن|ببند|باز کنم|پیدا کنم|دریافت کنم|حذف|ارسال|چاپ|دانلود/;
const evidence =
  /از کجا.*(?:آوردی|اوردی|آمده|امده|میاری|می یاری|میگی|می گویی)|از کجا.*(?:عدد|مبلغ)|(?:عدد|مبلغ).*از کجا|منبع|مبنای|مبنا|حساب کردی|محاسبه کردی|چرا.*(?:عدد|اختلاف|میگی|می گویی)|فرق.*(?:داره|دارد|دارن)|تفاوت.*(?:عدد|مبلغ)/;
const shortFollowup =
  /^(?:(?:خب|پس|حالا)\s+)?(?:چرا|از کجا آوردی|از کجا اوردی|از کجا میاری|از کجا می یاری|فرقش چیه|فرقش چیست|فرق داره|بیشتر توضیح بده|بعدش چی|بعدش|ادامه بده|حالا چی|مرحله بعد چیه)$/;

/** Sole arbitration before any procedural resolver. No record data or DOM reads. */
export function routeAssistantQuestion(
  message: string,
  previous?: AnswerContext,
  onSalesPage = false,
): QuestionDecision {
  const q = normalizeQuestion(message);
  const has = (pattern: RegExp) => matchesQuestion(q, pattern);
  const sales = has(/قرارداد|بیمه مسافر|رزرواسیون|رزرو/);
  const workbench = has(
    /میز\s*کار|مرخصی|جانشین|مساعده|تردد|پیام|پیام رسان|یادداشت|تقویم|فایل|تنظیمات حساب|حقوق|اضافه کاری|پورسانت|عملکرد من/,
  );
  const domain =
    workbench && !sales
      ? 'workbench'
      : sales
        ? 'sales'
        : (previous?.domain ?? (onSalesPage ? 'sales' : undefined));
  const changedDomain = Boolean(
    previous && (sales || workbench) && domain !== previous.domain,
  );
  const explicitProcedure =
    has(action) &&
    (has(procedure) || /میخوام|می خواهم|کنم|بدم|بدهم|بزنم|کردم/.test(q));
  const locationProcedure = has(
    /(?:از کجا|کجا).*(?:بارگذاری|آپلود|ثبت|اصلاح|تغییر|انتخاب|وارد|پیدا|باز|دریافت|چاپ|دانلود)/,
  );
  const asksEvidence =
    (has(evidence) &&
      !(
        has(/منبع آشنایی|منبع جذب/) &&
        (explicitProcedure || locationProcedure)
      )) ||
    (has(metric) && /چرا|اختلاف|فرق|بجای|به جای/.test(q));
  const dataIntent =
    asksEvidence || (has(metric) && !explicitProcedure && !locationProcedure);
  const definition =
    !asksEvidence &&
    !/\d/.test(q) &&
    /یعنی|به چه معنا|منظور از|تعریف|(?:فرق|تفاوت).*(?:پیش نویس|تسویه)/.test(q);
  const followup =
    shortFollowup.test(q) ||
    (!changedDomain &&
      previous?.kind === 'data' &&
      !explicitProcedure &&
      !locationProcedure &&
      /^(?:(?:این|اون|آن|همین)\s+(?:عدد|مبلغ|نتیجه|قرارداد|آمار)|چرا|از کجا|فرقش|تفاوتش|بر چه اساسی|بر چه مبنایی)/.test(
        q,
      ));
  const base = { domain, dataMessage: message };

  if (
    sales &&
    workbench &&
    has(/مرخصی|مساعده|جانشین|تردد|یادداشت|میز\s*کار|پیام رسان|تقویم/)
  )
    return {
      ...base,
      kind: 'clarify',
      clarification:
        'ابتدا راهنمای قرارداد را می‌خواهید یا راهنمای میزکار من؟ موضوع اول را مشخص کنید تا مراحل دو بخش با هم مخلوط نشوند.',
    };
  // Workbench has procedural tools only; never promote employee questions to Sales SQL.
  if (workbench && !sales) return { ...base, kind: 'guide' };
  if (
    domain === 'sales' &&
    !asksEvidence &&
    !/\d/.test(q) &&
    has(/مرحله بعد|دکمه|فهرست|فرم|گیر کردم|ثبت نمیشه|جلو نمی رود/)
  )
    return {
      ...base,
      kind: 'guide',
      guideQuestion: sales ? message : `قرارداد: ${message}`,
    };
  if (definition && domain === 'sales')
    return {
      ...base,
      kind: 'guide',
      guideQuestion: sales ? message : `قرارداد: ${message}`,
    };
  if (asksEvidence && !previous && !sales && !onSalesPage)
    return {
      ...base,
      kind: 'clarify',
      clarification:
        'منظورتان کدام پاسخ، عدد یا پرونده است؟ سؤال یا موضوع مرتبط را مشخص کنید تا همان مورد را بررسی کنم.',
    };
  if (dataIntent && (explicitProcedure || locationProcedure)) {
    const correction = /(?:از کجا|چطور|چگونه).*?(?:اصلاح|تغییر)/.test(q);
    const dataPart = message
      .split(
        /(?:[؛;]\s*| و\s+)(?=(?:از\s*کجا|چطور|چگونه).*(?:اصلاح|تغییر|ثبت|بارگذاری))/u,
      )[0]!
      .trim();
    return {
      ...base,
      kind: 'data-with-guide',
      dataMessage:
        previous?.kind === 'data'
          ? followupMessage(dataPart, previous.question)
          : dataPart,
      guideQuestion: correction
        ? 'چطور اطلاعات قرارداد را اصلاح کنم؟'
        : message,
    };
  }
  if (
    !changedDomain &&
    followup &&
    previous &&
    !(previous.kind === 'guide' && has(metric))
  ) {
    if (previous.kind === 'guide')
      return {
        ...base,
        kind: 'guide',
        guideQuestion: `${previous.question}\n${message}`,
      };
    return {
      ...base,
      kind: 'follow-up',
      dataMessage: followupMessage(message, previous.question),
    };
  }
  if ((followup || asksEvidence) && !previous && !sales && !has(metric))
    return {
      ...base,
      kind: 'clarify',
      clarification:
        'منظورتان کدام پاسخ، عدد یا پرونده است؟ سؤال یا موضوع مرتبط را مشخص کنید تا همان مورد را بررسی کنم.',
    };
  if (dataIntent && (sales || previous?.kind === 'data' || onSalesPage))
    return {
      ...base,
      kind: previous?.kind === 'data' && asksEvidence ? 'follow-up' : 'data',
      dataMessage:
        previous?.kind === 'data' && asksEvidence
          ? followupMessage(message, previous.question)
          : message,
    };
  if (
    has(procedure) ||
    locationProcedure ||
    (domain && has(action)) ||
    (domain && /خطا|گیر|نمی|نمیشه|باید|لازم|چیه|یعنی/.test(q))
  )
    return {
      ...base,
      kind: 'guide',
      ...(domain === 'sales' && !sales
        ? { guideQuestion: `قرارداد: ${message}` }
        : {}),
    };
  if (has(/چرا|کجا|فرق|تفاوت/))
    return {
      ...base,
      kind: 'clarify',
      clarification:
        'راهنمای انجام کار می‌خواهید یا بررسی اطلاعات واقعی؟ موضوع یا بخش موردنظر را مشخص کنید.',
    };
  return { ...base, kind: 'conversation' };
}

function followupMessage(message: string, question: string) {
  const expanded = `سؤال مرتبط قبلی: ${question.slice(0, 1000)}\nپرسش فعلی: ${message}\nبرای بررسی پاسخ قبلی، شواهد تازه از ابزار مجاز بخوان. سابقه اثبات صحت عدد یا علت نیست؛ اگر قابل تأیید نیست یا تغییر کرده، صریح اعلام کن.`;
  return expanded.length <= 4000 ? expanded : message;
}
