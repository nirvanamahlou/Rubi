import {
  assistantGuideCatalogues,
  type GuideSection,
  type AssistantGuideModule,
} from './assistant-guide-registry';
import { buildGuideWordSearch, normalizeGuideQuery } from './guide-word-search';
import { buildGuidePhraseIndex } from './guide-phrase-index';
import type { QuestionDecision } from './question-routing';
import { normalizeQuestion } from './question-text';

type Entry = { domain: AssistantGuideModule; section: GuideSection };
const entries = (
  Object.keys(assistantGuideCatalogues) as AssistantGuideModule[]
).flatMap((domain) =>
  assistantGuideCatalogues[domain].topics.map(
    (section) => ({ domain, section }) as Entry,
  ),
);
const byHref = new Map(
  entries.map((entry) => [entry.section.guideHref, entry]),
);
const panels = Object.entries(assistantGuideCatalogues).map(
  ([domain, catalogue]) => ({
    domain,
    name: normalizeQuestion(catalogue.title.replace(/^راهنمای\s+/, '')),
  }),
);
const searchPanelNames = buildGuidePhraseIndex(panels, (panel) => [panel.name]);
let search: ReturnType<typeof buildGuidePhraseIndex<Entry>> | undefined;

let wordSearch: ReturnType<typeof buildGuideWordSearch> | undefined;

