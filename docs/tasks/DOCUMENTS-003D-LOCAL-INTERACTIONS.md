# DOCUMENTS-003D — تعاملات آرشیو و راه‌اندازی محلی

## نتیجه

سه مانع عملی استفاده از Documents برطرف شد:

1. کارت‌های «مدیریت آرشیو» دکمه واقعی هستند و فهرست مرتبط را با فیلتر یا مرتب‌سازی
   مشخص باز می‌کنند؛ قرنطینه، اسناد آرشیوشده، اسناد نزدیک انقضا، وضعیت اسکن، مالکیت،
   دسته‌بندی و نوع سند مسیر قابل مشاهده دارند.
2. فرم بارگذاری برای Options و اطلاعات نشست دو درخواست وابسته ندارد. همان پاسخ احراز‌شده
   Documents، نوع‌ها، دسته‌ها، مالک‌ها، کاربر جاری و شعبه‌های مجاز را تحویل می‌دهد.
   Dropdownها مقدار اولیه واقعی، لایه نمایش درست و اعتبارسنجی صریح دارند و خطای Upload
   ورودی‌های کاربر را پاک نمی‌کند.
3. ساخت داده نمایشی روی هر دستگاه یک‌مرحله‌ای شده است. Apply پیش‌نیازهای دیتابیس را آماده
   می‌کند و موفقیت را فقط پس از مشاهده هفت سند `CLEAN` اعلام می‌کند.

## اجرای PC-A پس از Merge

Git دیتابیس، Storage یا فایل محیط خصوصی PC-B را جابه‌جا نمی‌کند. PC-A پس از دریافت
`develop` این فرمان‌ها را در محیط خودش اجرا می‌کند:

```powershell
git fetch --prune origin
git switch develop
git pull --ff-only origin develop
pnpm install --frozen-lockfile
pnpm documents:demo:apply
```

اگر فایل محیط API در مسیر پیش‌فرض نیست، پیش از فرمان آخر مسیر خصوصی همان PC تعیین می‌شود:

```powershell
$env:RUBI_API_ENV_FILE = 'C:\path\to\private-api.env'
pnpm documents:demo:apply
```

خروجی موفق شامل `readyForViewing: true` و `verifiedRecords: 7` است. پس از Restart سرویس
API/Web همان PC، هفت سند نمونه در نمای کلی و همه اسناد دیده می‌شوند.

## مرز امنیت و داده

- Fixtureها کاملاً ساختگی‌اند و هیچ PII، رمز، Session، Secret یا فایل واقعی ندارند.
- داده در PostgreSQL و Storage محلی هر PC ساخته و فایل‌ها با سازوکار موجود رمزگذاری
  می‌شوند؛ Binary یا داده کاربردی داخل Git قرار نمی‌گیرد.
- Apply فقط محیط development/test و دیتابیس محلی allowlist‌شده را می‌پذیرد، بدون
  Antivirus fail-closed متوقف می‌شود و اجرای مجدد Duplicate نمی‌سازد.
- قرارداد Options فقط به مصرف‌کننده Documents اطلاعات Scope احراز‌شده خودش را اضافه
  می‌کند. Schema/Migration، IAM Permission، Dependency/Lockfile و Seed عمومی تغییر
  نکرد؛ Runner خطای گذرای Seed اتمیک و idempotent محلی را حداکثر یک‌بار تکرار می‌کند.

## اعتبارسنجی

- تست قرارداد Options و Service برای شعبه‌های مجاز و کاربر جاری.
- تست Client برای یک درخواست Documents و عدم وابستگی به Refresh مستقل IAM.
- تست مدل فرم برای مقداردهی Dropdown، حفظ انتخاب کاربر و تمام خطاهای الزامی.
- تست نگاشت هشت کارت آرشیو و قرارداد Component برای کلیک، لایه Select و اتصال Options.
- تست Runner و Seed برای آماده‌سازی PC تازه و تأیید دقیق هفت رکورد `CLEAN`.

Gate کامل Monorepo شامل lint، typecheck و Production Build موفق بود. ۱٬۳۹۰ تست موفق و
۷۰ تست PostgreSQL اختیاری مطابق قرارداد عادی Suite، skip شدند. پیش از Apply واقعی یک
Backup خصوصی و قابل فهرست‌خوانی گرفته شد؛ اجرای تکراری روی دیتابیس محلی `created=0`،
`reused=7`، `readyForViewing=true` و `verifiedRecords=7` برگرداند.
