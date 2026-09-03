# DOCUMENTS-004-OPERATIONS — عملیات واقعی اسناد و آرشیو

- وضعیت نهایی: `DONE/MERGED`
- Pull Request: [#89](https://github.com/nirvanamahlou/Rubi/pull/89)
- Merge Commit: `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605`

## هدف

تکمیل تجربه عملیاتی بخش اسناد و فایل‌ها: نمایش ساده‌تر اطلاعات، فهرست‌های فیلترمحور، ویرایش و حذف دائمی کنترل‌شده، برچسب ناقص، اشتراک‌گذاری جست‌وجوپذیر، عملیات گروهی و ابزارهای واقعی آرشیو.

## مرزها

- Documents مالک Metadata، نسخه، فایل ذخیره‌شده، محرمانگی، تاریخچه دسترسی و وضعیت آرشیو است.
- لینک اشتراک فقط داخلی، احراز‌شده و تابع مجوز همان سند می‌ماند.
- حذف دائمی در Legal Hold ممنوع است و باید هم رکوردهای وابسته دیتابیس و هم فایل‌های ذخیره‌شده را پاک کند.
- رابطه پرونده در Backend حفظ می‌شود، اما توضیح فنی Source/Query از رابط کاربر حذف می‌شود.
- هیچ Dependency یا Lockfile جدیدی افزوده نمی‌شود.

## کنترل کیفیت برنامه‌ریزی‌شده

- تست Domain، Contract، Permission، Repository/Service/HTTP و Component
- Prisma format/validate/generate و Migration روی PostgreSQL خالی
- lint، typecheck، تست کامل و Production Build بخش‌های متاثر
- Smoke مرورگر برای فیلتر، ویرایش، حذف، اشتراک، عملیات گروهی، ناقص/منقضی و بازیابی آرشیو

## نتیجه پیاده‌سازی

- فهرست‌های عملیاتی فقط بعد از جست‌وجو یا انتخاب فیلتر داده می‌گیرند؛ نمای کلی، نمای شخصی و «مدارک ناقص و منقضی» فیلتر ضمنی خود را دارند.
- ویرایش Metadata، برچسب ناقص/کامل، آرشیو، بازیابی و عملیات گروهی با کنترل مجوز، Branch/Domain و نسخه خوش‌بینانه به Backend واقعی متصل شدند.
- حذف دائمی با دلیل و تأیید کد آرشیو انجام می‌شود؛ Legal Hold آن را مسدود می‌کند و نسخه‌ها، Jobها، قرنطینه، Relation، Audit، رکورد سند و Objectهای فایل پاک می‌شوند.
- اشتراک‌گذاری لینک داخلی احراز‌شده، جست‌وجو، فیلتر نوع/شعبه/محرمانگی و حالت خالی پیش از فیلتر دارد.
- مدیریت آرشیو فقط «مدارک ناقص و دسته‌بندی»، «اسناد تحت مسئولیت من»، «نگهداری و انقضا» و «بازیابی اسناد آرشیوشده» را نگه می‌دارد؛ هر کارت یک Query واقعی باز می‌کند.
- DatePicker مشترک فرم‌های اسناد Dropdown ماه/سال را حذف می‌کند؛ ماه‌ها در شبکه ۱۲تایی و سال‌ها در شبکه ۱۲تایی صفحه‌بندی‌شده انتخاب می‌شوند و ظاهر آبی Rubi، انتخاب شمسی/میلادی و خروجی Gregorian ISO حفظ می‌شود.
- Migration افزایشی `20260903110000_documents_incomplete_status` وضعیت ناقص را ذخیره و برای فهرست پیگیری Index می‌کند.

## اعتبارسنجی نهایی

- Full Monorepo: lint، typecheck و Production Build موفق.
- تست: ۱٬۴۷۰ موفق؛ ۷۰ تست PostgreSQL اختیاری طبق تنظیم معمول Suite رد شدند.
- PostgreSQL خالی: هر ۳۰ Migration اعمال و ستون `documents.is_incomplete` تأیید شد؛ دیتابیس موقت سپس حذف شد.
- دیتابیس محلی PC-B: Migration جدید اعمال و ۷ Fixture تصویری Documents با `readyForViewing=true` تأیید شد.
- Browser Smoke روی `http://localhost:3100/documents`: حالت خالی بدون فیلتر، ۱۳ نتیجه با جست‌وجوی «آزمایشی»، دکمه‌های ویرایش/حذف، Dialog عملیات گروهی، Dropdownهای ویرایش، پسوند `.PNG`، ارتباط ساده و چهار کارت آرشیو تأیید شدند؛ هیچ رکوردی در Smoke تغییر یا حذف نشد.
- Follow-up تقویم: ۵۹۸ تست Web، lint، typecheck و Production Build موفق؛ Browser QA فرم بارگذاری، Grid هر ۱۲ ماه، Grid صفحه‌بندی‌شده ۱۲ سال، انتخاب `۱۴۰۶ / مهر / ۱` و نمایش میلادی با رقم انگلیسی را تأیید کرد.

## Handoff نهایی قفل‌ها

| قفل                                     | وضعیت نهایی                |
| --------------------------------------- | -------------------------- |
| Documents shared-contract Owner         | `RELEASED / STABLE`        |
| Shared Calendar Owner                   | `RELEASED / STABLE`        |
| Dependency/Lockfile Owner               | `RELEASED`                 |
| Migration Owner                         | `PC-A/SALES-CONTRACTS-001` |
| Central Docs Owner                      | `PC-A/SALES-CONTRACTS-001` |
| Sales shared-contract/root export Owner | `PC-A/SALES-CONTRACTS-001` |

Documents فقط مالک نگهداری، نسخه‌بندی و دسترسی فایل است. Sales فقط از قرارداد عمومی Documents استفاده می‌کند و حق Query مستقیم جدول‌ها، Repository یا زیرساخت داخلی Documents را ندارد. Dependency/Lockfile برای Sales آزاد می‌ماند مگر نیاز واقعی بعداً اثبات و با Work Item مستقل، دلیل و فایل‌های دقیق رزرو شود.

مرجع رسمی انتقال: `docs/tasks/DOCUMENTS-004-HANDOFF.md`.
