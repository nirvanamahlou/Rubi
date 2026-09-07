# LEGAL-ENTITY-BRAND-HEADER-002

## هدف

وقتی شرکت فعال «جهان باستان» است، Header اصلی سامانه سورمه‌ای باشد و نام کاربر همراه ساعت ورود در همان Header نمایش داده شود.

## پیاده‌سازی

- انتخاب موجود Legal Entity Context با یک Data Attribute محدود به نزدیک‌ترین `header` همگام می‌شود؛ بنابراین فایل مشترک `app-shell.tsx` که در PR #99 مالک فعال دارد دست‌نخورده باقی مانده است.
- استایل `JAHAN_BASTAN` یک طیف سورمه‌ای با کنتراست روشن برای انتخاب شرکت، جست‌وجوی سراسری، عملیات Header و اطلاعات نشست اعمال می‌کند. Context نیایش سیر و حالت تجمیعی ظاهر قبلی را حفظ می‌کنند.
- Login موفق فقط نام نمایشی و زمان ورود را در Session Storage همان Tab ثبت می‌کند. اگر نشست از قبل برقرار باشد و Cache وجود نداشته باشد، Client عمومی Refresh احرازشده نام کاربر را بازیابی می‌کند.
- خلاصه نشست در اندازه دسکتاپ نام نمایشی و ساعت ورود را با چیدمان RTL نشان می‌دهد. هیچ Password، Token، Cookie، Email یا داده حساس دیگری در Cache یا UI قرار نمی‌گیرد.

## محدوده و مرزها

- تغییرها فقط در Legal Entity selector، Login form، helper و تست نشست Header، استایل سراسری محدود و مستندات همین Task هستند.
- Backend، Prisma Schema/Migration/Seed، API/Shared Contract، Permission، Dependency/Lockfile، داده کاربر، Navigation مرکزی و Branchهای دیگر تغییر نکرده‌اند.
- سرویس‌های فعال Task دیگر روی پورت‌های ۳۱۰۰ و ۴۰۰۰ متوقف نشدند. Preview همین Branch روی پورت موقت ۳۱۰۱ بالا آمد و مسیر Dashboard مطابق انتظار به Login سالم هدایت شد؛ ورود واقعی بدون استفاده یا نمایش Credential محلی انجام نشد.

## کنترل کیفیت

- ۱۳ تست هدفمند Header session، Auth session، Legal Entity model و قرارداد اتصال Header: موفق
- Web lint: موفق، بدون Warning
- Web typecheck: موفق
- Web Production Build: موفق، ۳۴ Route
- `git diff --check`: موفق

## وضعیت قفل

`Central UI Owner = RELEASED — PC-B/LEGAL-ENTITY-BRAND-HEADER-002 ready for review`.

هیچ قفل Migration، Contract، Dependency/Lockfile، Database، Permission یا Branch دیگری گرفته نشد.

## Follow-up: شرکت‌های جهان آکادمیا و قسطی رو

- قرارداد عمومی به `legal-entities.v3` ارتقا یافت و دو کد canonical جدید `JAHAN_ACADEMIA` و `GHESATI_RO` را منتشر می‌کند.
- API سوییچ شرکت، فهرست مجاز را مستقیماً از قرارداد مشترک می‌گیرد تا Backend و Web از هم جدا نشوند.
- انتخاب‌گر Header چهار شرکت واقعی را نمایش می‌دهد و گزینه تجمیعی مدیران «همه شرکت‌ها» نام دارد.
- برای «جهان آکادمیا» و «قسطی رو» تا زمان دریافت لوگوی رسمی، نشان خنثی همراه نام صحیح شرکت نمایش داده می‌شود؛ لوگوی شرکت دیگری بازاستفاده نشده است.
- پیش از هر نوشتن، Backup کامل دیتابیس در `C:\Users\admin\Rubi-backups\legal-entities-before-additional-companies-20260907-120525.dump` با SHA-256 برابر `C79E3B5C5EB4230430091D9108438DD9ACE2722A054F78ED1560A6B1FDAF4377` ثبت شد.
- چون API قدیمی پورت ۴۰۰۰ قرارداد دوشرکتی داشت، دو رکورد آزمایشی ساخته‌شده در دیتابیس مشترک پس از تأیید نبود Context/Document وابسته به‌طور کامل بازگردانده شدند. دیتابیس مشترک و سرویس‌های Task دیگر دست‌نخورده باقی ماندند.
- یک Clone ایزوله از همان Backup روی PostgreSQL پورت ۵۵۴۳۳ ساخته شد و هر چهار شرکت با Branding Snapshot نسخه ۱ در آن فعال‌اند. API/Web همین Branch روی `127.0.0.1:4001` و `127.0.0.1:3101` اجرا می‌شوند تا Cookie و نشست سرویس `localhost:3100/4000` تغییر نکند.
- فایل مشترک `packages/database/prisma/seed.ts` به‌علت مالکیت فعال PR #90 تغییر نکرد. افزودن این دو رکورد به Seed مشترک پس از پایان آن مالکیت، Handoff مستقل لازم دارد؛ Migration، Schema و قفل Seed/Migration در این Follow-up گرفته نشد.
- ۲۷ تست هدفمند Contract/API/Web، lint و typecheck بسته‌های متاثر، Production Build API/Web با ۳۴ Route و `git diff --check` موفق‌اند. Web و Health API ایزوله HTTP 200 و Preflight احرازشده دارای Origin صحیح است.

`Legal Entities shared-contract Owner = PC-B/LEGAL-ENTITY-BRAND-HEADER-002` تا Merge یا Handoff باقی می‌ماند.
