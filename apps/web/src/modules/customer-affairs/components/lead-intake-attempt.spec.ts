import { describe, expect, it } from 'vitest';
import { resolveLeadIntakeAttempt } from './lead-intake-attempt';

describe('manual lead intake identity', () => {
  it('keeps the same source, key, and contact time when an unchanged form is retried', () => {
    const first = resolveLeadIntakeAttempt(
      'form-a',
      null,
      () => 'first-id',
      () => '2026-09-28T08:00:00.000Z',
    );
    const retried = resolveLeadIntakeAttempt(
      'form-a',
      first,
      () => 'unused-id',
      () => '2026-09-28T09:00:00.000Z',
    );
    expect(retried).toBe(first);
  });

  it('uses a new source and key for a distinct submission', () => {
    const first = resolveLeadIntakeAttempt('form-a', null, () => 'first-id');
    const second = resolveLeadIntakeAttempt('form-b', first, () => 'second-id');
    expect(second.sourceReference).toBe('manual-second-id');
    expect(second.sourceReference).not.toBe(first.sourceReference);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });
});
