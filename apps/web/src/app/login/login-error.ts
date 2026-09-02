export function loginErrorMessage(status: number): string {
  if (status === 401) return 'نام کاربری یا رمز عبور صحیح نیست.';
  if (status === 400) return 'اطلاعات ورود کامل یا معتبر نیست.';
  if (status === 429)
    return 'تعداد تلاش‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.';
  if (status >= 500) return 'سرور ورود موقتاً در دسترس نیست؛ دوباره تلاش کنید.';
  return 'ورود انجام نشد؛ وضعیت سرویس و دسترسی را بررسی کنید.';
}

export function loginInputError(
  usernameInput: FormDataEntryValue | null,
  passwordInput: FormDataEntryValue | null,
): string | null {
  const username =
    typeof usernameInput === 'string' ? usernameInput.trim() : '';
  const password = typeof passwordInput === 'string' ? passwordInput : '';
  if (!username || !password)
    return 'نام کاربری و رمز عبور را کامل وارد کنید.';
  if (username.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(username))
    return 'نام کاربری باید حداقل ۳ نویسه و شامل حروف لاتین، عدد، نقطه، خط تیره یا زیرخط باشد.';
  return null;
}
