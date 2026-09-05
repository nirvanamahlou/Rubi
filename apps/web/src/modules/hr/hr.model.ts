import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  FileArchive,
  FileClock,
  FileText,
  Fingerprint,
  Gauge,
  GraduationCap,
  History,
  LayoutDashboard,
  ListChecks,
  Network,
  ReceiptText,
  ShieldCheck,
  Target,
  TimerReset,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';

export type HrSectionId =
  | 'home'
  | 'dashboard'
  | 'employees'
  | 'employee'
  | 'organization'
  | 'contracts'
  | 'time'
  | 'development'
  | 'assets'
  | 'documents'
  | 'requests'
  | 'finance'
  | 'reports'
  | 'payroll';
export type Tone =
  'blue' | 'violet' | 'cyan' | 'orange' | 'teal' | 'rose' | 'green' | 'slate';

export interface HrHubCard {
  id: HrSectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  pills: readonly string[];
  footer: string;
}

export const hrHubCards: readonly HrHubCard[] = [
  {
    id: 'dashboard',
    title: 'نمای کلی',
    description: 'شاخص‌های کارکنان، حضور امروز، قراردادها و هشدارهای مهم',
    icon: LayoutDashboard,
    tone: 'blue',
    pills: ['داشبورد', 'شاخص‌ها', 'هشدارها'],
    footer: 'نمای مدیریتی',
  },
  {
    id: 'employees',
    title: 'کارکنان',
    description: 'پرونده یکتا، تماس و بانک، انتصاب و ورود و خروج کارکنان',
    icon: UsersRound,
    tone: 'violet',
    pills: ['HR01', 'HR02', 'پروفایل ۳۶۰'],
    footer: '۱۴ تب پرونده',
  },
  {
    id: 'organization',
    title: 'ساختار سازمانی',
    description: 'شعبه، واحد، شغل، سمت، مدیر مستقیم و چارت تاریخی',
    icon: Building2,
    tone: 'cyan',
    pills: ['HR03', 'HR04', 'HR05'],
    footer: '۳ حوزه',
  },
  {
    id: 'contracts',
    title: 'قراردادها',
    description: 'قرارداد کاری، الحاقیه، تمدید، خاتمه و هشدار پایان',
    icon: FileText,
    tone: 'orange',
    pills: ['HR06', 'HR16', 'نسخه‌بندی'],
    footer: '۵ زیرصفحه',
  },
  {
    id: 'time',
    title: 'کارکرد و زمان',
    description: 'تردد، شیفت، مرخصی، مأموریت و اضافه‌کاری نسخه‌دار',
    icon: CalendarClock,
    tone: 'teal',
    pills: ['HR07', 'HR08', 'HR09', '+۱'],
    footer: '۴ حوزه',
  },
  {
    id: 'development',
    title: 'توسعه کارکنان',
    description: 'ارزیابی عملکرد، هدف، بازخورد، آموزش و شکاف مهارتی',
    icon: Target,
    tone: 'rose',
    pills: ['HR12', 'HR13', 'عملکرد'],
    footer: '۲ حوزه',
  },
  {
    id: 'assets',
    title: 'تجهیزات تحویلی',
    description: 'درخواست، تحویل، انتقال، عودت و تسویه دارایی کارکنان',
    icon: Boxes,
    tone: 'violet',
    pills: ['HR14', 'تحویل', 'عودت'],
    footer: 'رجیستر تحویل',
  },
  {
    id: 'documents',
    title: 'مدارک پرسنلی',
    description: 'مدارک الزامی، نسخه، بررسی، انقضا و دسترسی محرمانه',
    icon: FileArchive,
    tone: 'green',
    pills: ['HR15', 'نسخه سند', 'انقضا'],
    footer: '۵ دسته مدرک',
  },
  {
    id: 'requests',
    title: 'مرکز درخواست‌ها',
    description: 'کارتابل یکپارچه مرخصی، مأموریت، اصلاح تردد و سایر درخواست‌ها',
    icon: ListChecks,
    tone: 'orange',
    pills: ['کارتابل من', 'تأیید مدیر', 'SLA'],
    footer: '۸ نوع درخواست',
  },
  {
    id: 'finance',
    title: 'ارتباط با مالی',
    description: 'بسته کارکرد، حقوق، پرداخت، حساب مقصد و مغایرت مالی',
    icon: WalletCards,
    tone: 'cyan',
    pills: ['HR17', 'Payroll', 'Reconciliation'],
    footer: '۴ زیرصفحه',
  },
  {
    id: 'reports',
    title: 'گزارش و Audit',
    description: 'گزارش‌های منابع انسانی، دسترسی محرمانه و Audit اختصاصی',
    icon: BarChart3,
    tone: 'slate',
    pills: ['HR18', 'HR19', 'Export'],
    footer: '۳ زیرصفحه',
  },
  {
    id: 'payroll',
    title: 'حقوق و دستمزد',
    description:
      'عوامل، فرمول‌ها، محاسبه جاری و معوق، بیمه، مالیات، فیش و سند حسابداری',
    icon: BadgeDollarSign,
    tone: 'green',
    pills: ['جبران خدمت', 'محاسبه حقوق', 'قانونی'],
    footer: '۷ زیرصفحه',
  },
];

