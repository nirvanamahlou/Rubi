import type { B2bAgencyAgreementV1 } from '@rubi/contracts';

/** Keep Decimal precision: never convert money to a JavaScript Number. */
export function moneyLabel(amount: string, currency: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) return 'نامشخص';
  const integer = BigInt(`${match[1]}${match[2]}`).toLocaleString('fa-IR');
  const fraction = match[3]?.replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!,
  );
  return `${integer}${fraction ? `٫${fraction}` : ''} ${currency}`.trim();
}

export function agreementLabel(
  agreement: B2bAgencyAgreementV1,
  today: string,
): string {
  const labels = {
    DRAFT: 'پیش‌نویس',
    ACTIVE: 'فعال',
    SUSPENDED: 'تعلیق‌شده',
    EXPIRED: 'منقضی',
    TERMINATED: 'خاتمه‌یافته',
  };
  if (agreement.status !== 'ACTIVE') return labels[agreement.status];
  if (!agreement.isActive) return 'غیرفعال';
  if (agreement.endsAt && agreement.endsAt < today) return 'منقضی';
  if (agreement.startsAt > today) return 'هنوز آغاز نشده';
  return 'فعال';
}

export function cooperationLabel(roleCodes: unknown): string {
  const roles = String(roleCodes ?? '').split(',');
  if (roles.includes('AGENCY') && roles.includes('CORPORATE_CUSTOMER'))
    return 'آژانس و مشتری سازمانی';
  return roles.includes('CORPORATE_CUSTOMER') ? 'مشتری سازمانی' : 'آژانس همکار';
}
