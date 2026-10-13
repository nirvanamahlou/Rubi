export function initialUserPasswordError(password: string): string | null {
  return password.length >= 4 && password.length <= 200
    ? null
    : 'رمز اولیه باید ۴ تا ۲۰۰ نویسه باشد؛ استفاده از فقط عدد مجاز است.';
}

export function userPasswordError(password: string): string | null {
  return password.length >= 10 &&
    password.length <= 200 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
    ? null
    : 'رمز باید ۱۰ تا ۲۰۰ نویسه و شامل حرف بزرگ و کوچک لاتین، عدد و علامت باشد.';
}
