import type { DashboardKpiDefinition } from './registry';

// Definitions only: values require a versioned, permission-aware cross-module
// Reporting projection. The Dashboard adapter must not synthesize observations.
const employeeActivity = 'reporting_employee_commercial_activity_facts_v1';
const employeeSales = 'sales.reporting.organization.v2';

export const employeeCommercialKpis: readonly DashboardKpiDefinition[] = [
  {
    id: 'employee-lead-count', title: 'تعداد لید کارشناس', technicalName: 'Employee Lead Count',
    grain: 'یک لید و کارشناس منتسب در زمان ثبت', source: [employeeActivity],
    rule: 'تعداد لیدهای یکتا با انتساب معتبر به کارشناس در بازه ثبت لید؛ ثبت‌کننده و مالک لید به‌صورت جداگانه قابل بررسی‌اند.',
    exclusions: 'لید تکراری، حذف‌شده و انتساب نامشخص از رتبه‌بندی خارج است؛ یک لید نباید برای چند کارشناس شمرده شود.',
    dateBasis: 'created', currency: 'not-applicable', permission: 'reports.dashboard.crm.read',
    role: 'driver', decision: 'ورودی فرصت‌های فروش بین کارشناسان چگونه توزیع شده است؟',
    comparison: 'کارشناس، واحد فروش، منشا و وضعیت لید', reportCode: 'RPT-011',
  },
  {
    id: 'employee-call-count', title: 'تعداد تماس کارشناس', technicalName: 'Employee Call Count',
    grain: 'یک تماس ثبت‌شده و کارشناس', source: [employeeActivity],
    rule: 'تعداد تماس‌های یکتای ثبت‌شده با زمان وقوع در بازه، به تفکیک ورودی/خروجی و نتیجه تماس.',
    exclusions: 'یادداشت آزاد، تماس تکراری و تماس فاقد نوع یا کارشناس معتبر تماس شمرده نمی‌شود.',
    dateBasis: 'effective', currency: 'not-applicable', permission: 'reports.dashboard.crm.read',
    role: 'driver', decision: 'فعالیت ارتباطی و تماس موفق هر کارشناس چقدر است؟',
    comparison: 'کارشناس، نوع و نتیجه تماس، دوره قبل', reportCode: 'RPT-011',
  },
  {
    id: 'employee-followup-count', title: 'تعداد پیگیری کارشناس', technicalName: 'Employee Follow-up Count',
    grain: 'یک فعالیت پیگیری و کارشناس مسئول', source: [employeeActivity],
    rule: 'تعداد فعالیت‌های پیگیری یکتای ثبت‌شده برای لید یا مشتری در بازه، با تفکیک انجام‌شده و معوق.',
    exclusions: 'یادآور فاقد مالک، فعالیت حذف‌شده و تکرار همان پیگیری خارج است؛ معوق بودن با سررسید و وضعیت سنجیده می‌شود.',
    dateBasis: 'effective', currency: 'not-applicable', permission: 'reports.dashboard.crm.read',
    role: 'driver', decision: 'کدام کارشناس فرصت‌ها را به‌موقع پیگیری می‌کند؟',
    comparison: 'کارشناس، نوع و وضعیت پیگیری', reportCode: 'RPT-011',
  },
  {
    id: 'employee-finalized-sales-count', title: 'تعداد فروش کارشناس', technicalName: 'Employee Finalized Sales Count',
    grain: 'یک قرارداد فروش نهایی و کارشناس فروش منتسب', source: [employeeSales, employeeActivity],
    rule: 'تعداد قراردادهای فروش یکتای نهایی‌شده در بازه، منتسب به کارشناس طبق مالکیت مصوب در زمان تأیید.',
    exclusions: 'پیش‌نویس، قرارداد لغوشده و انتساب مبهم خارج است؛ قلم‌های چندخدمتی قرارداد را چند بار نمی‌شمارند.',
    dateBasis: 'effective', currency: 'not-applicable', permission: 'reports.dashboard.sales.read',
    role: 'outcome', decision: 'کدام کارشناس بیشترین فروش نهایی را ثبت کرده است؟',
    comparison: 'کارشناس، خدمت، کانال و دوره قبل', reportCode: 'RPT-002',
  },
  {
    id: 'employee-sales-amount', title: 'مبلغ فروش کارشناس', technicalName: 'Employee Sales Amount',
    grain: 'قرارداد فروش نهایی، کارشناس و ارز', source: [employeeSales, employeeActivity],
    rule: 'جمع مبلغ فروش قراردادهای نهایی‌شده منتسب به کارشناس، جداگانه برای هر ارز و در بازه تأیید فروش.',
    exclusions: 'پیش‌نویس، فروش لغوشده، مبلغ تکراری قلم خدمت و جمع ارزهای تبدیل‌نشده خارج است.',
    dateBasis: 'effective', currency: 'required', permission: 'reports.dashboard.sales.read',
    role: 'outcome', decision: 'سهم هر کارشناس از درآمد فروش چقدر است؟',
    comparison: 'کارشناس، خدمت، کانال، مقصد و ارز', reportCode: 'RPT-002',
  },
  {
    id: 'employee-lead-conversion', title: 'نرخ تبدیل لید کارشناس', technicalName: 'Employee Lead Conversion Rate',
    grain: 'کوهورت لیدهای یکتای منتسب به کارشناس', source: [employeeActivity],
    rule: 'تعداد لیدهای یکتای واجد شرایط که در پنجره تبدیل به نخستین فروش نهایی رسیدند ÷ تعداد کل همان لیدهای واجد شرایط × ۱۰۰؛ تعداد قرارداد به‌جای تعداد لید تبدیل‌شده استفاده نمی‌شود.',
    exclusions: 'فروش بدون ارتباط معتبر به لید و لیدهای کوهورت نارس از محاسبه خارج‌اند؛ پنجره تبدیل باید ثابت باشد.',
    dateBasis: 'created', currency: 'not-applicable', permission: 'reports.dashboard.crm.read',
    role: 'outcome', decision: 'چه سهمی از فرصت‌های هر کارشناس به مشتری تبدیل می‌شود؟',
    comparison: 'کارشناس، کانال جذب و کوهورت لید', reportCode: 'RPT-011',
  },
  {
    id: 'employee-average-sale', title: 'میانگین مبلغ فروش کارشناس', technicalName: 'Employee Average Sale Value',
    grain: 'کارشناس، بازه و ارز', source: [employeeSales, employeeActivity],
    rule: 'مبلغ فروش نهایی همان کارشناس و ارز ÷ تعداد قراردادهای فروش نهایی همان کارشناس؛ از جمع صورت و مخرج باز‌محاسبه می‌شود.',
    exclusions: 'کارشناس بدون فروش مقدار ندارد؛ میانگین ارزهای متفاوت یا میانگین میانگین‌ها مجاز نیست.',
    dateBasis: 'effective', currency: 'required', permission: 'reports.dashboard.sales.read',
    role: 'diagnostic', decision: 'ارزش متوسط معامله هر کارشناس چه تفاوتی دارد؟',
    comparison: 'کارشناس، خدمت، ارز و دوره قبل', reportCode: 'RPT-002',
  },
  {
    id: 'employee-contract-count', title: 'تعداد قرارداد کارشناس', technicalName: 'Employee Contract Count',
    grain: 'یک قرارداد ثبت‌شده و کارشناس مالک', source: [employeeSales, employeeActivity],
    rule: 'تعداد قراردادهای یکتای ثبت‌شده در بازه، به تفکیک وضعیت؛ فروش نهایی زیرمجموعه جداگانه آن است.',
    exclusions: 'قرارداد آزمایشی، حذف‌شده یا فاقد مالک معتبر خارج است.',
    dateBasis: 'created', currency: 'not-applicable', permission: 'reports.dashboard.sales.read',
    role: 'driver', decision: 'حجم قراردادهای در جریان هر کارشناس چقدر است؟',
    comparison: 'کارشناس، نوع و وضعیت قرارداد', reportCode: 'RPT-002',
  },
  {
    id: 'employee-cancellation-count', title: 'تعداد لغو کارشناس', technicalName: 'Employee Cancellation Count',
    grain: 'یک قرارداد یا رزرو لغوشده و کارشناس منتسب', source: [employeeActivity],
    rule: 'تعداد لغوهای یکتای ثبت‌شده در بازه وقوع لغو، منتسب به مالک فروش در زمان رخداد، با تفکیک دلیل.',
    exclusions: 'لغو تکراری همان سفارش و درخواست لغو نهایی‌نشده خارج است؛ لغو صرفاً معیار تقصیر کارشناس نیست.',
    dateBasis: 'effective', currency: 'not-applicable', permission: 'reports.dashboard.sales.read',
    role: 'guardrail', decision: 'لغوها در کدام تیم یا خدمت نیازمند بررسی علت‌اند؟',
    comparison: 'کارشناس، خدمت، دلیل لغو و دوره قبل', reportCode: 'RPT-010',
  },
  {
    id: 'employee-sales-rank', title: 'رتبه فروش کارشناس', technicalName: 'Employee Sales Rank',
    grain: 'کارشناس، بازه و ارز', source: [employeeSales, employeeActivity],
    rule: 'رتبه بر اساس مبلغ فروش نهایی در همان ارز و دامنه مجاز؛ معیار رتبه‌بندی قابل انتخاب است و تساوی رتبه یکسان می‌گیرد.',
    exclusions: 'ترکیب ارزها، جمع شاخص‌های ناهم‌واحد و رتبه‌دادن بدون پوشش کامل تیم مجاز نیست.',
    dateBasis: 'effective', currency: 'required', permission: 'reports.dashboard.sales.read',
    role: 'diagnostic', decision: 'برای بررسی تفاوت عملکرد، کدام کارشناسان را مقایسه کنیم؟',
    comparison: 'کارشناس، تیم، تعداد فروش و نرخ تبدیل', reportCode: 'RPT-002',
  },
] as const;

export const employeeCommercialSource = employeeActivity;
export const employeeSalesSource = employeeSales;
