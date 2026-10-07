import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import {
  MasterDataContactCrypto,
  normalizeMasterContact,
  normalizeTravelPhone,
} from './master-data-contact.crypto';

function cryptoService() {
  return new MasterDataContactCrypto(
    new ConfigService({
      MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 7).toString(
        'base64',
      ),
    }),
  );
}

describe('MasterDataContactCrypto', () => {
  it('encrypts phone values and only exposes a stable mask', () => {
    const service = cryptoService();
    const protectedPhone = service.protect('phone', '+98 912 123 4567');

    expect(protectedPhone.encrypted).not.toContain('0912');
    expect(protectedPhone.masked).toContain('4567');
    expect(protectedPhone.masked).not.toContain('123');
    expect(
      service.decrypt('phone', {
        encrypted: protectedPhone.encrypted,
        encryptionIv: protectedPhone.encryptionIv,
        encryptionAuthTag: protectedPhone.encryptionAuthTag,
        encryptionKeyVersion: protectedPhone.encryptionKeyVersion,
      }),
    ).toBe('+989121234567');
  });

  it('normalizes email before encryption and masks its local part', () => {
    const service = cryptoService();
    const protectedEmail = service.protect('email', ' Name@Example.COM ');

    expect(protectedEmail.masked).toBe('n•••@example.com');
    expect(
      service.decrypt('email', {
        encrypted: protectedEmail.encrypted,
        encryptionIv: protectedEmail.encryptionIv,
        encryptionAuthTag: protectedEmail.encryptionAuthTag,
        encryptionKeyVersion: protectedEmail.encryptionKeyVersion,
      }),
    ).toBe('name@example.com');
  });

  it.each([
    ['۰۹۱۲ ۱۲۳ ۴۵۶۷', '09121234567'],
    ['٠٠٩٠ (٥٥٥) ١٢٣-٤٥٦٧', '00905551234567'],
    ['123', '123'],
    ['1', '1'],
    ['+1 (212) 555-0199 ext. 42', '+1 (212) 555-0199 ext. 42'],
    ['9'.repeat(80), '9'.repeat(80)],
  ])(
    'encrypts unrestricted travel contact format %s and reads it back',
    (raw, expected) => {
      const service = cryptoService();
      const phone = service.protectTravelPhone(raw);
      expect(
        service.decrypt('phone', {
          encrypted: phone.encrypted,
          encryptionIv: phone.encryptionIv,
          encryptionAuthTag: phone.encryptionAuthTag,
          encryptionKeyVersion: phone.encryptionKeyVersion,
        }),
      ).toBe(expected);
      expect(phone.masked).not.toBe(expected);
      expect(phone.masked.length).toBeLessThanOrEqual(80);
      if (expected.length <= 4) expect(phone.masked).not.toMatch(/[0-9]/);
      const equivalent = service.protectTravelPhone(expected);
      expect(equivalent.fingerprint).toBe(phone.fingerprint);
      expect(equivalent.encrypted).not.toBe(phone.encrypted);
    },
  );

  it('retains storage bounds and authenticated decryption for travel phones', () => {
    expect(() => normalizeTravelPhone('  ')).toThrow();
    expect(() => normalizeTravelPhone('9'.repeat(81))).toThrow();
    const service = cryptoService();
    const phone = service.protectTravelPhone('۱۲۳');
    expect(() =>
      service.decrypt('phone', {
        encrypted: phone.encrypted,
        encryptionIv: phone.encryptionIv,
        encryptionAuthTag: Buffer.alloc(16).toString('base64'),
        encryptionKeyVersion: phone.encryptionKeyVersion,
      }),
    ).toThrow('integrity');
  });

  it('rejects malformed contact input', () => {
    expect(() => normalizeMasterContact('phone', '123')).toThrow();
    expect(() => normalizeMasterContact('email', 'not-an-email')).toThrow();
  });
});
