import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TaxpayerSecretVault,
  validateTaxpayerSecrets,
} from './accounting.taxpayer-vault';
describe('taxpayer secrets at rest', () => {
  it('encrypts with fresh nonces, rejects tampering and cross-book replay without returning material', () => {
    const vault = new TaxpayerSecretVault(
      Buffer.alloc(32, 7).toString('base64'),
    );
    const values = { txtIndirectServicePass: 'synthetic-test-only-password' };
    const a = vault.seal(values, 'book-a:record-a'),
      b = vault.seal(values, 'book-a:record-a');
    expect(a.nonce).not.toBe(b.nonce);
    expect(JSON.stringify(a)).not.toContain(values.txtIndirectServicePass);
    expect(vault.open(a, 'book-a:record-a')).toEqual(values);
    expect(() => vault.open(a, 'book-b:record-a')).toThrow('اعتبارسنجی');
    expect(() =>
      vault.open(
        { ...a, ciphertext: a.ciphertext.slice(0, -8) },
        'book-a:record-a',
      ),
    ).toThrow();
    expect(vault.fingerprint(values)).toBe(vault.fingerprint(values));
    expect(vault.fingerprint(values)).not.toBe(
      vault.fingerprint({ txtIndirectServicePass: 'different' }),
    );
  });
  it('fails closed with absent/malformed deployment key and validates only cryptographic structure', () => {
    expect(new TaxpayerSecretVault('bad-key').available).toBe(false);
    expect(() =>
      new TaxpayerSecretVault('bad-key').seal({ value: 'test' }, 'context'),
    ).toThrow('محرمانه');
    expect(() =>
      validateTaxpayerSecrets({ txtDirectPrivate: 'not-a-key' }),
    ).toThrow('ساختار');
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    expect(() =>
      validateTaxpayerSecrets({ txtDirectPrivate: pair.privateKey }),
    ).not.toThrow();
  });
});
