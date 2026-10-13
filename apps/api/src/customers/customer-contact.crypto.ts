import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;

export type ProtectedContact = {
  encryptedValue: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  encryptionKeyVersion: number;
  maskedValue: string;
  valueFingerprint: string;
  valueHash: string;
};

export type EncryptedContactRecord = {
  type: 'PHONE' | 'EMAIL';
  encryptedValue: string | null;
  encryptionIv: string | null;
  encryptionAuthTag: string | null;
  encryptionKeyVersion: number | null;
};

function decodeKey(name: string, encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== AES_KEY_BYTES)
    throw new Error(`${name} must be a base64-encoded 32-byte key.`);
  return key;
}

function contactAad(type: 'phone' | 'email' | 'PHONE' | 'EMAIL'): Buffer {
  return Buffer.from(`rubi:customer-contact:v1:${type.toLowerCase()}`, 'utf8');
}

@Injectable()
export class CustomerContactCrypto {
  private readonly encryptionKey: Buffer;
  private readonly fingerprintKey: Buffer;
  private readonly encryptionKeyVersion: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.encryptionKey = decodeKey(
      'CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64',
      config.getOrThrow<string>('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
    );
    this.fingerprintKey = decodeKey(
      'CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64',
      config.getOrThrow<string>('CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
    );
    this.encryptionKeyVersion = config.getOrThrow<number>(
      'CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION',
    );
  }

  fingerprint(normalizedValue: string): string {
    return createHmac('sha256', this.fingerprintKey)
      .update(normalizedValue, 'utf8')
      .digest('hex');
  }

  protect(
    type: 'phone' | 'email',
    normalizedValue: string,
    maskedValue: string,
  ): ProtectedContact {
    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(contactAad(type));
    const encryptedValue = Buffer.concat([
      cipher.update(normalizedValue, 'utf8'),
      cipher.final(),
    ]);
    const valueFingerprint = this.fingerprint(normalizedValue);
    return {
      encryptedValue: encryptedValue.toString('base64'),
      encryptionIv: iv.toString('base64'),
      encryptionAuthTag: cipher.getAuthTag().toString('base64'),
      encryptionKeyVersion: this.encryptionKeyVersion,
      maskedValue,
      valueFingerprint,
      valueHash: valueFingerprint,
    };
  }

  decrypt(record: EncryptedContactRecord): string | null {
    if (
      !record.encryptedValue ||
      !record.encryptionIv ||
      !record.encryptionAuthTag ||
      record.encryptionKeyVersion === null
    )
      return null;
    if (record.encryptionKeyVersion !== this.encryptionKeyVersion)
      throw new InternalServerErrorException(
        'Contact encryption key version is unavailable.',
      );
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(record.encryptionIv, 'base64'),
      );
      decipher.setAAD(contactAad(record.type));
      decipher.setAuthTag(Buffer.from(record.encryptionAuthTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(record.encryptedValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Contact decryption integrity check failed.',
      );
    }
  }
}