const workflowIntents: readonly [RegExp, readonly string[]][] = [
  [
    /(?=.*ویزا)(?=.*(?:کارتابل|درخواست))(?=.*(?:پیگیری|نقص|وضعیت|مدارک))(?!.*(?:ثبت|ایجاد|بفرست))/,
    ['workbench/request-status'],
  ],
  [
    /ویزا.*(?:کارتابل|درخواست داخلی)|(?:کارتابل|درخواست داخلی).*ویزا|درخواست ویزا.*پیگیری/,
    ['workbench/request-create', 'workbench/request-status'],
  ],
  [/مرخصی استعلاجی/, ['workbench/leave-medical']],
  [/جانشین.*مرخصی|مرخصی.*جانشین/, ['workbench/substitute']],
  [
    /(?=.*مرخصی)(?=.*(?:مدارک درخواست|پیوست درخواست|(?:تایید|تأیید) من))(?=.*(?:چک|بررسی|کجا))/,
    ['human-resources/requests', 'workbench/leave-approval'],
  ],
  [/اصلاح تردد.*ثبت|ثبت.*اصلاح تردد/, ['workbench/attendance-correction']],
  [/مساعده.*درخواست|درخواست.*مساعده/, ['workbench/advance']],
  [/کد پیگیری|کارتابل.*دلیل رد/, ['workbench/request-status']],
  [/یادداشت.*یادآوری/, ['workbench/note-checklist']],
  [/یادداشت.*بایگانی/, ['workbench/note-organize']],
  [/اعلان.*خوانده نشده/, ['workbench/notifications']],
  [/میزکار.*تنظیمات حساب/, ['workbench/account']],
  [/میزکار.*سوابق تردد/, ['workbench/performance']],
  [
    /(?=.*لغو)(?=.*صدور)(?=.*مجوز تحویل)(?!.*ت[اأ]یید).*/,
    ['finance-delivery/issue', 'finance-delivery/revoke'],
  ],
  [
    /پیگیری.*پس از ثبت قرارداد|(?:بعد|پس از) ثبت قرارداد.*پیگیری/,
    ['sales/reservation'],
  ],
  [/قرارداد (?:رو |را )?(?:چطور|چگونه|چجوری).*جستجو/, ['sales/list']],
  [
    /درخواست.*کار های من|کار های من.*درخواست/,
    ['call-center/call-center-queue', 'workbench/requests'],
  ],
  [/مرخصی.*(?:نیازمند اصلاح|برگشت خورده)/, ['workbench/request-status']],
  [
    /ترتیب.*(?:تایید|تأیید).*منابع انسانی/,
    ['workbench/leave-approval', 'human-resources/requests'],
  ],
  [/تغییر شرکت فعال|شرکت فعال.*تغییر/, ['nora-sources/company-scope']],
  [/نقش.*شعب.*کاربر/, ['system-management/permissions']],
  [/(?:مکاتبه|نامه) داخلی.*(?:بفرست|ارسال)/, ['correspondence/internal-send']],
  [/نامه صادره.*چاپ/, ['correspondence/outgoing-export']],
  [
    /گزارش رزرواسیون.*(?:اختلاف|کارت.*اکسل)|اختلاف.*گزارش رزرواسیون/,
    ['reservation-report/count-difference'],
  ],
  [/گزارش رزرواسیون.*(?:تاریخ حرکت|تاریخ صدور)/, ['reservation-report/dates']],
  [
    /گزارش رزرواسیون.*(?:pnr|فیلتر وضعیت)|(?:pnr|فیلتر وضعیت).*گزارش رزرواسیون/i,
    ['reservation-report/filters'],
  ],
  [/قرارداد.*(?:رسیده|ورودی).*فروش/, ['reservations/handoff']],
  [/نرخ خرید.*هتل|هتل.*نرخ خرید/, ['reservations/hotel-rates']],
  [/ایمیل کارگزار.*رزرو/, ['reservations/hotel-mail']],
  [/پرواز رفت و برگشت.*جدا/, ['reservations/flight']],
  [/هتل.*پرونده رزرو/, ['reservations/hotel']],
  [
    /(?=.*واچر)(?=.*(?:هتل|اقامت))(?=.*(?:چک|بررسی|ببین|مشاهده|پیدا))(?!.*(?:باطل|ابطال|صدور مجدد|صادر نشده))/,
    ['travel-issuance/voucher'],
  ],
  [/قرارداد.*چندتا هتل|چندتا هتل.*قرارداد/, ['sales/multi-hotel']],
  [/اسم انگلیسی مسافر/, ['sales/passport']],
  [/قرارداد.*مدرک پرداخت|رسید پرداخت.*قرارداد/, ['sales/receipt']],
  [/(?:پی دی اف|اکسل).*قرارداد|قرارداد.*پی دی اف/, ['sales/output']],
  [/مسافر.*تخصیص/, ['sales/allocation']],
  [/پیش نویس قرارداد.*ادامه/, ['sales/draft']],
  [/اصلاح.*مبلغ قرارداد/, ['sales/correction']],
  [/قرارداد آژانس/, ['sales/agency']],
  [/برنامه پرداخت قرارداد/, ['sales/payment']],
  [
    /قرارداد.*انتخاب.*پرواز|قرارداد بلی[تط] پرواز.*پرواز انتخاب/,
    ['sales/flight'],
  ],
  [/قرارداد.*بیمه.*انتخاب/, ['sales/insurance']],
  [/تاریخ مسیر قرارداد/, ['sales/route']],
  [/کمیسیون.*قرارداد/, ['sales/commission']],
  [/مجوز.*تسویه کامل|تسویه کامل.*مجوز/, ['finance-delivery/settlement']],
  [/رسید.*ت[اأ]یید نشده.*مجوز/, ['finance-delivery/receipt']],
  [
    /حساب مشتری و آژانس|واریزی مشتری.*مانده|دریافت در انتظار تایید/,
    ['finance-delivery/customer-receipt'],
  ],
  [/تنخواه.*ببند/, ['petty-cash/settlement-policy']],
  [/شارژ تنخواه/, ['petty-cash/recharge']],
  [/فایل.*آپلود.*آرشیو/, ['documents/upload', 'documents/archive']],
  [/سند بایگانی/, ['documents/archive']],
  [/مغایرت خرید/, ['purchase/discrepancy']],
  [/ارسال پکیج روز/, ['package-generator/daily-publication']],
  [/پاپ اپ تماس/, ['call-center/call-center-notification']],
  [/تیکت.*تشدید/, ['customer-affairs/ticket-escalation']],
  [
    /کارمند سابق|اکسل کارکنان|کد پرسنلی.*لیست|فیلتر کارکنان/,
    ['human-resources/employees'],
  ],
  [
    /نورا.*(?:نتوانست|دسترسی نداشت|عیب یابی|گزارش.*(?:جستجو|پیدا) نکرد)|عیب یابی.*نورا/,
    ['nora-sources/troubleshoot'],
  ],
  [
    /(?:نورا|پاسخ).*(?:شواهد|منبع داده|منبع داخلی)|(?:منبع|شواهد).*نورا/,
    ['nora-sources/evidence'],
  ],
  [/مطالبات.*تحویل مدارک/, ['reporting/receivables', 'reporting/delivery']],
  [/مانده مطالبات|مطالبات مشتریان|گزارش مطالبات/, ['reporting/receivables']],
  [
    /(?=.*فروش)(?=.*رزرواسیون)(?=.*(?:شعب|داشبورد)).*/,
    ['reporting/branch-sales', 'reporting/branch-reservations'],
  ],
  [
    /گزارش عملکرد فروش|عملکرد.*شعب|مقایسه فروش.*شعب/,
    ['reporting/branch-sales'],
  ],
  [/پرونده ویزا|درخواست ویزا/, ['sales/visa']],
  [/تخفیف.*پیش ?فاکتور|پیش ?فاکتور.*تخفیف/, ['sales/price']],
  [
    /وضعیت مجوز تحویل مدارک.*مسدود/,
    ['finance-delivery/search', 'finance-delivery/status'],
  ],
  [/مانیفست|مانيفست|\bmanifest\b/i, ['reservations/manifest']],
  [
    /بلی[تط].*(?:استرداد|ابطال)|(?:استرداد|ابطال).*بلی[تط]/,
    ['reservations/flight', 'reservations/cancellation'],
  ],
  [
    /(?:استرداد|ابطال|مسترد).*(?:گزارش رزرواسیون)|گزارش رزرواسیون.*(?:استرداد|ابطال|مسترد)/,
    [
      'reservation-report/dates',
      'reservation-report/filters',
      'reservation-report/allocation-and-status',
    ],
  ],
  [
    /صف رزرواسیون.*قرارداد.*(?:پرواز|هتل)|قرارداد.*از فروش.*(?:پرواز|هتل)/,
    ['reservations/handoff', 'reservations/flight', 'reservations/hotel'],
  ],
  [
    /^(?!.*(?:پرسنلی|استخدام|قرارداد کار(?:ی|مند)?(?: |$)))(?:(?:.*(?:ثبت|ایجاد).*قرارداد.*(?:جدید|ارسال.*رزرواسیون))|(?:.*قرارداد.*جدید.*(?:ثبت|ایجاد|بزن|بساز)))/,
    ['sales/create'],
  ],
  [
    /قرارداد.*(?:معطل|ارسال نشده|ارسال نشدن).*رزرواسیون/,
    ['sales/list', 'sales/reservation'],
  ],
  [
    /(?:ثبت.*(?:دریافت|پرداخت).*(?:مشتری|طرف حساب)|(?:دریافت|پرداخت).*مشتری.*ثبت)/,
    ['finance-delivery/customer-receipt'],
  ],
  [
    /مجوز تحویل مدارک.*استثنا|استثنا.*مجوز تحویل مدارک/,
    ['finance-delivery/exception'],
  ],
  [
    /(?:صدور|صادر).*لغو.*مجوز تحویل|مجوز تحویل.*(?:صدور|صادر).*لغو/,
    [
      'finance-delivery/issue',
      'finance-delivery/receipt',
      'finance-delivery/settlement',
      'finance-delivery/revoke',
    ],
  ],
  [
    /مرخصی.*(?:تایید|تأیید|منتظر)|(?:تایید|تأیید|منتظر).*مرخصی/,
    ['workbench/leave-approval', 'human-resources/requests'],
  ],
  [
    /(?=.*(?:ممیزی|آدیت))(?=.*منابع انسانی)|(?=.*گزارش)(?=.*(?:کارکرد|تردد))(?=.*(?:بازه|تنظیم|فیلتر))/,
    ['human-resources/reports'],
  ],
  [
    /(?:تردد|کارکرد).*(?:گزارش|خروجی)|(?:گزارش|خروجی).*(?:تردد|کارکرد)/,
    ['human-resources/time', 'human-resources/reports'],
  ],
  [
    /(?=.*(?:بارگذاری|آپلود))(?=.*مدرک).*آرشیو/,
    ['documents/upload', 'documents/archive'],
  ],
];

