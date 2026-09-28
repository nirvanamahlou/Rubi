export interface LeadIntakeAttempt {
  signature: string;
  sourceReference: string;
  idempotencyKey: string;
  contactOccurredAt: string;
}

export function resolveLeadIntakeAttempt(
  signature: string,
  previous: LeadIntakeAttempt | null,
  createId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): LeadIntakeAttempt {
  if (previous?.signature === signature) return previous;
  const id = createId();
  return {
    signature,
    sourceReference: `manual-${id}`,
    idempotencyKey: id,
    contactOccurredAt: now(),
  };
}
