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
