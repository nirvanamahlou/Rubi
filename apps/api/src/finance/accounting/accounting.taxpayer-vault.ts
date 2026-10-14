import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  X509Certificate,
} from 'node:crypto';
import { taxpayerPages } from '@nora/contracts';
import * as v from './accounting.validation';

export interface TaxpayerSealedSecrets {
  version: 1;
  nonce: string;
  tag: string;
  ciphertext: string;
}
/** G05/I27: key stays in deployment configuration; ciphertext is bound to book and record. */
export class TaxpayerSecretVault {
  #key: Buffer | null;
  constructor(value = process.env.FINANCE_TAXPAYER_SECRET_KEY) {
    this.#key =
      value &&
      /^[A-Za-z0-9+/]{43}=$/.test(value) &&
      Buffer.from(value, 'base64').length === 32
        ? Buffer.from(value, 'base64')
        : null;
  }
  get available() {
    return this.#key !== null;
  }
  private key() {
    if (!this.#key)
      v.rule('نگهداری محرمانه تنظیمات مالیاتی پیکربندی نشده است.');
    return this.#key;
  }
  fingerprint(values: Record<string, string>, context = '') {
    return Object.keys(values).length
      ? createHmac('sha256', this.key())
          .update(`TAXPAYER_REQUEST_SECRET_V1:${context}:`)
          .update(
            JSON.stringify(
              Object.fromEntries(
                Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
              ),
            ),
          )
          .digest('hex')
      : null;
  }
  seal(values: Record<string, string>, context: string): TaxpayerSealedSecrets {
    const nonce = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), nonce);
    cipher.setAAD(Buffer.from(`TAXPAYER_STORE_V1:${context}`, 'utf8'));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(values), 'utf8'),
      cipher.final(),
    ]);
    return {
      version: 1,
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: encrypted.toString('base64'),
    };
  }
  open(value: unknown, context: string): Record<string, string> {
    const raw = v.object(value);
    try {
      if (
        raw.version !== 1 ||
        typeof raw.nonce !== 'string' ||
        typeof raw.tag !== 'string' ||
        typeof raw.ciphertext !== 'string'
      )
        v.rule('مرجع محرمانه معتبر نیست.');
      const nonce = Buffer.from(raw.nonce, 'base64'),
        tag = Buffer.from(raw.tag, 'base64');
      if (
        nonce.length !== 12 ||
        tag.length !== 16 ||
        raw.ciphertext.length > 100000
      )
        v.rule('مرجع محرمانه معتبر نیست.');
      const cipher = createDecipheriv('aes-256-gcm', this.key(), nonce);
      cipher.setAAD(Buffer.from(`TAXPAYER_STORE_V1:${context}`, 'utf8'));
      cipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        cipher.update(Buffer.from(raw.ciphertext, 'base64')),
        cipher.final(),
      ]);
      const values = v.object(JSON.parse(decrypted.toString('utf8')));
      if (Object.values(values).some((x) => typeof x !== 'string'))
        v.rule('مرجع محرمانه معتبر نیست.');
      return values as Record<string, string>;
    } catch {
      v.rule('مرجع محرمانه قابل اعتبارسنجی نیست.');
    }
  }
}
export function taxpayerSecretInputs(
  rawInput: unknown,
): Record<string, string> {
  const raw = v.object(rawInput),
    result: Record<string, string> = {};
  const fields = taxpayerPages
    .find((p) => p.route === 'taxpayer-system/settings')!
    .fields.filter((f) => f.sensitive);
  for (const field of fields) {
    const value = v.text(
      raw[field.id],
      field.type === 'textarea' ? 16384 : 1000,
    );
    if (!value) continue;
    if (field.when && raw[field.when.field] !== field.when.value)
      v.invalid('ورودی محرمانه غیرفعال مجاز نیست.');
    result[field.id] = value;
  }
  return result;
}
export function validateTaxpayerSecrets(values: Record<string, string>) {
  try {
    const privateKey = values.txtDirectPrivate
      ? createPrivateKey(values.txtDirectPrivate)
      : null;
    const certificate = values.txtDirectCertificate
      ? new X509Certificate(values.txtDirectCertificate)
      : null;
    if (
      privateKey &&
      certificate &&
      !createPublicKey(privateKey)
        .export({ type: 'spki', format: 'der' })
        .equals(certificate.publicKey.export({ type: 'spki', format: 'der' }))
    )
      v.invalid('گواهی امضا با کلید خصوصی مطابقت ندارد.');
  } catch {
    v.invalid('ساختار کلید خصوصی یا گواهی امضا معتبر نیست.');
  }
}
