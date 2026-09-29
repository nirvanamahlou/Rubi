import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const KEY_VERSION = 1;

type ContactKind = 'phone' | 'email';

export type ProtectedMasterContact = {
  encrypted: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  encryptionKeyVersion: number;
  masked: string;
  fingerprint: string;
};

type EncryptedContactField = {
  encrypted: string | null;
  encryptionIv: string | null;
  encryptionAuthTag: string | null;
  encryptionKeyVersion: number | null;
};

function decodeRootKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== AES_KEY_BYTES)
    throw new Error(
      'MASTER_DATA_IMPORT_TOKEN_KEY_BASE64 must be a base64-encoded 32-byte key.',
    );
  return key;
}

function derive(root: Buffer, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      root,
      Buffer.from('rubi:master-data:v1', 'utf8'),
      Buffer.from(purpose, 'utf8'),
      AES_KEY_BYTES,
    ),
  );
}

function aad(kind: ContactKind): Buffer {
  return Buffer.from(`rubi:master-data-contact:v1:${kind}`, 'utf8');
}

export function normalizeMasterContact(
  kind: ContactKind,
  rawValue: string,
): { normalized: string; masked: string } {
  const value = rawValue.normalize('NFKC').trim();
  if (kind === 'phone') {
    const normalized = value.replace(/[\s().-]/g, '');
    if (!/^\+?[0-9]{7,20}$/.test(normalized))
      throw new BadRequestException('شماره تماس معتبر نیست.');
    const visiblePrefix = normalized.startsWith('+')
      ? normalized.slice(0, Math.min(3, normalized.length - 4))
      : '';
    return {
      normalized,
      masked: `${visiblePrefix}${'•'.repeat(Math.max(4, normalized.length - visiblePrefix.length - 4))}${normalized.slice(-4)}`,
    };
  }
  const normalized = value.toLowerCase();
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new BadRequestException('ایمیل معتبر نیست.');
  const [local = '', domain = ''] = normalized.split('@');
  return {
    normalized,
    masked: `${local.slice(0, 1)}${'•'.repeat(Math.max(3, local.length - 1))}@${domain}`,
  };
}

@Injectable()
export class MasterDataContactCrypto {
  private readonly encryptionKey: Buffer;
  private readonly fingerprintKey: Buffer;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const root = decodeRootKey(
      config.getOrThrow<string>('MASTER_DATA_IMPORT_TOKEN_KEY_BASE64'),
    );
    this.encryptionKey = derive(root, 'organization-contact-encryption');
    this.fingerprintKey = derive(root, 'organization-contact-fingerprint');
  }

  protect(kind: ContactKind, rawValue: string): ProtectedMasterContact {
    const { masked, normalized } = normalizeMasterContact(kind, rawValue);
    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(aad(kind));
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    return {
      encrypted: encrypted.toString('base64'),
      encryptionIv: iv.toString('base64'),
      encryptionAuthTag: cipher.getAuthTag().toString('base64'),
      encryptionKeyVersion: KEY_VERSION,
      masked,
      fingerprint: createHmac('sha256', this.fingerprintKey)
        .update(normalized, 'utf8')
        .digest('hex'),
    };
  }

  decrypt(kind: ContactKind, field: EncryptedContactField): string | null {
    if (
      !field.encrypted ||
      !field.encryptionIv ||
      !field.encryptionAuthTag ||
      field.encryptionKeyVersion === null
    )
      return null;
    if (field.encryptionKeyVersion !== KEY_VERSION)
      throw new InternalServerErrorException(
        'Master Data contact key version is unavailable.',
      );
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(field.encryptionIv, 'base64'),
      );
      decipher.setAAD(aad(kind));
      decipher.setAuthTag(Buffer.from(field.encryptionAuthTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(field.encrypted, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Master Data contact integrity check failed.',
      );
    }
  }
}
