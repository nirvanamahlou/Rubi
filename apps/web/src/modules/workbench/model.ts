export const workbenchTabs = [
  ['today', 'امروز من'],
  ['requests', 'کارتابل درخواست‌ها'],
  ['messages', 'پیام‌ها'],
  ['files', 'فایل‌های من'],
  ['favorites', 'ستاره‌دارها'],
  ['activity', 'فعالیت‌های من'],
  ['notes', 'یادداشت‌ها'],
  ['account', 'حساب و تنظیمات'],
] as const;
export type WorkbenchTab = (typeof workbenchTabs)[number][0];
export function workbenchTab(value: string | null): WorkbenchTab {
  return workbenchTabs.find(([key]) => key === value)?.[0] ?? 'today';
}
export const inboxViews = [
  'دریافتی من',
  'صف واحد من',
  'ارسالی من',
  'ارجاع‌شده توسط من',
  'منتظر تأیید من',
  'منتظر دیگران',
  'مختومه',
  'پیش‌نویس',
] as const;
export const todayMetrics = [
  'منتظر اقدام من',
  'منتظر دیگران',
  'کارهای امروز',
  'کارهای عقب‌افتاده',
  'منتظر تأیید من',
  'پیام‌های خوانده‌نشده',
] as const;
export function canAccessWorkbench(permissions: readonly string[]): boolean {
  return permissions.includes('workbench.access');
}
export const unavailableCopy: Record<WorkbenchTab, string> = {
  today:
    'خلاصهٔ کارهای شما هنوز قابل دریافت نیست. پس از فعال‌شدن سرویس درخواست‌ها، موارد مجاز اینجا نمایش داده می‌شوند.',
  requests:
    'ثبت و پیگیری درخواست هنوز فعال نشده است. در حال حاضر درخواست یا پیش‌نویسی در این صفحه ذخیره نمی‌شود.',
  messages:
    'پیام‌رسان داخلی هنوز فعال نشده است. ارسال و دریافت پیام در این نسخه در دسترس نیست.',
  files:
    'فایل‌ها از بخش اسناد و با مجوز جاری شما قابل بررسی هستند. نمای تجمیعی فایل‌های میزکار هنوز فعال نیست.',
  favorites: 'ذخیره و همگام‌سازی ستاره‌دارها هنوز فعال نشده است.',
  activity: 'فهرست فعالیت‌های شخصی هنوز متصل نشده است.',
  notes:
    'یادداشت خصوصی هنوز فعال نشده است. تا آماده‌شدن ذخیره‌سازی امن، امکان ورود متن وجود ندارد.',
  account:
    'اطلاعات حساب و امنیت از پروفایل موجود در دسترس است. ذخیرهٔ چیدمان و صفحهٔ شروع شخصی هنوز فعال نیست.',
};
