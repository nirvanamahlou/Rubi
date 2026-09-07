import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  CalendarCheck2,
  CircleGauge,
  ClipboardList,
  HandCoins,
  HeartHandshake,
  ReceiptText,
  Settings2,
  UserPlus,
} from 'lucide-react';
import type { HrSectionId, Tone } from './hr.model';

export type FrappeWorkspaceId =
  | 'expenses'
  | 'hr-setup'
  | 'leaves'
  | 'payroll'
  | 'performance'
  | 'recruitment'
  | 'shift-attendance'
  | 'tax-benefits'
  | 'tenure';

export interface FrappeWorkspaceLink {
  label: string;
  section: HrSectionId;
  tab?: string;
}

export interface FrappeWorkspaceGroup {
  title: string;
  items: readonly FrappeWorkspaceLink[];
}

export interface FrappeWorkspaceMetric {
  label: string;
  value: string;
  hint: string;
}

export interface FrappeWorkspaceDefinition {
  id: FrappeWorkspaceId;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  metrics: readonly FrappeWorkspaceMetric[];
  trend: readonly number[];
  trendLabel: string;
  groups: readonly FrappeWorkspaceGroup[];
}

export const frappeWorkspaces: readonly FrappeWorkspaceDefinition[] = [
  {
    id: 'expenses',
    title: 'هزینه‌ها و مأموریت',
    shortTitle: 'هزینه‌ها',
    description:
      'مطالبات هزینه، مساعده، سفر کاری، ثبت‌های مالی و ناوگان سازمانی',
    icon: ReceiptText,
    tone: 'orange',
    metrics: [
      { label: 'مطالبات این ماه', value: '۳۴', hint: '۱۲ مورد تأییدشده' },
      { label: 'در انتظار بررسی', value: '۱۴', hint: '۵ مورد فوری' },
      { label: 'مساعده باز', value: '۹', hint: '۳ مورد نزدیک تسویه' },
    ],
    trend: [12, 18, 16, 24, 21, 29, 26, 34],
    trendLabel: 'روند مطالبات هزینه در ۸ ماه اخیر',
    groups: [
      {
        title: 'مطالبات',
        items: [
          { label: 'درخواست هزینه', section: 'expenses', tab: 'claims' },
          {
            label: 'انواع درخواست هزینه',
            section: 'expenses',
            tab: 'approvals',
          },
        ],
      },
      {
        title: 'مساعده و پرداخت',
        items: [
          { label: 'مساعده کارکنان', section: 'expenses', tab: 'advances' },
          { label: 'ثبت پرداخت', section: 'finance', tab: 'payments' },
          { label: 'سند حسابداری', section: 'payroll', tab: 'accounting' },
          { label: 'پرداخت اضافی', section: 'payroll', tab: 'additional' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          {
            label: 'خلاصه مساعده کارکنان',
            section: 'reports',
            tab: 'dashboard',
          },
          {
            label: 'مطالبات هزینه پرداخت‌نشده',
            section: 'finance',
            tab: 'results',
          },
          { label: 'گزارش هزینه خودرو', section: 'fleet', tab: 'logs' },
        ],
      },
      {
        title: 'گزارش‌های حسابداری',
        items: [
          { label: 'حساب‌های دریافتنی', section: 'finance', tab: 'results' },
          { label: 'حساب‌های پرداختنی', section: 'finance', tab: 'payments' },
          { label: 'دفتر کل', section: 'payroll', tab: 'accounting' },
        ],
      },
      {
        title: 'سفر کاری',
        items: [
          { label: 'درخواست سفر', section: 'expenses', tab: 'travel' },
          { label: 'هدف و برنامه سفر', section: 'time', tab: 'mission' },
        ],
      },
      {
        title: 'مدیریت ناوگان',
        items: [
          { label: 'خودروها', section: 'fleet', tab: 'vehicles' },
          { label: 'رانندگان', section: 'employees' },
          { label: 'سرویس خودرو', section: 'fleet', tab: 'logs' },
          { label: 'کارکرد و هزینه خودرو', section: 'fleet', tab: 'logs' },
        ],
      },
    ],
  },
  {
    id: 'hr-setup',
    title: 'راه‌اندازی منابع انسانی',
    shortTitle: 'راه‌اندازی HR',
    description:
      'اطلاعات پایه شرکت و کارکنان، تنظیمات، حضور، مرخصی و گزارش‌های کلیدی',
    icon: Settings2,
    tone: 'teal',
    metrics: [
      { label: 'شرکت و شعبه', value: '۲ / ۲', hint: 'نیایش سیر و جهان باستان' },
      { label: 'واحد سازمانی', value: '۱۲', hint: 'همه دارای مدیر' },
      { label: 'رده و سمت', value: '۲۸', hint: '۲ مورد در حال بازبینی' },
    ],
    trend: [68, 71, 74, 76, 78, 82, 84, 86],
    trendLabel: 'روند تکمیل پرونده‌های پایه',
    groups: [
      {
        title: 'راه‌اندازی',
        items: [
          { label: 'شرکت', section: 'hrSettings', tab: 'companies' },
          { label: 'شعبه', section: 'organization', tab: 'branches' },
          { label: 'واحد سازمانی', section: 'organization', tab: 'units' },
          {
            label: 'عنوان و سمت شغلی',
            section: 'organization',
            tab: 'positions',
          },
        ],
      },
      {
        title: 'کارکنان',
        items: [
          { label: 'فهرست کارکنان', section: 'employees' },
          { label: 'رده شغلی', section: 'organization', tab: 'grades' },
        ],
      },
      {
        title: 'مرخصی',
        items: [
          { label: 'درخواست مرخصی', section: 'time', tab: 'leave' },
          {
            label: 'درخواست مرخصی جبرانی',
            section: 'time',
            tab: 'leavePolicies',
          },
        ],
      },
      {
        title: 'تنظیمات',
        items: [
          {
            label: 'تنظیمات منابع انسانی',
            section: 'hrSettings',
            tab: 'workflows',
          },
          { label: 'تنظیمات حقوق', section: 'payroll', tab: 'structures' },
          {
            label: 'گروه خلاصه کار روزانه',
            section: 'hrSettings',
            tab: 'notifications',
          },
        ],
      },
      {
        title: 'حضور و غیاب',
        items: [
          { label: 'حضور و غیاب', section: 'time', tab: 'attendance' },
          { label: 'درخواست اصلاح حضور', section: 'time', tab: 'corrections' },
          { label: 'ورود و خروج کارمند', section: 'time', tab: 'checkins' },
        ],
      },
      {
        title: 'هزینه‌ها',
        items: [
          { label: 'درخواست هزینه', section: 'expenses', tab: 'claims' },
          { label: 'مساعده کارکنان', section: 'expenses', tab: 'advances' },
          { label: 'درخواست سفر', section: 'expenses', tab: 'travel' },
        ],
      },
      {
        title: 'گزارش‌های کلیدی',
        items: [
          { label: 'کارکرد ماهانه', section: 'reports', tab: 'dashboard' },
          { label: 'تحلیل جذب', section: 'recruitment', tab: 'staffing' },
          { label: 'تحلیل کارکنان', section: 'dashboard' },
          { label: 'مانده مرخصی', section: 'time', tab: 'leavePolicies' },
          {
            label: 'خلاصه مساعده کارکنان',
            section: 'expenses',
            tab: 'advances',
          },
        ],
      },
      {
        title: 'گزارش‌های دیگر',
        items: [
          { label: 'اطلاعات کارکنان', section: 'employees' },
          { label: 'مناسبت‌های کارکنان', section: 'reports', tab: 'dashboard' },
          {
            label: 'کارکنان فعال در تعطیلات',
            section: 'time',
            tab: 'holidays',
          },
          {
            label: 'پاسخ‌های خلاصه کار روزانه',
            section: 'reports',
            tab: 'audit',
          },
        ],
      },
    ],
  },
  {
    id: 'leaves',
    title: 'مرخصی‌ها',
    shortTitle: 'مرخصی',
    description:
      'تقویم تعطیلات، سهمیه و مانده، درخواست، تأیید، جبرانی و بازخرید مرخصی',
    icon: CalendarCheck2,
    tone: 'cyan',
    metrics: [
      { label: 'مرخصی امروز', value: '۹', hint: 'از ۸۶ همکار آزمایشی' },
      { label: 'مرخصی این ماه', value: '۲۳', hint: 'میانگین ۱٫۸ روز' },
      { label: 'تعطیلات این ماه', value: '۲', hint: 'یک تعطیلی رسمی پیش رو' },
    ],
    trend: [8, 11, 9, 14, 12, 17, 15, 23],
    trendLabel: 'روند درخواست‌های مرخصی',
    groups: [
      {
        title: 'تنظیمات',
        items: [
          { label: 'تقویم تعطیلات', section: 'time', tab: 'holidays' },
          { label: 'انواع مرخصی', section: 'time', tab: 'leavePolicies' },
          { label: 'دوره مرخصی', section: 'time', tab: 'leavePolicies' },
          { label: 'سیاست مرخصی', section: 'time', tab: 'leavePolicies' },
          {
            label: 'فهرست مسدودی مرخصی',
            section: 'time',
            tab: 'leavePolicies',
          },
        ],
      },
      {
        title: 'تخصیص',
        items: [
          { label: 'تخصیص مرخصی', section: 'time', tab: 'leavePolicies' },
          { label: 'تخصیص سیاست مرخصی', section: 'time', tab: 'leavePolicies' },
          { label: 'پنل کنترل مرخصی', section: 'time', tab: 'leave' },
          { label: 'بازخرید مرخصی', section: 'time', tab: 'leavePolicies' },
        ],
      },
      {
        title: 'درخواست',
        items: [
          { label: 'درخواست مرخصی', section: 'time', tab: 'leave' },
          { label: 'مرخصی جبرانی', section: 'time', tab: 'leavePolicies' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          {
            label: 'مانده مرخصی کارکنان',
            section: 'reports',
            tab: 'dashboard',
          },
          { label: 'خلاصه مانده مرخصی', section: 'reports', tab: 'dashboard' },
          {
            label: 'کارکنان فعال در تعطیلات',
            section: 'time',
            tab: 'holidays',
          },
        ],
      },
    ],
  },
  {
    id: 'payroll',
    title: 'حقوق و دستمزد',
    shortTitle: 'حقوق',
    description:
      'ساختار حقوق، فیش، پرداخت‌های اضافی، مشوق‌ها و گزارش‌های مالی و قانونی',
    icon: HandCoins,
    tone: 'green',
    metrics: [
      { label: 'فیش این دوره', value: '۸۶', hint: 'پیش‌نمایش شهریور' },
      { label: 'پرداخت اضافی', value: '۱۲', hint: '۷ مورد تأییدشده' },
      { label: 'مغایرت باز', value: '۳', hint: 'نیازمند بررسی مالی' },
    ],
    trend: [72, 74, 73, 78, 80, 82, 84, 86],
    trendLabel: 'روند فیش‌های پردازش‌شده',
    groups: [
      {
        title: 'اطلاعات پایه',
        items: [
          { label: 'جزء حقوق', section: 'payroll', tab: 'components' },
          { label: 'ساختار حقوق', section: 'payroll', tab: 'structures' },
          {
            label: 'پله مالیات بر درآمد',
            section: 'benefits',
            tab: 'taxSlabs',
          },
          { label: 'دوره حقوق', section: 'payroll', tab: 'overview' },
        ],
      },
      {
        title: 'پردازش حقوق',
        items: [
          { label: 'تخصیص ساختار حقوق', section: 'payroll', tab: 'structures' },
          {
            label: 'تخصیص گروهی ساختار',
            section: 'payroll',
            tab: 'structures',
          },
          { label: 'فیش حقوقی', section: 'payroll', tab: 'payslips' },
          { label: 'اجرای حقوق', section: 'payroll', tab: 'runs' },
          { label: 'کسورات حقوق', section: 'payroll', tab: 'components' },
        ],
      },
      {
        title: 'مشوق‌ها',
        items: [
          { label: 'پرداخت اضافی', section: 'payroll', tab: 'additional' },
          { label: 'مشوق کارکنان', section: 'payroll', tab: 'incentives' },
          { label: 'پاداش ماندگاری', section: 'payroll', tab: 'incentives' },
        ],
      },
      {
        title: 'حسابداری',
        items: [
          { label: 'سرفصل حساب‌ها', section: 'finance', tab: 'results' },
          { label: 'مراکز هزینه', section: 'finance', tab: 'batch' },
          { label: 'ثبت پرداخت', section: 'finance', tab: 'payments' },
          { label: 'سند حسابداری', section: 'payroll', tab: 'accounting' },
          {
            label: 'تنظیمات حسابداری',
            section: 'hrSettings',
            tab: 'integrations',
          },
          { label: 'ابعاد حسابداری', section: 'finance', tab: 'batch' },
          { label: 'ارز', section: 'expenses', tab: 'approvals' },
        ],
      },
      {
        title: 'گزارش‌های حسابداری',
        items: [
          { label: 'دفتر کل', section: 'payroll', tab: 'accounting' },
          { label: 'حساب‌های پرداختنی', section: 'finance', tab: 'payments' },
          { label: 'حساب‌های دریافتنی', section: 'finance', tab: 'results' },
        ],
      },
      {
        title: 'گزارش‌های حقوق',
        items: [
          { label: 'دفتر حقوق', section: 'payroll', tab: 'reports' },
          { label: 'حواله بانکی', section: 'finance', tab: 'bank' },
          {
            label: 'پرداخت حقوق بر اساس سند',
            section: 'finance',
            tab: 'payments',
          },
          { label: 'پرداخت گروهی حقوق', section: 'payroll', tab: 'runs' },
          {
            label: 'محاسبه مالیات بر درآمد',
            section: 'benefits',
            tab: 'taxSlabs',
          },
        ],
      },
      {
        title: 'گزارش کسورات',
        items: [
          {
            label: 'کسورات مزایای پایان خدمت',
            section: 'benefits',
            tab: 'gratuity',
          },
          {
            label: 'کسورات مالیات حرفه‌ای',
            section: 'benefits',
            tab: 'taxSlabs',
          },
          {
            label: 'کسورات مالیات بر درآمد',
            section: 'benefits',
            tab: 'exemptions',
          },
        ],
      },
    ],
  },
  {
    id: 'performance',
    title: 'عملکرد و آموزش',
    shortTitle: 'عملکرد',
    description:
      'دوره ارزیابی، هدف و KRA، خودارزیابی، بازخورد و آموزش',
    icon: CircleGauge,
    tone: 'violet',
    metrics: [
      { label: 'دوره فعال', value: '۲', hint: 'یکی نزدیک پایان' },
      { label: 'اهداف جاری', value: '۴۸', hint: '۸۱٪ در مسیر هدف' },
      { label: 'ارزیابی باز', value: '۱۴', hint: '۶ مورد منتظر مدیر' },
    ],
    trend: [62, 66, 64, 71, 74, 78, 80, 84],
    trendLabel: 'روند تکمیل ارزیابی‌ها',
    groups: [
      {
        title: 'ارزیابی عملکرد',
        items: [
          { label: 'دوره ارزیابی', section: 'development', tab: 'cycles' },
          {
            label: 'ارزیابی کارکنان',
            section: 'development',
            tab: 'performance',
          },
          { label: 'خودارزیابی', section: 'development', tab: 'selfReview' },
          { label: 'بازخورد عملکرد', section: 'development', tab: 'feedback' },
        ],
      },
      {
        title: 'هدف‌ها و نتایج کلیدی',
        items: [
          { label: 'هدف و KRA', section: 'development', tab: 'goals' },
          { label: 'پیشرفت هدف‌ها', section: 'development', tab: 'goals' },
          {
            label: 'بازخورد چندمنبعی',
            section: 'development',
            tab: 'feedback',
          },
        ],
      },
      {
        title: 'آموزش و مهارت',
        items: [
          { label: 'برنامه آموزشی', section: 'development', tab: 'training' },
          {
            label: 'رویداد آموزشی',
            section: 'development',
            tab: 'trainingEvents',
          },
          {
            label: 'نتیجه و بازخورد آموزش',
            section: 'development',
            tab: 'trainingEvents',
          },
          { label: 'نقشه و شکاف مهارت', section: 'development', tab: 'skills' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          { label: 'تحلیل عملکرد', section: 'reports', tab: 'dashboard' },
          { label: 'پیشرفت اهداف', section: 'development', tab: 'goals' },
          { label: 'تاریخچه ارزیابی', section: 'reports', tab: 'audit' },
        ],
      },
    ],
  },
  {
    id: 'recruitment',
    title: 'جذب و استخدام',
    shortTitle: 'استخدام',
    description:
      'برنامه نیروی انسانی، فرصت شغلی، متقاضی، مصاحبه و پیشنهاد استخدام',
    icon: UserPlus,
    tone: 'blue',
    metrics: [
      { label: 'فرصت شغلی باز', value: '۷', hint: 'سه واحد متقاضی' },
      { label: 'متقاضی فعال', value: '۳۴', hint: '۱۲ نفر در غربالگری' },
      { label: 'مصاحبه این هفته', value: '۶', hint: 'دو مصاحبه امروز' },
    ],
    trend: [14, 18, 22, 19, 25, 29, 31, 34],
    trendLabel: 'روند متقاضیان فعال',
    groups: [
      {
        title: 'فرصت‌های شغلی',
        items: [
          {
            label: 'برنامه تأمین نیرو',
            section: 'recruitment',
            tab: 'staffing',
          },
          { label: 'درخواست جذب', section: 'recruitment', tab: 'requisitions' },
          { label: 'فرصت شغلی', section: 'recruitment', tab: 'openings' },
          { label: 'متقاضی شغل', section: 'recruitment', tab: 'applicants' },
          { label: 'پیشنهاد استخدام', section: 'recruitment', tab: 'offers' },
        ],
      },
      {
        title: 'مصاحبه‌ها',
        items: [
          {
            label: 'نوع و مرحله مصاحبه',
            section: 'recruitment',
            tab: 'interviews',
          },
          {
            label: 'زمان‌بندی مصاحبه',
            section: 'recruitment',
            tab: 'interviews',
          },
          {
            label: 'امتیاز و بازخورد',
            section: 'recruitment',
            tab: 'feedback',
          },
        ],
      },
      {
        title: 'انتصاب',
        items: [
          { label: 'قالب نامه انتصاب', section: 'recruitment', tab: 'offers' },
          { label: 'نامه انتصاب', section: 'recruitment', tab: 'offers' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          { label: 'تحلیل استخدام', section: 'reports', tab: 'dashboard' },
        ],
      },
    ],
  },
  {
    id: 'shift-attendance',
    title: 'شیفت و حضور و غیاب',
    shortTitle: 'شیفت و حضور',
    description:
      'شیفت‌بندی، تقویم کاری، ورود و خروج، حضور، اصلاح تردد و اضافه‌کاری',
    icon: ClipboardList,
    tone: 'rose',
    metrics: [
      { label: 'حاضر امروز', value: '۷۳', hint: '۸۴٪ کارکنان فعال' },
      {
        label: 'تأخیر و خروج زودهنگام',
        value: '۴',
        hint: 'دو مورد نیازمند اصلاح',
      },
      { label: 'درخواست شیفت', value: '۶', hint: 'سه مورد منتظر تأیید' },
    ],
    trend: [68, 71, 69, 74, 72, 76, 75, 73],
    trendLabel: 'روند حضور روزانه',
    groups: [
      {
        title: 'شیفت‌ها',
        items: [
          { label: 'نوع شیفت', section: 'time', tab: 'shift' },
          { label: 'محل شیفت', section: 'organization', tab: 'branches' },
          { label: 'تخصیص شیفت', section: 'time', tab: 'roster' },
          { label: 'برنامه شیفت', section: 'time', tab: 'roster' },
          { label: 'تخصیص برنامه شیفت', section: 'time', tab: 'roster' },
          {
            label: 'درخواست و جابه‌جایی شیفت',
            section: 'time',
            tab: 'shiftRequests',
          },
          { label: 'ابزار تخصیص شیفت', section: 'time', tab: 'roster' },
        ],
      },
      {
        title: 'حضور و غیاب',
        items: [
          { label: 'حضور و غیاب', section: 'time', tab: 'attendance' },
          { label: 'درخواست اصلاح حضور', section: 'time', tab: 'corrections' },
          { label: 'ورود و خروج کارمند', section: 'time', tab: 'checkins' },
          { label: 'ابزار حضور کارکنان', section: 'time', tab: 'import' },
        ],
      },
      {
        title: 'زمان',
        items: [
          { label: 'کاربرگ زمان', section: 'time', tab: 'attendance' },
          { label: 'نوع فعالیت', section: 'time', tab: 'attendance' },
        ],
      },
      {
        title: 'اضافه‌کاری',
        items: [
          { label: 'نوع اضافه‌کاری', section: 'time', tab: 'overtime' },
          { label: 'برگه اضافه‌کاری', section: 'time', tab: 'overtime' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          { label: 'کارکرد ماهانه', section: 'reports', tab: 'dashboard' },
          { label: 'حضور شیفت', section: 'time', tab: 'attendance' },
          {
            label: 'ساعات کارکنان و پروژه',
            section: 'reports',
            tab: 'dashboard',
          },
          { label: 'سودآوری پروژه', section: 'reports', tab: 'dashboard' },
          {
            label: 'کارکنان فعال در تعطیلات',
            section: 'time',
            tab: 'holidays',
          },
        ],
      },
    ],
  },
  {
    id: 'tax-benefits',
    title: 'مالیات و مزایا',
    shortTitle: 'مالیات و مزایا',
    description:
      'پله‌های مالیاتی، اظهار و مدارک معافیت، مزایا، وام و پایان خدمت',
    icon: BadgeDollarSign,
    tone: 'green',
    metrics: [
      { label: 'اظهار معافیت', value: '۱۸', hint: '۵ مورد منتظر مدرک' },
      { label: 'درخواست مزایا', value: '۹', hint: '۶ مورد تأییدشده' },
      { label: 'وام فعال', value: '۵', hint: 'بدون قسط عقب‌افتاده' },
    ],
    trend: [7, 9, 8, 11, 13, 15, 16, 18],
    trendLabel: 'روند اظهارنامه‌های معافیت',
    groups: [
      {
        title: 'راه‌اندازی مالیات',
        items: [
          {
            label: 'پله مالیات بر درآمد',
            section: 'benefits',
            tab: 'taxSlabs',
          },
          {
            label: 'دسته معافیت مالیاتی',
            section: 'benefits',
            tab: 'exemptions',
          },
          {
            label: 'زیرگروه معافیت مالیاتی',
            section: 'benefits',
            tab: 'exemptions',
          },
        ],
      },
      {
        title: 'معافیت',
        items: [
          {
            label: 'اظهار معافیت کارکنان',
            section: 'benefits',
            tab: 'exemptions',
          },
          { label: 'ارائه مدرک معافیت', section: 'benefits', tab: 'proofs' },
        ],
      },
      {
        title: 'مزایا',
        items: [
          {
            label: 'درخواست مزایای کارکنان',
            section: 'benefits',
            tab: 'benefits',
          },
          {
            label: 'مطالبه مزایای کارکنان',
            section: 'benefits',
            tab: 'benefits',
          },
          { label: 'وام کارکنان', section: 'benefits', tab: 'loans' },
          { label: 'پایان خدمت', section: 'benefits', tab: 'gratuity' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          {
            label: 'محاسبه مالیات بر درآمد',
            section: 'payroll',
            tab: 'reports',
          },
          {
            label: 'کسورات مالیات بر درآمد',
            section: 'payroll',
            tab: 'components',
          },
        ],
      },
    ],
  },
  {
    id: 'tenure',
    title: 'چرخه همکاری',
    shortTitle: 'چرخه همکاری',
    description: 'ورود و خروج کارکنان، شکایت، آموزش و خلاصه کار روزانه',
    icon: HeartHandshake,
    tone: 'teal',
    metrics: [
      { label: 'استخدام این ماه', value: '۵', hint: 'سه پرونده تکمیل‌شده' },
      { label: 'خروج این ماه', value: '۲', hint: 'هر دو در مرحله تسویه' },
      { label: 'آموزش این هفته', value: '۶', hint: '۴۲ شرکت‌کننده آزمایشی' },
    ],
    trend: [3, 4, 2, 5, 4, 6, 5, 7],
    trendLabel: 'روند رویدادهای چرخه همکاری',
    groups: [
      {
        title: 'ورود به سازمان',
        items: [
          { label: 'ورود نیروی جدید', section: 'lifecycle', tab: 'onboarding' },
        ],
      },
      {
        title: 'روابط کارکنان',
        items: [
          { label: 'نوع شکایت', section: 'hrSettings', tab: 'workflows' },
          { label: 'شکایت کارکنان', section: 'lifecycle', tab: 'separation' },
          { label: 'مصاحبه خروج', section: 'lifecycle', tab: 'exit' },
          { label: 'تسویه نهایی', section: 'lifecycle', tab: 'settlement' },
        ],
      },
      {
        title: 'آموزش',
        items: [
          { label: 'برنامه آموزشی', section: 'development', tab: 'training' },
          {
            label: 'رویداد آموزشی',
            section: 'development',
            tab: 'trainingEvents',
          },
          {
            label: 'بازخورد آموزش',
            section: 'development',
            tab: 'trainingEvents',
          },
          {
            label: 'نتیجه آموزش',
            section: 'development',
            tab: 'trainingEvents',
          },
        ],
      },
      {
        title: 'خلاصه کار روزانه',
        items: [
          { label: 'خلاصه کار روزانه', section: 'reports', tab: 'dashboard' },
          {
            label: 'گروه خلاصه کار',
            section: 'hrSettings',
            tab: 'notifications',
          },
          { label: 'پاسخ‌های خلاصه کار', section: 'reports', tab: 'audit' },
        ],
      },
      {
        title: 'گزارش‌ها',
        items: [
          { label: 'خروج کارکنان', section: 'lifecycle', tab: 'separation' },
          { label: 'مناسبت‌های کارکنان', section: 'reports', tab: 'dashboard' },
          { label: 'اطلاعات کارکنان', section: 'employees' },
          { label: 'تحلیل کارکنان', section: 'dashboard' },
        ],
      },
    ],
  },
] as const;

export const frappeWorkspaceIdsByHubSection: Readonly<
  Partial<Record<HrSectionId, readonly FrappeWorkspaceId[]>>
> = {
  recruitment: ['recruitment'],
  lifecycle: ['tenure'],
  time: ['shift-attendance', 'leaves'],
  development: ['performance'],
  expenses: ['expenses'],
  benefits: ['tax-benefits'],
  payroll: ['payroll'],
  hrSettings: ['hr-setup'],
};

const validWorkspaceIds = new Set<FrappeWorkspaceId>(
  frappeWorkspaces.map(({ id }) => id),
);

export function normalizeFrappeWorkspace(
  value?: string,
): FrappeWorkspaceId | null {
  return validWorkspaceIds.has(value as FrappeWorkspaceId)
    ? (value as FrappeWorkspaceId)
    : null;
}

export function getFrappeWorkspace(
  id: FrappeWorkspaceId,
): FrappeWorkspaceDefinition {
  return frappeWorkspaces.find((workspace) => workspace.id === id)!;
}

export function hrWorkspaceLinkHref(link: FrappeWorkspaceLink): string {
  const params = new URLSearchParams({ section: link.section });
  if (link.tab) params.set('tab', link.tab);
  return `/hr?${params.toString()}`;
}
