import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function decodeBase32(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/u, '')) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 value.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(value % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

@Injectable()
export class MfaTotpService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  generateSecret(): string {
    return encodeBase32(randomBytes(20));
  }

  otpAuthUri(username: string, secret: string): string {
    const issuer = 'Rubi';
    const label = encodeURIComponent(`${issuer}:${username}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
  }

  verify(secret: string, code: string, now = Date.now()): number | null {
    if (!/^\d{6}$/u.test(code)) return null;
    const currentStep = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
    const supplied = Buffer.from(code, 'utf8');
    for (const offset of [-1, 0, 1]) {
      const step = currentStep + offset;
      const expected = Buffer.from(codeForStep(secret, step), 'utf8');
      if (
        supplied.length === expected.length &&
        timingSafeEqual(supplied, expected)
      )
        return step;
    }
    return null;
  }

  encrypt(userId: string, secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(userId, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(userId: string, payload: string): string {
    const [version, ivValue, tagValue, encryptedValue] = payload.split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue)
      throw new ServiceUnavailableException(
        'تنظیمات اعتبارسنجی دومرحله‌ای معتبر نیست.',
      );
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        Buffer.from(ivValue, 'base64url'),
      );
      decipher.setAAD(Buffer.from(userId, 'utf8'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'تنظیمات اعتبارسنجی دومرحله‌ای قابل بازیابی نیست.',
      );
    }
  }

  private encryptionKey(): Buffer {
    const configured = this.config.get<string>(
      'IAM_TOTP_ENCRYPTION_KEY_BASE64',
    );
    if (configured) {
      const key = Buffer.from(configured, 'base64');
      if (key.length === 32) return key;
    }
    if (this.config.get<string>('NODE_ENV') === 'production')
      throw new ServiceUnavailableException(
        'کلید مستقل اعتبارسنجی دومرحله‌ای پیکربندی نشده است.',
      );
    const root = this.config.getOrThrow<string>('IAM_ACCESS_TOKEN_SECRET');
    return Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(root, 'utf8'),
        Buffer.from('rubi-iam-totp-v1', 'utf8'),
        Buffer.from('mfa-secret-encryption', 'utf8'),
        32,
      ),
    );
  }
}
