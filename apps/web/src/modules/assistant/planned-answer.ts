import { z } from 'zod';
const link = z.object({
  href: z
    .string()
    .max(600)
    .regex(/^\/[a-z][a-z0-9-]*(?:[/?#][a-zA-Z0-9/#?%=&:._-]*)?$/),
  label: z.string().min(1).max(200),
});
export const plannedAnswer = z
  .object({
    version: z.literal(3),
    parts: z
      .array(
        z
          .object({
            question: z.string().min(1).max(4000),
            status: z.enum([
              'answer',
              'empty',
              'clarify',
              'unavailable',
              'denied',
              'partial',
            ]),
            text: z.string().min(1).max(14000),
            links: z.array(link).max(12),
            source: z.string().max(512).optional(),
            observedAt: z.string().datetime().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export type AnswerPart = z.infer<typeof plannedAnswer>['parts'][number];

export function summarizeParts(parts: AnswerPart[]) {
  return parts
    .map((part) => {
      const lines = part.text.split('\n');
      // Keep currency subtotals and precision notices together. The complete
      // procedure or list of rows is available in the expandable evidence.
      const preview = part.source?.startsWith('/assistant-guides/')
        ? 4
        : /^فهرست قراردادها/u.test(part.text)
          ? 4
          : lines.length;
      return lines.length > preview
        ? [...lines.slice(0, preview), '…'].join('\n')
        : part.text;
    })
    .join('\n\n');
}
