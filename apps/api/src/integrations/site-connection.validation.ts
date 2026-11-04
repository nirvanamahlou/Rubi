import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';
import type { SiteConnectionInputV1 } from '@nora/contracts';

export const siteIdentityFields = [
  'origin',
  'client',
  'system',
  'organization',
  'environment',
  'keyId',
] as const;
export function siteConnectionInput(input: unknown): SiteConnectionInputV1 {
  const value = input as Record<string, unknown>;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        ![...siteIdentityFields, 'secret', 'expectedVersion'].includes(key),
    ) ||
    !Number.isSafeInteger(value.expectedVersion) ||
    Number(value.expectedVersion) < 0 ||
    Number(value.expectedVersion) >= Number.MAX_SAFE_INTEGER ||
    typeof value.secret !== 'string' ||
    (value.secret !== '' && !/^[\x21-\x7e]{32,4096}$/.test(value.secret))
  )
    throw new BadRequestException('اطلاعات یا نسخه اتصال معتبر نیست.');
  let origin: URL;
  try {
    if (typeof value.origin !== 'string' || value.origin.length > 2048)
      throw Error();
    origin = new URL(value.origin);
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== '/' ||
      (origin.port && origin.port !== '443') ||
      isIP(origin.hostname) ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
        origin.hostname,
      ) ||
      /\.(?:local|localhost|internal)$/i.test(origin.hostname)
    )
      throw Error();
  } catch {
    throw new BadRequestException(
      'نشانی اتصال باید دامنه عمومی HTTPS و بدون مسیر، رمز یا پارامتر باشد.',
    );
  }
  for (const field of siteIdentityFields.filter((field) => field !== 'origin'))
    if (
      typeof value[field] !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value[field] as string)
    )
      throw new BadRequestException(
        'شناسه‌های اتصال را مطابق اطلاعات API سایت وارد کنید.',
      );
  return {
    ...value,
    origin: origin.origin,
  } as unknown as SiteConnectionInputV1;
}
