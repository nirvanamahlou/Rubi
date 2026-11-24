# پذیرش انتشار مرحلهٔ ششم نورا

## محیط آزمون

شاخهٔ تجمیع از #1922 و آخرین develop این اجرا ساخته شد. پیش‌نمایش وب به API بومی ERP و PostgreSQL ایزوله با حساب‌های ساختگی متصل است. ارائه‌دهندهٔ مدل عمداً قطع است تا پاسخ راهنما از سند داخلی سنجیده شود. معیار پذیرش ۹۵٪ برای هر ماژول و قبولی تمام سناریوهای حساس است.

## ماتریس مرورگر

| شناسه | نقش | سؤال | بخش مورد انتظار |
| --- | --- | --- | --- |
| G01 | sales | چجور قرارداد بزنم؟ | [sales#create](../assistant/guides/sales.md#create) |
| G02 | sales | رسید رو از کجا بذارم؟ | [sales#receipt](../assistant/guides/sales.md#receipt) |
| G03 | reservations | بلیت پرواز رو چطور صادر کنم؟ | [travel-issuance#ticket](../assistant/guides/travel-issuance.md#ticket) |
| G04 | reservations | واچر هتل دوم رو از کجا بگیرم؟ | [travel-issuance#voucher](../assistant/guides/travel-issuance.md#voucher) |
| G05 | affairs | درخواست مشتری رو چجوری ثبت کنم؟ | [customer-affairs#requests](../assistant/guides/customer-affairs.md#requests) |
| G06 | affairs | تشدید تیکت رو چطور انجام بدم؟ | [customer-affairs#ticket-escalation](../assistant/guides/customer-affairs.md#ticket-escalation) |
| G07 | admin | بنر پک رو چطور بگیرم؟ | [package-generator#visual-output](../assistant/guides/package-generator.md#visual-output) |
| G08 | admin | ارسال به پکیج های روز چطور انجام میشه؟ | [package-generator#daily-publication](../assistant/guides/package-generator.md#daily-publication) |
| G09 | admin | شارژ تنخواه رو چطور ثبت کنم؟ | [petty-cash#recharge](../assistant/guides/petty-cash.md#recharge) |
| G10 | admin | بستن تنخواه چطور انجام میشه؟ | [petty-cash#settlement-policy](../assistant/guides/petty-cash.md#settlement-policy) |
| G11 | admin | چاپ نامه صادره رو چطور انجام بدم؟ | [correspondence#letter-export](../assistant/guides/correspondence.md#letter-export) |
| G12 | admin | بازارسال نامه داخلی رو از کجا انجام بدم؟ | [correspondence#internal-actions](../assistant/guides/correspondence.md#internal-actions) |
| G13 | admin | استعلام خرید را چطور ثبت کنم؟ | [purchase#supplier-quote](../assistant/guides/purchase.md#supplier-quote) |
| G14 | admin | ثبت مغایرت خرید رو چطور انجام بدم؟ | [purchase#discrepancy](../assistant/guides/purchase.md#discrepancy) |
| G15 | admin | معنی کارت‌های گزارش رزرواسیون چیست؟ | [reservation-report#metric-units](../assistant/guides/reservation-report.md#metric-units) |
| G16 | admin | اختلاف اکسل گزارش رزرواسیون رو چطور بررسی کنم؟ | [reservation-report#count-difference](../assistant/guides/reservation-report.md#count-difference) |
| G17 | admin | قیمت پلکانی پرواز رو چطور بزنم؟ | [flight-pricing#tiers](../assistant/guides/flight-pricing.md#tiers) |
| G18 | admin | چطور قیمت پرواز رو در سایت منتشر کنم؟ | [flight-pricing#publish](../assistant/guides/flight-pricing.md#publish) |
| G19 | admin | چطور پرونده مشتری جدید ثبت کنم؟ | [b2c#register](../assistant/guides/b2c.md#register) |
| G20 | admin | چطور پیشنهاد ادغام پرونده مشتری را ثبت کنم؟ | [b2c#duplicate](../assistant/guides/b2c.md#duplicate) |
| G21 | admin | چطور تور شناور تعریف کنم؟ | [tour#floating](../assistant/guides/tour.md#floating) |
| G22 | admin | قیمت پکیج تور رو چطور مدیریت کنم؟ | [tour#price](../assistant/guides/tour.md#price) |
| G23 | admin | درخواست در کارهای من نیست، چیکار کنم؟ | [call-center#call-center-assignment](../assistant/guides/call-center.md#call-center-assignment) |
| G24 | admin | پاپ آپ تماس نیومد چیکار کنم؟ | [call-center#call-center-notification](../assistant/guides/call-center.md#call-center-notification) |
| G25 | admin | هتل رو کجا تعریف کنم؟ | [master-data#hotels](../assistant/guides/master-data.md#hotels) |
| G26 | admin | کشور رو چطور تعریف کنم؟ | [master-data#countries](../assistant/guides/master-data.md#countries) |
| G27 | admin | چطور فایل بارگذاری کنم؟ | [documents#upload](../assistant/guides/documents.md#upload) |
| G28 | admin | چطور سند را دانلود کنم؟ | [documents#download](../assistant/guides/documents.md#download) |
| G29 | admin | چطور درخواست مرخصی ساعتی ثبت کنم؟ | [workbench#leave-hourly](../assistant/guides/workbench.md#leave-hourly) |
| G30 | admin | پکیج های روز رو از کجا ببینم؟ | [workbench#daily-packages](../assistant/guides/workbench.md#daily-packages) |
| G31 | admin | اعتبار موقت آژانس رو چطور ثبت کنم؟ | [b2b#credit](../assistant/guides/b2b.md#credit) |
| G32 | admin | امضادار سازمان رو از کجا ثبت کنم؟ | [b2b#signatories](../assistant/guides/b2b.md#signatories) |

## اجرای مرورگر و رفع رگرسیون

در دور اول ۳۰ مورد از ۳۲ مورد با پیوند دقیق راهنما و مدل قطع قبول شدند. دو مورد باقیمانده به تطبیق ترتیب فعل در سؤال دانلود سند و طبقه‌بندی پکیج‌های روز مربوط بودند. هر دو اصلاح به همراه تست بازگشت در این شاخه قرار دارند و همان دو سؤال در اجرای هدفمند مرورگر قبول شدند. مجموع نتایج ثبت‌شده ۳۲ از ۳۲ است.

حساب رزرواسیون در سؤال ترکیبی صدور و تحویل، فقط بخش صدور را دریافت کرد. درخواست مستقیم راهنمای استثنای مالی با همان نشست هیچ بخش یا پیوند محدودی برنگرداند. درخواست بدون نشست پاسخ ۴۰۱ گرفت.

در گزارش رزرواسیون، مقایسهٔ کارت، ردیف‌های پاسخ و فایل اکسل دانلودشده از مرورگر با فیلتر یکسان برای بازهٔ خالی موفق شد. دادهٔ چندردیفی با آزمون مصنوعی فایل بررسی شد.

پس از همگام‌سازی با develop، راهنمای عمومی رزرواسیون برای دو سؤال مشخص دربارهٔ صدور بلیت و دریافت واچر انتخاب می‌شد. اولویت این دو موضوع اصلاح شد و هر دو سؤال در مرورگر دوباره قبول شدند. محدودیت دسترسی نقش رزرواسیون نیز دوباره تأیید شد.

## بررسی‌های مستقل

- ۷۲۱ آزمون وب روی شاخهٔ همگام‌شده با develop شامل بازیابی راهنما، مرز احراز هویت، طبقه‌بندی سؤال و فیلترهای گزارش موفق شدند. TypeScript و تطابق کاتالوگ تأیید شدند.
- هندلر واقعی راهنما با توکن نشست بومی و بررسی دسترسی اصلی ۱۶ سؤال اول و منع راهنمای استثنای مالی برای نقش رزرواسیون را قبول کرد. اجرای مستقیم هندلر، آزمون نمایش خروجی در مرورگر محسوب نمی‌شود.
- سه آزمون خروجی اکسل شامل ردیف‌های چندخدمتی، شمارش اشخاص و تاریخ محلی تهران با دادهٔ ساختگی موفق شدند. تطبیق مرورگر و اکسل روی بازهٔ خالی و بازهٔ دارای سه ردیف ساختگی تأیید شد.

## نتیجهٔ بررسی‌های حساس

- تعویض شرکت از کنترل «انتخاب شرکت فعال» پاسخ موفق بومی دریافت کرد و زمینهٔ قبلی پاک شد. تعویض حساب با نشست بومی جدید نیز زمینهٔ قبلی را پاک کرد.
- سؤال وضعیت درخواست مشتری بدون شماره، از گردش راهنما پاسخ «شمارهٔ پیگیری درخواست را بفرستید» و مسیر پرونده را نمایش داد.
- در بازهٔ غیرخالی، فیلتر «همه خدمات» از خود رابط اعمال شد. پاسخ بومی، کارت تعداد خدمات و اکسل دانلودشده هر سه، سه ردیف ساختگی را با فیلتر یکسان نشان دادند.
- آزمون پوشش ترجمه با همان شروط مخزن دوباره اجرا شد و هر سه آزمون قبول شدند. اجرای هدفمند وب روی شاخهٔ همگام‌شده نیز تأیید شد.
## دروازهٔ انتشار

پیش از انتشار، ماتریس مرورگر و بررسی‌های حساس شامل تعویض حساب و شرکت، عدم دسترسی، دادهٔ ناموجود و قطعی مدل باید قبول شوند. هر نسخه با CI روی همان commit تحویل می‌شود. پس از تأیید انتشار، نسخهٔ قبلی سرویس و وب برای بازگشت نگه داشته شوند. بازگشت با استقرار مجدد نسخهٔ قبلی و تکرار آزمون راهنما و خواندن داده تأیید می‌شود. این تغییر نیاز به مهاجرت دیتابیس عملیاتی ندارد.