export function resolveDocumentedWorkflow(message: string) {
  const question = normalizeGuideQuery(message)
    .replace(/یاداشت/g, 'یادداشت')
    .replace(/یاداوری/g, 'یادآوری')
    .replace(/خونده/g, 'خوانده')
    .replace(/مرخسی/g, 'مرخصی')
    .replace(/اسعلاجی/g, 'استعلاجی')
    .replace(/تردود|ترددو/g, 'تردد')
    .replace(/پیگری/g, 'پیگیری')
    .replace(/بایگونی/g, 'بایگانی')
    .replace(/ثپت/g, 'ثبت')
    .replace(/اصلح/g, 'اصلاح')
    .replace(/تخصیس/g, 'تخصیص')
    .replace(/تنخاه/g, 'تنخواه')
    .replace(/درخاست/g, 'درخواست')
    .replace(/(?:^|\s)رزرو(?=\s|$)/g, ' رزرواسیون')
    .replace(/قرارداد جدیو/g, 'قرارداد جدید');
  const instruction =
    /چطور|چگونه|چجور|چطوری|چه جوری|کجا|چیه|چیکار|چی چک|چی تایپ|نحوه|مراحل|راهنما|چه چیز|چه (?:مدارک|تأیید|تایید)|از کدام (?:پنل|گزارش)|از چه گزارشی|برای عیب یابی/.test(
      question,
    );
  const explicitManifest =
    /^(?:منظورم )?(?:مانیفست|مانيفست|manifest)(?: است)?$/.test(question);
  if (!instruction && !explicitManifest) return [];
  if (/(?:کد پیگیری|شماره درخواست)\s+(?:[a-z]+-)?\d/i.test(question)) return [];
  const match = workflowIntents.find(([pattern]) => pattern.test(question));
  return (match?.[1] ?? []).flatMap((ref) => {
    const [domain, id] = ref.split('/');
    const section = byHref.get(
      '/assistant-guides/' + domain + '#' + id,
    )?.section;
    return section ? [section] : [];
  });
}

