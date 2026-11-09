import { ConfigService } from '@nestjs/config';
import { expect, it } from 'vitest';
import type { InsurancePassengerInputV1 } from '@nora/contracts';
import { InsuranceApplicantCrypto } from './insurance-applicant.crypto';
const crypto = new InsuranceApplicantCrypto(
  new ConfigService({
    CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 8).toString(
      'base64',
    ),
    CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
      'base64',
    ),
    CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
  }),
);
it('encrypts private values with random nonces and binds them to applicant and branch', () => {
  const input = {
    email: 'synthetic@example.invalid',
    passportNo: 'SYNTHETIC',
  } as InsurancePassengerInputV1;
  const envelope = crypto.seal('applicant', 'branch', input);
  expect(envelope).not.toContain(input.email);
  expect(crypto.seal('applicant', 'branch', input)).not.toBe(envelope);
  expect(crypto.open('applicant', 'branch', envelope)).toEqual(input);
  expect(() => crypto.open('other', 'branch', envelope)).toThrow();
  expect(() => crypto.open('applicant', 'other', envelope)).toThrow();
  expect(() =>
    crypto.open('applicant', 'branch', envelope.slice(0, -8)),
  ).toThrow();
});
it('keys replay fingerprints to the request and the protected input', () => {
  expect(crypto.fingerprint('key', { email: 'one@example.invalid' })).toBe(
    crypto.fingerprint('key', { email: 'one@example.invalid' }),
  );
  expect(
    crypto.fingerprint('other', { email: 'one@example.invalid' }),
  ).not.toBe(crypto.fingerprint('key', { email: 'one@example.invalid' }));
});
