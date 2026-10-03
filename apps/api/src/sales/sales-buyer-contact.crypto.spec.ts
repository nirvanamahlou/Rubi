import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
const crypto = () =>
  new SalesBuyerContactCrypto(
    new ConfigService({
      CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
        'base64',
      ),
      CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
    }),
  );
const buyer = {
  name: 'Synthetic Buyer',
  phone: '09120000000',
  address: 'Synthetic address',
  postalCode: '0012345678',
};
describe('Sales buyer contact encryption', () => {
  it('persists only ciphertext and decrypts all four fields without losing postal-code zeroes', () => {
    const service = crypto();
    const envelope = service.protect(buyer);
    for (const value of Object.values(buyer))
      expect(JSON.stringify(envelope)).not.toContain(value);
    expect(service.decrypt(envelope)).toEqual(buyer);
    expect(service.decrypt(null)).toBeNull();
    expect(service.protect(buyer).iv).not.toBe(envelope.iv);
  });
  it('rejects tampering, unavailable key versions and malformed envelopes', () => {
    const service = crypto();
    const envelope = service.protect(buyer);
    expect(() =>
      service.decrypt({
        ...envelope,
        tag: Buffer.alloc(16).toString('base64'),
      }),
    ).toThrow('integrity');
    expect(() => service.decrypt({ ...envelope, keyVersion: 2 })).toThrow(
      'integrity',
    );
    expect(() => service.decrypt(buyer)).toThrow('integrity');
  });
});
