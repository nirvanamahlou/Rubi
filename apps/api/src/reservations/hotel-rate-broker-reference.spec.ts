import { expect, it } from 'vitest';
import {
  hotelRateBrokerFields,
  hotelRateBrokerId,
} from './hotel-rate-broker-reference';

it('persists a registered broker using its own FK and projects its original ID', () => {
  const fields = hotelRateBrokerFields('registered', 'BROKER');
  expect(fields).toEqual({ brokerId: null, registeredBrokerId: 'registered' });
  expect(hotelRateBrokerId(fields)).toBe('registered');
});

it('preserves historical organization references without converting data', () => {
  const fields = hotelRateBrokerFields('legacy', 'ORGANIZATION');
  expect(fields).toEqual({ brokerId: 'legacy', registeredBrokerId: null });
  expect(hotelRateBrokerId(fields)).toBe('legacy');
  expect(hotelRateBrokerId({ brokerId: 'legacy' })).toBe('legacy');
});

it('rejects missing references instead of returning an invalid broker ID', () => {
  expect(() => hotelRateBrokerId({ brokerId: null })).toThrow();
});
