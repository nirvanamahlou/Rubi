import {
  assistantGuideCatalogues,
  assistantGuideSection,
  isAssistantGuideModule,
} from './assistant-guide-registry';
import { containsQuestionPhrase, normalizeQuestion } from './question-text';

const procedural =
  /چطور|چگونه|چجور|چیکار|از کجا|نحوه|مراحل|راهنما|آموزش|چه طور/;
const record = /\d{4,}|چقدر|چه تعداد|دست کی|وضعیت (?:این|همین|درخواست من)/;
const panelDomains = [
  'travel-issuance',
  'customer-affairs',
  'package-generator',
  'petty-cash',
  'correspondence',
] as const;

function matchPanelGuidance(
  question: string,
  pathname: string | null,
  canOpen: (href: string) => boolean,
  specificOnly = false,
) {
  const normalized = normalizeQuestion(question);
  if (!procedural.test(normalized) || record.test(normalized)) return;
  const candidates = panelDomains.flatMap((domain) =>
    assistantGuideCatalogues[domain].topics.flatMap((section) => {
      if (
        !canOpen(section.href) ||
        (specificOnly && !('specific' in section && section.specific))
      )
        return [];
      const score = section.aliases.reduce(
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
