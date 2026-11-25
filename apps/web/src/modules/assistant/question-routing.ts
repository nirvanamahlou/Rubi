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
    | 'capabilities'
    | 'sales-report-guide';
  domain?: AnswerContext['domain'] | undefined;
  guideQuestion?: string;
  guideTopicId?: 'travel-document-workflow' | 'create';
  dataMessage: string;
  clarification?: string;
  needsSalesPeriod?: true;
};

const metric =
  /عدد|تعداد|شمارش|مبلغ|درآمد|فروش|مانده|جمع|محاسبه|اختلاف|چقدر|چند|چنده|وضعیت|اطلاعات|آمار/;
const procedure =
  /چطور|چطوری|چجور|چجوری|چگونه|چه طور|نحوه|مراحل|راهنما|آموزش|یادم بده|چیکار|چه کار/;
const action =
  /ثبت|ایجاد|بارگذاری|آپلود|انتخاب|وارد|اصلاح|تغییر|بزن|ببند|باز کنم|پیدا کنم|دریافت کنم|حذف|ارسال|چاپ|دانلود/;
const evidence =
  /از کجا.*(?:آوردی|اوردی|آمده|امده|میاری|می یاری|میگی|می گویی)|از کجا.*(?:عدد|مبلغ)|(?:عدد|مبلغ).*از کجا|(?:زمان|ساعت|تاریخ) (?:مشاهده|استخراج)|(?:نحوه|روش) (?:محاسبه|شمارش|رتبه بندی)|منابع|منبع|مبنای|مبنا|حساب کردی|محاسبه کردی|چرا.*(?:عدد|اختلاف|میگی|می گویی)|فرق.*(?:داره|دارد|دارن)|تفاوت.*(?:عدد|مبلغ)/;
const shortFollowup =
  /^(?:(?:خب|پس|حالا)\s+)?(?:چرا|از کجا آوردی|از کجا اوردی|از کجا میاری|از کجا می یاری|فرقش چیه|فرقش چیست|فرق داره|بیشتر توضیح بده|بعدش چی|بعدش|ادامه بده|حالا چی|مرحله بعد چیه)$/;

