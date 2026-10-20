import type { IntegrationSection } from './model';

export const integrationNavigation = [
  {
    id: 'sites',
    title: 'سایت‌ها و برندها',
    hint: 'تعریف و مدیریت سامانه‌ها',
    sections: ['brands', 'overview'],
  },
  {
    id: 'connect',
    title: 'راه‌اندازی اتصال',
    hint: 'روش ارتباط و تبادل داده',
    sections: ['connections', 'events', 'mapping'],
  },
  {
    id: 'monitor',
    title: 'پیگیری و پایش',
    hint: 'همگام‌سازی، خطاها و سوابق',
    sections: ['sync', 'health', 'logs'],
  },
  {
    id: 'settings',
    title: 'تنظیمات و دسترسی',
    hint: 'قابلیت‌ها و دسترسی مدیریت',
    sections: ['settings'],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  hint: string;
  sections: readonly IntegrationSection[];
}[];

export const integrationSectionHelp: Record<IntegrationSection, string> = {
  brands: 'سایت جدید اضافه کنید یا تنظیمات هر سامانه را از کارت آن باز کنید.',
  overview: 'خلاصه وضعیت و مسیر رسیدگی به کارهای مجموعه را ببینید.',
  connections:
    'پیش‌نیازهای اتصال سایت‌ها و مسیرهای ارتباط با تأمین‌کنندگان را بررسی کنید.',
  events:
    'پیام‌های خودکار سایت‌ها، مانند تغییر سفارش، از این مسیر دریافت و پیگیری می‌شوند.',
  mapping: 'مشخص کنید اطلاعات و شناسه‌های سایت در کدام بخش روبی قرار می‌گیرند.',
  sync: 'انتقال اطلاعات بین سایت و روبی و زمان آخرین اجرا را پیگیری کنید.',
  health: 'وضعیت ارتباط و خطاهای نیازمند رسیدگی را بررسی کنید.',
  logs: 'سوابق تغییر تنظیمات و ارسال یا دریافت اطلاعات را ببینید.',
  settings: 'قابلیت‌های هر اتصال و شرایط دسترسی به مدیریت سایت را مشخص کنید.',
};

export function navigationGroup(section: IntegrationSection) {
  return integrationNavigation.find((group) =>
    (group.sections as readonly IntegrationSection[]).includes(section),
  )!;
}
