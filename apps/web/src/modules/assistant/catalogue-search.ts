import {
  assistantGuideCatalogues,
  type GuideSection,
  type AssistantGuideModule,
} from './assistant-guide-registry';
import { buildGuidePhraseIndex } from './guide-phrase-index';
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

export function findCatalogueTopics(
  message: string,
  pathname: string | null,
  allowed: (s: GuideSection) => boolean,
) {
  const text = normalizeQuestion(message);
  search ??= buildGuidePhraseIndex(entries, ({ section }) => [
    section.title,
    ...(section.aliases ?? []),
    ...(section.terms ?? []).filter((term) =>
      normalizeQuestion(term).includes(' '),
    ),
  ]);
  const named = searchPanelNames(text);
  const longest = Math.max(0, ...named.map((hit) => hit.score));
  // The panel name narrows the search. Its own words should not outscore the requested action.
  const explicit = named.filter((hit) => hit.score === longest);
  const subject = explicit
    .reduce((rest, { item }) => rest.replace(item.name, ' '), text)
    .replace(/\s+/g, ' ')
    .trim();
  const subjectHits = search(subject);
  const hasScopedHit = subjectHits.some(({ item }) =>
    explicit.some((hit) => hit.item.domain === item.domain),
  );
  const candidates = (
    explicit.length && !hasScopedHit ? search(text) : subjectHits
  )
    .filter(
      ({ item }) =>
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
