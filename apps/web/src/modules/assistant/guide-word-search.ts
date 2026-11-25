import { normalizeQuestion } from './question-text';
import type { GuideSection } from './assistant-guide-registry';

import vocabulary from './guide-search-vocabulary.json';

const folds = new Map(Object.entries(vocabulary.normalize));
const stop = new Set(vocabulary.stopWords);

export function normalizeGuideQuery(value: string) {
  return normalizeQuestion(value).split(' ').map((term) => {
    const alias = folds.get(term);
    if (alias) return alias;
    if (/^(?:فایل|پکیج|قرارداد|کار|اعلان)ای$/u.test(term)) return term.slice(0,-2) + ' های';
    if (/^(?:پکیج|فایل|قرارداد|روز|گزارش|کشور|هتل|ویز|تقویم)و$/u.test(term)) return term.slice(0,-1);
    return term;
  }).join(' ');
}

function words(value: string) {
  const tokens = normalizeQuestion(value).match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(
    tokens.flatMap((token) => {
      if (stop.has(token)) return [];
      // Colloquial attached object marks, e.g. «تقویمو» and «قراردادارو».
      const base =
        token.length > 4
          ? token.replace(
              /(?:های(?:مون|تون|شون|ی)?|ها(?:مون|تون|شون|ش)?|ای|ارو|ایو|و)$/u,
              '',
            )
          : token;
      const term = folds.get(base) ?? base;
      return term.length > 1 && !stop.has(term) ? [term] : [];
    }),
  );
}

export function buildGuideWordSearch(sections: readonly GuideSection[]) {
  const frequency = new Map<string, number>();
  const index = sections.map((section) => {
    const title = words(section.title);
    const subject = words(
      [
        section.title,
        ...(section.aliases ?? []),
        ...(section.terms ?? []),
      ].join(' '),
    );
    const body = words(section.steps.join(' '));
    for (const token of new Set([...subject, ...body]))
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    return { section, title, subject, body };
  });
  return (question: string) => {
    const terms = [...words(question)];
    if (terms.length < 2) return [];
    const weights = terms.map(
      (word) =>
        Math.log((sections.length + 1) / ((frequency.get(word) ?? 0) + 1)) + 1,
    );
    const total = weights.reduce((a, b) => a + b, 0);
    const ranked = index
      .map(({ section, title, subject, body }) => {
        let score = 0,
          coverage = 0,
          matches = 0,
          anchors = 0;
        terms.forEach((term, i) => {
          if (!subject.has(term) && !body.has(term)) return;
          matches++;
          if (subject.has(term)) anchors++;
          coverage += weights[i]!;
          score +=
            weights[i]! * (title.has(term) ? 3 : subject.has(term) ? 2 : 0.6);
        });
        return { section, score, matches, anchors, coverage: coverage / total };
      })
      .filter((r) => r.matches >= 2 && r.anchors > 0 && r.coverage >= 0.57)
      .sort((a, b) => b.score - a.score);
    const [best, second] = ranked;
    if (!best || (second && best.score < second.score * 1.17)) return [];
    return [best.section];
  };
}
