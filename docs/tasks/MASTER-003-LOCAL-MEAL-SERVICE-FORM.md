# MASTER-003-LOCAL-MEAL-SERVICE-FORM — PC-B

به‌روزرسانی انتشار 2026-08-31: کاربر انتشار همه تغییرات و فعال‌سازی محلی را تأیید کرد. این Slice روی `codex/pc-b-master-data-meal-service-forms`، Stacked روی شاخه ترمینال، منتشر می‌شود. Migration افزایشی پس از Backup روی DB محلی اجرا شد و API4000/Web3100 روشن‌اند. گزارش پایین مربوط به مرحله پیاده‌سازی و آزمون اولیه است؛ والدها، داده قبلی و سایر تغییرات حفظ شده‌اند.

## محدوده و حفظ کار محلی

با تأیید صریح کاربر، اصلاح روی نسخه جاری `codex/pc-b-master-data-partner-forms` انجام شد؛ تغییرات قبلی حذف امن، همکاری و فرم‌های دیگر حفظ می‌شوند. سه قفل فعال Migration/Contract/Docs متعلق به `PC-B/MASTER-003` هستند. Customers، Dependency/Lockfile، Seed، شاخه والد و شاخه‌های PC-A خارج از Scope هستند.

## قرارداد افزایشی، Producer و Consumer

Producer: Master Data API؛ Consumer: Master Data Web؛ مالک هر دو PC-B. شکل اصلی Contract v12 و وضعیت عمومی active/inactive حفظ شده است.

- `POST/PATCH /api/v1/master-data/meal-services`: کد صریح `values.code` با Trim/Uppercase، طول ۲ تا ۳۲ و یکتایی موجود قابل تعریف است؛ پیشنهادهای RO/BB/HB/FB/ALL/UALL/BRN صرفاً گزینه UI هستند و Seed نمی‌سازند. برای سازگاری، Create بدون code همان کد خودکار قبلی را می‌سازد و PATCH بدون code مقدار قبلی را حفظ می‌کند.
- `includedMeals`: آرایه متن یا رشته JSON بدون اتلاف داده؛ رشته‌های comma-delimited قدیمی نیز پذیرفته می‌شوند. حداکثر ۲۰ مورد، هر مورد ۸۰ نویسه، بدون تکرار؛ آرایه خالی پاک‌کردن صریح است و نبود فیلد در PATCH مقدار قبلی را حفظ می‌کند.
- `attributes.includedMealsJson` آرایه را بدون شکستن وعده‌های سفارشی دارای ویرگول منتقل می‌کند؛ نمایش قدیمی includedMeals حفظ شده است. گزینه‌های قدیمی فرم حذف یا خودکار جایگزین نمی‌شوند.
- `values.status=active|inactive|under_review` فقط برای این منبع. تغییر وضعیت نیازمند `master_data.status.manage` است؛ ایجاد با وضعیت پیش‌فرض active استثناست. مقادیر وضعیت و محتوا در تراکنش واحد با Version و Audit ذخیره می‌شوند. ارسال مستقیم isUnderReview یا شمارنده هتل رد می‌شود.
- در حال بررسی به `isActive=false,isUnderReview=true` نگاشت می‌شود؛ مصرف‌کننده قدیمی آن را inactive می‌بیند و lookup فعال آن را انتخاب نمی‌کند. endpoint قدیمی status هنگام فعال/غیرفعال‌کردن پرچم بررسی را پاک می‌کند.
- فیلتر اختصاصی اختیاری `mealServiceStatus` روی List و Excel سه وضعیت را تفکیک می‌کند؛ Web هنگام استفاده از آن status عمومی را all می‌فرستد. سایر منابع و enum وضعیت عمومی تغییر نمی‌کنند.
- فرم ایجاد/ویرایش/مشاهده از ورودی مشترک فرم به Popup اختصاصی هدایت می‌شود. تعداد واقعی هتل‌های مرتبط همچنان از رابطه Master Data و فقط‌خواندنی است. KPI نیازمند بازبینی شامل رکوردهای فاقد نام انگلیسی یا در حال بررسی است، نه همه غیرفعال‌ها.

