import { ConflictException } from '@nestjs/common';

export function assertGenericCurrencyRateMutationAllowed(
  resource: string,
): void {
  if (resource !== 'exchange-rates') return;
  throw new ConflictException({
    code: 'CURRENCY_RATE_STATUS_TRANSITION_FORBIDDEN',
    message:
      'ویرایش یا تغییر وضعیت عمومی نرخ ارز مجاز نیست؛ از فرمان اختصاصی تأیید یا رد استفاده کنید.',
  });
}
