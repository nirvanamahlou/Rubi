import {
  assistantGuideCatalogues,
  assistantGuideSection,
  isAssistantGuideModule,
} from './assistant-guide-registry';
import {
  containsQuestionPhrase,
  matchesQuestion,
  normalizeQuestion,
} from './question-text';

const procedural =
  /چطور|چگونه|چجور|چیکار|از کجا|نحوه|مراحل|راهنما|آموزش|چه طور/;
const record = /\d{4,}|چقدر|چه تعداد|دست کی|وضعیت (?:این|همین|درخواست من)/;
const panelDomains = [
  'travel-issuance',
  'customer-affairs',
  'package-generator',
  'petty-cash',
  'correspondence',
  'purchase',
  'reservation-report',
] as const;

function matchPanelGuidance(
  question: string,
  pathname: string | null,
  canOpen: (href: string) => boolean,
  specificOnly = false,
) {
  const normalized = normalizeQuestion(question);
  const asksForGuide =
    procedural.test(normalized) ||
    (specificOnly && /چرا|مبنای|معنی|فرق|تفاوت/.test(normalized));
  if (!asksForGuide || record.test(normalized)) return;
  const candidates = panelDomains.flatMap((domain) =>
    assistantGuideCatalogues[domain].topics.flatMap((section) => {
      if (
        !canOpen(section.href) ||
        (specificOnly && !('specific' in section && section.specific))
      )
        return [];
      const aliases = 'aliases' in section ? section.aliases : [];
      const score = aliases.reduce(
        (best, alias) =>
          containsQuestionPhrase(normalized, alias)
            ? Math.max(best, normalizeQuestion(alias).split(' ').length)
            : best,
        0,
      );
      return score
        ? [{ domain, section, score, onPanel: pathname === section.href }]
        : [];
    }),
  );
  candidates.sort(
    (a, b) => b.score - a.score || Number(b.onPanel) - Number(a.onPanel),
  );
  const first = candidates[0];
  if (!first) return;
  const second = candidates[1];
  if (
    second &&
    first.score === second.score &&
    first.onPanel === second.onPanel
  )
    return;
  return first;
}

export function retrieveSpecificPanelGuide(question: string, pathname: string) {
  const match = matchPanelGuidance(question, pathname, () => true, true);
  return match ? match.domain + '/' + match.section.id : undefined;
}

export function retrievePanelGuidance(
  question: string,
  pathname: string | null,
  canOpen: (href: string) => boolean,
) {
  const first = matchPanelGuidance(question, pathname, canOpen);
  if (!first) return [];
  const selected = [first.section];
  for (const ref of first.section.related) {
    const [domain, id] = ref.split('/');
    if (!domain || !isAssistantGuideModule(domain)) continue;
    const related = assistantGuideSection(domain, id);
    if (related && canOpen(related.href)) return [first.section, related];
  }
  return selected;
}

const salesPanelDomains = [
  'marketing',
  'package-management',
  'floating-packages',
] as const;
const salesPanelTopics = salesPanelDomains.flatMap((domain) =>
  assistantGuideCatalogues[domain].topics.map((section) => ({
    domain,
    section,
  })),
);

export function retrieveSalesPanelGuide(
  message: string,
  pathname: string | null,
  previous?: string,
) {
  const text = normalizeQuestion(message);
  if (/^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(text))
    return salesPanelTopics.find(
      ({ section }) => section.guideHref === previous,
    )?.section;

  const domain = matchesQuestion(text, /مارکتینگ|بازاریابی|کمپین/)
    ? 'marketing'
    : matchesQuestion(text, /پکیج شناور|پکیج های شناور|تور شناور/)
      ? 'floating-packages'
      : matchesQuestion(text, /مدیریت پکیج|بستن پکیج/)
        ? 'package-management'
        : undefined;
  if (!domain && matchesQuestion(text, /پک جنریتور|پکیج های روز|قرارداد فروش/))
    return;
  if (!procedural.test(text) && !matchesQuestion(text, /چرا|فرق|تفاوت|کجا|کجاست/))
    return;
  if (
    record.test(text) ||
    matchesQuestion(text, /این کمپین|همین کمپین|این پکیج|همین پکیج/)
  ) {
    if (
      domain ||
      pathname?.startsWith('/marketing') ||
      pathname?.startsWith('/sales/pricing')
    )
      return 'record' as const;
    return;
  }
  const candidates = salesPanelTopics
    .filter((item) => !domain || item.domain === domain)
    .map(({ section }) => ({
      section,
      onPanel: section.href.split('?')[0] === pathname,
      score: Math.max(
        0,
        ...section.aliases
          .filter((alias) => containsQuestionPhrase(text, alias))
          .map((alias) => normalizeQuestion(alias).split(' ').length),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(b.onPanel) - Number(a.onPanel));
  const [first, second] = candidates;
  if (
    first &&
    (first.score !== second?.score || first.onPanel !== second.onPanel)
  )
    return first.section;
  if (
    first ||
    domain ||
    (pathname?.startsWith('/sales/pricing') &&
      matchesQuestion(text, /پکیج|قیمت|انتشار/))
  )
    return 'clarify' as const;
}
