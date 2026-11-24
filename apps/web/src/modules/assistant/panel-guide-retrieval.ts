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

export function retrievePanelGuidance(
  question: string,
  pathname: string | null,
  canOpen: (href: string) => boolean,
) {
  const normalized = normalizeQuestion(question);
  if (!procedural.test(normalized) || record.test(normalized)) return [];
  const candidates = panelDomains.flatMap((domain) =>
    assistantGuideCatalogues[domain].topics.flatMap((section) => {
      if (!canOpen(section.href)) return [];
      const score = section.aliases.reduce(
        (best, alias) =>
          containsQuestionPhrase(normalized, alias)
            ? Math.max(best, normalizeQuestion(alias).split(' ').length)
            : best,
        0,
      );
      return score
        ? [{ section, score, onPanel: pathname === section.href }]
        : [];
    }),
  );
  candidates.sort(
    (a, b) => b.score - a.score || Number(b.onPanel) - Number(a.onPanel),
  );
  const first = candidates[0];
  if (!first) return [];
  const second = candidates[1];
  if (
    second &&
    first.score === second.score &&
    first.onPanel === second.onPanel
  )
    return [];
  const selected = [first.section];
  for (const ref of first.section.related) {
    const [domain, id] = ref.split('/');
    if (!domain || !isAssistantGuideModule(domain)) continue;
    const related = assistantGuideSection(domain, id);
    if (related && canOpen(related.href)) return [first.section, related];
  }
  return selected;
}
