# ممیزی مرحلهٔ پنجم راهنمای نورا

موجودی این مرحله ۱۶۵ موضوع در هشت سند است. جدول محدودهٔ موجود را ثبت می‌کند. در ۱۴ بخش، متن راهنما با رفتار فرم یا کنترل مربوط تکمیل شد. وجود فایل‌های مرجعِ ثبت‌شده در فرادادهٔ هر هشت سند نیز بررسی شد. مرجع هر اصلاح در ادامه آمده است و آزمون کاتالوگ وجود مرجع، مسیر راهنما و متن بازیابی‌شده را بررسی می‌کند.

| ماژول | موضوع‌های موجود | پوشش | بخش‌های به‌روزشده |
| --- | --- | --- | --- |
| قیمت‌گذاری پرواز | 9 | فیلتر و فهرست، نرخ سنی و جفت، پله، کانال فروش، اکسل و انتشار | [publish](../assistant/guides/flight-pricing.md#publish)، [tiers](../assistant/guides/flight-pricing.md#tiers) |
| مشتریان حقیقی | 12 | شاخص و فهرست، ثبت و پروندهٔ ۳۶۰، رضایت و روابط، موارد مشابه، مدارک و اکسل | [register](../assistant/guides/b2c.md#register)، [duplicate](../assistant/guides/b2c.md#duplicate) |
| تعریف تور و خدمات | 10 | تعریف و ویرایش، نوبت و ظرفیت، هتل و قیمت، انتشار و توقف | [price](../assistant/guides/tour.md#price)، [period](../assistant/guides/tour.md#period) |
| کال‌سنتر | 22 | تماس، ثبت نتیجه، صف و ارجاع، پرونده، گزارش، صوت و اعلان | [call-center-assignment](../assistant/guides/call-center.md#call-center-assignment)، [call-center-notification](../assistant/guides/call-center.md#call-center-notification) |
| اطلاعات پایه | 38 | مراجع جغرافیا، بانک و ارز، اشخاص حقوقی، سفر و هتل، فایل و تاریخچه | [hotels](../assistant/guides/master-data.md#hotels) |
| اسناد و فایل | 23 | رده‌بندی، بارگذاری و نسخه، مشاهده، اشتراک، نگهداری و آرشیو | [upload](../assistant/guides/documents.md#upload)، [download](../assistant/guides/documents.md#download) |
| میزکار من | 36 | درخواست و منابع انسانی، پیام و فایل، یادداشت، تقویم، پکیج و حساب | [daily-packages](../assistant/guides/workbench.md#daily-packages) |
| مشتریان سازمانی | 15 | هویت و ارتباطات، توافق و نرخ، اعتبار، مدارک، فعالیت و اسناد فروش | [credit](../assistant/guides/b2b.md#credit)، [finance](../assistant/guides/b2b.md#finance) |

## مراجع اصلاح‌ها

- [flight-pricing/publish](../assistant/guides/flight-pricing.md#publish) · [مرجع پیاده‌سازی](../../apps/web/src/modules/sales/components/ticket-prices-workspace.tsx)
- [flight-pricing/tiers](../assistant/guides/flight-pricing.md#tiers) · [مرجع پیاده‌سازی](../../apps/web/src/modules/sales/components/ticket-prices-workspace.tsx)
- [b2c/register](../assistant/guides/b2c.md#register) · [مرجع پیاده‌سازی](../../apps/web/src/modules/customers/components/customer-workspace.tsx)
- [b2c/duplicate](../assistant/guides/b2c.md#duplicate) · [مرجع پیاده‌سازی](../../apps/web/src/modules/customers/components/customer-workspace.tsx)
- [tour/price](../assistant/guides/tour.md#price) · [مرجع پیاده‌سازی](../../apps/web/src/modules/ticket-catalog/components/tour-inline-prices.tsx)
- [tour/period](../assistant/guides/tour.md#period) · [مرجع پیاده‌سازی](../../apps/web/src/modules/ticket-catalog/components/tour-inline-prices.tsx)
- [call-center/call-center-assignment](../assistant/guides/call-center.md#call-center-assignment) · [مرجع پیاده‌سازی](../../apps/web/src/modules/call-center/workflow-client.ts)
- [call-center/call-center-notification](../assistant/guides/call-center.md#call-center-notification) · [مرجع پیاده‌سازی](../../apps/web/src/modules/call-center/workflow.tsx)
- [master-data/hotels](../assistant/guides/master-data.md#hotels) · [مرجع پیاده‌سازی](../../apps/web/src/modules/master-data/components/hotel-images.tsx)
- [documents/upload](../assistant/guides/documents.md#upload) · [مرجع پیاده‌سازی](../../apps/web/src/modules/documents/components/documents-workspace.tsx)
- [documents/download](../assistant/guides/documents.md#download) · [مرجع پیاده‌سازی](../../apps/web/src/modules/documents/components/documents-workspace.tsx)
- [workbench/daily-packages](../assistant/guides/workbench.md#daily-packages) · [مرجع پیاده‌سازی](../../apps/web/src/modules/workbench/workbench-daily-packages.tsx)
- [b2b/credit](../assistant/guides/b2b.md#credit) · [مرجع پیاده‌سازی](../../apps/web/src/modules/organizations/model/temporary-credit.ts)
- [b2b/finance](../assistant/guides/b2b.md#finance) · [مرجع پیاده‌سازی](../../apps/web/src/modules/organizations/model/credit-projection.ts)

## موارد پذیرش مرحلهٔ ششم

در مرورگر با حساب‌های مجاز و محدود، انتخاب مسیر، پیام منع دسترسی و کنترل نقش را در هر ماژول بررسی کنید. برای مسیرهای حساس از نمونهٔ آزمایشی استفاده کنید. وضعیت انتشار سایت، تصمیم واقعی ادغام، مجوز بازکردن فایل و اعتبار واقعی پرونده باید از پنل مربوط تأیید شوند. رفتار عملیاتی این پنل‌ها در این واحد تغییر نکرده است.