/** Sole arbitration before any procedural resolver. No record data or DOM reads. */
export function routeAssistantQuestion(
  message: string,
  previous?: AnswerContext,
  pendingSalesPeriod = false,
): QuestionDecision {
  const q = normalizeQuestion(message);
  const has = (pattern: RegExp) => matchesQuestion(q, pattern);
  const salesPeriodClarification: QuestionDecision = {
    kind: 'clarify',
    domain: 'sales',
    dataMessage: message,
    needsSalesPeriod: true,
    clarification:
      'منظورتان از «ماه اخیر» کدام بازه است؟ ۳۰ روز کامل گذشته، ماه شمسی جاری یا ماه شمسی قبل؟ می‌توانید تاریخ شروع و پایان را هم مشخص کنید.',
  };
  if (pendingSalesPeriod) {
    const period =
      /^(?:همون |منظورم )?(?:(?:30|سی) روز(?: کامل)? (?:گذشته|اخیر|قبل)|این ماه(?: شمسی)?|ماه(?: شمسی)? جاری|ماه(?: شمسی)? (?:قبل|قبلی|گذشته))(?: بود| هست| رو بده)?$/.test(
        q,
      )
        ? /روز/.test(q)
          ? '30 روز گذشته'
          : /این ماه|جاری/.test(q)
            ? 'این ماه شمسی'
            : 'ماه قبل شمسی'
        : /^(?:از )?\d{1,2} [\p{L}]+(?: \d{4})? تا \d{1,2} [\p{L}]+(?: \d{4})?$/u.test(
              q,
            )
          ? q.startsWith('از ')
            ? q
            : 'از ' + q
          : undefined;
    if (period)
      return {
        kind: 'data',
        domain: 'sales',
        dataMessage: 'فروش ' + period + ' چقدر است؟',
      };
    if (/^(?:ماه اخیر|همون|نمی دونم|نمیدونم|ماه)$/.test(q))
      return salesPeriodClarification;
  }
  if (
    /^(?:لطفا )?(?:(?:مجموع|جمع|مبلغ|کل) )?فروش(?:مون|مان)? (?:در )?(?:یک |1 )?ماه اخیر(?: (?:را|رو))?(?: (?:بده|بگو|چقدر است|چقدر بوده))?$/u.test(
      q,
    )
  )
    return salesPeriodClarification;
  if (
    /^(?:لطفا )?(?:پر ?فروش ?ترین هتل(?: ?ها(?:یی|ی)?)?(?: ?(?:را|رو))?(?: که (?:باهاشون|با آن ها) قرارداد (?:بستیم|بستیمو|بسته ایم))?|هتل(?: ?ها(?:یی|ی)?)? که بیش ?ترین قرارداد(?: (?:را|رو))? (?:دارن|دارند|دارندو|دارنو))(?: (?:را |رو )?(?:بده|بنویس|بگو|نشون بده|نشان بده))?$/u.test(
      q.replace(/[؟?،.!]/g, ''),
    )
  )
    return { kind: 'data', domain: 'sales', dataMessage: message };
  if (
    /^(?:(?:سلام|داداش|نورا) )?(?:چی بلدی|چه کارهایی می تونی انجام بدی|چه کار می کنی|قابلیت هات چیه)$/.test(
      q,
    )
  )
    return { kind: 'capabilities', dataMessage: message };
  if (
    has(procedure) &&
    has(/گزارش فروش/) &&
    has(/بگیرم|بگیریم|بگیر|خروجی|اجرا|ساخت/)
  )
    return { kind: 'sales-report-guide', dataMessage: message };
  if (
    has(/سند(?: های)? (?:مالی|حسابداری)/) &&
    has(/قرارداد/) &&
    has(/صادر شده|ثبت شده/) &&
    !/\d/.test(q)
  )
    return {
      kind: 'clarify',
      domain: 'sales',
      dataMessage: message,
      clarification:
        'شماره قرارداد را بفرستید تا مشخص شود وضعیت سند مالی کدام پرونده را می‌خواهید.',
    };
  if (
    has(/(?:روند|رویه|نحوه)/) &&
    has(/قرارداد (?:زدن|بستن|ثبت)|(?:زدن|بستن|ثبت) قرارداد/) &&
    !/\d/.test(q)
  )
    return {
      kind: 'guide',
      domain: 'sales',
      guideTopicId: 'create',
      dataMessage: message,
    };
  const crossTeamWorkflow =
    has(/رویه|روند|فرایند|فرآیند/) && has(/فروش/) && has(/رزرواسیون/);
  const customerDeliveryPolicy =
    has(/مجوز|اجازه/) &&
    has(/صدور/) &&
    has(/بلی[تط]|واچر/) &&
    has(/مشتری/) &&
    has(/دانلود|مشاهده/) &&
    !/\d/.test(q);
  const documentProcedure =
    has(/رویه|فرایند|فرآیند|به چه صورت/) || has(procedure);
  const travelDocument =
    documentProcedure &&
    has(/بلی[تط]|پرواز|هتل|واچر/) &&
    has(
      /سند زدن|سند بزن|سند.*صادر|صدور سند|صدور بلی[تط]|صدور واچر|صادر.*(?:بلی[تط]|واچر)|تحویل مدارک/,
    ) &&
    !has(
      /سند حسابداری|سند مالی|ثبت حسابداری|شماره قرارداد|قرارداد [0-9۰-۹٠-٩]/,
    ) &&
    !has(/مبلغ|چقدر|تعداد|چند تا|مانده|وضعیت/);
  if (
    travelDocument ||
    crossTeamWorkflow ||
    customerDeliveryPolicy ||
    (previous?.kind === 'guide' &&
      previous.topicId === 'travel-document-workflow' &&
      shortFollowup.test(q))
  )
    return {
      kind: 'guide',
      domain: 'sales',
      guideTopicId: 'travel-document-workflow',
      dataMessage: message,
    };
  const sales = has(/فروش|قرارداد|بیمه مسافر|رزرواسیون|رزرو/);
  const callCenter = has(
    /کال سنتر|صف رسیدگی|تماس بدون نتیجه|تماس های بدون نتیجه|تماس مجدد|پرونده مخاطب|بررسی پیگیری|مدیر ایجادکننده|واحد مسئول مخاطب|تماس امروز|فایل صوتی تماس|ضبط مکالمه/,
  );
  const workbench = has(
    /میز\s*کار|مرخصی|جانشین|مساعده|تردد|پیام|پیام رسان|یادداشت|تقویم|فایل|تنظیمات حساب|حقوق|اضافه کاری|پورسانت|عملکرد من|ماموریت|مأموریت|پکیج(?: های)? روز/,
  );
  if (callCenter) {
    if (
      has(metric) &&
      !has(procedure) &&
      !has(action) &&
      !/یعنی|منظور|تعریف/.test(q)
    )
      return {
        kind: 'clarify',
        dataMessage: message,
        clarification:
          'برای عدد به‌روز کال سنتر، کارت یا گزارش همان صفحه را باز کنید.',
      };
    return { kind: 'guide', domain: 'workbench', dataMessage: message };
  }
  const domain =
    workbench && !sales ? 'workbench' : sales ? 'sales' : previous?.domain;
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
  const panelProcedure =
    !asksEvidence &&
    !/\d/.test(q) &&
    (has(/از کجای.*شروع کنم/) || has(/مبنای تاریخ.*گزارش.*چیه/));
  if (panelProcedure) return { kind: 'guide', dataMessage: message };
  const dataIntent =
    asksEvidence ||
    (has(metric) &&
      !explicitProcedure &&
      !locationProcedure &&
      !has(/رویه|روند|فرایند|فرآیند/));
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
  if (asksEvidence && !previous && !sales)
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
  if (dataIntent && (sales || previous?.kind === 'data'))
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
  if (
    dataIntent &&
    !has(procedure) &&
    !has(/رویه|روند|فرایند|فرآیند/) &&
    has(/گزارش|فروش|سفارش|حسابداری|دریافت|پرداخت|خرید|مشتری|انبار/)
  )
    return { ...base, kind: 'data' };
  if (sales && !has(/رویه|روند|فرایند|فرآیند/))
    return { ...base, kind: 'data' };
  return { ...base, kind: 'guide' };
}

function followupMessage(message: string, question: string) {
  const expanded = `سؤال مرتبط قبلی: ${question.slice(0, 1000)}\nپرسش فعلی: ${message}\nبرای بررسی پاسخ قبلی، شواهد تازه از ابزار مجاز بخوان. سابقه اثبات صحت عدد یا علت نیست؛ اگر قابل تأیید نیست یا تغییر کرده، صریح اعلام کن.`;
  return expanded.length <= 4000 ? expanded : message;
}
