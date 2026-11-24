/** Shared Persian lexical matching. JavaScript \b does not bound Persian words. */
export function normalizeQuestion(text: string) {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[\u064b-\u065f\u0670ـ]/g, '')
      .replace(/[\u200c\u200d]/g, ' ')
      .replace(/قرار\s+داد/g, 'قرارداد')
      .replace(/(^|\s)ازکجا/g, '$1از کجا')
      // Preserve date/contract identifier separators consumed by native readers.
      .replace(/[؟?!.،؛:()[\]{}"'«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function boundedPattern(pattern: RegExp) {
  // Allow ordinary attached Persian plural/possessive endings, not arbitrary substrings.
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:${pattern.source})(?=$|[^\\p{L}\\p{N}]|(?:ها(?:یی?)?(?:م|ت|ش|مان|تان|شان)?|ان|ش|شان|مان|تان|م|ت)(?:$|[^\\p{L}\\p{N}]))`,
    'iu',
  );
}

// Routing patterns are supplied by code and catalogues. Never use a user's question as a cache key.
const routingPatterns = new Map<string, RegExp>();

export function matchesQuestion(text: string, pattern: RegExp) {
  let bounded = routingPatterns.get(pattern.source);
  if (!bounded) {
    bounded = boundedPattern(pattern);
    if (routingPatterns.size < 512)
      routingPatterns.set(pattern.source, bounded);
  }
  return bounded.test(text);
}

export function compileQuestionPhrase(phrase: string) {
  const literal = normalizeQuestion(phrase).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return boundedPattern(new RegExp(literal || '(?!)'));
}

export function containsQuestionPhrase(text: string, phrase: string) {
  return compileQuestionPhrase(phrase).test(text);
}
