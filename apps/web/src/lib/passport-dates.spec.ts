import { expect, it } from 'vitest';
import { tehranToday, passportExpiryWarning } from './passport-dates';
import { parseTypedCustomerDate } from '@/modules/customers/model/customer-calendar';
it('uses Tehran today and warns only below six calendar months with month-end clamping', () => {
  expect(tehranToday(new Date('2026-10-18T21:00:00Z'))).toBe('2026-10-19');
  expect(passportExpiryWarning('2027-04-18', '2026-10-19')).toBe(true);
  expect(passportExpiryWarning('2027-04-19', '2026-10-19')).toBe(false);
  expect(passportExpiryWarning('2026-10-18', '2026-10-19')).toBe(false);
  expect(passportExpiryWarning('2027-02-27', '2026-08-31')).toBe(true);
  expect(passportExpiryWarning('2027-02-28', '2026-08-31')).toBe(false);
});
it('accepts typed Persian and Gregorian dates and rejects impossible days', () => {
  expect(parseTypedCustomerDate('۱۴۰۵/۰۱/۰۱', 'persian')).toBe('2026-03-21');
  expect(parseTypedCustomerDate('2000/02/29', 'gregorian')).toBe('2000-02-29');
  expect(parseTypedCustomerDate('2026/02/30', 'gregorian')).toBeNull();
  expect(parseTypedCustomerDate('1405/13/01', 'persian')).toBeNull();
});
