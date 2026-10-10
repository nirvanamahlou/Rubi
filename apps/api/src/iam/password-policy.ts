export const PASSWORD_MIN_LENGTH = 10;
export const INITIAL_PASSWORD_MIN_LENGTH = 4;

export function initialPasswordPolicyErrors(password: string): string[] {
  return password.length >= INITIAL_PASSWORD_MIN_LENGTH &&
    password.length <= 200
    ? []
    : ['رمز اولیه باید ۴ تا ۲۰۰ نویسه باشد؛ استفاده از فقط عدد مجاز است.'];
}

export function passwordPolicyErrors(password: string): string[] {
  const checks: Array<[boolean, string]> = [
    [password.length >= PASSWORD_MIN_LENGTH, 'حداقل ۱۰ نویسه لازم است.'],
    [/[a-z]/.test(password), 'حداقل یک حرف کوچک لاتین لازم است.'],
    [/[A-Z]/.test(password), 'حداقل یک حرف بزرگ لاتین لازم است.'],
    [/\d/.test(password), 'حداقل یک رقم لازم است.'],
    [/[^A-Za-z0-9]/.test(password), 'حداقل یک نویسه ویژه لازم است.'],
  ];
  return checks.filter(([valid]) => !valid).map(([, message]) => message);
}

export function assertStrongPassword(password: string): void {
  const errors = passwordPolicyErrors(password);
  if (errors.length > 0) throw new Error(errors.join(' '));
}
