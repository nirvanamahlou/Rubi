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
import type { InsurancePassengerInputV1 } from '@nora/contracts';

@Injectable()
export class InsuranceApplicantCrypto {
  private readonly key: Buffer;
  private readonly fingerprintKey: Buffer;
  private readonly version: number;
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.key = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    this.fingerprintKey = Buffer.from(
      config.getOrThrow<string>('CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
      'base64',
    );
    this.version = Number(
      config.getOrThrow('CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION'),
    );
    if (
      this.key.length !== 32 ||
      this.fingerprintKey.length !== 32 ||
      !Number.isSafeInteger(this.version) ||
      this.version < 1
    )
      throw new Error(
        'Insurance applicant encryption configuration is invalid.',
      );
  }
  seal(id: string, branchId: string, input: InsurancePassengerInputV1) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(`rubi:insurance-applicant:v1:${id}:${branchId}`));
    const bytes = Buffer.concat([
      cipher.update(JSON.stringify(input), 'utf8'),
      cipher.final(),
    ]);
    return [
      this.version,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      bytes.toString('base64'),
    ].join('.');
  }
  open(
    id: string,
    branchId: string,
    envelope: string,
  ): InsurancePassengerInputV1 {
    try {
      const [version, iv, tag, data] = envelope.split('.');
      if (Number(version) !== this.version || !iv || !tag || !data)
        throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(iv, 'base64'),
      );
      decipher.setAAD(
        Buffer.from(`rubi:insurance-applicant:v1:${id}:${branchId}`),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(data, 'base64')),
          decipher.final(),
        ]).toString('utf8'),
      ) as InsurancePassengerInputV1;
    } catch {
      throw new InternalServerErrorException(
        'اطلاعات متقاضی بیمه قابل خواندن نیست.',
      );
    }
  }
  fingerprint(requestKey: string, input: unknown) {
    return createHmac('sha256', this.fingerprintKey)
      .update(
        'rubi:insurance-request:v1:' + requestKey + ':' + JSON.stringify(input),
      )
      .digest('hex');
  }
}
