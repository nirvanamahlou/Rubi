export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'select' | 'money' | 'sensitive';
  options?: readonly string[];
  required?: boolean;
};
export interface Section {
  id: string;
  title: string;
  description: string;
  icon: string;
  fields: readonly Field[];
  permission: string;
}
const name: Field = { key: 'title', label: 'عنوان', required: true };
const start: Field = {
  key: 'startsAt',
  label: 'تاریخ شروع',
  type: 'date',
  required: true,
};
const end: Field = {
  key: 'endsAt',
  label: 'تاریخ پایان',
  type: 'date',
  required: true,
};
const employee: Field = {
  key: 'employee',
  label: 'کارمند نمایشی',
  type: 'select',
  options: ['کارمند نمایشی الف', 'کارمند نمایشی ب', 'کارمند نمایشی پ'],
  required: true,
};
const document: Field = {
  key: 'document',
  label: 'سند پرسنلی',
  type: 'sensitive',
};
export const sections: readonly Section[] = [
  {
    id: 'dashboard',
    title: 'داشبورد منابع انسانی',
    description:
      'نگاه یکپارچه به وضعیت تیم، تعهدها و درخواست‌های نیازمند رسیدگی',
    icon: 'chart',
    permission: 'hr.read',
    fields: [],
  },
  {
    id: 'employees',
    title: 'کارکنان',
    description: 'پرونده مستقل هر همکار و تاریخچه همکاری او',
    icon: 'users',
    permission: 'hr.read',
    fields: [
      { key: 'title', label: 'نام فارسی', required: true },
      { key: 'lastName', label: 'نام خانوادگی فارسی', required: true },
      { key: 'personnelCode', label: 'کد پرسنلی نمایشی', required: true },
      { key: 'latinName', label: 'نام لاتین' },
      { key: 'birthDate', label: 'تاریخ تولد', type: 'date' },
      {
        key: 'gender',
        label: 'جنسیت',
        type: 'select',
        options: ['زن', 'مرد', 'اظهار نشده'],
      },
      {
        key: 'maritalStatus',
        label: 'وضعیت تأهل',
        type: 'select',
        options: ['مجرد', 'متأهل', 'اظهار نشده'],
      },
      start,
      {
        key: 'cooperation',
        label: 'نوع همکاری',
        type: 'select',
        options: ['تمام‌وقت', 'پاره‌وقت', 'مشاوره', 'مدت معین'],
      },
      { key: 'skills', label: 'مهارت‌ها' },
      { key: 'experience', label: 'سوابق شغلی' },
      ...[
        'کد ملی',
        'شماره تماس',
        'تماس اضطراری',
        'ایمیل',
        'نشانی',
        'شماره بیمه',
        'مرجع بانکی',
        'تصویر پروفایل',
      ].map((label, index): Field => ({
        key: `private-${index}`,
        label,
        type: 'sensitive',
      })),
    ],
  },
  {
    id: 'organization',
    title: 'ساختار سازمانی',
    description:
      'شعبه، واحد، تیم، سمت و زنجیره مدیریت؛ مستقل از شرکت صادرکننده',
    icon: 'building',
    permission: 'hr.read',
    fields: [
      name,
      { key: 'branch', label: 'شعبه نمایشی', required: true },
      { key: 'unit', label: 'واحد' },
      { key: 'team', label: 'تیم' },
      { key: 'position', label: 'سمت' },
      { key: 'manager', label: 'مدیر مستقیم' },
      { key: 'substitute', label: 'جانشین' },
      { key: 'capacity', label: 'ظرفیت سمت', type: 'number', required: true },
      start,
      end,
    ],
  },
  {
    id: 'contracts',
    title: 'قراردادهای کاری',
    description: 'نسخه‌ها، تمدید و پایان قرارداد؛ پرداخت از مسیر مالی',
    icon: 'file',
    permission: 'hr.contract.read',
    fields: [
      name,
      employee,
      { key: 'number', label: 'شماره قرارداد نمایشی', required: true },
      { key: 'kind', label: 'نوع قرارداد', required: true },
      {
        key: 'issuer',
        label: 'شرکت صادرکننده',
        type: 'select',
        options: ['شرکت نمایشی الف', 'شرکت نمایشی ب'],
        required: true,
      },
      start,
      end,
      { key: 'probationEnd', label: 'پایان دوره آزمایشی', type: 'date' },
      { key: 'workplace', label: 'محل خدمت' },
      { key: 'shift', label: 'الگوی شیفت' },
      { key: 'salary', label: 'مبلغ توافقی', type: 'sensitive' },
      { key: 'benefits', label: 'مزایا', type: 'sensitive' },
      document,
    ],
  },
  {
    id: 'attendance',
    title: 'حضور، شیفت و مأموریت',
    description: 'برنامه حضور و ثبت زمان با گردش تأیید',
    icon: 'clock',
    permission: 'hr.attendance.read',
    fields: [
      name,
      employee,
      {
        key: 'kind',
        label: 'نوع رکورد',
        type: 'select',
        options: ['حضور', 'شیفت', 'مأموریت'],
        required: true,
      },
      start,
      end,
      {
        key: 'startMinute',
        label: 'دقیقه شروع شیفت از نیمه‌شب',
        type: 'number',
      },
      {
        key: 'endMinute',
        label: 'دقیقه پایان شیفت از نیمه‌شب',
        type: 'number',
      },
      { key: 'breakMinutes', label: 'استراحت (دقیقه)', type: 'number' },
      { key: 'overtime', label: 'اضافه‌کاری پیشنهادی (دقیقه)', type: 'number' },
    ],
  },
  {
    id: 'leave',
    title: 'مرخصی‌ها',
    description: 'درخواست ساعتی و روزانه، جانشین و تصمیم مدیر',
    icon: 'calendar',
    permission: 'hr.leave.request',
    fields: [
      name,
      employee,
      {
        key: 'kind',
        label: 'نوع مرخصی',
        type: 'select',
        options: ['ساعتی', 'روزانه'],
        required: true,
      },
      start,
      end,
      { key: 'substitute', label: 'جانشین' },
      document,
    ],
  },
  {
    id: 'recruitment',
    title: 'استخدام و متقاضیان',
    description: 'از موقعیت شغلی تا مصاحبه، پیشنهاد همکاری و پذیرش',
    icon: 'users',
    permission: 'hr.recruitment.manage',
    fields: [
      name,
      { key: 'position', label: 'موقعیت شغلی', required: true },
      { key: 'count', label: 'تعداد موردنیاز', type: 'number', required: true },
      {
        key: 'stage',
        label: 'مرحله',
        type: 'select',
        options: [
          'دریافت درخواست',
          'غربالگری',
          'مصاحبه',
          'پیشنهاد همکاری',
          'پذیرفته',
          'رد شده',
        ],
      },
      { key: 'interview', label: 'زمان مصاحبه', type: 'date' },
      document,
    ],
  },
  {
    id: 'onboarding',
    title: 'ورود و خروج کارکنان',
    description: 'چک‌لیست تحویل تجهیزات، دسترسی‌ها و پایان همکاری',
    icon: 'check',
    permission: 'hr.update',
    fields: [
      name,
      employee,
      {
        key: 'kind',
        label: 'گردش',
        type: 'select',
        options: ['ورود', 'خروج'],
        required: true,
      },
      { key: 'checklist', label: 'موارد چک‌لیست', required: true },
      { key: 'owner', label: 'مسئول پیگیری' },
      start,
      end,
    ],
  },
  {
    id: 'performance',
    title: 'ارزیابی عملکرد',
    description: 'دوره، شاخص‌های وزن‌دار، خودارزیابی و برنامه بهبود',
    icon: 'chart',
    permission: 'hr.performance.read',
    fields: [
      name,
      employee,
      start,
      end,
      { key: 'criteria', label: 'شاخص ارزیابی', required: true },
      {
        key: 'weight',
        label: 'وزن شاخص (درصد)',
        type: 'number',
        required: true,
      },
      {
        key: 'score',
        label: 'امتیاز (از ۱۰۰)',
        type: 'number',
        required: true,
      },
      { key: 'assessment', label: 'ارزیابی مدیر', type: 'sensitive' },
      { key: 'improvement', label: 'برنامه بهبود', type: 'sensitive' },
    ],
  },
  {
    id: 'training',
    title: 'آموزش و گواهینامه‌ها',
    description: 'مسیر یادگیری و اعتبار گواهینامه‌های کارکنان',
    icon: 'award',
    permission: 'hr.training.manage',
    fields: [
      name,
      employee,
      start,
      end,
      { key: 'provider', label: 'برگزارکننده' },
      document,
    ],
  },
  {
    id: 'compensation',
    title: 'مزایا و کسورات',
    description: 'پیشنهاد ورودی پرداخت؛ بدون ثبت سند حسابداری یا پرداخت حقوق',
    icon: 'wallet',
    permission: 'hr.compensation.read',
    fields: [
      name,
      employee,
      {
        key: 'kind',
        label: 'نوع پیشنهاد',
        type: 'select',
        options: ['مزایا', 'کسورات'],
        required: true,
      },
      { key: 'amount', label: 'مبلغ نمایشی', type: 'money', required: true },
      {
        key: 'currency',
        label: 'ارز',
        type: 'select',
        options: ['IRR', 'USD', 'EUR'],
        required: true,
      },
    ],
  },
  {
    id: 'assets',
    title: 'تجهیزات و اموال تحویلی',
    description: 'تحویل، عودت و رسید تجهیزات هر همکار',
    icon: 'box',
    permission: 'hr.update',
    fields: [
      name,
      employee,
      { key: 'assetCode', label: 'مرجع تجهیز نمایشی', required: true },
      start,
      end,
      document,
    ],
  },
  {
    id: 'documents',
    title: 'اسناد پرسنلی',
    description: 'مدارک هویتی، تحصیلی، بیمه، نامه‌ها و قراردادها',
    icon: 'file',
    permission: 'hr.documents.read',
    fields: [
      name,
      employee,
      {
        key: 'classification',
        label: 'طبقه‌بندی',
        type: 'select',
        options: [
          'هویتی',
          'تحصیلی',
          'گواهینامه',
          'بیمه',
          'قرارداد',
          'فرم داخلی',
          'نامه',
          'خروج',
        ],
        required: true,
      },
      { key: 'retention', label: 'سیاست نگهداری تأییدشده', type: 'sensitive' },
      document,
    ],
  },
  {
    id: 'reminders',
    title: 'هشدارها و یادآوری‌ها',
    description: 'پایان قرارداد، انقضای مدارک و ارزیابی‌های سررسیدشده',
    icon: 'bell',
    permission: 'hr.read',
    fields: [
      name,
      employee,
      { key: 'dueAt', label: 'سررسید', type: 'date', required: true },
      {
        key: 'kind',
        label: 'نوع یادآوری',
        type: 'select',
        options: ['قرارداد', 'مدرک', 'گواهینامه', 'ارزیابی'],
        required: true,
      },
    ],
  },
  {
    id: 'reports',
    title: 'گزارش‌های منابع انسانی',
    description: 'گزارش مبتنی بر دسترسی و داده تأییدشده',
    icon: 'chart',
    permission: 'hr.reports.read',
    fields: [],
  },
  {
    id: 'settings',
    title: 'تنظیمات ماژول',
    description: 'سیاست حضور، مرخصی، تأییدها و نگهداری؛ نیازمند تصویب',
    icon: 'settings',
    permission: 'hr.settings.manage',
    fields: [
      name,
      {
        key: 'policy',
        label: 'موضوع سیاست',
        type: 'select',
        options: ['حضور', 'مرخصی', 'تأیید', 'نگهداری'],
        required: true,
      },
      { key: 'proposal', label: 'پیشنهاد سیاست', required: true },
    ],
  },
];
export const kpis = [
  'کارکنان فعال',
  'کارکنان جدید ماه',
  'قراردادهای نزدیک پایان',
  'مرخصی‌های در انتظار تأیید',
  'غیبت یا تأخیر امروز',
  'افراد حاضر در مأموریت',
  'ارزیابی‌های سررسیدشده',
  'مدارک رو به انقضا',
  'نرخ ماندگاری کارکنان',
  'توزیع کارکنان براساس واحد',
  'توزیع نوع همکاری',
  'استخدام‌های باز',
];
export const uiStates = {
  preview: 'داده نمایشی',
  loading: 'در حال دریافت',
  empty: 'بدون داده',
  error: 'خطای ارتباط',
  unauthorized: 'نیازمند ورود',
  forbidden: 'دسترسی غیرمجاز',
  conflict: 'تعارض نسخه',
  success: 'اعتبارسنجی موفق',
} as const;
export type UiState = keyof typeof uiStates;
export interface PreviewRecord {
  id: `preview-${string}`;
  section: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'PENDING';
  unit: string;
  version: number;
  values: Record<string, string>;
}
export const previewRecords: readonly PreviewRecord[] = sections
  .filter((item) => item.fields.length)
  .flatMap((section) =>
    Array.from({ length: 7 }, (_, index): PreviewRecord => ({
      id: `preview-${section.id}-${index + 1}`,
      section: section.id,
      title: `${section.id === 'employees' ? 'همکار' : section.title} نمایشی ${['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ'][index]}`,
      status:
        index % 3 === 0 ? 'ACTIVE' : index % 3 === 1 ? 'PENDING' : 'DRAFT',
      unit: index % 2 ? 'پشتیبانی نمایشی' : 'عملیات نمایشی',
      version: 1,
      values: Object.fromEntries(
        section.fields
          .filter((field) => field.type !== 'sensitive')
          .map((field) => [
            field.key,
            field.type === 'date'
              ? field.key === 'endsAt'
                ? '2026-12-01'
                : '2026-09-01'
              : field.type === 'number'
                ? '1'
                : field.type === 'money'
                  ? '100.00'
                  : (field.options?.[0] ?? `${field.label} نمایشی`),
          ]),
      ),
    })),
  );
