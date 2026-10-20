import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { HR_RADAN_PRIVATE_RESOURCES } from '@nora/contracts';

export const privateHrResource = (key: string) =>
  (HR_RADAN_PRIVATE_RESOURCES as readonly string[]).includes(key);
function key() {
  const value = Buffer.from(
    process.env.HR_PRIVATE_ENCRYPTION_KEY_BASE64 ??
      process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64 ??
      '',
    'base64',
  );
  if (value.length !== 32)
    throw new ServiceUnavailableException(
      'کلید رمزنگاری پرونده منابع انسانی پیکربندی نشده است.',
    );
  return value;
}
export function protectHrValues(values: string[], context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`hr-private:v1:${context}`));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(values), 'utf8'),
    cipher.final(),
  ]);
  return {
    privateVersion: 1,
    privatePayload: [iv, cipher.getAuthTag(), ciphertext]
      .map((v) => v.toString('base64'))
      .join('.'),
  };
}
export function revealHrValues(data: unknown, context: string): string[] {
  try {
    const payload = data as { privateVersion: number; privatePayload: string };
    if (payload.privateVersion !== 1) throw new Error();
    const [iv, tag, ciphertext] = payload.privatePayload
      .split('.')
      .map((v) => Buffer.from(v, 'base64'));
    if (!iv || !tag || !ciphertext) throw new Error();
    const cipher = createDecipheriv('aes-256-gcm', key(), iv);
    cipher.setAAD(Buffer.from(`hr-private:v1:${context}`));
    cipher.setAuthTag(tag);
    const result: unknown = JSON.parse(
      Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString(
        'utf8',
      ),
    );
    if (!Array.isArray(result) || result.some((v) => typeof v !== 'string'))
      throw new Error();
    return result as string[];
  } catch {
    throw new ServiceUnavailableException(
      'رمزگشایی اطلاعات منابع انسانی انجام نشد.',
    );
  }
}
export function publicHrData(data: unknown) {
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(
      ([key]) => !['privatePayload', 'privateVersion'].includes(key),
    ),
  );
}
