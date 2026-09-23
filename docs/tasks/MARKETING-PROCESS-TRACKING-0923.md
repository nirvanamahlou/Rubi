# MARKETING-PROCESS-TRACKING-0923

## هدف

فرایند مرجع بازاریابی به یک projection قابل مشاهده در Rubi تبدیل می‌شود تا کاربر از
«استراتژی بازاریابی» تا «تحلیل و بهبود» مسیر، مالک هر مرحله، داده‌های مورد انتظار و
کمبود زیرساخت را ببیند. این projection خودش داده کسب‌وکار تولید نمی‌کند و وضعیت
`AVAILABLE` را فقط برای مسیرهای عملیاتی موجود اعلام می‌کند.

## نگاشت فرایند به پروژه

| مرحله | مالک نهایی | وضعیت فعلی | مسیر عملیاتی |
| --- | --- | --- | --- |
| تدوین استراتژی | Marketing | در انتظار زیرساخت | جایگاه داخل Marketing |
| جذب B2B/B2C | Marketing + Customer Affairs | بخشی | Leadهای امور مشتریان |
| بخش‌بندی | Marketing + Customers | در انتظار زیرساخت | جایگاه مخاطبان Marketing |
| CRM | Customer Affairs + Customers | عملیاتی | `/customer-affairs` |
| فروش | Sales | عملیاتی | `/sales` |
| ارائه خدمات سفر | Reservations | عملیاتی | `/reservations` |
| حفظ و وفاداری | Customer Affairs + Customers | بخشی | رضایت امور مشتریان |
| تحلیل و بهبود | Reporting | بخشی | `/reports` |

## پیاده‌سازی

- قرارداد افزایشی `marketing.process.v1` و کدهای مجوز Marketing در بسته Contracts.
- endpoint فقط‌خواندنی `GET /marketing/process` با AuthGuard، PermissionGuard و
  `Cache-Control: private, no-store`.
- سرویس API با هشت مرحله مرتب، مالک، وضعیت، فیلدهای قابل پیگیری، کمبودها و لینک
  عملیاتی. این سرویس metadata قابلیت‌هاست و رکورد آزمایشی یا PII برنمی‌گرداند.
- سکشن «فرایند یکپارچه» در Hub مارکتینگ با رابط RTL، وضعیت loading/error/retry،
  خلاصه وضعیت و اقدام‌های fail-closed برای مرحله‌های فاقد زیرساخت.
- مجوزهای Marketing و Roleهای `marketing_staff` و `marketing_manager` در Seed؛
  اجرای Seed یا تغییر داده عملیاتی بخشی از این واحد نیست.

## مرز امنیت و مالکیت

- Marketing شماره تماس، ایمیل، نام مشتری یا اعضای materialized یک Segment را مالک
  نمی‌شود؛ Customers باید شمارش، Consent و Suppression را از Public Contract بدهد.
- Marketing هیچ Repository یا جدول خصوصی Customers، Customer Affairs، Sales،
  Reservations یا Reporting را مستقیم نمی‌خواند.
- endpoint فقط برای کاربر احراز‌شده دارای هر دو مجوز `marketing.read` و
  `marketing.process.read` قابل دسترس است.

## زیرساخت باقی‌مانده

1. `MarketingPlan` نسخه‌دار، بودجه/ارز و گردش تأیید آن هنوز Persistence ندارد.
2. Campaign، Segment، Approval و Touchpoint به Prisma model/migration پایدار نیاز
   دارند. این تغییر انجام نشد چون Migration lock جاری در `WORK_ASSIGNMENTS.md`
   هنوز رسماً آزاد نشده است.
3. Customer Affairs برای Lead به `campaignReference/UTM` پایدار و Public Contract
   نیاز دارد؛ در حال حاضر فقط مسیر Lead موجود به کاربر داده می‌شود.
4. Customers باید قرارداد عمومی audience evaluation، consent و suppression بدون
   افشای PII منتشر کند.
5. Reporting به `reporting_campaign_facts_v1`، مدل Attribution مصوب و مراجع هزینه
   و درآمد منتسب نیاز دارد تا CAC/ROAS معتبر بسازد.
6. مالک دامنه Loyalty، قواعد امتیاز/سطح و ارتباط خرید مجدد هنوز مصوب و پیاده نشده
   است.
7. اجرای ارسال کمپین به Provider/Worker، idempotency، retry و delivery receipt نیاز
   دارد؛ تا آن زمان اجرای واقعی کمپین در این واحد فعال نشده است.

## اعتبارسنجی

- Typecheck بسته‌های Contracts و Database موفق است.
- تست‌های هدفمند Marketing API: ۷ فایل و ۳۹ تست موفق.
- تست‌های هدفمند Marketing Web: ۴ فایل و ۲۳ تست موفق.
- Lint محدوده، Typecheck کامل و Build تولیدی API و Web موفق‌اند؛ Web با ۵۲ مسیر
  تولیدی ساخته شد.
- Prisma Client صرفاً برای build با URL غیرعملیاتی بازتولید شد؛ هیچ اتصال، migration
  یا seed روی دیتابیس انجام نشد.