export function prepareCatalogueSearch() {
  return (search ??= buildGuidePhraseIndex(entries, ({ section }) =>
    [
      section.title,
      ...(section.aliases ?? []),
      ...(section.terms ?? []).filter((term) =>
        normalizeQuestion(term).includes(' '),
      ),
    ].map(normalizeGuideQuery),
  ));
}

/** Ask the index only for an instruction. Leave composite, record and provenance questions to their readers. */
export function catalogueLookupMode(
  question: string,
  decision: QuestionDecision,
) {
  const text = normalizeGuideQuery(question);
  // Colloquial location questions can otherwise be classified as numerical queries by
  // a noun such as «گزارش» or «مبلغ». Record identifiers and provenance keep their readers.
  const locateAction =
    /(?:از کجا|کجا.*(?:چک|بررسی)|کجاس|کجاست|کدوم (?:بخش|صفحه|کارتابل|دکمه)|چی چک|چی تایپ)/.test(
      text,
    ) &&
    !/\d|چقدر|چند تا|دست کی|چرا|از کجا.*(?:آوردی|آمده|میاری)|درخواستم|کد پیگیری/.test(
      text,
    );
  if (
    decision.guideTopicId ||
    decision.needsSalesPeriod ||
    (!['guide', 'clarify'].includes(decision.kind) &&
      !(locateAction && decision.kind === 'data'))
  )
    return;
  if (
    /ت[اأ]یید مدیر/.test(text) &&
    /مانده مرخصی/.test(text) &&
    !/[0-9]|کد پیگیری|مرخصی من/.test(text)
  )
    return 'procedure';
  if (
    /\d{3,}|چقدر|دست کی|از کجا آوردی|این (?:عدد|مبلغ|نتیجه|قرارداد|پرونده|درخواست|کمپین)|همین|پیگیری من|چرا|قبل (?:از )?ارسال/.test(
      text,
    )
  )
    return;
  if (locateAction) return 'procedure';
  if (/^راهنمای?\s/.test(text)) return 'explicit';
  if (
    /چطور|چجور|چگونه|چه جوری|چیه|کجا|کدوم (?:بخش|کارتابل|دکمه)|نحوه|مراحل|انجام بدم|انجام بدهم/.test(
      text,
    )
  )
    return 'procedure';
}

