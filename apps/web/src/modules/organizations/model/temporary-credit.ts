import type { B2bAgreementTermsV1 } from '@rubi/contracts';

export function temporaryCreditIssue(
  policies: B2bAgreementTermsV1['creditPolicies'],
  previous: B2bAgreementTermsV1['creditPolicies'],
): string | null {
  if (!policies.length || policies.some((p) => !p.expiresAt))
    return 'برای اعتبار موقت، سقف ارزی و تاریخ پایان هر سقف را تعیین کنید.';
  const amount = (value: string) => {
    if (!/^\d+(?:\.\d{1,4})?$/.test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
  };
  let increased = false;
  for (const policy of policies) {
    const old = previous.find((p) => p.currencyCode === policy.currencyCode);
    const before = amount(old?.creditLimit ?? '0');
    const after = amount(policy.creditLimit);
    if (before === null || after === null) return 'مبلغ سقف اعتبار معتبر نیست.';
    if (after < before)
      return 'در فرم افزایش موقت، سقف اعتبار نباید کاهش یابد.';
    if (after > before) increased = true;
  }
  if (
    previous.some(
      (p) => !policies.some((n) => n.currencyCode === p.currencyCode),
    )
  )
    return 'برای افزایش موقت، سقف‌های ارزی قبلی را حفظ کنید.';
  return increased ? null : 'حداقل سقف یکی از ارزها را افزایش دهید.';
}
