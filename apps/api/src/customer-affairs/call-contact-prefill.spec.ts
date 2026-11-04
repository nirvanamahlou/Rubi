import { expect, it } from 'vitest';
import { callContactPrefill } from './call-contact-prefill';
it('prefills identity/source only and skips empty recent call identities', () => {
  expect(
    callContactPrefill([
      { name: '', source: 'نامشخص' },
      {
        name: 'Known contact',
        source: 'سایت',
        note: 'old private note',
        subject: 'old subject',
      } as never,
    ]),
  ).toEqual({ name: 'Known contact', source: 'سایت' });
  expect(callContactPrefill([])).toEqual({ name: '', source: 'نامشخص' });
});
