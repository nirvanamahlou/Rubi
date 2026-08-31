import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export type ProtectedNationalId = {
  nationalIdEncrypted: string;
  nationalIdIv: string;
  nationalIdAuthTag: string;
  nationalIdKeyVersion: number;
  nationalIdFingerprint: string;
  nationalIdMasked: string;
};

export type StoredNationalId = {
  nationalIdEncrypted: string | null;
  nationalIdIv: string | null;
  nationalIdAuthTag: string | null;
  nationalIdKeyVersion: number | null;
};

export function normalizeNationalId(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

export function isValidIranianNationalId(value: string): boolean {
  const normalized = normalizeNationalId(value);
  if (!/^\d{10}$/.test(normalized) || /^(\d)\1{9}$/.test(normalized))
    return false;
  const checksum = [...normalized.slice(0, 9)].reduce(
    (sum, digit, index) => sum + Number(digit) * (10 - index),
    0,
  );
  const remainder = checksum % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  return Number(normalized[9]) === expected;
}

@Injectable()
export class CustomerNationalIdProtector {
  private readonly encryptionKey: Buffer;
  private readonly fingerprintKey: Buffer;
  private readonly keyVersion: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.encryptionKey = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    this.fingerprintKey = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
    this.keyVersion = config.getOrThrow<number>(
      'CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION',
    );
    if (this.encryptionKey.length !== 32 || this.fingerprintKey.length !== 32)
      throw new Error('Customer identity keys must be 32 bytes.');
  }

  protect(value: string): ProtectedNationalId {
    const normalized = normalizeNationalId(value);
    if (!isValidIranianNationalId(normalized))
      throw new BadRequestException({
        code: 'CUSTOMER_NATIONAL_ID_INVALID',
        message: 'کد ملی باید ده‌رقمی و دارای رقم کنترل معتبر باشد.',
      });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(Buffer.from('rubi:customer-national-id:v1', 'utf8'));
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    return {
      nationalIdEncrypted: encrypted.toString('base64'),
      nationalIdIv: iv.toString('base64'),
      nationalIdAuthTag: cipher.getAuthTag().toString('base64'),
      nationalIdKeyVersion: this.keyVersion,
      nationalIdFingerprint: createHmac('sha256', this.fingerprintKey)
        .update(`national-id:v1:${normalized}`, 'utf8')
        .digest('hex'),
      nationalIdMasked: `******${normalized.slice(-4)}`,
    };
  }

  decrypt(value: StoredNationalId): string | null {
    if (
      value.nationalIdEncrypted === null &&
      value.nationalIdIv === null &&
      value.nationalIdAuthTag === null &&
      value.nationalIdKeyVersion === null
    )
      return null;
    if (
      !value.nationalIdEncrypted ||
      !value.nationalIdIv ||
      !value.nationalIdAuthTag ||
      value.nationalIdKeyVersion !== this.keyVersion
    )
      throw new Error('Customer national ID encryption metadata is invalid.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(value.nationalIdIv, 'base64'),
    );
    decipher.setAAD(Buffer.from('rubi:customer-national-id:v1', 'utf8'));
    decipher.setAuthTag(Buffer.from(value.nationalIdAuthTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(value.nationalIdEncrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    if (!isValidIranianNationalId(decrypted))
      throw new Error('Customer national ID plaintext is invalid.');
    return decrypted;
  }
}