export interface HrTab {
  id: string;
  label: string;
  icon: LucideIcon;
}
export const employeeTabs: readonly HrTab[] = [
  { id: 'summary', label: 'مشخصات', icon: Fingerprint },
  { id: 'contact', label: 'تماس و بانک', icon: WalletCards },
  { id: 'assignment', label: 'انتصاب', icon: Building2 },
  { id: 'contract', label: 'قرارداد', icon: FileText },
  { id: 'attendance', label: 'حضور', icon: Activity },
  { id: 'shift', label: 'شیفت', icon: CalendarClock },
  { id: 'leave', label: 'مرخصی', icon: CalendarClock },
  { id: 'mission', label: 'مأموریت', icon: CalendarClock },
  { id: 'overtime', label: 'اضافه‌کاری', icon: TimerReset },
  { id: 'performance', label: 'عملکرد', icon: Target },
  { id: 'training', label: 'آموزش', icon: GraduationCap },
  { id: 'assets', label: 'تجهیزات', icon: Boxes },
  { id: 'docs', label: 'مدارک', icon: FileArchive },
  { id: 'financial', label: 'مالی', icon: BadgeDollarSign },
  { id: 'audit', label: 'تاریخچه', icon: History },
];

export const sectionTabs: Readonly<
  Partial<Record<HrSectionId, readonly HrTab[]>>
> = {
  organization: [
    { id: 'orgchart', label: 'چارت سازمانی', icon: Network },
    { id: 'units', label: 'شعبه و واحد', icon: Building2 },
    { id: 'positions', label: 'شغل و سمت', icon: WalletCards },
  ],
  contracts: [
    { id: 'active', label: 'قراردادهای فعال', icon: FileText },
    { id: 'templates', label: 'قالب‌ها و انواع', icon: FileArchive },
    { id: 'amendments', label: 'الحاقیه و تمدید', icon: History },
    { id: 'termination', label: 'خاتمه همکاری', icon: UserRoundCheck },
    { id: 'alerts', label: 'هشدار پایان', icon: FileClock },
  ],
  time: [
    { id: 'attendance', label: 'حضور و غیاب', icon: Activity },
    { id: 'shift', label: 'شیفت', icon: CalendarClock },
    { id: 'leave', label: 'مرخصی', icon: CalendarClock },
    { id: 'mission', label: 'مأموریت', icon: CalendarClock },
    { id: 'overtime', label: 'اضافه‌کاری', icon: TimerReset },
  ],
  development: [
    { id: 'performance', label: 'ارزیابی عملکرد', icon: Target },
    { id: 'training', label: 'آموزش‌ها', icon: GraduationCap },
    { id: 'skills', label: 'مهارت و شکاف', icon: Gauge },
  ],
  finance: [
    { id: 'batch', label: 'بسته مبانی پرداخت', icon: FileText },
    { id: 'results', label: 'نتیجه حقوق', icon: ReceiptText },
    { id: 'payments', label: 'پرداخت و مغایرت', icon: BadgeDollarSign },
    { id: 'bank', label: 'کنترل حساب مقصد', icon: WalletCards },
  ],
  reports: [
    { id: 'dashboard', label: 'گزارش‌ها و شاخص‌ها', icon: BarChart3 },
    { id: 'audit', label: 'Audit اختصاصی', icon: History },
    { id: 'access', label: 'دسترسی محرمانه', icon: ShieldCheck },
  ],
  payroll: [
    { id: 'overview', label: 'نمای کلی', icon: BarChart3 },
    { id: 'factors', label: 'عوامل حقوقی', icon: BadgeDollarSign },
    { id: 'formulas', label: 'فرمول‌ها و قوانین', icon: FileText },
    { id: 'calculate', label: 'محاسبه حقوق', icon: ReceiptText },
    { id: 'legal', label: 'بیمه و مالیات', icon: FileArchive },
    { id: 'payslips', label: 'فیش حقوقی', icon: ReceiptText },
    { id: 'accounting', label: 'سند حسابداری', icon: BadgeDollarSign },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
  ],
};

