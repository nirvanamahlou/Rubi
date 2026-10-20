import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import {
  Injectable,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BankIdentifiers = {
  accountNumber: string | null;
  cardNumber: string | null;
  iban: string | null;
};

@Injectable()
export class BankAccountCrypto {
  private encryptionKey: Buffer;
  private fingerprintKey: Buffer;
  constructor(@Inject(ConfigService) config: ConfigService) {
    const root = Buffer.from(
      config.getOrThrow<string>('MASTER_DATA_IMPORT_TOKEN_KEY_BASE64'),
      'base64',
    );
    if (root.length !== 32)
      throw new Error('Bank account root key must be32 bytes.');
    const derive = (purpose: string) =>
      Buffer.from(
        hkdfSync('sha256', root, 'rubi:finance:bank-accounts:v1', purpose, 32),
      );
    this.encryptionKey = derive('encryption');
    this.fingerprintKey = derive('fingerprint');
  }
  seal(values: BankIdentifiers, context: string) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(values), 'utf8'),
      cipher.final(),
    ]);
    return {
      version: 1,
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }
  open(value: unknown, context: string): BankIdentifiers {
    if (value === null)
      return { accountNumber: null, cardNumber: null, iban: null };
    try {
      const data = value as ReturnType<BankAccountCrypto['seal']>;
      if (
        data.version !== 1 ||
        typeof data.ciphertext !== 'string' ||
        data.ciphertext.length > 4096
      )
        throw new Error();
      const nonce = Buffer.from(data.nonce, 'base64'),
        tag = Buffer.from(data.tag, 'base64');
      if (nonce.length !== 12 || tag.length !== 16) throw new Error();
      const cipher = createDecipheriv('aes-256-gcm', this.encryptionKey, nonce);
      cipher.setAAD(Buffer.from(context));
      cipher.setAuthTag(tag);
      const result: BankIdentifiers = JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(data.ciphertext, 'base64')),
          cipher.final(),
        ]).toString('utf8'),
      );
      if (
        !result ||
        ['accountNumber', 'cardNumber', 'iban'].some(
          (key) =>
            result[key as keyof BankIdentifiers] !== null &&
            typeof result[key as keyof BankIdentifiers] !== 'string',
        )
      )
        throw new Error();
      return result;
    } catch {
      throw new ServiceUnavailableException(
        'اطلاعات محرمانه حساب قابل خواندن نیست.',
      );
    }
  }
  fingerprint(kind: keyof BankIdentifiers, value: string | null) {
    return value
      ? createHmac('sha256', this.fingerprintKey)
          .update(`${kind}:${value}`)
          .digest('hex')
      : null;
  }
}
