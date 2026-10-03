# B2B-CRM-CONNECTIONS-002

وضعیت: آماده بازبینی

## مسئله

پرونده ۳۶۰ آژانس در Web برای شاخص‌های مشتری، فروش، رزرو و مالی به داده‌های
نمونه یا تجمیع مستقیم چند API تکیه می‌کرد. این روش کنترل دسترسی شعبه و رابطه واقعی
رکوردها را در مرز B2B تضمین نمی‌کرد.

## پیاده‌سازی

- مسیر خواندنی و نسخه‌دار
  `GET /api/v1/b2b/agencies/:organizationId/crm-connections` اضافه شد.
- Query Service در Backend ابتدا مجوز `b2b.agency.read`، عضویت کاربر در شعبه و
  وجود Organization را کنترل می‌کند.
- اتصال رکوردها فقط با شناسه‌های قطعی انجام می‌شود:
  `MasterData Organization.id -> Customers.organizationId -> Sales.customerId -> Reservations.contractId`.
  تشابه نام هیچ نقشی در اتصال ندارد.
- B2B فقط از سرویس‌های عمومی Customers، Sales و Reservations می‌خواند؛ Query
  مستقیم Repository یا جدول ماژول دیگر وجود ندارد.
- داده خروجی حداقلی است و نام/شناسه مسافر را منتشر نمی‌کند. برای رزرو فقط تعداد
  مسافر و نوع خدمات برگردانده می‌شود.
- خطای یک producer باعث حذف داده موفق producerهای دیگر نمی‌شود و متن خطای داخلی
  نیز به مصرف‌کننده نشت نمی‌کند. `unavailableSources` وضعیت هر منبع را مشخص می‌کند.
- فراخوانی جزئیات قرارداد فروش با حداکثر هم‌زمانی ۴ انجام می‌شود و تمام فهرست‌ها
  سقف صفحه‌بندی دارند.
- Web Organizations اکنون فقط همین endpoint تجمیع B2B را مصرف می‌کند. KPIها،
  نمای ارتباطات CRM و جدول‌های مالی مبتنی بر قرارداد فروش از پاسخ Backend ساخته
  می‌شوند.

## مرزها و ارتباط‌های موجود

| منبع | وضعیت Backend | قاعده |
| --- | --- | --- |
| Master Data | متصل | هویت Organization و شعبه مرجع |
| IAM | متصل | نشست، Permission و Branch scope |
| Documents | از قبل متصل | اسناد پرونده با قرارداد عمومی Documents |
| B2B | متصل | پروفایل، قرارداد همکاری، اعتبار و نرخ توافقی |
| Customers | متصل در Query Service | تطبیق دقیق `organizationId` |
| Sales | متصل در Query Service | فقط قراردادهای Customerهای تطبیق‌یافته |
| Reservations | متصل در Query Service | فقط `contractId`های فروش تطبیق‌یافته |
| Finance | پورت رسمی موجود، producer ناموجود | وضعیت صریح unavailable؛ مانده Sales دفترکل یا فاکتور Finance معرفی نمی‌شود |

Marketing، Customer Affairs، Tasks/Automation و Integrations هنوز قرارداد عمومی
خواندن با `organizationId` منتشر نکرده‌اند. اتصال واقعی آن‌ها باید پس از انتشار
قرارداد نسخه‌دار توسط مالک همان ماژول اضافه شود؛ این Task جدول خصوصی یا داده
ساختگی برای پرکردن این فاصله ایجاد نمی‌کند.

## سازگاری و استقرار

تغییر افزایشی است و Migration یا Dependency ندارد. ترتیب استقرار:
Contracts، سپس API، سپس Web. کلاینت‌های قدیمی بدون تغییر کار می‌کنند.

## کنترل کیفیت

- تست سرویس: اتصال دقیق ID، حذف هم‌نام نامرتبط، projection حداقلی، مجوز، شعبه،
  failure isolation و پاک‌سازی خطا.
- تست Web: مصرف یک endpoint Backend، projection مالی با Decimal رشته‌ای، فیلتر
  تاریخ و وضعیت و KPIهای متصل.
- typecheck و lint محدوده Contracts/API/Web و buildهای متاثر اجرا می‌شوند.
