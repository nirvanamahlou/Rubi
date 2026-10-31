import { expect, it } from 'vitest';
import type { Call } from './model';
import { refreshCallRecipient } from './operational-call-popup';

it('refreshes confirmed answer identity while preserving the business conflict baseline', () => {
  const before = {
    id: 'call',
    operator: 'نامشخص',
    name: 'Original',
    subject: 'Original subject',
    note: 'Original note',
    source: 'Original source',
  } as Call;
  const latest = {
    ...before,
    name: 'Concurrent change',
    subject: 'Concurrent subject',
    operator: 'داخلی 404',
    answerRecipient: { extension: '404', label: 'کارشناس آزمایشی' },
  } as Call;
  const result = refreshCallRecipient(before, latest);
  expect(result.answerRecipient).toEqual(latest.answerRecipient);
  expect(result.operator).toBe('داخلی 404');
  expect(result.name).toBe(before.name);
  expect(result.subject).toBe(before.subject);
  expect(result.note).toBe(before.note);
  expect(result.source).toBe(before.source);
  expect(before.operator).toBe('نامشخص');
});

it('does not infer an answered recipient before provider confirmation', () => {
  const initial = { id: 'call', operator: 'نامشخص' } as Call;
  expect(refreshCallRecipient(null, initial)).toBe(initial);
  expect(
    refreshCallRecipient(initial, initial).answerRecipient,
  ).toBeUndefined();
});
