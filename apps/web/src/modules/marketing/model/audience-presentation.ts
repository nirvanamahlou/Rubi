export const audienceStatusLabels: Record<string, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته‌شده',
  QUALIFIED: 'واجد شرایط',
  NURTURE: 'در حال پرورش',
  LOST: 'از دست رفته',
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  PAUSED: 'متوقف',
  ARCHIVED: 'بایگانی‌شده',
};
export const audienceSourceLabels: Record<string, string> = {
  WEBSITE: 'وب‌سایت',
  PHONE: 'تماس تلفنی',
  EMAIL: 'ایمیل',
  SOCIAL: 'شبکه اجتماعی',
  REFERRAL: 'معرفی',
  WALK_IN: 'مراجعه حضوری',
  OTHER: 'سایر',
  GOOGLE_ADS: 'تبلیغات گوگل',
  SMS: 'پیامک',
  CAMPAIGN: 'کمپین',
  B2B: 'آژانس‌ها و سازمان‌ها',
  Customers: 'مشتریان',
};
export const audienceRuleLabels: Record<string, string> = {
  PHONE_VALID: 'شماره تماس معتبر',
  CAMPAIGN_ATTRIBUTED: 'متصل به کمپین',
  ASSIGNED: 'دارای کارشناس',
  FOLLOWED_UP: 'پیگیری انجام‌شده',
  STATUS_QUALIFIED: 'واجد شرایط',
};
export const audienceKindLabels: Record<string, string> = {
  SEGMENT: 'گروه مخاطبان',
  MESSAGE: 'پیام',
  TEMPLATE: 'قالب پیام',
  SCHEDULE: 'پیام زمان‌بندی‌شده',
  FORM: 'فرم',
  LANDING_PAGE: 'صفحه فرود',
  SHORT_LINK: 'لینک رهگیری',
  AUTOMATION: 'اتوماسیون',
};
export function audienceSourceLabel(value: string) {
  return (
    audienceSourceLabels[value] ??
    ([...value].every((character) => character.charCodeAt(0) < 128)
      ? 'منبع دیگر'
      : value)
  );
}
export function audienceMatches(
  search: string,
  values: readonly (string | null | undefined)[],
) {
  const normalize = (value: string) =>
    value.replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLocaleLowerCase().trim();
  return normalize(values.filter(Boolean).join(' ')).includes(
    normalize(search),
  );
}
