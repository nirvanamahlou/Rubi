import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { clearHeaderSession } from '@/lib/header-session';

export function passwordChangeError(
  current: string,
  next: string,
  confirmation: string,
): string | null {
  if (!current || current.length > 200)
    return 'رمز فعلی را وارد کنید (حداکثر ۲۰۰ نویسه).';
  if (
    next.length < 10 ||
    next.length > 200 ||
    !/[a-z]/.test(next) ||
    !/[A-Z]/.test(next) ||
    !/\d/.test(next) ||
    !/[^A-Za-z0-9]/.test(next)
  )
    return 'رمز جدید باید ۱۰ تا ۲۰۰ نویسه و شامل حرف بزرگ و کوچک لاتین، عدد و نویسه ویژه باشد.';
  if (current === next) return 'رمز جدید باید با رمز فعلی متفاوت باشد.';
  if (next !== confirmation) return 'تکرار رمز جدید با آن یکسان نیست.';
  return null;
}

export async function submitPasswordChange(
  currentPassword: string,
  newPassword: string,
  expectedUserId: string,
  dependencies: {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    refresh?: typeof refreshAuthenticatedSession;
    clearSession?: typeof clearHeaderSession;
  } = {},
) {
  const baseUrl = dependencies.baseUrl ?? getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('ارتباط با سرویس حساب تنظیم نشده است.');
  const session = await (dependencies.refresh ?? refreshAuthenticatedSession)(
    baseUrl,
  );
  if (!session || session.user.id !== expectedUserId)
    throw new Error('نشست حساب تغییر کرده یا منقضی شده است. دوباره وارد شوید.');
  let response: Response;
  try {
    response = await (dependencies.fetchImpl ?? fetch)(
      `${baseUrl}/iam/auth/change-password`,
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          'X-Rubi-Password-Change': '1',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );
  } catch {
    throw new Error(
      'پاسخ سرور دریافت نشد؛ نتیجه تغییر رمز مشخص نیست. پیش از تلاش دوباره، ورود با رمز جدید را بررسی کنید.',
    );
  }
  if (response.status !== 204) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    const messages: Record<string, string> = {
      IAM_PASSWORD_CURRENT_INVALID: 'رمز عبور فعلی صحیح نیست.',
      IAM_PASSWORD_LOCKED:
        'تلاش‌های ناموفق بیش از حد است. ۱۵ دقیقه دیگر دوباره تلاش کنید.',
      IAM_PASSWORD_POLICY: 'رمز جدید شرایط اعلام‌شده را ندارد.',
      IAM_PASSWORD_UNCHANGED: 'رمز جدید باید با رمز فعلی متفاوت باشد.',
    };
    throw new Error(
      messages[payload?.error?.code ?? ''] ??
        (response.status === 401
          ? 'نشست معتبر نیست. دوباره وارد حساب شوید.'
          : response.status === 404
            ? 'سرویس تغییر رمز هنوز در این نسخه فعال نیست.'
            : 'تغییر رمز تأیید نشد. وضعیت ورود خود را بررسی کنید و دوباره تلاش کنید.'),
    );
  }
  (dependencies.clearSession ?? clearHeaderSession)();
}
