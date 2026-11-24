import { compileQuestionPhrase, normalizeQuestion } from './question-text';

/** Each posting keeps the original section, so permission and page checks use the current request. */
export function buildGuidePhraseIndex<T>(
  items: Iterable<T>,
  phrases: (item: T) => readonly string[],
) {
  type Posting = { item: T; phrase: string; pattern?: RegExp; weight: number };
  const postings = new Map<string, Posting[]>();
  let longest = 0;
  for (const item of items) {
    for (const phrase of new Set(phrases(item).map(normalizeQuestion))) {
      const first = phrase.match(/[\p{L}\p{N}]+/u)?.[0];
      if (!first) continue;
      longest = Math.max(longest, first.length);
      const bucket = postings.get(first) ?? [];
      bucket.push({
        item,
        phrase,
        weight: phrase.split(' ').length,
      });
      postings.set(first, bucket);
    }
  }
  return (normalized: string) => {
    const scores = new Map<T, number>();
    const checked = new Set<string>();
    for (const token of normalized.match(/[\p{L}\p{N}]+/gu) ?? []) {
      // An attached Persian plural or possessive can extend the first token.
      for (let end = 1; end <= Math.min(token.length, longest); end++) {
        const prefix = token.slice(0, end);
        const bucket = postings.get(prefix);
        if (!bucket || checked.has(prefix)) continue;
        checked.add(prefix);
        for (const posting of bucket) {
          if (!normalized.includes(posting.phrase)) continue;
          const pattern = (posting.pattern ??= compileQuestionPhrase(
            posting.phrase,
          ));
          if (pattern.test(normalized))
            scores.set(
              posting.item,
              Math.max(posting.weight, scores.get(posting.item) ?? 0),
            );
        }
      }
    }
    return [...scores].map(([item, score]) => ({ item, score }));
  };
}
