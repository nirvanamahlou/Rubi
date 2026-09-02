# DOCUMENTS-003C — داده نمایشی قابل اجرای اسناد

## نتیجه

هفت سند نمونه با فایل PNG واقعی و رنگی آماده شده‌اند تا نمای کلی، فهرست، جزئیات و
Preview اسناد روی PC-A و PC-B بدون داده واقعی قابل بررسی باشد. داده دیتابیس و فایل
Storage با Git جابه‌جا نمی‌شوند؛ Git مولد قطعی و فرمان محلی را منتقل می‌کند و هر دستگاه
نسخه محلی خودش را می‌سازد.

پوشش نمونه‌ها:

| دامنه | نمونه‌ها |
| --- | --- |
| هویت مشتری | پاسپورت و ترجمه مدارک ساختگی |
| فروش | پیشنهاد سفر گروهی و قرارداد ساختگی |
| سفر | واچر هتل منقضی ساختگی |
| خرید | سفارش خرید خدمات سفر ساختگی |
| منابع انسانی | گواهی آموزشی محدود ساختگی |

دو نمونه تا ۳۰ روز آینده منقضی می‌شوند و یک نمونه منقضی است. هیچ PII، نام مسافر، شماره
مدرک، مبلغ، حساب، Credential، Session، Secret یا فایل واقعی در Repository قرار نمی‌گیرد.

## اجرای PC-A و PC-B

پیش‌نیازها: PostgreSQL محلی Rubi روی پورت `55432`، Migration و Seed معمول، یک مدیر فعال
با دسترسی شعبه، تنظیمات Storage و کلید محلی و Antivirus فعال.

```powershell
git fetch --prune origin
git switch develop
git pull --ff-only origin develop
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @rubi/database exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter @rubi/database db:seed
pnpm documents:demo:preview
pnpm documents:demo:apply
```

تنظیمات پیش‌فرض از `apps/api/.env` خوانده می‌شود. اگر فایل محیط جای دیگری است:

```powershell
$env:RUBI_API_ENV_FILE = 'C:\path\to\private-api.env'
pnpm documents:demo:preview
pnpm documents:demo:apply
```

نام کاربری مدیر پیش‌فرض `nirvana` است و با `DOCUMENTS_DEMO_USERNAME` قابل تغییر است؛
Branch اختیاری با `DOCUMENTS_DEMO_BRANCH_CODE` انتخاب می‌شود. هیچ رمز یا حسابی ساخته یا
تغییر داده نمی‌شود.

## محافظ‌ها و رفتار

- Preview فقط پیش‌نیازها و نتیجه مورد انتظار را می‌خواند و هیچ رکورد یا فایلی نمی‌سازد.
- Apply فقط برای `development/test`، میزبان `localhost/127.0.0.1`، پورت `55432` و نام
  دیتابیس محلی allowlist‌شده مجاز است.
- Apply بدون Antivirus در دسترس متوقف می‌شود؛ وضعیت `CLEAN` فقط از نتیجه واقعی Adapter
  ثبت می‌شود.
- تصویرها در زمان اجرا تولید و با Storage موجود AES-256-GCM رمزگذاری می‌شوند؛ Binary
  آماده داخل Git نیست.
- تراکنش دیتابیس، advisory lock و پاک‌سازی فایل در خطا، اجرای اتمیک با RPO صفر برای همین
  عملیات فراهم می‌کنند. هدف p99 اجرای محلی کمتر از ۶۰ ثانیه است.
- Marker و شناسه‌های قطعی اجرای مجدد را idempotent می‌کنند. Metadata ویرایش‌شده کاربر
  بازنویسی نمی‌شود و Duplicate ساخته نمی‌شود.
- Production، Startup و Seed عمومی این فرمان را اجرا نمی‌کنند.

## اعتبارسنجی PC-B

- Preview دیتابیس برنامه: `created=7`, `reused=0` و بدون Write.
- Apply با Microsoft Defender واقعی: هفت Scan پاک و هفت رکورد ایجاد شد.
- اجرای دوباره: `created=0`, `reused=7`, `repairedFiles=0`.
- API زنده: هر هفت شناسه در فهرست دیده شدند و Preview تصویر PNG پاسخ ۲۰۰ داد.
- PostgreSQL مستقل و Storage موقت: چهار سناریوی Preview، fail-closed Antivirus، Apply
  تکرارپذیر/رمزگذاری‌شده و فهرست/Preview واقعی موفق شد.
- مجموعه عمومی API: ۸۰ فایل موفق، ۸ فایل اختیاری skip؛ ۷۲۹ تست موفق و ۷۰ تست اختیاری
  skip. lint API، typecheck کامل Workspace و Build API موفق بود.

پیش از Apply روی PC-B یک Backup خصوصی از دیتابیس محلی گرفته شد. Backup، فایل محیط، کلید
Storage و داده ساخته‌شده محلی هستند و وارد Git نمی‌شوند.

## مرز تغییر

این Task فقط کد Demo در Documents، Scriptهای اجرایی، تست و مستندات را تغییر می‌دهد.
Schema/Migration، قرارداد عمومی، IAM Permission، Dependency و `pnpm-lock.yaml` تغییر
نکرده‌اند. صدور سند و داده واقعی همچنان در ماژول مالک باقی می‌ماند.
