import { expect, it } from 'vitest';
import { matchesContactColumns } from './contact-column-filters';
const call = {
  direction: 'INBOUND',
  outcome: null,
  source: '',
  operator: 'داخلی 369',
  answerRecipient: { label: 'HR منابع انسانی - کارمند آزمایشی - 369' },
  needsCompletion: true,
};
it.each([
  [{ direction: 'INBOUND' }, true],
  [{ direction: 'OUTBOUND' }, false],
  [{ outcome: 'UNKNOWN' }, true],
  [{ outcome: 'NO_ANSWER' }, false],
  [{ source: 'نامشخص' }, true],
  [{ source: 'سایت' }, false],
  [{ unit: call.answerRecipient.label }, true],
  [{ unit: 'داخلی 369' }, false],
  [{ incomplete: 'YES' }, true],
  [{ incomplete: 'NO' }, false],
  [
    {
      direction: 'INBOUND',
      unit: call.answerRecipient.label,
      incomplete: 'YES',
    },
    true,
  ],
  [{ direction: 'OUTBOUND', unit: call.answerRecipient.label }, false],
])('matches the visible contact columns: %j', (filters, expected) =>
  expect(matchesContactColumns(call, filters)).toBe(expected),
);
it('matches unknown source and destination exactly as displayed', () =>
  expect(
    matchesContactColumns(
      { ...call, answerRecipient: undefined, operator: '' },
      { unit: 'نامشخص', source: 'نامشخص' },
    ),
  ).toBe(true));
