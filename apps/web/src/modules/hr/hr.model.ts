import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  CarFront,
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
  | 'recruitment'
  | 'lifecycle'
  | 'contracts'
  | 'time'
  | 'development'
  | 'expenses'
  | 'benefits'
  | 'assets'
  | 'fleet'
  | 'documents'
  | 'requests'
  | 'finance'
  | 'reports'
  | 'payroll'
  | 'hrSettings';
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

export const iranLocalizationStatus = [
  {
    id: 'persian-calendar',
    label: 'تقویم شمسی رابط',
    status: 'IMPLEMENTED_IN_UI',
  },
  {
    id: 'insurance-export',
    label: 'خروجی بیمه ایران',
    status: 'BLOCKED_FOR_APPROVED_RULES',
  },
  {
    id: 'tax-export',
    label: 'خروجی مالیات ایران',
    status: 'BLOCKED_FOR_APPROVED_RULES',
  },
  {
    id: 'bank-export',
    label: 'خروجی بانکی ایران',
    status: 'BLOCKED_FOR_PUBLIC_CONTRACT',
  },
] as const;

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
    footer: '۱۵ تب پرونده',
  },
  {
    id: 'organization',
    title: 'ساختار سازمانی',
    description: 'شعبه، واحد، شغل، سمت، مدیر مستقیم و چارت تاریخی',
    icon: Building2,
    tone: 'cyan',
    pills: ['HR03', 'HR04', 'HR05'],
    footer: '۶ زیرصفحه',
  },
  {
    id: 'recruitment',
    title: 'جذب و استخدام',
    description:
      'برنامه نیروی انسانی، درخواست جذب، فرصت شغلی، متقاضی، مصاحبه و پیشنهاد',
    icon: UsersRound,
    tone: 'blue',
    pills: ['برنامه جذب', 'مصاحبه', 'پیشنهاد'],
    footer: '۸ زیرصفحه',
  },
  {
    id: 'lifecycle',
    title: 'چرخه همکاری',
    description:
      'ورود نیروی جدید، ارتقا، انتقال، جدایی، مصاحبه خروج و تسویه نهایی',
    icon: UserRoundCheck,
    tone: 'violet',
    pills: ['Onboarding', 'انتقال', 'Offboarding'],
    footer: '۷ زیرصفحه',
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
    footer: '۱۳ زیرصفحه',
  },
  {
    id: 'development',
    title: 'توسعه کارکنان',
    description: 'ارزیابی عملکرد، هدف، بازخورد، آموزش و شکاف مهارتی',
    icon: Target,
    tone: 'rose',
    pills: ['HR12', 'HR13', 'عملکرد'],
    footer: '۸ زیرصفحه',
  },
  {
    id: 'expenses',
    title: 'مأموریت و هزینه‌ها',
    description:
      'درخواست سفر کاری، مساعده، بازپرداخت چندارزی و تأییدهای مرحله‌ای',
    icon: ReceiptText,
    tone: 'orange',
    pills: ['Travel', 'Advance', 'Expense'],
    footer: '۴ زیرصفحه',
  },
  {
    id: 'benefits',
    title: 'مالیات و مزایا',
    description: 'پله مالیاتی، معافیت، مزایا، وام، پایان خدمت و مدارک قانونی',
    icon: BadgeDollarSign,
    tone: 'green',
    pills: ['Tax', 'Benefits', 'Loan'],
    footer: '۶ زیرصفحه',
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
    id: 'fleet',
    title: 'خودروهای سازمانی',
    description: 'ثبت خودرو، تخصیص مجاز، سوابق استفاده، کیلومتر و هزینه سفر',
    icon: CarFront,
    tone: 'slate',
    pills: ['Vehicle', 'Log', 'Assignment'],
    footer: '۲ زیرصفحه',
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
    footer: '۹ زیرصفحه',
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
    footer: '۱۰ زیرصفحه',
  },
  {
    id: 'hrSettings',
    title: 'تنظیمات و یکپارچگی',
    description:
      'گردش‌کار، نقش، اعلان، فیلدهای سفارشی، API، Webhook و چندشرکتی',
    icon: ShieldCheck,
    tone: 'slate',
    pills: ['Workflow', 'API', 'Multi-company'],
    footer: '۶ زیرصفحه',
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
    { id: 'branches', label: 'شعبه‌ها', icon: Building2 },
    { id: 'units', label: 'واحدها', icon: Building2 },
    { id: 'positions', label: 'شغل و سمت', icon: WalletCards },
    { id: 'grades', label: 'رده شغلی', icon: Gauge },
    { id: 'groups', label: 'گروه کارکنان', icon: UsersRound },
  ],
  recruitment: [
    { id: 'staffing', label: 'برنامه نیروی انسانی', icon: BarChart3 },
    { id: 'requisitions', label: 'درخواست جذب', icon: ListChecks },
    { id: 'openings', label: 'فرصت‌های شغلی', icon: WalletCards },
    { id: 'applicants', label: 'متقاضیان', icon: UsersRound },
    { id: 'interviews', label: 'مصاحبه‌ها', icon: CalendarClock },
    { id: 'feedback', label: 'امتیاز و بازخورد', icon: Target },
    { id: 'offers', label: 'پیشنهاد استخدام', icon: FileText },
  ],
  lifecycle: [
    { id: 'onboarding', label: 'ورود نیروی جدید', icon: UserRoundCheck },
    { id: 'promotion', label: 'ارتقا', icon: Target },
    { id: 'transfer', label: 'انتقال', icon: Network },
    { id: 'skills', label: 'نقشه مهارت', icon: Gauge },
    { id: 'separation', label: 'پایان همکاری', icon: FileClock },
    { id: 'exit', label: 'مصاحبه خروج', icon: ListChecks },
    { id: 'settlement', label: 'تسویه نهایی', icon: ReceiptText },
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
    { id: 'checkins', label: 'ورود و خروج', icon: TimerReset },
    { id: 'biometric', label: 'دستگاه و موقعیت', icon: Fingerprint },
    { id: 'corrections', label: 'اصلاح حضور', icon: History },
    { id: 'import', label: 'ورود گروهی', icon: FileArchive },
    { id: 'shift', label: 'تعریف شیفت', icon: CalendarClock },
    { id: 'shiftRequests', label: 'درخواست شیفت', icon: ListChecks },
    { id: 'roster', label: 'تقویم شیفت', icon: CalendarClock },
    { id: 'leave', label: 'مرخصی', icon: CalendarClock },
    { id: 'leavePolicies', label: 'سیاست و سهمیه', icon: ShieldCheck },
    { id: 'holidays', label: 'تعطیلات', icon: CalendarClock },
    { id: 'mission', label: 'مأموریت', icon: CalendarClock },
    { id: 'overtime', label: 'اضافه‌کاری', icon: TimerReset },
  ],
  development: [
    { id: 'performance', label: 'ارزیابی عملکرد', icon: Target },
    { id: 'cycles', label: 'دوره ارزیابی', icon: CalendarClock },
    { id: 'goals', label: 'هدف و KRA', icon: Target },
    { id: 'selfReview', label: 'خودارزیابی', icon: UserRoundCheck },
    { id: 'feedback', label: 'بازخورد', icon: ListChecks },
    { id: 'training', label: 'برنامه آموزشی', icon: GraduationCap },
    { id: 'trainingEvents', label: 'رویداد و نتیجه', icon: GraduationCap },
    { id: 'skills', label: 'مهارت و شکاف', icon: Gauge },
  ],
  expenses: [
    { id: 'travel', label: 'درخواست سفر', icon: CalendarClock },
    { id: 'advances', label: 'مساعده هزینه', icon: WalletCards },
    { id: 'claims', label: 'بازپرداخت هزینه', icon: ReceiptText },
    { id: 'approvals', label: 'تأیید و تطبیق', icon: ListChecks },
  ],
  benefits: [
    { id: 'taxSlabs', label: 'پله‌های مالیاتی', icon: BarChart3 },
    { id: 'exemptions', label: 'اظهار و معافیت', icon: FileText },
    { id: 'benefits', label: 'مزایای کارکنان', icon: BadgeDollarSign },
    { id: 'loans', label: 'وام کارکنان', icon: WalletCards },
    { id: 'gratuity', label: 'پایان خدمت', icon: ReceiptText },
    { id: 'proofs', label: 'مدارک قانونی', icon: FileArchive },
  ],
  fleet: [
    { id: 'vehicles', label: 'خودروها', icon: CarFront },
    { id: 'logs', label: 'سوابق استفاده', icon: History },
  ],
  requests: [
    { id: 'inbox', label: 'کارتابل من', icon: ListChecks },
    { id: 'mine', label: 'درخواست‌های من', icon: UserRoundCheck },
    { id: 'leave', label: 'مرخصی', icon: CalendarClock },
    { id: 'attendance', label: 'اصلاح تردد', icon: TimerReset },
    { id: 'shift', label: 'شیفت', icon: CalendarClock },
    { id: 'travel', label: 'مأموریت و هزینه', icon: ReceiptText },
    { id: 'profile', label: 'تغییر اطلاعات', icon: Fingerprint },
    { id: 'payslips', label: 'فیش حقوقی', icon: BadgeDollarSign },
    { id: 'mobile', label: 'دسترسی موبایل', icon: UsersRound },
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
    { id: 'structures', label: 'ساختار حقوق', icon: FileText },
    { id: 'components', label: 'دریافتی و کسورات', icon: BadgeDollarSign },
    { id: 'runs', label: 'اجرای گروهی حقوق', icon: ReceiptText },
    { id: 'additional', label: 'پرداخت اضافی', icon: WalletCards },
    { id: 'incentives', label: 'پاداش و مشوق', icon: Target },
    { id: 'payslips', label: 'فیش حقوقی', icon: ReceiptText },
    { id: 'corrections', label: 'اصلاح و معوق', icon: History },
    { id: 'accounting', label: 'سند حسابداری', icon: BadgeDollarSign },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
  ],
  hrSettings: [
    { id: 'workflows', label: 'گردش‌کار', icon: Network },
    { id: 'roles', label: 'نقش و دسترسی', icon: ShieldCheck },
    { id: 'notifications', label: 'اعلان و یادآوری', icon: FileClock },
    { id: 'customization', label: 'فیلد، فرم و چاپ', icon: FileText },
    { id: 'integrations', label: 'API و Webhook', icon: Network },
    { id: 'companies', label: 'چندشرکتی و بومی‌سازی', icon: Building2 },
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
  recruitment: {
    title: 'جذب و استخدام',
    description:
      'برنامه‌ریزی نیرو و بودجه، درخواست جذب، فرصت شغلی، متقاضی، مصاحبه چندمرحله‌ای، بازخورد و پیشنهاد',
  },
  lifecycle: {
    title: 'چرخه همکاری',
    description:
      'ورود نیروی جدید، ارتقا، انتقال، مهارت، پایان همکاری، مصاحبه خروج و تسویه نهایی',
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
  expenses: {
    title: 'مأموریت و هزینه‌ها',
    description:
      'سفر کاری، مساعده، بازپرداخت چندارزی و تأیید مرحله‌ای با تحویل نتیجه به مالی',
  },
  benefits: {
    title: 'مالیات و مزایا',
    description:
      'پله مالیاتی، اظهار و مدرک معافیت، مزایا، وام و قواعد پایان خدمت تاریخ‌دار',
  },
  assets: {
    title: 'تجهیزات تحویلی',
    description:
      'درخواست، تخصیص، تحویل، انتقال، خرابی، عودت و تسویه تجهیزات کارکنان',
  },
  fleet: {
    title: 'خودروهای سازمانی',
    description:
      'رجیستر خودرو، تخصیص مجاز و سوابق استفاده بدون تداخل با مالکیت مالی دارایی',
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
  hrSettings: {
    title: 'تنظیمات و یکپارچگی منابع انسانی',
    description:
      'گردش‌کار، نقش، اعلان، شخصی‌سازی، API، Webhook، چندشرکتی و وضعیت بومی‌سازی ایران',
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
