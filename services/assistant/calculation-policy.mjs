import { ServiceError } from './errors.mjs';

/** Shared answer contract for every connected ERP domain, including future tools. */
export const CALCULATION_POLICY = `Calculation transparency applies to ALL ERP domains and tools, not only Sales or contracts. For any count, sum, average, percentage, ratio, balance, difference, comparison or other derived value, explain how the reported result was calculated from the cited current evidence. State the metric/record grain and source, actual period and date basis/timezone, authorized scope and applied filters, included/excluded statuses or rows, formula and relevant subtotals/operands, units/currency, rounding and known missing/truncated data. Obtain results and intermediate numbers from authorized tools using exact arithmetic; never invent operands or recompute monetary figures with floating-point. State only applicable facts supported by tools; explicitly identify unavailable coverage instead of inventing it. Keep currencies separate unless a verified conversion source is supplied; distinguish a zero result from unavailable data and a recorded payment from confirmed collection. Prevent double-counting in joins; for ratios name the numerator and denominator and handle zero denominators without inventing a percentage. Let the question and evidence determine whether concise prose, a list, a formula or a table communicates best: NO fixed table, mandatory row layout or module-specific response template. The public explanation is a reproducible calculation summary, never private chain of thought, credentials, raw unrestricted SQL or additional sensitive fields. For a calculated ANSWER supply calculationExplanation as a nonempty string containing that user-facing explanation in the user's language, using your chosen text/table layout. Keep this explanation exclusively in calculationExplanation. In text, present the requested findings and relevant report period. The runtime adds the method only on explicit request. Never put source labels or observation timestamps in text. Cite the actual resultIds used. For non-calculated responses this field may be omitted or null. Do not claim that an unconnected domain has been read. This rule remains mandatory when new domains/tools are added. For Persian questions, ALL public prose, calculationExplanation, headings, table labels, formulas and limitations must use Persian business wording. Never expose English prose or internal tool/schema/column/JSON names. Translate meanings accurately: non-cancelled is not automatically active. Use Persian currency and status names. Preserve exact numeric operands, record references and original proper names; never fabricate stored data. Internal SQL, tool arguments and evidence are unchanged. Use concise headings, **bold**, lists or pipe tables; do not emit HTML, images or executable links.`;

export function calculationMetadataValid(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) =>
      ['required', 'operations'].includes(key),
    ) &&
    typeof value.required === 'boolean' &&
    Array.isArray(value.operations) &&
    value.operations.length <= 20 &&
    value.operations.every(
      (op) => typeof op === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(op),
    )
  );
}

export function requestsCalculationExplanation(message) {
  return /(?:نحوه|روش|مبنای|مبنا) (?:محاسبه|شمارش|رتبه بندی)|(?:محاسبه|حساب|شمارش) (?:کردی|کردید|شد)|چ(?:طور|طوری|گونه).*?(?:محاسبه|حساب|شمرد)|\b(?:calculation method|methodology|how .*calculat)/iu.test(
    message.replace(/[‌‍]/g, ' '),
  );
}

export function explainedAnswerText(answer, required, showMethod = true) {
  const explanation = answer.calculationExplanation;
  if (
    explanation != null &&
    (typeof explanation !== 'string' || explanation.length > 4000)
  )
    throw new ServiceError(502, 'INVALID_CALCULATION_EXPLANATION');
  if (answer.status === 'ANSWER' && required && !explanation?.trim())
    throw new ServiceError(502, 'CALCULATION_EXPLANATION_REQUIRED');
  const text = answer.text.trim();
  const note = explanation?.trim();
  const displayed =
    answer.status === 'ANSWER' && note
      ? showMethod
        ? text.includes(note)
          ? text
          : text + '\n\n' + note
        : text.replaceAll(note, '').trim()
      : text;
  if (!displayed)
    throw new ServiceError(502, 'INVALID_CALCULATION_EXPLANATION');
  if (displayed.length > 6000)
    throw new ServiceError(502, 'CALCULATION_EXPLANATION_TOO_LONG');
  return displayed;
}
