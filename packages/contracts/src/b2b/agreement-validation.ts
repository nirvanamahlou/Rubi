import {
  B2B_SERVICE_CODES,
  type B2bAgreementTermsV1,
} from './agreement-workflow';

export function b2bValidDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function b2bAgreementTermsIssue(
  terms: B2bAgreementTermsV1,
): string | undefined {
  if (terms.title.trim().length < 2 || terms.title.length > 160)
    return 'عنوان قرارداد باید بین ۲ تا ۱۶۰ نویسه باشد.';
  if (
    !b2bValidDay(terms.startsAt) ||
    (terms.endsAt !== null &&
      (!b2bValidDay(terms.endsAt) || terms.endsAt < terms.startsAt))
  )
    return 'بازه اعتبار قرارداد معتبر نیست.';
  if (
    !terms.currencyCodes.length ||
    terms.currencyCodes.length > 12 ||
    terms.currencyCodes.some((code) => !/^[A-Z]{3}$/.test(code)) ||
    new Set(terms.currencyCodes).size !== terms.currencyCodes.length
  )
    return 'ارزهای مجاز قرارداد را بدون تکرار انتخاب کنید.';
  if (
    !terms.services.length ||
    terms.services.some((service) => !B2B_SERVICE_CODES.includes(service)) ||
    new Set(terms.services).size !== terms.services.length
  )
    return 'خدمات مجاز قرارداد را انتخاب کنید.';
  if (
    !['FRAMEWORK', 'AGENCY', 'CORPORATE'].includes(terms.agreementType) ||
    !['PREPAID', 'CREDIT', 'MIXED'].includes(terms.paymentMethod) ||
    !['PER_ORDER', 'WEEKLY', 'MONTHLY', 'CUSTOM'].includes(
      terms.settlementCycle,
    )
  )
    return 'نوع قرارداد، پرداخت یا دوره تسویه معتبر نیست.';
  if (
    !Number.isInteger(terms.settlementDays) ||
    terms.settlementDays < 0 ||
    terms.settlementDays > 365
  )
    return 'مهلت تسویه باید بین صفر تا ۳۶۵ روز باشد.';
  if (terms.settlementCycle === 'CUSTOM' && terms.settlementDays < 1)
    return 'تعداد روز دوره تسویه سفارشی لازم است.';
  if (
    terms.cutoffDay !== null &&
    (!Number.isInteger(terms.cutoffDay) ||
      terms.cutoffDay < 1 ||
      terms.cutoffDay > 28)
  )
    return 'روز بستن دوره باید بین ۱ تا ۲۸ باشد.';
  if (terms.settlementCycle === 'MONTHLY' && terms.cutoffDay === null)
    return 'روز بستن دوره ماهانه لازم است.';
  if (
    terms.slaHours !== null &&
    (!Number.isInteger(terms.slaHours) ||
      terms.slaHours < 1 ||
      terms.slaHours > 720)
  )
    return 'زمان پاسخ‌گویی باید بین ۱ تا ۷۲۰ ساعت باشد.';
  if (terms.changeReason.trim().length < 3 || terms.changeReason.length > 500)
    return 'دلیل ثبت یا تغییر شرایط را وارد کنید.';
  if (
    [terms.notes, terms.refundTerms, terms.cancellationTerms].some(
      (text) => text.length > 2000,
    )
  )
    return 'هر متن شرایط حداکثر ۲۰۰۰ نویسه دارد.';
  if (
    terms.creditPolicies.length > 12 ||
    new Set(terms.creditPolicies.map((p) => p.currencyCode)).size !==
      terms.creditPolicies.length
  )
    return 'برای هر ارز تنها یک سقف اعتبار وارد کنید.';
  if (terms.paymentMethod !== 'PREPAID' && !terms.creditPolicies.length)
    return 'برای پرداخت اعتباری یا ترکیبی حداقل یک سیاست اعتبار لازم است.';
  const money = (value: string) => /^\d{1,18}(?:\.\d{1,2})?$/.test(value);
  const within = (from: string, to: string | null) =>
    b2bValidDay(from) &&
    from >= terms.startsAt &&
    (!terms.endsAt || from <= terms.endsAt) &&
    (to === null
      ? terms.endsAt === null
      : b2bValidDay(to) && to >= from && (!terms.endsAt || to <= terms.endsAt));
  for (const policy of terms.creditPolicies) {
    if (
      !terms.currencyCodes.includes(policy.currencyCode) ||
      !money(policy.creditLimit)
    )
      return 'ارز و مبلغ سقف اعتبار را بررسی کنید؛ مبلغ با حداکثر دو رقم اعشار وارد شود.';
    if (!within(policy.effectiveFrom, policy.expiresAt))
      return 'اعتبار سیاست هر ارز باید در بازه قرارداد باشد.';
    if (
      !['HARD', 'SOFT'].includes(policy.limitType) ||
      !['BLOCK', 'WARN'].includes(policy.overdueAction) ||
      !Number.isInteger(policy.dueDays) ||
      policy.dueDays < 0 ||
      policy.dueDays > 365
    )
      return 'نوع سقف، رفتار سررسید و مهلت پرداخت معتبر نیست.';
  }
  if (terms.guarantees.length > 20)
    return 'حداکثر ۲۰ تضمین در هر نسخه قابل ثبت است.';
  for (const guarantee of terms.guarantees) {
    if (
      !terms.currencyCodes.includes(guarantee.currencyCode) ||
      !money(guarantee.amount) ||
      !/[1-9]/.test(guarantee.amount)
    )
      return 'مبلغ مثبت و ارز مجاز برای تضمین لازم است.';
    if (
      !['BANK_GUARANTEE', 'CHEQUE', 'DEPOSIT_REQUIREMENT', 'OTHER'].includes(
        guarantee.kind,
      ) ||
      !['REQUIRED', 'RECEIVED'].includes(guarantee.status)
    )
      return 'نوع یا وضعیت تضمین معتبر نیست.';
    if (
      !guarantee.reference.trim() ||
      guarantee.reference.length > 120 ||
      guarantee.issuer.trim().length < 2 ||
      guarantee.issuer.length > 160
    )
      return 'شماره و صادرکننده تضمین را وارد کنید.';
    if (
      !b2bValidDay(guarantee.receivedAt) ||
      (guarantee.expiresAt !== null &&
        (!b2bValidDay(guarantee.expiresAt) ||
          guarantee.expiresAt < guarantee.receivedAt))
    )
      return 'بازه تاریخ تضمین معتبر نیست.';
    if (
      guarantee.kind === 'DEPOSIT_REQUIREMENT' &&
      guarantee.status === 'RECEIVED'
    )
      return 'ودیعه در این فرم فقط شرط قرارداد است؛ وصول آن باید در مالی ثبت شود.';
    if (guarantee.status === 'RECEIVED' && !guarantee.documentId)
      return 'برای تضمین دریافت‌شده مدرک مرتبط لازم است.';
  }
}
