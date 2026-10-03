import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SalesBuyerContactV1 } from '@nora/contracts';

export interface SalesBuyerContactEnvelope {
  version: 1;
  keyVersion: number;
  iv: string;
  tag: string;
  encrypted: string;
}
const aad = Buffer.from('rubi:sales:buyer-contact:v1');
@Injectable()
export class SalesBuyerContactCrypto {
  private readonly key: Buffer;
  private readonly keyVersion: number;
  constructor(@Inject(ConfigService) config: ConfigService) {
    const root = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    if (root.length !== 32)
      throw new Error('Customer contact encryption key must contain 32 bytes.');
    this.key = Buffer.from(
      hkdfSync('sha256', root, aad, Buffer.from('encryption'), 32),
    );
    this.keyVersion = Number(
      config.getOrThrow<number>('CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION'),
    );
  }
  protect(input: SalesBuyerContactV1): SalesBuyerContactEnvelope {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(aad);
    const value: SalesBuyerContactV1 = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      postalCode: input.postalCode.trim(),
    };
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf-8'),
      cipher.final(),
    ]);
    return {
      version: 1,
      keyVersion: this.keyVersion,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      encrypted: encrypted.toString('base64'),
    };
  }
  decrypt(value: unknown): SalesBuyerContactV1 | null {
    if (value == null) return null;
    const envelope = value as SalesBuyerContactEnvelope;
    try {
      if (envelope.version !== 1 || envelope.keyVersion !== this.keyVersion)
        throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(envelope.iv, 'base64'),
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const result = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(envelope.encrypted, 'base64')),
          decipher.final(),
        ]).toString('utf-8'),
      ) as SalesBuyerContactV1;
      if (
        !['name', 'phone', 'address', 'postalCode'].every(
          (key) => typeof result[key as keyof SalesBuyerContactV1] === 'string',
        )
      )
        throw new Error();
      return result;
    } catch {
      throw new InternalServerErrorException(
        'Buyer contact encryption integrity check failed.',
      );
    }
  }
}
