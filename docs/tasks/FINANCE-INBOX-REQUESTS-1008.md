# FINANCE-INBOX-REQUESTS-1008

## تغییر رابط

نمودار «جریان کارتابل بر اساس واحد» و محاسبهٔ محلی توزیع درخواست‌ها از نمای مالی حذف شد. خلاصهٔ عملیاتی، سررسیدهای نزدیک، حساب‌های فعال و راهنمای اقدام مالی باقی مانده‌اند.

فهرست درخواست‌ها در تمام اندازه‌های صفحه تمام‌عرض است. با انتخاب یک ردیف، جزئیات و فرم اقدام همان درخواست در یک کارت تمام‌عرض و زیر فهرست نمایش داده می‌شود؛ صفحه به آن بخش پیمایش می‌کند. کارت‌های درخواست با فاصله، کنتراست و حالت انتخاب واضح‌تر بازچینی شدند. فیلترها، صفحه‌بندی، انتخاب درخواست و عملیات مالی بدون تغییر مانده‌اند.

## محدوده و اعتبارسنجی

فقط رابط Finance Web و CSS همان ماژول تغییر کرده است؛ API، schema، migration، مجوزها، dependency و دادهٔ عملیاتی تغییری ندارند. Scoped ESLint and Prettier pass. Web typecheck was attempted but cannot pass until workspace-linked shared contract outputs are rebuilt from this newer develop base; the reported missing exports are in other modules, not the changed finance screen. No tests or production build were run. No migration or database runtime work is needed.
