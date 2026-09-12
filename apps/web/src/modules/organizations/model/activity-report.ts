import type {
  OrganizationActivityEvent,
  OrganizationActivityPage,
  OrganizationActivityQuery,
} from '@rubi/contracts';

export const activityCategories = {
  PROFILE: 'مشخصات، شعب و نمایندگان',
  ACCESS: 'کاربران و دسترسی',
  CONTRACT: 'قرارداد، تضمین و شرایط',
  CREDIT: 'سیاست اعتبار',
  RATE: 'نرخ، تخفیف و پورسانت',
  DOCUMENT: 'اسناد و فایل‌ها',
};
export const activitySources = {
  B2B: 'همکاری تجاری',
  MASTER_DATA: 'اطلاعات سازمان',
  DOCUMENTS: 'اسناد و فایل‌ها',
};
const actions: Record<string, string> = {
  create: 'ثبت',
  update: 'ویرایش',
  delete: 'حذف',
  draft_saved: 'ذخیره پیش‌نویس قرارداد و شرایط',
  submit: 'ارسال برای تأیید',
  approve: 'تأیید قرارداد',
  approved: 'فعال‌سازی همکاری پس از تأیید',
  reject: 'رد درخواست',
  upsert: 'ثبت یا ویرایش',
  upload: 'بارگذاری سند',
  archive: 'بایگانی سند',
  restore: 'بازیابی سند',
  'permanently-delete': 'حذف دائمی سند',
  download: 'دریافت فایل',
  preview: 'پیش‌نمایش فایل',
  view: 'مشاهده',
  unmask: 'نمایش اطلاعات حساس',
  status: 'تغییر وضعیت',
};
export function activityAction(event: OrganizationActivityEvent) {
  const complete: Record<string, string> = {
    'documents.antivirus.scan': 'بررسی امنیت فایل',
    'documents.metadata.view': 'مشاهده اطلاعات سند',
    'documents.metadata.update': 'ویرایش اطلاعات سند',
    'documents.completion.update': 'تغییر وضعیت تکمیل سند',
    'documents.access_grant.create': 'درخواست دسترسی تأییدشده به فایل',
  };
  if (complete[event.action]) return complete[event.action]!;
  const suffix = event.action.split('.').at(-1) ?? '';
  return actions[suffix] ?? event.action;
}
export function activityDate(iso: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Tehran',
  }).format(new Date(iso));
}
/** Fetch every server page using one fixed upper time bound; never export just the visible page. */
export async function loadActivityReport(
  read: (query: OrganizationActivityQuery) => Promise<OrganizationActivityPage>,
  query: OrganizationActivityQuery,
  progress: (count: number) => void = () => {},
) {
  let page = await read(query);
  const rows = [...page.data];
  const cursors = new Set<string>();
  const asOf = page.asOf;
  progress(rows.length);
  while (page.nextCursor) {
    if (cursors.has(page.nextCursor))
      throw new Error('دریافت صفحه گزارش تکرار شد؛ دوباره تلاش کنید.');
    cursors.add(page.nextCursor);
    page = await read({ ...query, asOf, cursor: page.nextCursor });
    rows.push(...page.data);
    progress(rows.length);
  }
  return { ...page, asOf, data: rows };
}
export function activityWorkbook(rows: OrganizationActivityEvent[]) {
  return [
    [
      'زمان تهران',
      'زمان UTC',
      'بخش',
      'عملیات',
      'کد رویداد',
      'انجام‌دهنده',
      'نتیجه',
      'فیلدهای تغییرکرده',
      'منبع',
      'شناسه رکورد',
      'شناسه رویداد',
    ],
    ...rows.map((row) => [
      activityDate(row.occurredAt),
      row.occurredAt,
      activityCategories[row.category],
      activityAction(row),
      row.action,
      row.actorName,
      row.outcome === 'SUCCESS' ? 'موفق' : 'ناموفق',
      row.changedFields.join('، '),
      activitySources[row.source],
      row.entityId ?? '',
      row.id,
    ]),
  ];
}
