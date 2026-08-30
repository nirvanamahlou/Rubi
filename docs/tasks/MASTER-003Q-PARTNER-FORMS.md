# MASTER-003Q — تکمیل فرم‌های تأمین‌کننده و کارگزار

مالک: PC-B / MASTER-003. شاخه: `codex/pc-b-master-data-partner-forms`، والد #44.

## تحویل Stacked

Draft PR #45: https://github.com/nirvanamahlou/Rubi/pull/45 با Base برابر `codex/pc-b-master-data-clear-fields`، وابسته به #44 و زنجیره والد شامل #25. پیش از Merge والدها، به‌ویژه #25، این PR نباید Merge شود. پس از ادغام زنجیره والد، Base به `develop` منتقل شود؛ Merge خودکار، Force Push، تغییر Parent Branch/main و حذف Source Branch انجام نمی‌شود.

## دامنه و سازگاری

- نام انگلیسی مستقل در هر پروفایل، نوع حقیقی/حقوقی در Organization مشترک و انتخاب تماس اصلی از مخاطبان همان Organization.
- `Supplier/Broker → Organization` و `Supplier/Broker → Contact همان Organization` با FK مرکب؛ خدمات همچنان M:N از کاتالوگ واقعی‌اند.
- مقادیر جدید Nullable هستند؛ اطلاعات قبلی و API v12 سازگار باقی می‌مانند. نوع شخصیت رکوردهای قدیمی حدس زده نمی‌شود.
- فرم سازمان و مخاطب از داخل فرم پروفایل در Popup باز می‌شود؛ ویرایش سازمان با نسخه و مجوز مستقل آن انجام می‌شود. پروفایل مستقل یا تب اطلاعات تماس اضافه نمی‌شود.
- قرارداد، سقف خرید و وضعیت اتصال Provider قرارداد عملیاتی موجود ندارند و در این Slice ساخته/جعل نمی‌شوند؛ نیازمند Handoff رسمی B2B/Procurement/Integrations هستند.
- تغییرات محلی حذف امن و Board همکاری با مجوز کاربر حفظ می‌شوند؛ این واحد کار مالک Commit آن‌ها نیست.

## فرض‌ها و معیار بررسی

معماری و فرض‌های MASTER-003E ثابت‌اند: داده مرجع مشترک دو شرکت، بدون فیلتر Legal Entity، تماس سازمانی PII رمزنگاری‌شده با سازوکار موجود، مصرف read-heavy با فرض 20:1 و اوج کمتر از 50 QPS. هدف موجود p95 < 300ms، p99 < 600ms، با هدف p50 < 150ms؛ SLO 99.9%، RPO ≤ 24h و RTO ≤ 4h. مالک بررسی این Slice PC-B/MASTER-003 است؛ این اعداد نتیجه Load Test یا تعهد Production جدید نیستند.

رابط داخلی احرازشده برای دسکتاپ شبکه سازمانی و Responsive موبایل، با هدف WCAG AA و مالک بررسی PC-B. چارچوب/Rendering تغییر نمی‌کند؛ هدف بررسی LCP ≤ 2500ms، INP ≤ 200ms، CLS ≤ 0.1 در p75، حداکثر 80KB-gzip JS افزوده در Route، Lighthouse a11y ≥ 90 و performance ≥ 80 است؛ بدون اندازه‌گیری نباید ادعای عبور از این اهداف شود.

## Migration و بازگشت

Migration افزایشی، بدون Drop/Reset/Seed داده عملیاتی. بازگشت کد به نسخه والد با نگه‌داشتن ستون‌های nullable سازگار است؛ حذف ستون‌ها پس از ثبت داده مجاز نیست. هر Rollback ساختاری به Backup و Migration مستقلِ تأییدشده نیاز دارد.

## کنترل کیفیت

- Frozen install، Prisma format/validate/generate موفق. تمام ۲۰ Migration روی PostgreSQL 18 خالی اجرا شدند؛ Seed دوبار بدون ساخت Supplier/Broker نمونه. چهار آزمون DB برای ثبت/ویرایش/پاک‌کردن، Version، Mask/Audit، FK مرکب، جلوگیری از حذف/انتقال مخاطب استفاده‌شده و Constraint نوع شخصیت موفق‌اند.
- Migration جدید روی دیتابیس محلی Rubi نیز deploy شد، بدون Reset یا Seed داده عملیاتی. دیتابیس‌های موقت با نام تصادفیِ اعتبارسنجی‌شده پس از آزمون حذف شدند؛ رکورد کاربر حذف نشد.
- API جاری: ۳۸۴ موفق/۱۱ skipped؛ Web جاری: ۲۴۸ موفق؛ Contract: ۱۴؛ Database: ۵۳. این اعداد شامل اصلاحات محلی هم‌زمان‌اند.
- نسخه مستقل فقط همین Slice روی والد #44: API ۲۵۴ موفق/۴ آزمون opt-in DB skipped در اجرای عادی؛ Web ۱۸۶ موفق شامل ۶ آزمون SSR فرم واقعی؛ typecheck و Production Build هر دو برنامه، Web/webpack با ۳۴ صفحه، موفق. چهار آزمون opt-in DB جداگانه اجرا و موفق شدند.
- lint کل API و فایل‌های Web همین تغییر موفق؛ lint کلی Web به خطا و هشدار از پیش موجود در `apps/web/src/components/ui/date-picker.tsx:67,99` محدود است؛ فایل خارج Scope دست‌نخورده ماند.
- ابزار schema_analyzer مهارت Database فایل ALTER-only را پشتیبانی نکرد؛ جایگزین بررسی، Prisma validate و آزمون واقعی Constraint روی PostgreSQL بود. هدف‌های Performance/Accessibility اندازه‌گیری نشده‌اند و ادعای عبور ندارند.
- Health API و صفحه Login پاسخ می‌دهند. هر دو مرورگر قابل دسترس فاقد Session احراز‌شده بودند؛ بررسی تعاملی Popup بعد از ورود کاربر باقی است. تست SSR جای Smoke احراز‌شده معرفی نمی‌شود. هیچ رمز یا Session تغییر نکرد.
- سه قفل Migration/Contract/Docs در PC-B/MASTER-003 فعال‌اند. Dependency/Lockfile، Parent Branch، Customers و داخل ماژول‌های مالک قرارداد/خرید تغییر نکردند. تغییرات غیرمرتبط از Staging جدا شدند.
- `git diff --check` و Scope/Secret/Card-pattern scan تغییرات Stage‌شده موفق؛ هیچ Secret/PII واقعی یا فایل Customers وارد این Slice نشده است.

## Handoff وابستگی‌های مالی

مالک B2B/Procurement باید قرارداد عمومی برای وضعیت قرارداد و سقف خرید بر پایه Organization/Supplier/Broker، دامنه Legal Entity، ارز و نسخه/زمان مشاهده منتشر کند. Integrations باید وضعیت واقعی Provider را منتشر کند. تا آن زمان Master Data این اطلاعات را قابل ویرایش نمی‌کند و مقدار نامعلوم را صفر یا «بدون محدودیت» نشان نمی‌دهد. این بخش‌ها تکمیل‌شده اعلام نمی‌شوند.