export const screenMeta: Readonly<
  Record<HrSectionId, { title: string; description: string }>
> = {
  home: {
    title: 'منابع انسانی',
    description:
      'مدیریت یکپارچه چرخه همکاری، ساختار سازمانی، کارکرد، توسعه، تجهیزات، اسناد و ارتباط مالی',
  },
  dashboard: {
    title: 'داشبورد منابع انسانی',
    description:
      'نمای تصمیم‌گیری سریع از وضعیت کارکنان، حضور، قراردادها، درخواست‌ها و کیفیت داده',
  },
  employees: {
    title: 'کارکنان',
    description:
      'فهرست پرونده‌های یکتا و دوره‌های همکاری با کنترل تکرار، وضعیت و دسترسی حساس',
  },
  employee: {
    title: 'پرونده کارمند',
    description:
      'نمای یکپارچه و Permission-aware از اطلاعات، همکاری، کارکرد، توسعه، اسناد و مالی',
  },
  organization: {
    title: 'ساختار سازمانی',
    description:
      'شعبه، واحد، شغل، سمت، مدیر مستقیم و چارت تاریخی مبتنی بر تاریخ اثر',
  },
  contracts: {
    title: 'قراردادهای کاری',
    description:
      'قرارداد، نسخه، الحاقیه، تمدید، خاتمه و هشدارهای سررسید با تاریخ اثر',
  },
  time: {
    title: 'کارکرد و زمان',
    description:
      'مدیریت تردد خام، شیفت، مرخصی، مأموریت و اضافه‌کاری با محاسبه و نسخه منبع',
  },
  development: {
    title: 'توسعه کارکنان',
    description:
      'ارزیابی عملکرد، هدف و بازخورد، نیازسنجی مهارت و آموزش‌های سازمانی',
  },
  assets: {
    title: 'تجهیزات تحویلی',
    description:
      'درخواست، تخصیص، تحویل، انتقال، خرابی، عودت و تسویه تجهیزات کارکنان',
  },
  documents: {
    title: 'مدارک پرسنلی',
    description:
      'مدارک الزامی، بارگذاری امن، نسخه، بررسی، انقضا، Retention و Legal Hold',
  },
  requests: {
    title: 'مرکز درخواست‌ها',
    description:
      'کارتابل یکپارچه خودخدمتی کارکنان و تأیید مدیران با SLA، مالک و تاریخچه',
  },
  finance: {
    title: 'ارتباط با مالی',
    description:
      'بسته کارکرد و مبانی پرداخت، نتیجه حقوق، حساب مقصد، پرداخت و Reconciliation بدون ثبت Journal در HR',
  },
  reports: {
    title: 'گزارش و Audit',
    description:
      'گزارش‌های grain-safe، دسترسی deny-by-default و تاریخچه اختصاصی منابع انسانی',
  },
  payroll: {
    title: 'حقوق و دستمزد',
    description:
      'جبران خدمت پارامتریک و تاریخ‌دار با کنترل قانونی و ارتباط یکپارچه با حضور، قرارداد و مالی',
  },
};

const validSectionIds = new Set<HrSectionId>(
  Object.keys(screenMeta) as HrSectionId[],
);
export function normalizeSection(value?: string): HrSectionId {
  return validSectionIds.has(value as HrSectionId)
    ? (value as HrSectionId)
    : 'home';
}
export function previewId(section: HrSectionId, index: number): string {
  return `preview-${section}-${index + 1}`;
}
