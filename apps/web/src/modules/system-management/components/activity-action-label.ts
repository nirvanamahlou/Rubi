/** Human-readable presentation only; raw audit events remain intact. */
export function activityActionLabel(action: string): string {
  const http = /^(POST|PUT|PATCH|DELETE|GET)\s+\/(.*)$/i.exec(action.trim());
  const method = http?.[1]?.toUpperCase();
  const tokens = (http?.[2] ?? action)
    .toLowerCase()
    .split(/[/.:_-]+/)
    .filter(Boolean);
  const has = (...values: string[]) =>
    values.some((value) => tokens.includes(value));
  if (has('logout')) return 'خروج از سامانه';
  if (has('login')) return 'ورود به سامانه';
  if (has('password')) return 'تغییر رمز عبور';
  if (has('approve', 'approved', 'confirm')) return 'تأیید';
  if (has('reject', 'rejected')) return 'رد درخواست';
  if (has('cancel', 'void', 'revoke')) return 'لغو';
  if (has('restore')) return 'بازیابی';
  if (has('forward', 'resend')) return 'بازارسال';
  if (has('send', 'sent')) return 'ارسال';
  if (has('upload', 'import')) return 'بارگذاری';
  if (has('download', 'export')) return 'دریافت خروجی';
  if (has('search', 'report', 'list', 'preview') || method === 'GET')
    return 'مشاهده اطلاعات';
  if (has('delete', 'remove', 'deleted') || method === 'DELETE') return 'حذف';
  if (
    has(
      'update',
      'edit',
      'write',
      'patch',
      'save',
      'assign',
      'activate',
      'deactivate',
    ) ||
    method === 'PUT' ||
    method === 'PATCH'
  )
    return 'ویرایش';
  if (has('create', 'add', 'issue') || method === 'POST') return 'افزودن';
  return 'ثبت فعالیت';
}
