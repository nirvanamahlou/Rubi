import { expect, it } from 'vitest';
import { lookupSelectedLabel } from './controls';

it('resolves saved Persian broker labels by ID to the current English choice', () => {
  const saved = { id: 'broker', name: 'نام قدیمی فارسی' };
  expect(
    lookupSelectedLabel('brokers', saved, [
      { id: 'broker', name: 'Registered English' },
    ]),
  ).toBe('Registered English');
  expect(lookupSelectedLabel('brokers', saved, [])).not.toMatch(
    /[\u0600-\u06ff]/u,
  );
  expect(lookupSelectedLabel('brokers', null, [])).toBeUndefined();
});

it('keeps currency and other reference display rules unchanged', () => {
  expect(
    lookupSelectedLabel('currencies', { id: 'IRR', name: 'ریال (IRR)' }, [
      { id: 'IRR', name: 'Other label' },
    ]),
  ).toBe('ریال (IRR)');
});
