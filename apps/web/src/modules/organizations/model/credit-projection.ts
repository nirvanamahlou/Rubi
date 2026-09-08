import type {
  B2bAgencyCreditPolicyV1,
  B2bFinanceExposureV1,
} from '@rubi/contracts';

export type CreditProjection =
  | { status: 'UNAVAILABLE'; reason: string }
  | {
      status: 'AVAILABLE';
      limit: string;
      exposure: string;
      available: string;
      currencyCode: string;
      observedAt: string;
      sourceVersion: number;
    };

function validDay(value: string): boolean {
  const time = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time.getTime()) &&
    time.toISOString().slice(0, 10) === value
  );
}
function units(value: string): bigint | null {
  if (!/^-?\d{1,24}(?:\.\d{1,4})?$/.test(value)) return null;
  const [integer = '', fraction = ''] = value.replace('-', '').split('.');
  return (
    BigInt(`${integer}${fraction.padEnd(4, '0')}`) *
    (value.startsWith('-') ? -1n : 1n)
  );
}
function decimal(value: bigint): string {
  const digits = (value < 0n ? -value : value).toString().padStart(5, '0');
  return `${value < 0n ? '-' : ''}${digits.slice(0, -4)}.${digits.slice(-4)}`;
}

/** Read projection only, never order authorization or an FX/financial ledger. */
export function projectCredit(
  policy: B2bAgencyCreditPolicyV1 | null,
  exposure: B2bFinanceExposureV1,
  now: Date,
): CreditProjection {
  const unavailable = (reason: string): CreditProjection => ({
    status: 'UNAVAILABLE',
    reason,
  });
  if (!policy) return unavailable('سیاست اعتبار ثبت نشده است.');
  const today = now.toISOString().slice(0, 10);
  if (
    !policy.isActive ||
    !validDay(policy.effectiveFrom) ||
    (policy.expiresAt !== null && !validDay(policy.expiresAt)) ||
    policy.effectiveFrom > today ||
    (policy.expiresAt !== null && policy.expiresAt < today)
  )
    return unavailable('سیاست اعتبار در تاریخ جاری معتبر نیست.');
  if (exposure.status !== 'AVAILABLE')
    return unavailable('اطلاعات مالی هنوز در دسترس نیست.');
  if (
    !/^[A-Z]{3}$/.test(policy.currencyCode) ||
    exposure.currencyCode !== policy.currencyCode
  )
    return unavailable(
      'ارز اطلاعات مالی با سقف اعتبار یکسان نیست؛ تبدیل خودکار انجام نمی‌شود.',
    );
  const limit = units(policy.creditLimit);
  const used = units(exposure.amount);
  if (limit === null || used === null || limit < 0n)
    return unavailable(
      'مبلغ معتبر از سرویس مالی و سیاست اعتبار دریافت نشده است.',
    );
  const observed = Date.parse(exposure.observedAt);
  if (
    !Number.isFinite(observed) ||
    observed > now.getTime() ||
    !/Z$/.test(exposure.observedAt) ||
    !Number.isSafeInteger(exposure.sourceVersion) ||
    exposure.sourceVersion < 1
  )
    return unavailable('زمان یا نسخه اطلاعات مالی معتبر نیست.');
  return {
    status: 'AVAILABLE',
    limit: policy.creditLimit,
    exposure: exposure.amount,
    available: decimal(limit - used),
    currencyCode: policy.currencyCode,
    observedAt: exposure.observedAt,
    sourceVersion: exposure.sourceVersion,
  };
}