## Migration و فعال‌سازی

`20260831130000_master_data_meal_service_forms` فقط ستون Boolean پیش‌فرض false و CHECK عدم هم‌زمانی فعال/درحال‌بررسی را اضافه می‌کند؛ کد، وعده، شناسه، رابطه و وضعیت قدیمی را بازنویسی نمی‌کند.

Prisma Client و Build در نسخه آزمایشی مستقل از خروجی سرورهای جاری ساخته می‌شوند. Deploy دیتابیس کاربردی و جایگزینی Client سرور مشترک پس از هماهنگی فعال‌سازی انجام می‌شود؛ این اصلاح نباید Migrationهای محلی در انتظار فرم ترمینال/خدمات سفر را بی‌خبر فعال کند.

## بررسی

- Frozen install بدون تغییر Dependency/Lockfile؛ Prisma format/validate/generate در نسخه آزمایشی مستقل موفق.
- API: مجموعه نهایی ۵۱۲ تست موفق (شامل ۵ تست جدید HTTP/Permission)؛ Web: ۳۲۹ تست؛ Contract: ۱۴ و Database: ۵۷ تست موفق. Typecheck API/Web و Production Build API/Web موفق.
- ۸ تست واقعی PostgreSQL 18: اجرای همه ۲۳ Migration محلی روی DB خالی، حفظ رکورد legacy هنگام افزودن ستون، Seed دوبار، یکتایی کد، CHECK بررسی/فعال، PATCH جزئی و Version، منع وضعیت بدون مجوز، Audit، فیلتر/Excel و شمارش هتل با FK واقعی. دیتابیس موقت پس از هر اجرا حذف شد؛ داده کاربردی حذف نشد.
- اولین اجرای Seed به Timeout پیش‌فرض پنج‌ثانیه‌ای خورد؛ تکرار مستقل با همان Seed بدون تغییر Timeout موفق شد. خطای اولیه Fixture خروجی (ارسال pagination در filters) اصلاح شد؛ قرارداد خروجی محصول تغییر داده نشد.
- lint کل API و فایل‌های Web متاثر موفق؛ lint کامل Web فقط خطا/هشدار قبلی `date-picker.tsx:67/99` را دارد و آن فایل تغییر نکرد.
- تحلیلگر کمکی مهارت Database Designer، SQL نقل‌قول‌شده Prisma را parse نکرد و migration_generator در `--validate-only` خطای serialization نوع Column داد. این ابزارها معیار قبولی گزارش نشده‌اند؛ Prisma و اجرای واقعی PostgreSQL، CHECK، FK و دادهٔ legacy مرجع راستی‌آزمایی‌اند.
- کنترل محلی: Web3100 صفحه Login پاسخ ۲۰۰ می‌دهد؛ API4000 در زمان کنترل اتصال را نمی‌پذیرفت. نشست احراز‌شده موجود نبود و Smoke زندهٔ فرم ادعا نمی‌شود. هیچ سرور یا Client مشترک در این کار تعویض نشده است.
- Branch جاری `codex/pc-b-master-data-partner-forms` و HEAD `208801046c52637aa474aca6626f7617e0edd579` بدون جابه‌جایی؛ اصلاح فقط محلی و بدون Commit/Push است تا سایر کارهای ثبت‌نشده وارد Commit این فرم نشوند.
- `git diff --check` و اسکن الگوهای Secret/کارت در فایل‌های همین اصلاح موفق؛ مقایسه با snapshot پیش از ویرایش نشان می‌دهد تغییرات قبلی فایل‌های هم‌پوشان حفظ شده‌اند. هیچ فایل stage نشده و دیتابیس موقت آزمون باقی نمانده است.
