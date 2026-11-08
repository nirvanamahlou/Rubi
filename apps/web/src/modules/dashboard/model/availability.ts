/** Business explanations for missing measurements. Never substitutes a zero. */
export function dashboardVisualLimitation(
  id: string,
  decision?: string,
): string | null {
  if (id === 'treasury-flow')
    return 'گردش نمایش‌داده‌شده فقط شامل دریافت تأییدشده و استرداد اجراشده است؛ برای مانده و گردش کامل، اسناد قطعی حسابداری و سایر پرداخت‌ها لازم‌اند.';
  if (id === 'finance-profit-trend' || id === 'gross-profit-by-service')
    return 'سود تنها با هزینهٔ تأییدشده و مرتبط با همان فروش قابل محاسبه است؛ نبود هزینه به معنی صفر بودن آن نیست.';
  if (decision?.includes('DEC-OPEN-008'))
    return 'محاسبهٔ ریسک اعتباری به سقف اعتبار مصوب، بدهی‌های مشمول و قاعدهٔ توقف یا هشدار فروش نیاز دارد.';
  if (decision?.includes('DEC-OPEN-009'))
    return 'محاسبهٔ زمان مجاز رسیدگی به ساعات کاری، تعطیلات، مهلت پاسخ و قاعدهٔ ارجاع درخواست عقب‌افتاده نیاز دارد.';
  if (decision?.includes('DEC-OPEN-012'))
    return 'ارزیابی کمپین به هزینهٔ واقعی ثبت‌شده و روش مصوب نسبت‌دادن فروش به کمپین نیاز دارد.';
  return null;
}

export function dashboardUnavailableReason(reason?: string): string {
  switch (reason) {
    case 'APPROVED_MATCHED_COST_REQUIRED':
      return 'هزینهٔ تأییدشده و منطبق با فروش کامل نیست؛ سود قابل محاسبه نیست.';
    case 'POSTED_ACCOUNTING_SOURCE_REQUIRED':
      return 'این شاخص به اسناد حسابداری قطعی نیاز دارد؛ ثبت فروش یا تعریف حساب به‌تنهایی کافی نیست.';
    case 'ZERO_DENOMINATOR':
      return 'مبنای محاسبه در این بازه صفر است؛ میانگین یا نرخ قابل محاسبه نیست.';
    case 'SOURCE_ROW_LIMIT':
      return 'تعداد رکوردها از سقف محاسبه بیشتر است؛ بازهٔ تاریخ را کوچک‌تر کنید.';
    case 'SOURCE_READ_FAILED':
      return 'دریافت منبع داده ناموفق بود؛ دوباره تلاش کنید.';
    case 'CHART_NUMERIC_RANGE':
      return 'مقدارها از محدودهٔ نمایش دقیق نمودار بزرگ‌ترند؛ بازهٔ کوچک‌تری انتخاب کنید.';
    default:
      return 'منبع معتبر این شاخص برای فیلترها و دسترسی فعلی در دسترس نیست.';
  }
}
