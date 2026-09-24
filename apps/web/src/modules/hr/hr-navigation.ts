import type { HrSectionId } from './hr.model';

export interface HrSource {
  section: HrSectionId;
  tab: string;
  label: string;
  action: string;
  readOnly?: boolean;
}
export interface HrGroup {
  id: string;
  label: string;
  sources: readonly HrSource[];
  caseLabel?: string;
}
const source = (
  section: HrSectionId,
  tab: string,
  label: string,
  action = `ثبت ${label}`,
  readOnly = false,
): HrSource => ({ section, tab, label, action, readOnly });
const group = (
  id: string,
  label: string,
  sources: readonly HrSource[],
  caseLabel?: string,
): HrGroup => ({ id, label, sources, ...(caseLabel ? { caseLabel } : {}) });
export const hrGroups: Partial<Record<HrSectionId, readonly HrGroup[]>> = {
  time: [
    group(
      'work',
      'کارکرد کارکنان',
      [
        source('time', 'attendance', 'کارکرد روزانه', 'محاسبه کارکرد', true),
        source('time', 'checkins', 'ورود و خروج', 'ثبت تردد'),
        source('time', 'corrections', 'اصلاح حضور', 'درخواست اصلاح حضور'),
        source('time', 'overtime', 'اضافه‌کاری', 'درخواست اضافه‌کاری'),
      ],
      'جزئیات کارکرد',
    ),
    group(
      'shifts',
      'شیفت‌بندی',
      [source('time', 'shift', 'تعریف شیفت', 'تعریف شیفت')],
      'جزئیات شیفت',
    ),
    group(
      'leaves',
      'مرخصی',
      [source('time', 'leave', 'درخواست مرخصی', 'درخواست مرخصی')],
      'پرونده مرخصی',
    ),
    group('settings', 'تنظیمات کارکرد', [
      source('time', 'leavePolicies', 'سیاست و سهمیه', 'تعریف سیاست مرخصی'),
      source('time', 'holidays', 'تعطیلات', 'ثبت تعطیلی'),
      source('time', 'biometric', 'دستگاه‌ها', 'افزودن دستگاه'),
    ]),
  ],
  contracts: [
    group(
      'contracts',
      'قراردادها',
      [
        source('contracts', 'active', 'فهرست قراردادها', 'ثبت قرارداد'),
        source(
          'contracts',
          'amendments',
          'الحاقیه و تمدید',
          'ثبت الحاقیه یا تمدید',
        ),
      ],
      'پرونده قرارداد',
    ),
    group('templates', 'تنظیمات قرارداد', [
      source('contracts', 'templates', 'قالب‌ها و انواع', 'تعریف قالب قرارداد'),
    ]),
  ],
  recruitment: [
    group('planning', 'برنامه و درخواست جذب', [
      source(
        'recruitment',
        'requisitions',
        'درخواست‌های جذب',
        'ثبت درخواست جذب',
      ),
      source(
        'recruitment',
        'staffing',
        'برنامه نیروی انسانی',
        'تعریف برنامه جذب',
      ),
    ]),
    group(
      'openings',
      'فرصت‌های شغلی',
      [source('recruitment', 'openings', 'فرصت‌های شغلی', 'ثبت فرصت شغلی')],
      'پرونده فرصت شغلی',
    ),
    group(
      'candidates',
      'متقاضیان',
      [
        source('recruitment', 'applicants', 'متقاضیان', 'افزودن متقاضی'),
        source('recruitment', 'interviews', 'مصاحبه‌ها', 'زمان‌بندی مصاحبه'),
        source('recruitment', 'feedback', 'ارزیابی مصاحبه', 'ثبت ارزیابی'),
        source(
          'recruitment',
          'offers',
          'پیشنهاد استخدام',
          'ثبت پیشنهاد استخدام',
        ),
      ],
      'پرونده متقاضی',
    ),
  ],
  lifecycle: [
    group(
      'onboarding',
      'ورود نیروی جدید',
      [source('lifecycle', 'onboarding', 'نیروی جدید', 'ثبت نیروی جدید')],
      'پرونده شروع همکاری',
    ),
    group(
      'changes',
      'تغییرات شغلی',
      [
        source('lifecycle', 'promotion', 'ارتقا', 'ثبت ارتقا'),
        source('lifecycle', 'transfer', 'انتقال', 'ثبت انتقال'),
      ],
      'پرونده تغییر شغلی',
    ),
    group(
      'exit',
      'پایان همکاری',
      [
        source(
          'lifecycle',
          'separation',
          'پرونده‌های خروج',
          'تشکیل پرونده خروج',
        ),
        source('lifecycle', 'exit', 'مصاحبه خروج', 'ثبت مصاحبه خروج'),
        source('lifecycle', 'settlement', 'تسویه نهایی', 'درخواست تسویه'),
        source(
          'contracts',
          'termination',
          'خاتمه قرارداد',
          'ثبت خاتمه قرارداد',
        ),
        source(
          'finance',
          'settlements',
          'پیگیری تأیید مالی',
          'پیگیری تأیید مالی',
          true,
        ),
      ],
      'پرونده خروج',
    ),
  ],
  development: [
    group(
      'reviews',
      'دوره‌های ارزیابی',
      [
        source(
          'development',
          'cycles',
          'دوره‌های ارزیابی',
          'تعریف دوره ارزیابی',
        ),
        source(
          'development',
          'performance',
          'ارزیابی کارکنان',
          'ثبت ارزیابی کارمند',
        ),
        source('development', 'goals', 'اهداف', 'افزودن اهداف'),
        source('development', 'selfReview', 'خودارزیابی', 'ثبت خودارزیابی'),
      ],
      'پرونده ارزیابی',
    ),
    group(
      'training',
      'آموزش',
      [
        source(
          'development',
          'training',
          'برنامه‌های آموزشی',
          'تعریف برنامه آموزشی',
        ),
        source('development', 'skills', 'نیازهای آموزشی', 'ثبت نیاز آموزشی'),
      ],
      'پرونده برنامه آموزشی',
    ),
  ],
  expenses: [
    group(
      'missions',
      'مأموریت‌ها',
      [
        source('expenses', 'mission', 'مأموریت‌ها', 'درخواست مأموریت'),
        source('expenses', 'travel', 'برنامه سفر', 'ثبت برنامه سفر'),
        source('expenses', 'advances', 'مساعده مأموریت', 'درخواست مساعده'),
        source('expenses', 'claims', 'هزینه‌ها و رسیدها', 'ثبت هزینه'),
      ],
      'پرونده مأموریت',
    ),
    group('expenses', 'هزینه‌های مستقل', [
      source('expenses', 'claims', 'هزینه‌های مستقل', 'ثبت هزینه مستقل'),
      source('expenses', 'advances', 'مساعده مستقل', 'درخواست مساعده مستقل'),
    ]),
  ],
  payroll: [
    group(
      'periods',
      'دوره‌های حقوق',
      [
        source('payroll', 'runs', 'دوره‌های حقوق', 'ایجاد دوره حقوق'),
        source('finance', 'batch', 'مبانی پرداخت', 'آماده‌سازی مبانی پرداخت'),
        source('finance', 'results', 'نتیجه حقوق', 'دریافت نتیجه', true),
        source('payroll', 'payslips', 'فیش‌های حقوقی', 'مشاهده فیش', true),
        source('finance', 'payments', 'پرداخت و مغایرت', 'مشاهده پرداخت', true),
        source('payroll', 'accounting', 'سند حسابداری', 'مشاهده سند', true),
      ],
      'پرونده دوره حقوق',
    ),
    group('adjustments', 'پرداخت و اصلاحات', [
      source('payroll', 'additional', 'پرداخت اضافی', 'ثبت پرداخت اضافی'),
      source('payroll', 'incentives', 'پاداش و مشوق', 'ثبت پاداش'),
      source('payroll', 'corrections', 'اصلاح و معوق', 'ثبت اصلاح حقوق'),
    ]),
    group('settings', 'تنظیمات حقوق', [
      source('payroll', 'structures', 'ساختار حقوق', 'تعریف ساختار حقوق'),
      source('payroll', 'components', 'دریافتی و کسورات', 'تعریف مؤلفه حقوق'),
      source('finance', 'bank', 'حساب مقصد', 'کنترل حساب مقصد', true),
    ]),
  ],
  assets: [
    group(
      'assets',
      'دارایی‌های تحویلی',
      [
        source('assets', 'list', 'تجهیزات', 'ثبت تجهیز'),
        source('assets', 'vehicles', 'خودروهای سازمانی', 'ثبت خودرو'),
        source('assets', 'logs', 'سوابق استفاده', 'مشاهده سوابق', true),
      ],
      'پرونده دارایی',
    ),
  ],
};

