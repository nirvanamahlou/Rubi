import { describe, expect, it } from 'vitest';
import { telephonyDraftName } from './telephony-draft';
describe('telephony popup name default', () => {
  it('prefers the saved operator name', () => {
    expect(
      telephonyDraftName({
        call: { name: 'نام ثبت‌شده' },
        technical: { callerName: 'شرکت نمونه' },
      }),
    ).toBe('نام ثبت‌شده');
  });
  it('prefills empty names and tolerates old snapshots', () => {
    expect(
      telephonyDraftName({
        call: { name: '' },
        technical: { callerName: 'شرکت نمونه' },
      }),
    ).toBe('شرکت نمونه');
    expect(telephonyDraftName({ call: { name: '' }, technical: {} })).toBe('');
  });
});
