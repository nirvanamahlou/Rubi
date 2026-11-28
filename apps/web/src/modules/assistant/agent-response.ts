import { z } from 'zod';

/** Local UI metadata is never part of the strict v2/v3 conversation request. */
export function conversationHistory(
  messages: readonly {
    role: 'user' | 'assistant';
    content: string;
    local?: boolean;
  }[],
) {
  return messages
    .filter((item) => !item.local)
    .slice(-12)
    .map(({ role, content }) => ({ role, content: content.slice(0, 1000) }));
}

export const agentResponseSchema = z
  .object({
    version: z.literal(3),
    status: z.enum(['ANSWER', 'CLARIFY', 'REPLY']),
    text: z.string().min(1).max(6000),
    reportParts: z
      .object({
        summary: z.string().max(6000),
        contracts: z.string().max(6000).optional(),
      })
      .strict()
      .optional(),
    reportHref: z
      .string()
      .regex(
        /^\/sales\?salesPeriodAsOf=\d{4}-\d{2}-\d{2}T\d{2}(?:%3A|:)\d{2}(?:%3A|:)\d{2}\.\d{3}Z$/i,
      )
      .optional(),
    reportCoverage: z
      .object({
        total: z.number().int().nonnegative(),
        listed: z.number().int().nonnegative(),
        missingAmounts: z.number().int().nonnegative(),
        truncated: z.boolean(),
        currencyTotalsOmitted: z.boolean(),
        rowCurrenciesOmitted: z.boolean(),
      })
      .strict()
      .optional(),
    plan: z.array(z.string().max(200)).max(5),
    sources: z
      .array(
        z
          .object({
            resultId: z.string().uuid(),
            kind: z.literal('panel-count-breakdown').optional(),
            sources: z
              .array(
                z.enum([
                  'contracts',
                  'passengers',
                  'services',
                  'amounts',
                  'payments',
                ]),
              )
              .max(5),
            observedAt: z.string().datetime(),
            truncated: z.boolean(),
          })
          .strict(),
      )
      .max(6),
    limitations: z.array(z.string().max(500)).max(9),
    requestId: z.string().uuid(),
  })
  .strict()
  .refine((value) => value.status !== 'ANSWER' || value.sources.length > 0);
