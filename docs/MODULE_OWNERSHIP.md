# مالکیت ماژول‌ها

وضعیت: مالکیت نهایی توسعه — 2026-08-22

این سند مرجع تخصیص ماژول‌ها میان `PC-A` و `PC-B` است. مالک هر ماژول مسئول توسعه
Full-Stack آن، شامل مدل داده، Backend، Frontend و تست‌ها است. مالکیت ماژول به معنی
اجازه تغییر بدون هماهنگی در فایل‌های مرکزی، قراردادهای مشترک، Dependencyها یا
Migrationها نیست.

## مالکیت PC-A

- مشتریان
- قراردادها، فروش و تخصیص خدمات
- رزرواسیون و عملیات سفر
- مدیریت و تعریف بلیت‌ها
- مالی و خزانه‌داری
- احراز هویت و مدیریت کاربران
- نقش‌ها و سطح دسترسی
- API تأمین‌کنندگان سفر
- اتصال دو سایت
- مدیریت سیستم: IAM، تنظیمات و امنیت
- زیرساخت گزارش‌گیری Backend

## مالکیت PC-B

- داشبورد
- امور مشتریان، سرنخ‌ها و پشتیبانی
- خرید و تأمین
- مارکتینگ
- آژانس‌ها و مشتریان سازمانی
- منابع انسانی
- وظایف و اتوماسیون
- اسناد و فایل‌ها
- اطلاعات پایه
- رابط مرکزی گزارش‌ها

## نگاشت منوی اصلی

| ردیف | بخش منو                    | مالک اجرا         | توضیح مرز                                                |
| ---: | -------------------------- | ----------------- | -------------------------------------------------------- |
|    1 | داشبورد                          | PC-B              | فقط مصرف‌کننده Viewها و APIهای گزارش‌دهی تاییدشده                  |
|    2 | مشتریان و مسافران                | PC-A              | هویت و Customer 360؛ تخصیص قراردادی در Sales است                   |
|    3 | امور مشتریان، سرنخ‌ها و پشتیبانی | PC-B              | request/lead، qualification، Ticket، SLA و satisfaction            |
|    4 | رزرواسیون و عملیات سفر           | PC-A              | availability/Hold، صدور، هتل، بیمه سامان و Manifest                |
|    5 | مدیریت و تعریف بلیت‌ها           | PC-A              | محصول بلیت، fare version و ظرفیت؛ بدون صدور passenger document     |
|    6 | قراردادها، فروش و تخصیص خدمات    | PC-A              | قرارداد و اتصال customer/passenger به ticket/hotel/service         |
|    7 | خرید و تأمین                     | PC-B              | Purchase Request/Order/Invoice، تخفیف کارگزار و net purchase       |
|    8 | مالی و خزانه‌داری                | PC-A              | Sub-ledger، چک، دریافت/پرداخت، Journal و financial release         |
|    9 | مارکتینگ                         | PC-B              | Campaign، audience و attribution                                   |
|   10 | آژانس‌ها و مشتریان سازمانی       | PC-B              | B2B contract، credit و agreed rate                                 |
|   11 | منابع انسانی                     | PC-B              | پرونده کارمند، سازمان، حضور، مرخصی و ارزیابی                       |
|   12 | وظایف و اتوماسیون                | PC-B              | Task، Approval و Automation Rule/Run                               |
|   13 | اسناد و فایل‌ها                  | PC-B              | metadata، archive، version و access history                        |
|   14 | گزارش‌ها                         | مشترک با مرز صریح | PC-A: Backend؛ PC-B: رابط مرکزی                                    |
|   15 | یکپارچه‌سازی‌ها                  | PC-A              | Provider APIها، بیمه سامان و اتصال دو سایت                         |
|   16 | مدیریت سیستم                     | PC-A              | UI مشترک IAM/Settings؛ مرز Backend جدا، امنیت و audit              |
|   17 | اطلاعات پایه                     | PC-B              | Reference/Master Data و فعال/غیرفعال‌سازی                          |

مالک Backend گزارش‌ها مسئول View/Query/Export infrastructure و صحت grain است. مالک
رابط مرکزی گزارش‌ها مسئول navigation، filter، visualization و stateهای UI است و فقط
قرارداد تاییدشده Backend را مصرف می‌کند. تغییر این قرارداد پیش از اجرا ثبت و هماهنگ
می‌شود.

## قفل‌های کاری مشترک

- در هر لحظه فقط یک **Migration Owner** فعال است. مالک در `WORK_ASSIGNMENTS.md`،
  دامنه Schema/Migration و Branch را پیش از تغییر رزرو می‌کند.
- در هر لحظه فقط یک **Dependency/Lockfile Owner** فعال است. تغییر `package.json`های
  مشترک، workspace config یا lockfile بدون این رزرو ممنوع است.
- فایل‌های مرکزی مانند تنظیمات ریشه، قراردادهای مشترک، Prisma schema، مستندات
  cross-module و زیرساخت مشترک پیش از تغییر به نام یک Work Item قفل می‌شوند.
- تغییر API/Event Contract مشترک باید پیش از پیاده‌سازی با نسخه، producer، consumer و
  migration/compatibility plan در Work Item یا سند قرارداد ثبت شود.
- قفل مشترک فقط محدوده اعلام‌شده را پوشش می‌دهد و پس از `DONE` یا آزادسازی صریح پایان
  می‌یابد؛ مالکیت دائمی فایل مرکزی ایجاد نمی‌کند.

## قرارداد شاخه و ادغام

- ماژول‌های مستقل در Branchهای مستقل `codex/pc-a-<task>` یا
  `codex/pc-b-<task>` ساخته می‌شوند.
- هر دو کامپیوتر در ماژول تحت مالکیت خود مجاز و مسئول تغییر Database، Backend،
  Frontend و Test هستند.
- PR قابلیت‌ها ابتدا به `develop` باز می‌شود و بدون Review ادغام نمی‌شود.
- انتشار پایدار با PR/تایید از `develop` به `main` انجام می‌شود؛ توسعه مستقیم روی
  `main` یا `develop` ممنوع است.

مرز مالکیت داده و dependencyهای مجاز در
[MODULE_BOUNDARIES.md](MODULE_BOUNDARIES.md) و روش رزرو و تحویل در
[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) تعریف شده است.