export function queryRecords(
  records: readonly PreviewRecord[],
  query: {
    section: string;
    search: string;
    status: string;
    direction: 'asc' | 'desc';
    page: number;
  },
) {
  const filtered = records
    .filter(
      (item) =>
        item.section === query.section &&
        `${item.title} ${item.id} ${item.unit}`.includes(query.search.trim()) &&
        (!query.status || item.status === query.status),
    )
    .sort(
      (a, b) =>
        (query.direction === 'asc' ? 1 : -1) *
        a.title.localeCompare(b.title, 'fa'),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const page = Math.min(pages, Math.max(1, Math.floor(query.page) || 1));
  return {
    items: filtered.slice((page - 1) * 5, page * 5),
    total: filtered.length,
    page,
    pages,
  };
}
export function validatePreview(
  section: Section,
  values: Record<string, string>,
): string | null {
  for (const field of section.fields) {
    if (field.type === 'sensitive') continue;
    const value = values[field.key]?.trim() ?? '';
    if (field.required && !value) return `${field.label} الزامی است.`;
    if (value.length > 500) return `${field.label} بیش از حد طولانی است.`;
    if (value && field.type === 'number' && !/^\d+$/.test(value))
      return `${field.label} باید عدد صحیح نامنفی باشد.`;
    if (
      value &&
      field.type === 'money' &&
      !/^(0|[1-9]\d{0,27})(\.\d{1,8})?$/.test(value)
    )
      return 'مبلغ باید عدد اعشاری معتبر با رقم انگلیسی باشد.';
    if (value && field.type === 'select' && !field.options?.includes(value))
      return 'انتخاب معتبر نیست.';
  }
  if (values.startsAt && values.endsAt && values.startsAt >= values.endsAt)
    return 'پایان باید پس از شروع باشد.';
  if (
    section.id === 'performance' &&
    (Number(values.weight) !== 100 || Number(values.score) > 100)
  )
    return 'در این پیش‌نمایش تک‌شاخصی، وزن باید ۱۰۰ و امتیاز بین صفر تا ۱۰۰ باشد.';
  return null;
}
export function applyPreview(
  records: readonly PreviewRecord[],
  record: PreviewRecord,
  expectedVersion: number,
): readonly PreviewRecord[] {
  if (!record.id.startsWith('preview-')) throw new Error('INVALID_PREVIEW');
  const existing = records.find((item) => item.id === record.id);
  if ((existing?.version ?? 0) !== expectedVersion) throw new Error('CONFLICT');
  const next = { ...record, version: expectedVersion + 1 };
  return existing
    ? records.map((item) => (item.id === record.id ? next : item))
    : [...records, next];
}
