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

@Injectable()
export class CallCenterCrypto {
  private readonly key: Buffer;
  private readonly fingerprintKey: Buffer;
  readonly keyVersion: number;
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.key = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    this.fingerprintKey = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
    this.keyVersion = Number(
      config.getOrThrow('CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION'),
    );
    if (
      this.key.length !== 32 ||
      this.fingerprintKey.length !== 32 ||
      !Number.isSafeInteger(this.keyVersion) ||
      this.keyVersion < 1
    )
      throw new Error('Call Center encryption configuration is invalid.');
  }
  fingerprint(value: string) {
    return createHmac('sha256', this.fingerprintKey)
      .update('call-center:v1:')
      .update(value)
      .digest('hex');
  }
  encrypt(value: unknown, context: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(`rubi:call-center:v1:${context}`));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), ciphertext]
      .map((part) => part.toString('base64'))
      .join('.');
  }
  decrypt<T>(payload: string, version: number, context: string): T {
    if (version !== this.keyVersion)
      throw new InternalServerErrorException(
        'Call Center encryption key version unavailable.',
      );
    try {
      const [iv, tag, data] = payload
        .split('.')
        .map((part) => Buffer.from(part, 'base64'));
      if (!iv || !tag || !data) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(Buffer.from(`rubi:call-center:v1:${context}`));
      decipher.setAuthTag(tag);
      return JSON.parse(
        Buffer.concat([decipher.update(data), decipher.final()]).toString(
          'utf8',
        ),
      ) as T;
    } catch {
      throw new InternalServerErrorException(
        'Call Center decryption integrity check failed.',
      );
    }
  }
}
