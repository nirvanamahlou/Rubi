import { createHash } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { CustomerContactCrypto } from './customer-contact.crypto';

function cryptoWithKeys(encryptionByte = 1, fingerprintByte = 2) {
  const values: Record<string, string | number> = {
    CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(
      32,
      encryptionByte,
    ).toString('base64'),
    CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(
      32,
      fingerprintByte,
    ).toString('base64'),
    CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
  };
  return new CustomerContactCrypto({
    getOrThrow: (key: string) => values[key],
  } as ConfigService);
}

describe('CustomerContactCrypto', () => {
  it('uses deterministic keyed HMAC fingerprints rather than plain SHA-256', () => {
    const value = '0000000000';
    const first = cryptoWithKeys();
    const second = cryptoWithKeys();
    const rotated = cryptoWithKeys(1, 3);
    expect(first.fingerprint(value)).toBe(second.fingerprint(value));
    expect(first.fingerprint(value)).not.toBe(
      createHash('sha256').update(value).digest('hex'),
    );
    expect(first.fingerprint(value)).not.toBe(rotated.fingerprint(value));
    expect(first.fingerprint(value)).toBe(
      cryptoWithKeys(9, 2).fingerprint(value),
    );
  });

  it('uses random IVs and authenticated encryption for round trips', () => {
    const crypto = cryptoWithKeys();
    const first = crypto.protect('phone', '0000000000', '0000•••000');
    const second = crypto.protect('phone', '0000000000', '0000•••000');
    expect(first.encryptionIv).not.toBe(second.encryptionIv);
    expect(first.encryptedValue).not.toBe(second.encryptedValue);
    expect(
      crypto.decrypt({
        type: 'PHONE',
        encryptedValue: first.encryptedValue,
        encryptionIv: first.encryptionIv,
        encryptionAuthTag: first.encryptionAuthTag,
        encryptionKeyVersion: first.encryptionKeyVersion,
      }),
    ).toBe('0000000000');
  });

  it('returns only a safe error when authentication fails', () => {
    const crypto = cryptoWithKeys();
    const protectedValue = crypto.protect(
      'email',
      'synthetic@example.test',
      'sy•••@example.test',
    );
    try {
      crypto.decrypt({
        type: 'EMAIL',
        ...protectedValue,
        encryptionAuthTag: Buffer.alloc(16, 9).toString('base64'),
      });
      throw new Error('Expected decryption to fail.');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Contact decryption integrity check failed.',
      });
      expect(String(error)).not.toContain('synthetic@example.test');
      expect(String(error)).not.toContain(protectedValue.encryptedValue);
    }
  });
});