export const employeeGroups: readonly HrGroup[] = [
  group('identity', 'مشخصات', [
    source('employee', 'summary', 'مشخصات فردی'),
    source('employee', 'contact', 'اطلاعات تماس'),
  ]),
  group('employment', 'همکاری و قرارداد', [
    source('employee', 'assignment', 'انتصاب'),
    source('employee', 'contract', 'قرارداد', '', true),
  ]),
  group('time', 'کارکرد و مرخصی', [
    source('employee', 'attendance', 'کارکرد', '', true),
    source('employee', 'shift', 'شیفت', '', true),
    source('employee', 'leave', 'مرخصی', '', true),
    source('employee', 'overtime', 'اضافه‌کاری', '', true),
  ]),
  group('pay', 'حقوق و پرداخت‌ها', [
    source('employee', 'financial', 'حقوق و کسورات', '', true),
    source('employee', 'payslips', 'فیش‌های حقوقی', '', true),
  ]),
  group('development', 'عملکرد و آموزش', [
    source('employee', 'performance', 'ارزیابی', '', true),
    source('employee', 'training', 'آموزش'),
  ]),
  group('assets', 'تجهیزات و مدارک', [
    source('employee', 'assets', 'تجهیزات', '', true),
    source('employee', 'docs', 'مدارک', 'افزودن مدرک'),
  ]),
  group('requests', 'درخواست‌ها', [
    source('employee', 'requests', 'درخواست‌ها', '', true),
    source('employee', 'mission', 'مأموریت‌ها', '', true),
  ]),
  group('history', 'تاریخچه', [
    source('employee', 'audit', 'تاریخچه', '', true),
  ]),
];

export function resolveHrGroup(groups: readonly HrGroup[], tab?: string) {
  return (
    groups.find(
      (item) =>
        item.id === tab || item.sources.some((entry) => entry.tab === tab),
    ) ?? groups[0]!
  );
}
export function canonicalHrLocation(
  section: HrSectionId,
  tab?: string,
): { section: HrSectionId; tab?: string } {
  if (section === 'finance')
    return tab === 'settlements'
      ? { section: 'lifecycle', tab: 'settlements' }
      : { section: 'payroll', tab: tab ?? 'periods' };
  if (section === 'contracts' && tab === 'termination')
    return { section: 'lifecycle', tab: 'termination' };
  if (section === 'contracts' && tab === 'alerts')
    return { section, tab: 'active' };
  if (section === 'fleet')
    return { section: 'assets', tab: tab === 'logs' ? 'logs' : 'vehicles' };
  return { section, ...(tab ? { tab } : {}) };
}
