import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import {
  MasterDataContactCrypto,
  normalizeMasterContact,
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

  it('rejects malformed contact input', () => {
    expect(() => normalizeMasterContact('phone', '123')).toThrow();
    expect(() => normalizeMasterContact('email', 'not-an-email')).toThrow();
  });
});
