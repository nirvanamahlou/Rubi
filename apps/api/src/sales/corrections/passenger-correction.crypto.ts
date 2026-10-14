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

@Injectable()
export class PassengerCorrectionCrypto {
  private readonly key: Buffer;
  private readonly keyVersion: number;
  constructor(@Inject(ConfigService) config: ConfigService) {
    const root = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    if (root.length !== 32)
      throw new Error(
        'Passenger correction encryption key must contain32bytes.',
      );
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        root,
        'rubi:sales:passenger-correction:v1',
        'encryption',
        32,
      ),
    );
    this.keyVersion = Number(
      config.getOrThrow<number>('CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION'),
    );
  }
  protect(contractId: string, value: unknown) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(
      Buffer.from('rubi:sales:passenger-correction:v1:' + contractId),
    );
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
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
  decrypt<T>(contractId: string, value: unknown): T {
    try {
      const envelope = value as ReturnType<
        PassengerCorrectionCrypto['protect']
      >;
      if (envelope.version !== 1 || envelope.keyVersion !== this.keyVersion)
        throw new Error();
      const cipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(envelope.iv, 'base64'),
      );
      cipher.setAAD(
        Buffer.from('rubi:sales:passenger-correction:v1:' + contractId),
      );
      cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(envelope.encrypted, 'base64')),
          cipher.final(),
        ]).toString('utf8'),
      ) as T;
    } catch {
      throw new InternalServerErrorException(
        'Passenger correction encryption integrity check failed.',
      );
    }
  }
}
