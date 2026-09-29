export function loginErrorMessage(status: number): string {
  if (status === 401) return 'نام کاربری یا رمز عبور صحیح نیست.';
  if (status === 400) return 'اطلاعات ورود کامل یا معتبر نیست.';
  if (status === 429)
    return 'تعداد تلاش‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.';
  if (status >= 500) return 'سرور ورود موقتاً در دسترس نیست؛ دوباره تلاش کنید.';
  return 'ورود انجام نشد؛ وضعیت سرویس و دسترسی را بررسی کنید.';
}