export function findCatalogueTopics(
  message: string,
  pathname: string | null,
  allowed: (s: GuideSection) => boolean,
  minimumWords = 1,
) {
  const text = normalizeGuideQuery(message);
  const searchTopics = prepareCatalogueSearch();
  const named = searchPanelNames(text);
  const longest = Math.max(0, ...named.map((hit) => hit.score));
  // The panel name narrows the search. Its own words should not outscore the requested action.
  const explicit = named.filter((hit) => hit.score === longest);
  const subject = explicit
    .reduce((rest, { item }) => rest.replace(item.name, ' '), text)
    .replace(/\s+/g, ' ')
    .trim();
  const subjectHits = searchTopics(subject);
  const hasScopedHit = subjectHits.some(({ item }) =>
    explicit.some((hit) => hit.item.domain === item.domain),
  );
  const candidates = (
    explicit.length && !hasScopedHit ? searchTopics(text) : subjectHits
  )
    .filter(
      ({ item, score }) =>
        score >= minimumWords &&
        allowed(item.section) &&
        (!named.length ||
          named.some(
            (hit) => hit.score === longest && hit.item.domain === item.domain,
          )),
    )
    .map(({ item, score }) => ({
      section: item.section,
      score:
        score +
        (normalizeGuideQuery(text).includes(
          normalizeGuideQuery(item.section.title),
        )
          ? 0.25
          : 0),
      current: item.section.href.split(/[?#]/)[0] === pathname,
    }))
    .sort((a, b) => b.score - a.score || Number(b.current) - Number(a.current));
  const first = candidates[0];
  if (!first) {
    if (minimumWords < 2) return [];
    wordSearch ??= buildGuideWordSearch(entries.map(({ section }) => section));
    return wordSearch(message).filter(
      (section) =>
        allowed(section) &&
        (!explicit.length ||
          explicit.some(
            ({ item }) => byHref.get(section.guideHref)?.domain === item.domain,
          )),
    );
  }
  return candidates
    .filter((c) => c.score === first.score && c.current === first.current)
    .map((c) => c.section);
}

/** Retrieve one attributable section per explicit task; leave single-topic ranking intact. */
export function retrieveDocumentSections(
  message: string,
  pathname: string | null,
  allowed: (section: GuideSection) => boolean,
) {
  const clauses = message
    .split(/[؟?]\s*(?=\S)/)
    .flatMap((sentence) =>
      normalizeQuestion(sentence).split(
        /\s+و\s+(?=(?:چطور|چگونه|از کجا|کجا|نحوه|مراحل)\s)/,
      ),
    );
  if (clauses.length < 2 || clauses.length > 4) return [];
  const sections = new Map<string, GuideSection>();
  for (const clause of clauses) {
    if (
      catalogueLookupMode(clause, { kind: 'guide', dataMessage: clause }) ===
      undefined
    )
      return [];
    const workflow = resolveDocumentedWorkflow(clause);
    const matches = workflow.length
      ? workflow
      : findCatalogueTopics(clause, pathname, () => true, 2);
    if (!matches.length || (!workflow.length && matches.length !== 1))
      return [];
    if (matches.some((section) => !allowed(section))) return [];
    for (const section of matches) sections.set(section.guideHref, section);
  }
  return sections.size <= 6 ? [...sections.values()] : [];
}

export function workflowDestination(
  message: string,
  previousHref: string | undefined,
  allowed: (s: GuideSection) => boolean,
) {
  if (!previousHref) return;
  const previous = byHref.get(previousHref)?.section;
  if (!previous?.workflow) return;
  const text = normalizeQuestion(message);
  const kind = /^(?:بعدش چی|بعدش|مرحله بعد چیه|قدم بعدی چیه)$/.test(text)
    ? 'next'
    : /^(?:قبلش چی|پیش نیازش چیه|قبلش چی لازمه)$/.test(text)
      ? 'prerequisite'
      : /^(?:از کجا پیگیری کنم|نتیجه رو از کجا ببینم|وضعیتش رو از کجا ببینم)$/.test(
            text,
          )
        ? 'status'
        : undefined;
  const ref = kind && previous.workflow[kind];
  if (!ref) return;
  const [domain, id] = ref.split('/');
  const target = byHref.get('/assistant-guides/' + domain + '#' + id)?.section;
  return target && allowed(previous) && allowed(target) ? target : null;
}
