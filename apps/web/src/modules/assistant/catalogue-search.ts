import {
  assistantGuideCatalogues,
  type GuideSection,
  type AssistantGuideModule,
} from './assistant-guide-registry';
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

const workflowIntents: readonly [RegExp, readonly string[]][] = [
  [
    /نورا.*(?:نتوانست|دسترسی نداشت|عیب یابی)|عیب یابی.*نورا/,
    ['nora-sources/troubleshoot'],
  ],
  [
    /(?:نورا|پاسخ).*(?:شواهد|منبع داده|منبع داخلی)|(?:منبع داده|منبع داخلی|شواهد).*نورا/,
    ['nora-sources/evidence'],
  ],
  [/مطالبات.*تحویل مدارک/, ['reporting/receivables', 'reporting/delivery']],
  [/مانده مطالبات|مطالبات مشتریان/, ['reporting/receivables']],
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
    /(?:ثبت|ایجاد).*قرارداد.*(?:جدید|ارسال.*رزرواسیون)|قرارداد.*جدید.*(?:ثبت|ایجاد)/,
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
    /(?:تردد|کارکرد).*(?:گزارش|خروجی)|(?:گزارش|خروجی).*(?:تردد|کارکرد)/,
    ['human-resources/time', 'human-resources/reports'],
  ],
  [
    /(?=.*(?:بارگذاری|آپلود))(?=.*مدرک).*آرشیو/,
    ['documents/upload', 'documents/archive'],
  ],
];

export function resolveDocumentedWorkflow(message: string) {
  const question = normalizeQuestion(message);
  const instruction =
    /چطور|چگونه|چجور|کجا|نحوه|مراحل|راهنما|چه چیز|چه (?:مدارک|تأیید|تایید)|از کدام (?:پنل|گزارش)|برای عیب یابی/.test(
      question,
    );
  const explicitManifest =
    /^(?:منظورم )?(?:مانیفست|مانيفست|manifest)(?: است)?$/.test(question);
  if (!instruction && !explicitManifest) return [];
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
  return (search ??= buildGuidePhraseIndex(entries, ({ section }) => [
    section.title,
    ...(section.aliases ?? []),
    ...(section.terms ?? []).filter((term) =>
      normalizeQuestion(term).includes(' '),
    ),
  ]));
}

/** Ask the index only for an instruction. Leave composite, record and provenance questions to their readers. */
export function catalogueLookupMode(
  question: string,
  decision: QuestionDecision,
) {
  const text = normalizeQuestion(question);
  if (
    decision.guideTopicId ||
    decision.needsSalesPeriod ||
    !['guide', 'clarify'].includes(decision.kind)
  )
    return;
  if (
    /\d{3,}|چقدر|دست کی|از کجا آوردی|این (?:عدد|مبلغ|نتیجه|قرارداد|پرونده|درخواست|کمپین)|همین|پیگیری من|چرا|قبل (?:از )?ارسال/.test(
      text,
    )
  )
    return;
  if (/^راهنمای?\s/.test(text)) return 'explicit';
  if (/چطور|چجور|چگونه|کجا|نحوه|مراحل|انجام بدم|انجام بدهم/.test(text))
    return 'procedure';
}

export function findCatalogueTopics(
  message: string,
  pathname: string | null,
  allowed: (s: GuideSection) => boolean,
  minimumWords = 1,
) {
  const text = normalizeQuestion(message);
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
      score,
      current: item.section.href.split(/[?#]/)[0] === pathname,
    }))
    .sort((a, b) => b.score - a.score || Number(b.current) - Number(a.current));
  const first = candidates[0];
  if (!first) return [];
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
