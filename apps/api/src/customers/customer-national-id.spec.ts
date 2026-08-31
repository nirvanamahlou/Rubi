import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import {
  CustomerNationalIdProtector,
  isValidIranianNationalId,
  normalizeNationalId,
} from './customer-national-id';

const encryptionKey = Buffer.from('0123456789abcdef0123456789abcdef').toString(
  'base64',
);
const fingerprintKey = Buffer.from('abcdef0123456789abcdef0123456789').toString(
  'base64',
);

describe('Customer national ID protection', () => {
  it('normalizes Persian digits and validates the Iranian checksum', () => {
    expect(normalizeNationalId(' ۱۲۳۴۵۶۷۸۹۱ ')).toBe('1234567891');
    expect(isValidIranianNationalId('1234567891')).toBe(true);
    expect(isValidIranianNationalId('1234567890')).toBe(false);
    expect(isValidIranianNationalId('1111111111')).toBe(false);
  });

  it('returns only ciphertext, fingerprint and a masked value', () => {
    const protector = new CustomerNationalIdProtector(
      new ConfigService({
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: encryptionKey,
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: fingerprintKey,
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
      }),
    );
    const protectedValue = protector.protect('1234567891');

    expect(protectedValue.nationalIdMasked).toBe('******7891');
    expect(protectedValue.nationalIdFingerprint).toHaveLength(64);
    expect(JSON.stringify(protectedValue)).not.toContain('1234567891');
    expect(protector.decrypt(protectedValue)).toBe('1234567891');
  });

  it('returns null for a legacy empty identity and rejects tampering', () => {
    const protector = new CustomerNationalIdProtector(
      new ConfigService({
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: encryptionKey,
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: fingerprintKey,
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
      }),
    );
    expect(
      protector.decrypt({
        nationalIdEncrypted: null,
        nationalIdIv: null,
        nationalIdAuthTag: null,
        nationalIdKeyVersion: null,
      }),
    ).toBeNull();
    const protectedValue = protector.protect('1234567891');
    expect(() =>
      protector.decrypt({
        ...protectedValue,
        nationalIdEncrypted: `${protectedValue.nationalIdEncrypted.slice(0, -2)}AA`,
      }),
    ).toThrow();
  });

  it.each(['', '123', '1234567890', '1111111111'])(
    'rejects invalid national ID %j',
    (value) => {
      const protector = new CustomerNationalIdProtector(
        new ConfigService({
          CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: encryptionKey,
          CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: fingerprintKey,
          CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
        }),
      );
      expect(() => protector.protect(value)).toThrow(BadRequestException);
    },
  );
});
