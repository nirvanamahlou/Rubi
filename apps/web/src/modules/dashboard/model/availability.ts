/** Business explanations for missing measurements. Never substitutes a zero. */
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
