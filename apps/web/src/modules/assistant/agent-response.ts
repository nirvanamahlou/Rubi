import { z } from 'zod';
export const agentResponseSchema = z
  .object({
    version: z.literal(3),
    status: z.enum(['ANSWER', 'CLARIFY', 'REPLY']),
    text: z.string().min(1).max(6000),
    plan: z.array(z.string().max(200)).max(5),
    sources: z
      .array(
        z
          .object({
            resultId: z.string().uuid(),
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
