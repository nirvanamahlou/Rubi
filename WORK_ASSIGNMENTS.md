# Work Assignments

## DOCUMENTS-004-OPERATIONS — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-09-03: ساده‌سازی جزئیات سند، فارسی‌سازی فعالیت/نگهداری، فیلترمحورشدن فهرست‌ها و اشتراک‌گذاری، فعال‌کردن پیگیری و عملیات گروهی، ویرایش و حذف دائمی امن همه رکوردها، برچسب «ناقص» و تکمیل Backend ابزارهای باقی‌مانده مدیریت آرشیو. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-workflows` از `origin/develop@9608607` در Worktree تمیز `C:\Users\admin\Rubi-documents-workflows` ساخته و سپس با `origin/develop@6ac2dfc` همگام شد؛ `develop`، `main` و Worktreeهای دیگر مستقیم تغییر نمی‌کنند.
- محدوده رزروشده: `apps/web/src/modules/documents/**`، `apps/api/src/documents/**`، قرارداد افزایشی Documents در `packages/contracts/src/documents/**`، مدل و Migration افزایشی Documents در `packages/database/prisma/**`، تقویم مشترک `apps/web/src/components/ui/date-picker*`، تست‌های همین Slice و اسناد همین Work Item.
- هماهنگی قفل: Task `MASTER-004-FORM-FOLLOWUP` با Commit `34066f6` قفل Central Docs را صریحاً آزاد کرده و هیچ فایل Documents را تغییر نداده است. `Migration Owner = PC-B/DOCUMENTS-004-OPERATIONS`، `Documents shared-contract Owner = PC-B/DOCUMENTS-004-OPERATIONS` و `Central Docs Owner = PC-B/DOCUMENTS-004-OPERATIONS`؛ Dependency/Lockfile آزاد و بدون تغییر می‌ماند.
- حذف دائمی فقط با مجوز مدیریت نگهداری، تأیید صریح کاربر، کنترل Branch/Domain، رد Legal Hold و پاک‌سازی رکوردهای وابسته و Object ذخیره‌شده مجاز است. حذف منطقی جدید ساخته نمی‌شود؛ بازیابی فقط برای اسناد `ARCHIVED` باقی می‌ماند.
- فهرست‌های عملیاتی تا انتخاب حداقل یک فیلتر داده نشان نمی‌دهند؛ نمای کلی KPI/کارهای من مستثنا است. خروجی از UI حذف می‌شود و اشتراک‌گذاری همچنان لینک داخلی احراز‌شده و Permission-aware است، نه لینک عمومی.
- نتیجه: جزئیات سند ساده و فارسی شد؛ نوع فایل به‌صورت پسوند نمایش داده می‌شود و متن‌های SHA/MIME/منبع فنی و مسیر پیشنهادی حذف شدند. ویرایش، حذف دائمی، آرشیو/بازیابی، برچسب ناقص و عملیات گروهی به API و دیتابیس واقعی متصل‌اند. اشتراک‌گذاری فیلتر و جست‌وجو دارد و ابزارهای باقی‌مانده آرشیو به فهرست‌های واقعی متصل شدند.
- اعتبارسنجی: ۱٬۴۷۰ تست موفق و ۷۰ تست اختیاری PostgreSQL رد شدند؛ lint، typecheck و Production Build کامل Monorepo موفق است. هر ۳۰ Migration روی PostgreSQL خالی و Migration جدید روی دیتابیس محلی اعمال شد. بسته آزمایشی ۷ سند `readyForViewing=true` است و Smoke مرورگر فیلترمحوربودن، ۱۳ نتیجه جست‌وجو، عملیات گروهی، Dropdown ویرایش، `.PNG` و حذف متن‌های فنی را تأیید کرد.
- وضعیت انتشار: تغییرات روی Branch مستقل محلی آماده Commit/Review است؛ `develop` و `main` تغییر نکرده‌اند و قفل‌های Migration، Documents Contract و Central Docs تا تعیین تکلیف انتشار نزد همین Work Item باقی می‌مانند.
- Follow-up مالک در 2026-09-03: انتخاب ماه و سال در تقویم فرم‌های اسناد نباید Dropdown باشد و باید با Grid هم‌تم Rubi انجام شود. `Shared Calendar Owner = PC-B/DOCUMENTS-004-OPERATIONS`؛ API عمومی DatePicker، مقدار ISO Gregorian، Dependency و Lockfile بدون تغییر می‌مانند.
- نتیجه Follow-up تقویم: دو Select ماه/سال حذف شدند؛ ماه‌ها در Grid دوازده‌تایی و سال‌ها در Grid دوازده‌تایی صفحه‌بندی‌شده نمایش داده می‌شوند. انتخاب شمسی/میلادی، ارقام انگلیسی حالت میلادی، انتخاب روز و مقدار ذخیره‌شده Gregorian ISO حفظ شدند. Web شامل ۵۹۸ تست موفق است و lint، typecheck و Production Build موفق‌اند؛ Browser QA در فرم بارگذاری اسناد انتخاب شبکه‌ای `۱۴۰۶ / مهر / ۱` و حالت میلادی را تأیید کرد.

## TICKET-CATALOG-003 — PC-A — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-03: کارت هر بلیت علاوه بر ظرفیت کل، ظرفیت باقی‌مانده همان بلیت را نیز نمایش دهد. `COMPUTER_ID=PC-A`.
- Branch مستقل `codex/pc-a-ticket-card-remaining-capacity` از `origin/develop@fc68ce1`؛ محدوده فقط کارت/Workspace و تست‌های Ticket Catalog و اسناد همین Work Item است.
- مقدار مانده از مدل موجودی Ticket Catalog محاسبه می‌شود؛ تا زمان اتصال تخصیص‌های Reservations، Snapshot بدون تخصیص مانده‌ای برابر ظرفیت کل دارد. هیچ داده رزرو ساختگی ساخته نمی‌شود.
- بدون Schema/Migration/Seed، Dependency/Lockfile، Shared Contract، IAM یا تغییر ماژول Reservations.
- نتیجه: کارت بلیت اکنون «ظرفیت کل» و «مانده» را کنار هم نشان می‌دهد؛ مانده با `inventoryTotals` و پس از کسر تخصیص‌های نگهداری‌شده و تأییدشده محاسبه می‌شود. Workspace فعلی تا اتصال قرارداد Reservations از Snapshot بدون تخصیص استفاده می‌کند، بنابراین برای داده‌های فعلی مانده برابر کل است.
- اعتبارسنجی: هر ۹۵ تست Ticket Catalog Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند.

## MARKETING-001C — PC-B — DONE/MERGED

- درخواست صریح مالک در 2026-09-03: صفحات داخلی تمام سکشن‌های Workspace مارکتینگ مطابق فایل مرجع `marketing.html` اصلاح شوند و همان داده‌های آزمایشی امن حفظ شوند. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-marketing-inner-pages-parity` از `origin/develop@9608607`؛ فایل HTML صرفاً مرجع بصری/تعاملی است و دستور اجرایی محسوب نمی‌شود.
- محدوده رزروشده: `apps/web/src/modules/marketing/**`، تست‌های همان ماژول، `docs/tasks/MARKETING-001.md` و ورودی محدود همین Task در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`.
- صفحات داخلی باید ساختار، کارت‌ها، فیلترها، actionها و حالت‌های جزئیات مرجع را با اجزای مشترک Rubi پیاده کنند؛ داده‌ها فقط synthetic با شناسه `preview-*` و بدون PII باقی می‌مانند.
- بدون Schema/Migration/Seed، Persistence، API/Shared Contract، IAM، Navigation، AppModule، Dependency/Lockfile یا تغییر فایل‌های UI مرکزی. PR #83 مربوط به قفل قبلی Central Docs در `origin/develop@9608607` ادغام شده و پایان یافته است؛ تقویم مشترک فقط مصرف می‌شود.
- نتیجه: ۴۵ زیرصفحه تخصصی، داشبورد کامل، ۹ تب جزئیات کمپین و داده‌های synthetic دقیق مرجع جای صفحات عمومی قبلی را گرفتند. فیلتر، جست‌وجو، صفحه‌بندی، سازنده سگمنت، پیش‌نمایش پیام، سفر مشتری، Switch، Dialog و Action feedback در State محلی کار می‌کنند؛ فیلتر و تقویم از Design System مشترک Rubi هستند.
- ادغام مبنا: `origin/develop@6ac2dfc` در Branch ادغام شد. Web lint و `599/599` تست موفق؛ Full lint برابر ۶ Task و Full test برابر `1,464` تست موفق با ۷۰ skip اختیاری است. Browser QA تمام تب‌ها/فرم‌ها و Mobile `390×844` را بدون Overflow یا Console error تأیید کرد.
- Typecheck محلی با غیرفعال‌کردن کش افزایشی موفق شد. CI تمیز PR #86 نیز Full Typecheck، Full Production Build، Full Test و Gate کامل PostgreSQL 18/Migration/Seed را سبز کرد؛ خطای موقت `observedAt` ناشی از کش قدیمی محلی بود و هیچ فایل Master Data در این Task تغییر نکرد.
- انتشار: PR [#86](https://github.com/nirvanamahlou/Rubi/pull/86) با Merge Commit `4ea7b27` وارد `develop` شد. هر چهار Job اجباری CI پیش از ادغام و اجرای کامل CI پس از ادغام روی خود `develop` موفق‌اند.
- Final lock state: `RELEASED — PC-B/MARKETING-001C merged via PR #86`. Migration، Dependency/Lockfile، Shared Contract و Central UI در تمام Task آزاد و بدون تغییر ماندند.

## MASTER-004-FORM-FOLLOWUP — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-03: خروجی واقعی تمام فرم‌های اطلاعات پایه دوباره با فهرست اصلاحات هم‌ترازی کنترل شود و مواردی که ناقص یا فقط ظاهری پیاده شده‌اند، به‌ویژه جریان یکپارچه استان/شهر و حذف کاتالوگ‌های مستقل هتل، تکمیل شوند. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-master-data-form-followup` از `origin/develop@9608607`؛ `develop` و `main` مستقیم تغییر نمی‌کنند.
- محدوده رزروشده: `apps/web/src/modules/master-data/**`، در صورت نیاز منطق سازگار `apps/api/src/master-data/**` و `packages/contracts/src/master-data/**`، تست‌های همین Slice و اسناد همین Work Item.
- هدف این Follow-up اصلاح رفتار و نمایش واقعی است. Schema/Migration/Seed، Dependency/Lockfile و قرارداد ماژول‌های دیگر تا زمان اثبات نیاز تغییر نمی‌کنند؛ داده و ستون قدیمی حذف مخرب نمی‌شود.
- `Master Data Web/API = PC-B/MASTER-004-FORM-FOLLOWUP`. قفل `Central Docs` پس از تکمیل و تحویل این Follow-up آزاد شد؛ Migration، Dependency/Lockfile و Shared Root Contract نیز `RELEASED / UNASSIGNED` می‌مانند.
- نتیجه: نمای استان و شهر در یک سکشن و دو جدول پیوسته قرار گرفت؛ فیلدها، ستون‌ها و کاتالوگ‌های حذف‌شده واقعاً از UI حذف شدند؛ کد خدمت تأمین‌کننده/کارگزار در Backend خودکار تولید می‌شود و فیلدهای فرم، Exportها و نمایش نرخ/اقامت/حمل‌ونقل با درخواست نهایی هم‌تراز شدند.
- اعتبارسنجی: Web Master Data برابر `42/42` فایل و `327/327` تست، API Master Data برابر `27/27` فایل و `402/402` تست، lint و typecheck هر دو برنامه و Production Build هر دو موفق‌اند. API روی `4000` و Web تازه‌ساخته‌شده روی `3100` فعال‌اند؛ Health هر دو پاسخ `200` دارند. Schema/Migration/Seed/Dependency/Lockfile تغییر نکرد.

## MASTER-004-FORM-ALIGNMENT — PC-B — DONE/MERGED

- درخواست مالک در 2026-09-02: هم‌ترازسازی کامل فرم‌ها و فهرست‌های اطلاعات پایه شامل ادغام تجربه استان/شهر، حذف یا اختیاری‌کردن فیلدهای مشخص‌شده، افزودن ترتیب نمایش عمومی، یکسان‌سازی تقویم و قالب اعداد، حذف Exportهای تعیین‌شده، ورود داخلی امکانات هتل، ساده‌سازی حمل‌ونقل و افزودن Logo Reference برای شرکت‌ها و سازمان‌ها. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-master-data-form-alignment` از `origin/develop@e91cdba`؛ کار مستقیم روی `develop` یا `main`، Merge خودکار، Force Push و حذف Branch ممنوع است.
- محدوده رزروشده: `apps/web/src/modules/master-data/**`، `apps/api/src/master-data/**`، قرارداد افزایشی `packages/contracts/src/master-data/**`، مدل‌ها و Migration افزایشی Master Data در `packages/database/prisma/**`، تست‌های همین Slice و اسناد همین Work Item.
- مرزها: مدل Region/City در دیتابیس ادغام نمی‌شود و فقط تجربه فرم به‌صورت یک جریان وابسته استان سپس شهر یکپارچه می‌شود؛ حذف فیلدهای قدیمی از UI/Contract به روش backward-compatible انجام می‌شود و ستون داده‌ای به‌صورت مخرب حذف نخواهد شد.
- Lock state: `Migration Owner = PC-B/MASTER-004-FORM-ALIGNMENT`، `Master Data Contract Owner = PC-B/MASTER-004-FORM-ALIGNMENT`، `Shared Calendar Owner = PC-B/MASTER-004-FORM-ALIGNMENT` و `Central Docs Owner = PC-B/MASTER-004-FORM-ALIGNMENT`. قفل Dependency/Lockfile گرفته نمی‌شود. تغییر Calendar فقط برای انتخاب مستقیم ماه/سال، رقم انگلیسی میلادی و حفظ API موجود انجام می‌شود.
- Logo فقط به‌صورت File Reference امن و بدون ذخیره Binary/Secret در Git تعریف می‌شود؛ اتصال بین‌ماژولی Documents تنها از قرارداد عمومی موجود مجاز است.
- پیاده‌سازی و Migration افزایشی `20260902173500_master_data_form_alignment` تکمیل و روی PostgreSQL محلی اعمال شد. Web شامل `586/586` تست و API شامل `776/776` تست موفق است؛ ۷۰ تست اختیاری PostgreSQL در اجرای API طبق تنظیم Suite رد شدند. lint، typecheck، Prisma validate، API build و Web production build موفق‌اند.
- انتشار: PR #83 با Merge Commit `9608607` وارد `develop` شد. قفل‌های Migration، Master Data Contract، Shared Calendar و Central Docs این Work Item آزاد شدند؛ Follow-up مستقل بالا فقط پس از این Merge آغاز شده است.

## TICKET-CATALOG-002 — PC-A — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-02: زمان حرکت/رسیدن و بازه اعتبار نرخ از فرم تعریف بلیت حذف شود و ثبت بلیت بدون تاریخ/ساعت در منطق Web و API پذیرفته شود. `COMPUTER_ID=PC-A`.
- Branch: `codex/pc-a-ticket-catalog-optional-schedule` از `origin/develop@f78e70e`؛ محدوده فقط Ticket Catalog Web/API، تست‌های همان ماژول و مستند Task است.
- بدون Prisma Schema/Migration/Seed، Dependency/Lockfile، قرارداد عمومی، Permission یا تغییر ماژول Master Data/Reservations. تاریخ‌های موجود هنگام ویرایش حفظ می‌شوند و مقدار ساختگی جایگزین نمی‌شود.
- قفل‌های Migration، Dependency/Lockfile و اسناد مرکزی رزرو نمی‌شوند؛ مالکیت این Slice فقط فایل‌های Ticket Catalog است.
- نتیجه: فرم جدید دیگر تاریخ حرکت/رسیدن و بازه اعتبار نرخ را نمایش یا تبدیل نمی‌کند؛ جفت‌های کاملاً خالی در Web/API معتبرند، ورود ناقص همچنان رد می‌شود و کارت بلیت خالی را «بدون زمان‌بندی» نشان می‌دهد.
- Follow-up صریح مالک در 2026-09-02: دکمه متنی و واضح «توقف فروش»، فیلتر مبدأ/مقصد، شمارش بلیت‌های تعریف‌شده به تفکیک مسیر و تب گزارش بلیت‌های صادرشده با فیلتر قرارداد، مسافر، شماره بلیت/PNR، مسیر، ایرلاین، وضعیت و تاریخ اضافه شد.
- Follow-up بعدی مالک: کنترل فروش روی همه کارت‌ها فقط با آیکون پاور نمایش داده می‌شود؛ قرمز برای توقف، سبز برای فعال‌سازی و خاکستری غیرفعال برای بلیت لغوشده. عنوان راهنما و aria-label معنا را حفظ می‌کنند. ویرایش برای همه وضعیت‌های بلیت در دسترس است؛ کنترل نسخه، اعتبار داده، ظرفیت و محافظت تغییرات دارای تخصیص حفظ شده‌اند.
- رفع خطای فعال‌سازی: انقضای بازه نرخ خرید دیگر فعال‌کردن فروش را مسدود نمی‌کند، زیرا قیمت فروش در Sales تعیین می‌شود؛ ظرفیت مثبت و اعتبار اطلاعات اصلی بلیت همچنان الزامی است.
- Follow-up بلیت ترکیبی: فرم، Web و API اکنون یک بلیت واحد با ۲ تا ۸ قطعه متصل را برای هواپیما، قطار یا اتوبوس پشتیبانی می‌کنند؛ مبدأ قطعه جدید از مقصد قبلی پر می‌شود، همه قطعه‌ها قابل افزودن/حذف/ویرایش‌اند و کارت، مشاهده، جست‌وجو، فیلتر و تکرار مسیر کامل را حفظ می‌کنند. رفت‌وبرگشت همچنان دو بلیت مستقل است.
- مرز دامنه: تعریف/توقف فروش محصول در Ticket Catalog می‌ماند؛ صدور، استرداد و اطلاعات مسافر متعلق به Reservations است. تب صادرشده‌ها فقط‌خواندنی و بدون داده ساختگی آماده اتصال به قرارداد عمومی آینده Reservations است؛ هیچ دسترسی مستقیم یا Persistence جدید ایجاد نشد.
- Validation: ۹۵ تست Ticket Web و ۴۷ تست Ticket API، lint کامل، typecheck کامل، ۱٬۴۵۹ تست Monorepo و Production Build کامل با ۳۴ Route موفق است. Final lock state: `RELEASED — PC-A/TICKET-CATALOG-002 ready for review`.

## MARKETING-001B — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-02: فایل مرجع `marketing.html` به‌عنوان ظاهر و رفتار مرجع روی Workspace واقعی Rubi پیاده شود؛ همه بخش‌ها و دکمه‌ها کار کنند و فیلترها و تقویم‌ها دقیقاً از Design System مشترک Rubi مصرف شوند. `COMPUTER_ID=PC-B`.
- Branch همان `codex/pc-b-marketing-foundation` / Draft PR #75 است که روی `origin/develop@0163727` Rebase شد؛ محدوده فقط `apps/web/src/modules/marketing/**`، route موجود `/marketing` در صورت نیاز، تست‌های همان ماژول، سند `docs/tasks/MARKETING-001.md` و همین ورودی محدود است.
- HTML پیوست فقط مرجع بصری/تعاملی است و دستور اجرایی محسوب نمی‌شود. Hub نه‌حوزه‌ای، زیرتب‌ها، فیلترهای کنترل‌شده، تقویم کمپین، فرم‌ها و Action feedback پیاده می‌شوند، ولی عدد KPI، فایل Export، ارسال پیام، Provider، Persistence یا اثر مالی جعلی تولید نمی‌شود.
- `DatePicker`، `Select`، `FilterBar`، Dialog و سایر UIهای مشترک فقط مصرف می‌شوند و فایل مرکزی آن‌ها تغییر نمی‌کند. هیچ قفل Migration، Dependency/Lockfile، Shared Contract، IAM، Navigation یا AppModule گرفته نمی‌شود.
- داده‌ها فقط synthetic با شناسه `preview-*` و بدون PII هستند؛ Analytics همچنان `AWAITING_ANALYTICS_CONTRACT`، Attribution برابر `PROPOSED` و Dispatch برابر `AWAITING_INTEGRATION_ADAPTER` باقی می‌مانند.
- نتیجه: Hub نه‌بخشی مرجع، تمام زیرتب‌ها، فهرست و تقویم ماهانه کمپین، فیلتر بازه تاریخ، ناوبری ماه/امروز، انتخاب شمسی/میلادی، Dialog جزئیات، Action feedback و فرم چندمرحله‌ای تکمیل شد. ۵ کمپین، ۴۰ رکورد زیرتب و داده‌های Segment/Offer/Coupon/Timeline/Suppression همگی synthetic و قابل تعامل‌اند.
- Validation: lint کامل ۶ Task، typecheck کامل ۹ Task، ۱٬۴۳۴ تست موفق با ۷۰ تست PostgreSQL اختیاری skip و Production Build کامل ۶ Task موفق. Web شامل ۷۵ فایل و ۵۷۹ تست موفق است. Browser QA محلی روی مسیر محافظت‌شده `/marketing` تمام ۹ بخش، جست‌وجو/پاک‌کردن، تقویم، تغییر نوع و ماه، بازکردن رویداد، زیرتب/جزئیات، Action feedback، فرم و موبایل را بدون Console error یا Overflow ماژول پوشش داد.
- Final lock state: `RELEASED — PC-B/MARKETING-001B ready for review`. هیچ Migration، Dependency/Lockfile، Shared Contract، IAM، Navigation، AppModule، Persistence یا داده واقعی تغییر نکرد.

## MARKETING-001 — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک: Foundation حرفه‌ای ماژول Marketing در Phase A بدون Persistence، مستقل از Documents در PC-B و Ticket Catalog/Sales در PC-A. `COMPUTER_ID=PC-B`.
- Base نهایی پس از Rebase: `origin/develop@f78e70e` شامل Merge PR #62 / `MASTER-003-LOCK-RELEASE`، CI مشترک و Ticket Catalog PR #74. Branch: `codex/pc-b-marketing-foundation`؛ توسعه مستقیم روی `develop` یا `main` انجام نشد.
- محدوده رزروشده: `apps/api/src/marketing/**` برای Domain/Application/Ports/Validation/Error/Permission proposal بدون Controller یا Repository فعال؛ `apps/web/src/modules/marketing/**` و اتصال محدود route موجود `/marketing`؛ تست‌های همان ماژول؛ `docs/tasks/MARKETING-001.md`؛ فقط همین ورودی محدود در `WORK_ASSIGNMENTS.md`.
- مرز بین‌ماژولی: Customers، Customer Affairs، Sales، Finance، Master Data، Documents و Integrations فقط از Public Contract/Event/Port پیشنهادی مصرف می‌شوند؛ Query مستقیم جدول یا import زیرساخت داخلی آن‌ها ممنوع است. Marketing فقط Offer Intent می‌دهد و قیمت نهایی قرارداد نزد Sales می‌ماند؛ ارسال واقعی و Provider Credential نزد Integrations/Notifications است.
- این Phase هیچ Prisma Schema/Migration/Seed، `packages/contracts/src/index.ts`، IAM مرکزی، `package.json`، `pnpm-lock.yaml`، AppModule/Navigation مشترک متعارض، Controller فعال، Repository جعلی، Worker یا پیام واقعی را تغییر نمی‌دهد.
- Lock state: Migration Owner، Dependency/Lockfile Owner و Shared Root Contract برای این Task رزرو نمی‌شوند و `RELEASED / UNASSIGNED` می‌مانند. Permissionها Proposal ماژول‌محلی و deny-by-default هستند؛ اتصال IAM و Persistence فقط در Phase B با Handoff و رزرو تازه مجاز است.
- داده Preview فقط synthetic با شناسه `preview-*` و بدون PII خام است. KPI فاقد Backend واقعی با `AWAITING_ANALYTICS_CONTRACT`، Attribution مالی با `PROPOSED` و ارسال بدون Adapter با `AWAITING_INTEGRATION_ADAPTER` نمایش داده می‌شود.
- نتیجه: Domain/Application/Port و قواعد Permission، Decimal، UTC، Lifecycle، Consent/Suppression/Frequency Cap و Idempotency بدون Controller/Persistence آماده شد. Workspace فارسی RTL شامل ۱۸ KPI تعریف‌شده، فهرست و فرم ۹مرحله‌ای کمپین، Segment، Channel، Offer/Coupon، Attribution، Budget/Spend، Timeline و Consent/Suppression است.
- Validation: ۳۷ تست هدفمند API و ۱۱ تست هدفمند Web؛ Full Monorepo نهایی با ۱۴۲۹ تست موفق و ۷۰ skip اختیاری؛ lint، typecheck و production build کامل موفق. Browser QA دسکتاپ و موبایل بدون Overflow یا Console error؛ Scope/Secret/PII/Prisma/Migration/Dependency scan پاک است.
- Phase B: Persistence، قرارداد عمومی، IAM binding، Analytics/Attribution، Provider integration و SLO/RPO/RTO فقط با Work Item، قفل و Handoff مستقل طبق `docs/tasks/MARKETING-001.md` مجازند.
- Draft PR: `#75` به مقصد `develop`؛ سازنده Branch آن را Merge نمی‌کند.
- Final lock state: `RELEASED — PC-B/MARKETING-001 ready for review`. Migration، Dependency/Lockfile و Shared Root Contract در تمام Task آزاد و بدون تغییر ماندند.

## DOCUMENTS-003F-RELATED-CASE-PICKER — PC-B — DONE/MERGED

- درخواست مالک در 2026-09-02: بخش «ارتباط با پرونده» در فرم بارگذاری به‌جای ورود دستی ماژول، نوع، شناسه و عنوان، یک Dropdown جست‌وجودار از پرونده‌های موجود و مرتبط باشد. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-record-picker` از `origin/develop@45b6b11` در Worktree تمیز `C:\Users\admin\Rubi-documents-record-picker`؛ `develop`، `main` و Checkoutهای دیگر مستقیم تغییر نمی‌کنند.
- محدوده رزروشده: API/Repository/DTO و تست‌های `apps/api/src/documents/**`، رابط و Client/Model/Testهای `apps/web/src/modules/documents/**`، قرارداد افزایشی و backward-compatible در `packages/contracts/src/documents/**` و ورودی‌های همین Work Item در `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md`، `PLANS.md` و سند Task.
- Producer و Consumer هر دو Documents API/Web تحت مالکیت PC-B هستند. Endpoint خواندنی جدید فقط Relationهای موجود Documents را در شعبه و Domainهای مجاز جست‌وجو می‌کند و شناسه فنی منبع را برنمی‌گرداند؛ Upload جدید یک Relation داخلی مجاز را resolve می‌کند. فیلدهای قدیمی Upload برای سازگاری مصرف‌کننده‌های موجود حفظ می‌شوند.
- بدون Schema/Migration/Seed، Permission جدید، Dependency/Lockfile، تغییر Customers یا Query مستقیم جدول ماژول دیگر. هیچ قفل Migration یا Dependency گرفته نمی‌شود.
- نتیجه: چهار ورودی فنی «ماژول/نوع/شناسه/عنوان مبدأ» از فرم کاربر حذف شد و یک انتخاب‌گر جست‌وجویی «پرونده مربوطه» جای آن را گرفت. فهرست فقط پرونده‌های موجود، حذف‌نشده، هم‌شعبه و دارای Domain/محرمانگی قابل مشاهده را نشان می‌دهد؛ با تغییر شعبه انتخاب قبلی پاک می‌شود. Backend فقط شناسه Relation داخلی را می‌پذیرد و مرجع canonical را سمت سرور resolve می‌کند، بنابراین spoof کردن شناسه منبع یا اتصال بین شعبه‌ای ممکن نیست.
- Validation: Full Monorepo lint، typecheck، ۱٬۳۹۵ تست موفق با ۷۰ تست PostgreSQL اختیاری skip و Production Build موفق‌اند. Smoke مرورگر احراز‌شده روی API4001/Web3101، نمایش ۱۴ پرونده، جست‌وجوی «قرارداد» تا دو نتیجه و انتخاب موفق را بدون ثبت فایل/داده تأیید کرد.
- انتشار: PR #81 با Merge Commit `ad6ff5d` پس از سبزشدن هر دو اجرای کامل CI در `develop` ادغام شد؛ Commit قابلیت `93166cf` در تاریخچه `origin/develop` تأیید شده است.
- Final lock state: `RELEASED — PC-B/DOCUMENTS-003F-RELATED-CASE-PICKER merged via PR #81`. هیچ قفل Migration، Dependency/Lockfile، Schema، Seed، Permission یا ماژول خارجی گرفته نشد.

## LEGAL-ENTITY-BRAND-LOGO-001 — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-09-01: با انتخاب شرکت فعال «جهان باستان»، لوگوی افقی ارسالی همان شرکت در App Shell جای لوگوی «نیایش سیر سحر» نمایش داده شود. `COMPUTER_ID=PC-B`.
- Branch مستقل: `codex/pc-b-jahan-bastan-logo` از `origin/develop@0f1d7b6fd15cba995be9793e0a9686474ad8c4c9` در Worktree تمیز `C:\Users\admin\Rubi-integrated-pc-b`؛ Branchهای کاری قبلی، `develop` و `main` دست‌نخورده می‌مانند.
- محدوده رزروشده: Asset برند جهان باستان در `apps/web/public/brand/**`، انتخاب برند در مدل Legal Entity، نمایش لوگو در `apps/web/src/components/layout/app-shell.tsx` و تست‌های هدفمند همان Web slice؛ فقط ورودی‌های همین Work Item در اسناد مرکزی.
- بدون Backend، Database، Schema/Migration/Seed، داده کاربر، API Contract، Dependency/Lockfile یا Permission. هیچ قفل Migration، Contract، Dependency/Lockfile یا Branch گرفته نمی‌شود.
- `LEGAL-ENTITY-CONTEXT-001` قبلاً با PR #24 ادغام و قفل‌های آن آزاد شده است؛ این تغییر فقط مصرف‌کننده Web و برندینگ نمایشی را لمس می‌کند.
- نتیجه: App Shell برند را از Legal Entity Context موجود می‌خواند؛ انتخاب `JAHAN_BASTAN` فایل افقی دقیقاً مطابق تصویر مالک را همراه نام و متن جایگزین درست نمایش می‌دهد و انتخاب نیایش سیر رفتار قبلی را حفظ می‌کند. Asset سرو‌شده با فایل ورودی SHA-256 یکسان دارد.
- Validation: پیش از Integration هر ۵۵۲ تست Web و Smoke لوکال API/Web/Asset موفق بود. پس از ادغام `origin/develop@f78e70e` شامل PR #74 PC-A، Full lint/typecheck/build و ۱٬۳۸۳ تست اجراشده Workspace موفق شدند؛ ۷۰ تست PostgreSQL اختیاری طبق Suite معمول skip ماندند و Web هر ۵۶۵ تست را گذراند.
- مجوز انتشار: مالک در 2026-09-01 صریحاً دریافت آخرین تغییرات PC-A، Push این Branch و Merge آن با `develop` را خواست. `origin/develop@f78e70e` بدون Conflict در Branch ادغام و کنترل کیفیت کامل تکرار شد؛ انتشار فقط از مسیر PR انجام می‌شود و `main` و Force Push ممنوع می‌مانند.
- Final lock state: `RELEASED — PC-B/LEGAL-ENTITY-BRAND-LOGO-001 ready for review`. هیچ قفل Migration، Contract، Dependency/Lockfile، Permission، Database یا Branch گرفته نشد.

## DOCUMENTS-003D-LOCAL-INTERACTIONS — PC-B — DONE/MERGED

- درخواست صریح مالک: داده‌های آزمایشی اسناد روی PC-A نیز قابل ایجاد و مشاهده باشند، کارت‌های مدیریت آرشیو عمل کنند و فرم بارگذاری به‌ویژه Dropdownها قابل استفاده باشد؛ پس از تست، Push و Merge به `develop` انجام شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-interactions` پس از یکپارچه‌سازی با `origin/develop@0163727`، با PR #78 و Merge Commit `869a043` وارد `develop` شد؛ `main` دست‌نخورده ماند.
- محدوده رزروشده: `apps/web/src/modules/documents/**`، `apps/api/src/documents/**`، قرارداد افزایشی Documents در `packages/contracts/src/documents/**`، Scriptهای Demo اسناد، تست‌های همین ماژول و ورودی‌های همین Work Item در `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md`، `PLANS.md` و سند Task.
- قرارداد Options فقط اطلاعات شعبه مجاز و شناسه کاربر جاری را به producer/consumer خود Documents اضافه می‌کند تا فرم به Refresh مستقل IAM وابسته نباشد. هیچ دسترسی مستقیم به جدول ماژول دیگر خارج از Repository موجود و Scope احراز‌شده ایجاد نمی‌شود.
- داده‌های نمایشی همچنان کاملاً ساختگی، محلی، idempotent، رمزگذاری‌شده و fail-closed در برابر Antivirus هستند. Git دیتابیس یا Secret را منتقل نمی‌کند؛ فرمان Apply باید پیش‌نیازهای محلی را قابل تشخیص و اجرای PC-A را روشن و قابل تایید کند.
- بدون Schema/Migration، Permission جدید، Dependency/Lockfile یا تغییر Seed عمومی. Runner محلی در خطای گذرای Seed اتمیک و idempotent فقط یک‌بار آن را تکرار می‌کند. Migration و Dependency/Lockfile Owner آزاد می‌مانند.
- نتیجه: هشت کارت آرشیو دکمه و نمای فیلترشده دارند؛ فرم بارگذاری Options احراز‌شده، مقدار اولیه واقعی، Dropdown روی Dialog، اعتبارسنجی صریح و حفظ ورودی پس از خطا دارد. Apply محلی Migration/Seed/Build را اجرا و هفت سند `CLEAN` را راستی‌آزمایی می‌کند.
- Validation: lint، typecheck و Build کامل Monorepo موفق؛ ۱٬۳۹۰ تست موفق و ۷۰ تست PostgreSQL اختیاری skip. Apply واقعی پس از Backup خصوصی و اجرای تکراری هر بار `created=0`، `reused=7`، `readyForViewing=true` و `verifiedRecords=7` داد.
- Final lock state: `RELEASED — PC-B/DOCUMENTS-003D-LOCAL-INTERACTIONS merged via PR #78`. هیچ قفل Migration، Dependency/Lockfile، Seed، Permission یا Schema گرفته نشد.

## DOCUMENTS-003C-CI-PORTABILITY — PC-B — READY_FOR_REVIEW

- CI مشترک پس از Merge PR #72 دو شکست Linux-only در محافظ Storage بسته داده نمایشی Documents کشف کرد؛ درخواست صریح مالک برای Push و Merge تمام تغییرات، مجوز اصلاح محدود این مانع یکپارچه‌سازی است. `COMPUTER_ID=PC-B`.
- Branch موقت اصلاح همان `codex/pc-b-ci-foundation` است تا PR #71 فقط پس از سبزشدن آخرین `develop` Merge شود. محدوده فقط `apps/api/src/documents/demo/local-document-demo.ts`، تست موجود `document-demo-fixtures.spec.ts` در صورت نیاز و اسناد همین Work Item است.
- هدف: مسیر ریشه Windows و UNC روی runner لینوکسی نیز fail-closed رد شوند، درحالی‌که مسیر scoped ویندوزی و مسیر scoped محلی معتبر باقی بمانند.
- بدون Schema/Migration/Seed، Dependency/Lockfile، API Contract، Permission، داده کاربردی یا تغییر Storage. مالکیت اصلی Documents گسترش نمی‌یابد و Worktreeهای قبلی دست‌نخورده می‌مانند.
- نتیجه: اعتبارسنجی Storage Root اکنون ورودی خام را مستقل از سیستم‌عامل برای Windows drive root و UNC بررسی می‌کند و مسیر scoped معتبر را حفظ می‌کند. دو پوشش رگرسیون برای `C:/` و UNC با slash افزوده شد؛ Prettier، lint هدفمند و هر ۱۴ تست Fixture موفق‌اند.
- Final lock state: `RELEASED — PC-B/DOCUMENTS-003C-CI-PORTABILITY ready for review`. هیچ قفل Migration، Dependency/Lockfile، Contract، Permission یا داده‌ای گرفته نشد.

## CI-001 — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-01: CI مشترک و اجباری برای Branchها و PRهای PC-A/PC-B، بدون لغو یا اختلال متقابل، پیاده‌سازی شود. `COMPUTER_ID=PC-B`.
- Branch: `codex/pc-b-ci-foundation` از `origin/develop@8758271883bf1d9f4bb072aa31250b39f66e4e07` در Worktree مستقل `C:\Users\admin\Rubi-ci`؛ Checkoutها، Branchها، سرورها و تغییرات محلی هر دو کامپیوتر خارج از این کار هستند.
- محدوده رزروشده: Workflow جدید `.github/workflows/ci.yml`، سند مستقل `docs/tasks/CI-001.md` و فقط ورودی‌های همین Work Item در اسناد وضعیت مرکزی.
- این Task هیچ مالکیت Migration، Dependency/Lockfile، Schema/Seed، API Contract یا ماژول کاربردی نمی‌گیرد و هیچ فایل `package.json`، `pnpm-lock.yaml` یا Migration را تغییر نمی‌دهد.
- CI برای Push و Pull Request شاخه‌های `codex/pc-a-*` و `codex/pc-b-*` و Push به `develop` اجرا می‌شود. کلید Concurrency بر اساس نوع رخداد و Head Branch است؛ فقط اجرای قدیمی همان رخداد و Branch لغو می‌شود، Push و PR یکدیگر را متوقف نمی‌کنند و اجرای PC-A/PC-B مستقل می‌ماند.
- Gate اجباری این Slice: نصب frozen با Node/pnpm pin‌شده، Prisma format/validate/generate، Prettier فایل‌های تغییرکرده، Full Monorepo lint، Full typecheck/test/build و Migration/Seed دوگانه روی PostgreSQL 18 موقت. بدهی قالب‌بندی فایل‌های قدیمی به Branchهای جاری تحمیل نمی‌شود؛ هیچ Deploy، Production credential یا تغییر دیتابیس کاربردی انجام نمی‌شود.
- نتیجه: Workflow خواندنی و بدون Deploy آماده شد. Full lint/typecheck/test/build محلی موفق است؛ ۲۸ Migration روی PostgreSQL 18 خالی اعمال و Seed دوبار موفق شد. فایل‌های همین Slice با Prettier معتبرند؛ بدهی قالب‌بندی ۵۰۷ فایل قدیمی فقط به‌عنوان سابقه ثبت و به Branchهای جاری تحمیل نشد.
- Final lock state: `RELEASED — PC-B/CI-001 ready for review`. این Task هیچ Migration، Dependency/Lockfile، Schema/Seed، Contract یا مالکیت ماژولی نگرفت؛ Branchها، Worktreeها، Dev Serverها و دیتابیس‌های PC-A/PC-B دست‌نخورده ماندند.

## DOCUMENTS-003C-DEMO-BOOTSTRAP — PC-B — DONE/MERGED

- درخواست صریح مالک: داده‌ها و فایل‌های نمایشی بخش اسناد به‌شکلی در Git منتشر شوند که PC-A و PC-B بتوانند همان بسته را روی دیتابیس و Storage محلی خود ایجاد کنند. `COMPUTER_ID=PC-B`.
- Branch: `codex/pc-b-documents-demo-bootstrap`؛ PR #72 با Merge Commit `a2b5b9e` وارد `develop` شد. توسعه مستقیم روی `develop` یا `main` انجام نشد.
- محدوده رزروشده: Fixture و فرمان Preview/Apply محلی در `apps/api/src/documents/demo/**` و `apps/api/scripts/**`، تست‌های Documents، Scriptهای Root در `package.json` و مستند همین Task؛ فقط ورودی‌های همین Work Item در اسناد مرکزی.
- بسته فقط داده و فایل کاملاً ساختگی تولید می‌کند، به User/Branch/Permission موجود متصل می‌شود و هیچ حساب، رمز، Session، PII، Secret یا Binary واقعی را وارد Git نمی‌کند. فایل تصویر در زمان اجرا به‌صورت قطعی تولید و با Storage خصوصی AES-256-GCM ذخیره می‌شود.
- Apply فقط برای `development/test`، PostgreSQL محلی allowlist‌شده و با تأیید صریح مجاز است؛ Startup، Seed عمومی و Production آن را اجرا نمی‌کنند. اجرای دوباره idempotent است و رکورد ویرایش‌شده کاربر را بازنویسی نمی‌کند.
- وضعیت `CLEAN` فقط پس از اسکن واقعی Adapter فعال ثبت می‌شود؛ نبود یا خطای Antivirus کل Apply را fail-closed متوقف می‌کند. Preview هیچ رکورد یا فایل ایجاد نمی‌کند.
- بدون Schema/Migration، قرارداد عمومی، Dependency/Lockfile یا تغییر Permission. `package.json` فقط برای دو Script محلی رزرو است؛ Migration و Dependency/Lockfile Owner آزاد می‌مانند.
- نتیجه: هفت سند کاملاً ساختگی با تصویر PNG واقعی و رنگی برای هویت مشتری، فروش، سفر، خرید و منابع انسانی آماده شد؛ دو سند نزدیک انقضا و یک سند منقضی نیز KPIهای نمای کلی را پوشش می‌دهند. فایل‌ها در زمان اجرا تولید و فقط به‌صورت رمزگذاری‌شده ذخیره می‌شوند.
- Validation: Preview روی دیتابیس برنامه بدون Write، Apply با Microsoft Defender واقعی، اجرای دوم با `created=0/reused=7`، مشاهده هر هفت رکورد و Preview PNG از API موفق بود. چهار تست PostgreSQL مستقل، ۷۲۹ تست API با ۷۰ skip اختیاری، lint API، typecheck کامل Workspace و Build API موفق‌اند.
- Final lock state: `RELEASED — PC-B/DOCUMENTS-003C-DEMO-BOOTSTRAP merged via PR #72`. هیچ Migration، Contract، Permission، Dependency یا Lockfile تغییر نکرد؛ داده کاربردی و Secret وارد Git نشد.

## IAM-003-LOGIN-STABILITY — PC-B — DONE/MERGED

- درخواست صریح مالک در 2026-08-31: خطای تکراری «رمز صحیح نیست» پس از تغییر/راه‌اندازی مجدد به‌صورت دائمی برطرف شود. `COMPUTER_ID=PC-B`.
- Branch: `codex/pc-b-iam-login-stability` از آخرین `origin/develop`؛ PR #68 با Merge Commit `bba6cc0` در `develop` ادغام شد. این اصلاح مستقیم روی `develop` یا `main` انجام نشد.
- مالکیت نهایی IAM برای PC-A محفوظ است؛ قفل‌های IAM-001/IAM-002 آزاد شده‌اند و این کار یک استثنای محدود و صریح PC-B برای پایداری Login است.
- محدوده رزروشده: Bootstrap داخلی مدیر و Refresh نشست در `apps/api/src/iam/**`، helper مشترک Refresh و Login UI در `apps/web/src/**`، تست‌های هدفمند و `docs/tasks/IAM-003-LOGIN-STABILITY.md`؛ فقط ورودی‌های همین Work Item در اسناد مرکزی.
- بدون Prisma Schema/Migration/Seed، بدون تغییر قرارداد عمومی یا Permission، بدون Dependency/Lockfile و بدون بازنشانی حساب/رمز/Session یا تغییر داده کاربردی در زمان پیاده‌سازی.
- معیار پذیرش: اجرای مجدد Bootstrap رمز کاربر موجود را تغییر ندهد؛ Refresh هم‌زمان تب‌ها خانواده Session را به‌اشتباه revoke نکند؛ Login فقط پاسخ 401 را خطای نام کاربری/رمز بنامد و خطاهای اعتبارسنجی/سرور/ارتباط پیام مستقل داشته باشند؛ تست، lint، typecheck، build و Smoke لوکال موفق باشند.
- نتیجه: Bootstrap برای کاربر موجود Credential/Status را حفظ و فقط نقش مدیر و شعبه را idempotent تضمین می‌کند. Refresh با claim اتمیک، grace پنج‌ثانیه‌ای فقط برای Token منطبقِ تازه‌چرخیده و Web Lock مشترک چندتب پایدار شد؛ Token نامنطبق یا reuse قدیمی همچنان کل خانواده را fail-closed لغو می‌کند. Login UI فقط 401 را خطای نام کاربری/رمز می‌نامد.
- Validation: ۷۱۷ تست API با ۶۶ skip اختیاری و ۵۴۴ تست Web موفق؛ lint، typecheck و production build API/Web موفق. API health و Login لوکال ۲۰۰ و Validation ورود ناقص ۴۰۰ است. در زمان پیاده‌سازی هیچ Bootstrap/Reset یا تغییر داده کاربردی اجرا نشد. پس از Merge، بازیابی محلی صریح و جداگانه `nirvana` روی PC-B با Backup، لغو نشست‌های قبلی و ورود/خروج ۲۰۰/۲۰۴ موفق انجام شد؛ هیچ Secretی وارد Git نشد.
- Final lock state: `RELEASED — PC-B/IAM-003-LOGIN-STABILITY merged via PR #68`. Migration/Dependency/Contract lock در تمام کار آزاد و دست‌نخورده بود؛ مالکیت نهایی IAM نزد PC-A باقی است.

## DOCUMENTS-003B — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: تصویر بارگذاری‌شده باید پس از اسکن پاک و احراز مجوز، داخل تب پیش‌نمایش همان سند قابل مشاهده باشد.
- Branch: `codex/pc-b-documents-image-preview` / Draft PR #67، فرزند `codex/pc-b-documents-usability@8cbe77b` / Draft PR #65. این Slice مستقیم به `develop` نمی‌رود و والدها را Merge یا بازنویسی نمی‌کند.
- محدوده رزروشده: `apps/api/src/documents/**`، `apps/web/src/modules/documents/**` و تست‌های همان ماژول؛ اسناد `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md`، `PLANS.md` و `docs/tasks/DOCUMENTS-003B.md`.
- بدون Prisma Schema/Migration/Seed، بدون Dependency/Lockfile و بدون تغییر قرارداد عمومی. endpoint افزایشی و احراز‌شده `GET /documents/:id/preview` فقط producer داخلی Web را پوشش می‌دهد و backward-compatible است؛ مجوز `documents.file.read`، محرمانگی، شعبه، آرشیو فعال و Scan پاک را مستقل از مجوز دانلود کنترل می‌کند.
- Web فقط برای تصویر JPEG/PNG پاک و مجاز، پاسخ را به Blob URL موقت تبدیل می‌کند و در cleanup آن را آزاد می‌سازد. پیش‌نمایش برای Pending/آلوده/قرنطینه، سند بدون مجوز، یا نوع غیرتصویری fail-closed می‌ماند؛ Audit مستقل مشاهده ثبت می‌شود و URL عمومی/ماندگار ساخته نمی‌شود.
- نتیجه: پیش‌نمایش واقعی تصویر در تب جزئیات، دلیل مشاهده فایل محرمانه، مسیر inline امن، Audit مستقل، وضعیت‌های خطا/Loading/Retry و cleanup درخواست/Blob URL تکمیل شد. فایل لوکال `100.jpg` از نوع JPEG و Scan پاک برای این جریان آماده است.
- Validation: lint/typecheck/build کامل API و Web موفق؛ ۷۰۸ تست API موفق با ۶۶ skip اختیاری و ۵۱۶ تست Web موفق. API4000 و Web3100 از همین Worktree فعال و Health برابر ۲۰۰ است. گزارش: `docs/tasks/DOCUMENTS-003B.md`.
- Final lock state: این Slice هیچ Migration/Dependency/Contract lock نگرفت. رزرو Documents API/Web و اسناد مرکزی با وضعیت `RELEASED — PC-B/DOCUMENTS-003B ready for review` تحویل می‌شود؛ والدها، `develop` و `main` بدون Merge باقی می‌مانند.

## DOCUMENTS-003A — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: حذف نمای مستقل گزارش دسترسی و نگه‌داشتن Timeline در جزئیات سند؛ تکمیل لینک اشتراک داخلی؛ فعال‌سازی اسکن واقعی فایل در محیط لوکال PC-B؛ فعال‌کردن نماهای شخصی و یکدست‌سازی افکت و رنگ رابط Documents.
- Branch: `codex/pc-b-documents-usability` / Draft PR #65، فرزند `codex/pc-b-documents-vertical-slice@37558aa` / Draft PR #64. این Slice مستقیم به `develop` نمی‌رود و والدها را تغییر یا Merge نمی‌کند.
- محدوده رزروشده: `apps/api/src/documents/**`، `apps/web/src/modules/documents/**`، قرارداد افزایشی Documents در `packages/contracts/src/documents/**`، مثال تنظیمات Documents، تست‌ها و اسناد `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md`، `PLANS.md` و `docs/tasks/DOCUMENTS-003A.md`.
- بدون Prisma Schema/Migration/Seed و بدون Dependency/Lockfile. Migration Owner و Dependency/Lockfile Owner رزرو نمی‌شوند. قرارداد عمومی فقط فیلتر شخصی افزایشی و backward-compatible برای producer/consumer خود Documents API/Web است.
- لینک اشتراک در این Slice فقط لینک داخلی احراز‌شده و Permission-aware است؛ لینک عمومی/ناشناس، دورزدن محرمانگی و دانلود بدون Scan ممنوع می‌ماند. Audit Timeline از منوی مستقل حذف می‌شود ولی داخل جزئیات هر فایل حفظ می‌شود.
- Antivirus روی PC-B با Microsoft Defender فعال و fail-closed است؛ `CLEAN` فقط پس از اجرای واقعی موتور و تطبیق SHA-256 ثبت می‌شود. نبود/خطای موتور همچنان دانلود را مسدود می‌کند و هیچ Seed/UI وضعیت پاک جعل نمی‌کند. Adapter تولیدی S3/MinIO و Worker توزیع‌شده همچنان خارج از این Slice هستند.
- نتیجه: منوی مستقل Activity حذف و Timeline داخل جزئیات حفظ شد؛ لینک داخلی مستقیم و قابل کپی، چهار نمای شخصی، رنگ و افکت تمام سکشن‌ها و پیام واقعی وضعیت اسکن تکمیل شدند. هر ۶ فایل لوکال با Defender واقعی `CLEAN`، Jobها `COMPLETED` و قرنطینه‌ها `RELEASED` شدند؛ Backup خصوصی پیش از اجرا معتبر است.
- Validation: lint/typecheck/build برای API/Web/Contracts موفق؛ ۱٬۲۳۴ تست موفق و ۶۶ تست اختیاری skip. Smoke مرورگر احراز‌شده مسیرهای شخصی، Favorite، Recently Viewed، کپی/بازکردن لینک، Timeline داخل فایل و Download gate پاک را پوشش داد. گزارش: `docs/tasks/DOCUMENTS-003A.md`.
- Final lock state: این Slice هیچ Migration/Dependency lock نگرفت. رزرو Documents API/Web/Contract و اسناد مرکزی با وضعیت `RELEASED — PC-B/DOCUMENTS-003A ready for review` تحویل می‌شود؛ Branch والد، PRها، `develop` و `main` بدون Merge باقی می‌مانند.

## DOCUMENTS-002 — PC-B — READY_FOR_REVIEW

- Owner confirmed on 2026-09-01 that the `PC-B/MASTER-003` Migration and central-file locks are released for this work. `COMPUTER_ID=PC-B`.
- Branch: `codex/pc-b-documents-vertical-slice`; Draft PR #64 is stacked on `origin/codex/pc-b-documents-foundation@05b09e8` / Draft PR #61. Phase A does not need to merge into `develop` before this slice؛ #64 targets the Phase-A branch until its parent is merged.
- Reserved scope: Documents Prisma schema and one additive migration; Documents repository/application/controller/module; versioned Documents contract and IAM permission seed; `/documents` Web module, route/navigation integration and tests; shared Dialog RTL positioning fix in `apps/web/src/components/ui/overlays.tsx`; storage environment examples in root/API `.env.example`; `WORK_ASSIGNMENTS.md`, `docs/PROJECT_STATUS.md`, `PLANS.md`, `docs/DECISIONS.md`; task report `docs/tasks/DOCUMENTS-002.md`.
- Final lock state: Migration Owner, Documents shared-contract/root export, Documents IAM permission/seed slice, shared Dialog/environment-example files and central status/docs are `RELEASED — PC-B/DOCUMENTS-002 ready for review`. Dependency/Lockfile stayed `RELEASED`; `pnpm-lock.yaml` was not changed.
- First vertical slice: server-side document list/search/filter/sort/pagination, document detail with six tabs, central upload dialog with real multipart/storage adapter flow, base permission enforcement, Loading/Empty/Error/Forbidden states, authenticated route/navigation/responsive smoke and database/API/Web tests.
- Domain boundaries: Documents stores/version-controls final file assets and archive metadata only. Issuance/rendering stays in producer modules; no direct query to another module's tables. Finance/HR content access remains deny-by-default behind separate permissions.
- Deferred: production antivirus engine/worker, advanced secure sharing, final retention deletion, exports and cross-module producer integrations. They require separate slices and unresolved security/operations decisions.
- Validation: all 28 migrations on empty PostgreSQL 18, repeatable Seed, full lint/typecheck/build and 1,296 tests passed (66 opt-in PostgreSQL tests remain intentionally skipped in the ordinary suite). Authenticated browser smoke covered upload, fail-closed download, Persian/Gregorian date preservation, role isolation for Archive/Sales/Finance/HR and desktop/mobile layout. Synthetic DB/container, file, keys and ignored environment files were removed after validation.

## MASTER-003-FILTER-ACTIONS — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: کنترل‌های «پاک‌کردن» و «تازه‌سازی» در تمام فیلترهای اطلاعات پایه به دکمه‌های دارای Border و پس‌زمینه تبدیل و در ردیف پایینیِ سمت چپ سکشن فیلتر یکدست شوند.
- Branch: `codex/pc-b-master-data-filter-actions` به‌صورت Stacked روی نسخه تحویلی `codex/pc-b-master-data-remove-lock-notes@51aed9e`؛ توسعه مستقیم روی `develop` انجام نمی‌شود.
- محدوده رزرو: فقط کامپوننت‌های FilterBar در `apps/web/src/modules/master-data/components/**`، کامپوننت مشترک اکشن فیلتر، آزمون رگرسیون نمایش و گزارش همین Work Item. بدون API/Contract، Schema/Migration، Seed/Data، Customers، Calendar، Dependency/Lockfile یا تغییر دیتابیس.
- منطق فیلتر، داده، صفحه‌بندی و مجوزها ثابت می‌ماند؛ این تغییر Presentation/Interaction است و تازه‌سازی هر Workspace فقط Loader موجود همان صفحه را فراخوانی می‌کند.
- نتیجه: اکشن مشترک تمام FilterBarهای اطلاعات پایه در یک ردیف تمام‌عرض زیر فیلدها قرار گرفت؛ در RTL با تراز انتهای ردیف در سمت چپ نمایش داده می‌شود. هر دو کنترل Button واقعی با Border، پس‌زمینه، Focus/Hover و آیکون مستقل هستند. تازه‌سازی وضعیت همکاری نیز با همان کامپوننت و عنوان تخصصی حفظ شد.
- ۵۳۴ تست Web، Typecheck، lint کامل Web و Production Build موفق‌اند. بررسی زنده جغرافیا روی Checkout همین شاخه در پورت ۳۱۰۱ وجود فیلتر تاریخ و دو دکمه پایین-چپ و حذف نوار قفل قدیمی را تأیید کرد. پورت ۳۱۰۰ همچنان متعلق به Checkout جداگانه PC-A است و تغییر یا متوقف نشد.

## MASTER-003-REMOVE-LOCK-NOTES — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: نوارهای قفل‌دار/قاعده‌ای باقی‌مانده زیر KPIهای تمام بخش‌های اطلاعات پایه، از جمله جغرافیا، حذف و از بازگشت آن‌ها جلوگیری شود.
- Branch: `codex/pc-b-master-data-remove-lock-notes` به‌صورت Stacked روی `codex/pc-b-master-data-date-filters@49d83b8`؛ توسعه مستقیم روی `develop` انجام نمی‌شود.
- محدوده رزرو: فقط Workspaceهای `apps/web/src/modules/master-data/components/**`، آزمون رگرسیون نمایش و گزارش همین Work Item در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`. بدون API/Contract، Schema/Migration، Seed، Customers، Calendar، Dependency/Lockfile یا تغییر دیتابیس.
- رفتار حذف امن، کنترل وابستگی رکوردها، وضعیت/پاور، خطاهای دسترسی و پیام‌های نتیجه عملیات حفظ می‌شوند؛ این اصلاح فقط نوار اطلاع‌رسانی ثابت بین KPI و فیلترها را هدف می‌گیرد.
- نتیجه: نسخه جاری هر هشت Workspace تخصصی و fallback عمومی فاقد Alert/Card قفل‌دار بین KPI و فیلترهاست. آزمون قبلی از بررسی فاصله ثابت به کنترل کامل بازه KPI تا FilterBar ارتقا یافت و آیکون/عنوان‌های قاعده‌ای را نیز رد می‌کند. ۵۲۳ تست Web، Typecheck، lint کامل Web و Production Build موفق‌اند. علت مشاهده نوار در `localhost:3100` اجرای Checkout مستقل PC-A از `C:\Users\admin\Rubi-documents-vertical-slice` است؛ آن پردازش و فایل‌ها دست‌نخورده ماندند.

## MASTER-003-DATE-RANGE-FILTERS — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: فیلتر جمع‌وجور «از تاریخ / تا تاریخ» به همه فهرست‌های اطلاعات پایه اضافه شود و انتخاب تاریخ در هر دو تقویم شمسی و میلادی در دسترس باشد.
- Branch: `codex/pc-b-master-data-date-filters` به‌صورت Stacked روی نسخه تحویلی `codex/pc-b-master-data-remove-kpi-notes@ccf68db`؛ توسعه مستقیم روی `develop` انجام نمی‌شود.
- محدوده رزرو: قرارداد افزایشی Query فهرست و Export اطلاعات پایه، DTO/Repository همان ماژول، Client و هشت Workspace اطلاعات پایه، کامپوننت مشترک بازه تاریخ، آزمون‌ها و گزارش همین Work Item. بدون Calendar، Customers، Schema/Migration، داده، Dependency/Lockfile یا تغییر دیتابیس.
- Producer/Consumer قرارداد هر دو Master Data API/Web تحت مالکیت PC-B هستند. `createdFrom` و `createdTo` اختیاری و با رفتار قبلی سازگارند؛ بازه روی `createdAt` و برای تاریخچه نرخ روی `observedAt`، پیش از Pagination اعمال می‌شود.
- نتیجه: گروه فشرده بازه تاریخ در هشت Workspace تخصصی و fallback عمومی قرار گرفت؛ تقویم مشترک همان تاریخ را به انتخاب کاربر شمسی یا میلادی نمایش می‌دهد، بازه قابل پاک‌کردن است و Excel همان فیلتر را دریافت می‌کند. API بازه معکوس/نامعتبر را رد و روز پایان را به‌صورت کامل و inclusive محاسبه می‌کند. ۵۲۳ تست Web و ۶۷۱ تست API موفق؛ Typecheck، lint محدوده و Production Build Web/API/Contract موفق‌اند. کنترل بصری روی نسخه همین Branch در پورت موقت ۳۱۰۱، نمایش فشرده و کلیدهای شمسی/میلادی را تأیید کرد؛ پورت ۳۱۰۰ متعلق به Checkout PC-A و دست‌نخورده باقی ماند.

## MASTER-003-REMOVE-KPI-NOTES — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: تمام نوارهای توضیحی/قاعده‌ای بلافاصله زیر کارت‌های KPI از همه Workspaceهای اطلاعات پایه حذف شوند؛ خود KPIها، تب‌ها، فیلترها، جدول‌ها و رفتار Backend حفظ می‌شوند.
- Branch: `codex/pc-b-master-data-remove-kpi-notes` از `origin/develop@03e4c431f29286509cdf0e5423aae8ed3a87a788`؛ توسعه مستقیم روی `develop` انجام نمی‌شود.
- محدوده رزرو: فقط `apps/web/src/modules/master-data/components/**`، آزمون‌های رندر مرتبط و گزارش همین Work Item در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`. بدون Customers، Calendar، API/Contract، Schema/Migration، Seed یا Dependency/Lockfile.
- قفل‌های فعال PC-B/MASTER-003 بدون تغییر می‌مانند؛ این اصلاح صرفاً Presentation است و مالکیت یا قرارداد ماژول دیگری را تغییر نمی‌دهد.
- نتیجه: نوارهای توضیحی زیر KPI در جغرافیا، سازمان‌ها و تأمین‌کنندگان، اقامت، حمل‌ونقل، بیمه، خدمات سفر و مراجع فروش حذف شدند؛ مالی و پولی از ابتدا چنین نوار مستقلی نداشت. ۵۱۱ تست Web، Typecheck، lint فایل‌های متاثر و Production Build موفق‌اند. API روی ۴۰۰۰ سالم و Web روی ۳۱۰۰ روشن است؛ مسیر محافظت‌شده بدون Session مطابق انتظار به Login هدایت می‌شود.

## MASTER-003-DEMO-BOOTSTRAP — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-08-31: داده‌های نمایشی اطلاعات پایه به‌شکلی در Git منتشر شوند که PC-A نیز بتواند همان رکوردها را در دیتابیس لوکال خود ببیند.
- Branch: `codex/pc-b-master-data-demo-bootstrap` از `origin/develop@1fd22ef` پس از Merge #60؛ توسعه مستقیم روی `develop` انجام نمی‌شود.
- محدوده رزرو: فرمان‌ها و Runner ریشه برای بارگذاری Environment، Build و Preview/Apply داده نمایشی، Parser و تست CLI در Master Data API، مستند اجرای PC-A و ورودی‌های همین Task در WORK_ASSIGNMENTS/PROJECT_STATUS. `package.json` فقط برای افزودن Script رزرو است؛ Dependency و Lockfile تغییر نمی‌کنند.
- Fixture موجود ۷۸ رکورد/۴۰ کاتالوگ بدون تغییر ماهیت استفاده می‌شود. Seed عمومی Prisma، Startup، Schema/Migration، Contract، Customers، IAM و داده عملیاتی خارج از Scope هستند.
- Apply باید همچنان فقط با فرمان صریح، محیط development/test، PostgreSQL روی localhost:55432 و DB مجاز اجرا شود؛ Production/Remote رد می‌شوند. اجرای دوباره idempotent است و داده ویرایش‌شده کاربر را بازنویسی نمی‌کند.
- نتیجه: `pnpm master-data:demo:preview` و `pnpm master-data:demo:apply` از Root قابل اجرا هستند؛ Runner تنظیمات خصوصی را قبل از Prisma/Build بارگذاری می‌کند و Apply تأیید صریح را به ابزار سطح پایین می‌دهد. Preview واقعی هر ۷۸ رکورد را Reuse و کامل Rollback کرد. ۱۲ تست واحد CLI/Fixture، ۹ آزمون واقعی PostgreSQL 18، ۱٬۲۵۹ تست عمومی، lint/typecheck و Build کامل موفق‌اند. PR عادی به `develop` ساخته می‌شود؛ Branch حذف یا Force Push نمی‌شود.

## MASTER-003-DEVELOP-INTEGRATION — PC-B — READY_FOR_REVIEW

- Owner explicitly requested push and merge to dev/develop on 2026-08-31. This authorizes this normal PR integration, superseding the earlier no-merge restriction for the delivered Master Data snapshots; no force push or source-branch deletion.
- Base: `origin/develop@e25f2886c3e6d7e90c33ef27604bdce76dc973f0` (merged #58). Source: #59 `b04c2bd7c31b6ef85ed7357d83f4c5f548183d12`, including #57 `6abd960` and the existing #55/#54/#47 lineage already retained by #58.
- Branch: `codex/pc-b-master-data-develop-integration`; isolated worktree preserves the original checkout, live servers, private configuration and data.
- Reservation under PC-B/MASTER-003: integration of the published Master Data files/migration/contract; compatibility changes in Master Data tests only; WORK_ASSIGNMENTS, PROJECT_STATUS, preservation of both published DECISIONS entries, and this integration task report. No new feature, Customers/Calendar edit, historical migration rewrite, dependency/lockfile change, or application database operation.
- #58 integration reservation ended upon its verified merge. Existing PC-B development locks remain unchanged; this does not acquire or release another module's locks. Combined checks and review must pass before normal PR merge; no invented approvals or protection bypass.
- Combined gates passed: full lint/typecheck/build, 1,257 ordinary tests and all 66 opt-in PostgreSQL tests, 27 migrations on empty PostgreSQL 18, two seeds, 45 authenticated catalog lists and 11 authenticated production HTTP/RTL routes. No application database or account changed. Existing Swagger documentation debt remains unchanged and is explicitly reported, not marked passed. See `docs/tasks/MASTER-003-DEVELOP-INTEGRATION.md`. On successful PR merge only this integration reservation becomes DONE/MERGED; source branches and PC-B development locks remain.

## SHARED-INTEGRATION-0831 — PC-A — IN_PROGRESS

- Final handoff: PR #58 targets develop. Required combined runtime gates passed; on its successful merge this integration becomes DONE and only its integration reservation ends. PC-B development locks stay as recorded. Each PC must safely fast-forward to the resulting develop commit; no local data or keys travel through Git.

- Central handoff scope includes recording the existing PR #46 pricing/IAM clarification in DECISIONS and travel architecture; no new business decision or permission expansion beyond that source snapshot.

- Current ownership: customer-chain #41 is MERGED and its locks RELEASED. PC-B's later MASTER-003 stack retains its Migration/Master-contract/development-doc locks; the historical Phase-A release does not release this later work. This task coordinates only frozen integration entries and compatibility checks under the owner's explicit request.
- Additional source scope: PR #46 contains the task-documented IAM password minimum update (12 to 10, retaining every character-class requirement). No account provisioning is executed here.
- Test scope also reserves `apps/api/test/*postgres.spec.ts` and the test-only target helper for a dedicated local test container; shared Web route tests include Ticket Catalog and its rendered tests.
- Historical reports below describe their original snapshots, not current deployment. PC-B local synchronization and global lock release are not implied.

- Owner authorization: combine the published changes of both computers into one develop product (2026-08-31).
- Base: `5f9cb723de39e29cff95f26b047138699bd36392`.
- Frozen inputs: PC-B PR #55 `241308e45aead3fcea82cc08466ce60dde057f8c` (including its published parent stack), PC-A PR #56 `f0dd7922cc60bd61b8fc0487b2311867c5616888`, and PC-A PR #46 `86551ce447fb9af3d7fb49119498cee3c7e1ec2a`.
- Branch: `codex/pc-a-shared-integration-0831`; isolated worktree only protects ongoing source work. The delivery target is ONE `develop`, not another product or permanent preview.
- Reserved integration-only scope: reconcile these published snapshots, merge-conflict resolutions, compatibility/regression fixes and tests, and the integration entries in WORK_ASSIGNMENTS/PROJECT_STATUS/PLANS. No new business feature, dependency, or historical Migration edit is authorized.
- Existing PC-B development locks are NOT transferred or released by this integration. No source branch, PC-B working copy, active development reservation, or uncommitted file is modified. New unpublished/source-head changes are excluded until explicitly selected.
- Review the combined code and original dependencies before a normal PR merge; do not bypass protections, invent approvals, force-push, or change main. Failure of a required safety/compatibility gate blocks merging.
- Test databases contain synthetic data only. Existing local databases, protected encryption keys, secrets, and volumes are preserved. Applying additive migrations to a live local database requires a verified backup first.

## Current customer-chain handoff — 2026-08-31

- Supersedes the historical conditional MASTER-003 handoff below for this customer-only chain.
- Prerequisites are now fulfilled: #25 merged `d73f51f`, #26 merged `a470d06`, #27 merged `eb2fe1e`.
- The product owner explicitly authorized review, conflict resolution and sequential merge of #26/#27/#34/#41; no PC-B PR is included.
- Migration, Customer shared-contract and Central customer-status ownership: `ACTIVE — PC-A/CUSTOMER-002B` only until PR #41 merges; **automatically RELEASED by this explicit final handoff when #41 is MERGED**. No new domain schema is authorized. Any subsequent task must reserve its own scope on fresh develop.
- Master shared-contract: `RELEASED / STABLE`; Dependency/Lockfile: `RELEASED`. PC-B source branches and pending PRs remain untouched.
- National-ID slice only; DEC-OPEN-006/011 remain open for passports, retention/residency/KMS and actual merge. No production deployment or real-data migration is authorized by this review.
- PR #34 merged `b5f06a2` after 420 tests, 11 fresh migrations and real encrypted national-ID smoke. #41 integration passes 425 tests/81 files, full lint/typecheck/build and 17 synthetic HTTP/database checks on top of it. `CUSTOMER-CHAIN-REVIEW-001` becomes DONE upon #41 merge; full CUSTOMER-002B remains partial with the security/API backlog documented.
- Next product work requested by the owner is PC-A Ticket Catalog: definition/schedule/fare/capacity, not passenger issuance or Manifest. This is a next-step handoff, NOT a Migration reservation and NOT permission to change PC-B branches.

آخرین به‌روزرسانی: 2026-08-29 — MASTER-003 Phase A برای Review و Handoff مشروط آماده شد
آخرین به‌روزرسانی: 2026-08-31 — اصلاح نمایش فهرست مالی و جغرافیا پس از ثبت فرم

## MASTER-003-CATALOG-USABILITY — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-08-31: پاور وضعیت، دو فیلتر ستونی، تکمیل ستون‌های ماکاپ و واقع‌گراتر کردن نمونه‌های محلی.
- شاخه مستقل `codex/pc-b-master-data-catalog-usability` از `6abd960` / PR #57؛ شاخه‌های تحویلی ثابت می‌مانند. هیچ Merge یا تغییر والد مجاز نیست.
- رزرو محدود: `apps/web/src/modules/master-data/**`، `apps/api/src/master-data/**`، ابزار/تست همین ماژول، `packages/contracts/src/master-data/**`، WORK_ASSIGNMENTS، PROJECT_STATUS، DECISIONS و سند Task. Producer/consumer قرارداد افزایشی فقط Master Data API/Web (PC-B)؛ فیلتر اختیاری قبل از Pagination و Export اعمال می‌شود و نبود آن رفتار قبلی را حفظ می‌کند.
- مبنای شروع Handoff origin/develop پس از #41 بود. بررسی نهایی Merge #58 / `e25f288` را نشان داد: قفل‌های توسعه PC-B منتقل یا آزاد نشده‌اند و رزرو integration خاتمه یافته است. این Work Item زیر PC-B/MASTER-003 می‌ماند؛ Migration محدود `MasterCountry.displayOrder` در `20260831140000_master_country_display_order` و همان قسمت Schema، قرارداد و اسناد فوق برای تحویل ثبت شده‌اند. بدون Dependency، Calendar، Customers یا داخلی ماژول دیگر. ادغام نسخه جدید develop در این شاخه انجام نشده است.
- نمونه‌سازی فقط development محلی با Backup، Preview، Audit و حفظ داده کاربر/نمونه ویرایش‌شده؛ بدون PII واقعی، حساب، کارت، نرخ ارز، Connection یا سند جعلی.
- نتیجه: پاور مشترک در هشت Workspace، دو فیلتر allowlist قبل از Pagination/Export برای ۴۵ کاتالوگ، ستون‌های تخصصی حمل‌ونقل/هتل/جغرافیا و ترتیب کشور قابل ذخیره‌سازی. ۷۸ Fixture دست‌نخورده با حفظ ID/FK و Audit بازآرایی شدند؛ اجرای مجدد صفر تغییر داشت. ۹۹۴ تست عمومی و ۹ تست مستقل PostgreSQL 18 موفق، Build و Typecheck موفق؛ lint محدوده موفق و خطای قدیمی Calendar در lint کامل خارج Scope باقی است. Smoke احراز‌شده به Session کاربر نیاز دارد. Migration محلی پس از Backup اعمال شد؛ API4000/Web3100 روشن‌اند. جزئیات و محدودیت‌ها: `docs/tasks/MASTER-003-CATALOG-USABILITY.md`.

### `MASTER-003-LOCAL-DEMO-DATA` — PC-B — `READY_FOR_REVIEW`

- درخواست 2026-08-31 کاربر: افزودن داده آزمایشی برای تمام بخش‌های اطلاعات پایه روی لوکال. Branch: `codex/pc-b-master-data-demo-fixtures` از `241308e` / PR #55.
- Scope: Fixture اختصاصی Master Data با اجرای صریح و محدود به PostgreSQL لوکال، آزمون تکرارپذیری/حفظ داده، اسناد. زیر قفل اسناد PC-B/MASTER-003؛ بدون Migration، تغییر Contract، Dependency، IAM، Customers یا Seed عمومی.
- رکوردها برچسب آزمایشی دارند؛ فقط Create از Service موجود همراه Audit سیستمی اختصاصی. هیچ داده موجود Update/Delete نمی‌شود؛ خطا کل اجرای Fixture را Rollback می‌کند و اجرای دوباره با Audit marker رکورد تکراری نمی‌سازد.
- قبل از اجرای کاربردی Backup خصوصی؛ تست ابتدا روی DB مستقل. نرخ ارز، کاتالوگ‌های حذف‌شده از منو، ارتباط Provider/Documents/Finance و اطلاعات واقعی حساس ساخته نمی‌شوند. شاخه‌های والد/PC-A/main/develop بدون تغییر؛ Merge خارج از این درخواست است.
- نتیجه: ۷۸ رکورد در ۴۰ کاتالوگ هشت بخش ساخته شد؛ اجرای دوم صفر Create و ۷۸ Reuse. جست‌وجو و Detail تمام نمونه‌ها روی DB محلی تأیید شد. ۵۴۶ تست API شامل ۱۳ تست جدید موفق؛ lint، Typecheck و Build API موفق. نسخه پشتیبان خصوصی محفوظ و سرورها روشن‌اند. مرورگر تست بدون Session به Login می‌رود؛ Smoke احراز‌شده ادعا نمی‌شود. جزئیات: `docs/tasks/MASTER-003-LOCAL-DEMO-DATA.md`.

آخرین به‌روزرسانی: 2026-08-31 — داده آزمایشی مستقل و امن برای اطلاعات پایه

### `MASTER-003-LIST-VISIBILITY` — PC-B — `READY_FOR_REVIEW`

- درخواست کاربر: اصلاح نمایش‌ندادن داده پس از ثبت فرم و سپس ادغام به develop؛ مجوز Merge به معنی عبور از Review و وابستگی‌های باز نیست.
- Branch: `codex/pc-b-master-data-list-visibility` از `790c20a`؛ والدها، PC-A، Customers و داده‌های موجود دست‌نخورده می‌مانند.
- Scope: درخواست‌های فهرست/KPI مالی و جغرافیا، تست سازگاری Web/API و اسناد همین اصلاح؛ زیر قفل اسناد PC-B/MASTER-003. بدون Migration، Seed، Contract یا Dependency/Lockfile جدید.
- علت تأییدشده: شش درخواست KPI با pageSize=1 در برابر حداقل 10 قرارداد؛ شکست Promise.all فهرست موفق را نیز خالی می‌کند. اصلاح و آزمون قبل از انتشار انجام می‌شود.
- نتیجه: helper مشترک با pageSize=10، ۱۲ تست بازگشت جدید و ۹۵۸ تست عمومی موفق؛ Typecheck و Production Build موفق، lint محدوده موفق. lint کلی همان ایراد قبلی DatePicker است. API4000/Login3100 سالم؛ Smoke احراز‌شده انجام نشده است. ادغام به develop تا Review والدها و حل سه تعارض معلق می‌ماند.

### `MASTER-003-LOCAL-PUBLISH` — PC-B — `READY_FOR_REVIEW`

- مجوز صریح کاربر در 2026-08-31: انتشار تمام تغییرات محلی پروژه و فعال‌سازی نسخه کامل محلی، با حفظ کد و داده‌های موجود.
- اصلاحات سربرگ، وضعیت همکاری، حذف امن، فرم‌های سفر، ترمینال و وعده/سرویس در Commitها و شاخه‌های Stacked تفکیک می‌شوند؛ والدهای موجود، PC-A، main و develop تغییر نمی‌کنند. هیچ Merge یا Force Push انجام نمی‌شود.
- Scope شامل کد/تست/اسناد Master Data و مهاجرت‌های افزایشی معلق است؛ تنظیمات خصوصی، نسخه پشتیبان، داده عملیاتی، خروجی ساخت و Dependencyها وارد Git نمی‌شوند. سه قفل PC-B/MASTER-003 فعال و Dependency/Lockfile آزاد باقی می‌ماند.
- قبل از Deploy محلی، Backup دیتابیس گرفته می‌شود؛ Seed یا Reset روی داده کاربردی اجرا نمی‌شود. آزمون‌ها در DB مستقل هستند. API4000، Web3100 و زیرساخت Rubi پس از بررسی روشن می‌مانند.
- نتیجه: شش شاخه تخصصی و Draft PRهای #48 تا #53 منتشر شدند؛ نسخه حمل‌ونقل #47 نیز بدون تغییر والدها در شاخه `codex/pc-b-master-data-local-complete` قرار گرفت. اصلاح آزمون ترمینال با Fast-forward به #52 رسید؛ حذف امن امکانات وابسته قطار در نسخه تجمیعی با تست واقعی بررسی شد.
- هر ۲۴ Migration محلی اعمال شده، داده قبلی محفوظ و API4000/Worker/Web3100 روشن‌اند. ۹۴۶ تست عمومی، Typecheck و Production Build موفق؛ آزمون واقعی ترمینال ۱۵ و حمل‌ونقل ۱۰ موفق. lint محدوده موفق؛ ایراد قبلی DatePicker و نبود Smoke احراز‌شده صریحاً گزارش شده‌اند. جزئیات: `docs/tasks/MASTER-003-LOCAL-PUBLISH.md`.

### `MASTER-003-LOCAL-MEAL-SERVICE-FORM` — PC-B — `READY_FOR_REVIEW`

- تأیید صریح کاربر برای تکمیل روی همین نسخه محلی با حفظ تمام تغییرات موجود؛ checkout جاری `codex/pc-b-master-data-partner-forms` جابه‌جا نمی‌شود.
- Scope: فقط کد قابل تعریف وعده/سرویس، چندانتخابی وعده‌ها و وضعیت در حال بررسی؛ API/Contract/Web، Migration افزایشی، آزمون و اسناد همین اصلاح. بدون Customers، Seed یا Dependency/Lockfile.
- زیر قفل‌های فعال Migration/Contract/Docs مربوط به PC-B/MASTER-003. تغییرات قبلی حذف امن و فرم‌های دیگر حفظ می‌شوند. آزمون و Client جدید در نسخه آزمایشی جدا؛ Deploy دیتابیس کاربردی و تغییر سرورها خارج از این اصلاح است.
- قرارداد افزایشی سازگار با v12، Producer/Consumer: Master Data API/Web (PC-B): `values.code` اختیاری برای مصرف‌کننده قدیمی و قابل تعریف در فرم وعده؛ `values.status=active|inactive|under_review` با مجوز وضعیت و ذخیره اتمیک/Audit. در حال بررسی برای مصرف‌کننده قدیمی inactive است؛ `mealServiceStatus` فیلتر اختصاصی جدید و `includedMealsJson` نمایش بدون از دست دادن داده آرایه است.
- کد استاندارد با کنترل یکتایی و خطای هم‌زمانی، انتخاب چندگانه همراه پاک‌کردن و حفظ وعده سفارشی، وضعیت سه‌گانه در فرم/فهرست/فیلتر/Excel تکمیل شد. هشت آزمون واقعی PostgreSQL 18، Seed دوگانه، کنترل TypeScript و Build API/Web در نسخه جدا موفق؛ جزئیات در `docs/tasks/MASTER-003-LOCAL-MEAL-SERVICE-FORM.md`.
- فعال‌سازی محلی معلق است: Migration کاربردی و Client سرور مشترک تغییر نکرده‌اند؛ در کنترل نهایی API4000 پاسخ نمی‌دهد و Web3100 به Login می‌رود. Commit/Push و جابه‌جایی Branch در این اصلاح محلی انجام نشد.

یادداشت: محدودیت فعال‌سازی/انتشار در گزارش مرحله‌ای بالا با مجوز جدید کاربر در `MASTER-003-LOCAL-PUBLISH` جایگزین شده است.

### `MASTER-003R-TRANSPORT-FORMS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-transport-forms` از `origin/codex/pc-b-master-data-partner-forms@2088010`؛ Draft stacked روی #45، والدها دست‌نخورده.
- اجرای مستقل در `C:/Users/admin/Rubi-transport-forms` برای حفظ همه تغییرات ثبت‌نشده و سرورهای Checkout اصلی؛ ادغام محلی تغییرات هم‌زمان نیازمند هماهنگی جداست.
- محدوده: هفت فرم حمل‌ونقل، API/Repository/Contract ماژول Master Data، Prisma/Migration افزایشی امکانات قطار و وضعیت بررسی، آزمون‌ها و اسناد همین Slice.
- قفل Migration، Master Data shared-contract و اسناد مرکزی زیر مالکیت فعال `PC-B/MASTER-003`؛ بدون تغییر Dependency/Lockfile، Customers یا جداول ماژول‌های دیگر.
- Producer/Consumer هر دو PC-B: افزودن اختیاری `values.transportStatus` و `train-types.values.facilityIds`، پاسخ attributes و فیلتر وضعیت حمل‌ونقل؛ قرارداد v12 سازگار، درخواست قدیمی رفتار قبلی را حفظ می‌کند. وضعیت بررسی در قرارداد عمومی قدیمی inactive است.
- اتصال Documents/Integrations و شمارش ناوگان تا قرارداد واقعی فقط‌خواندنی/ناموجود؛ کدهای تولیدشده، Version و Audit ورودی دستی نیستند. ظرفیت در مدل وسیله ذخیره نمی‌شود.
- آزمون‌ها: API ۲۶۵، Web ۲۰۳، Contracts ۱۴، Database ۵۵ و PostgreSQL ۱۸ واقعی ۹ تست موفق؛ Build/Typecheck و lint محدوده موفق. ایراد قبلی DatePicker در lint کل Web باقی است. Seed دوبار در دیتابیس موقت اجرا شد؛ Deploy محلی و Smoke احراز‌شده نسخه جدید انجام نشد.
- قفل‌های اصلی MASTER-003 آزاد نمی‌شوند. اتصال به تغییرات ثبت‌نشده Checkout مشترک، Deploy و Merge نیازمند هماهنگی جداست؛ شرح دقیق در `docs/tasks/MASTER-003R-TRANSPORT-FORMS.md`.

تجمیع نسخه حمل‌ونقل منتشرشده در PR #47 با اصلاحات بالا، تحت مجوز انتشار کامل کاربر، روی `codex/pc-b-master-data-local-complete` انجام می‌شود؛ شاخه تجمیعی برای اجرای محلی است و PRهای تخصصی مستقل باقی می‌مانند.

هر ردیف مالکیت یک واحد کار و فایل‌های آن را مشخص می‌کند. قبل از ویرایش، ردیف جدید
ثبت شود. وضعیت‌های مجاز: `PLANNED`، `PLANNED/RESERVED`، `IN_PROGRESS`،
`BLOCKED`، `READY_FOR_REVIEW`، `DONE`.

| Work ID                         | مالک         | Branch                                      | محدوده/فایل‌های اصلی                                                                                     | وضعیت              | وابستگی یا Handoff                                                                                                                                       |
| ------------------------------- | ------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CUSTOMER-002B                   | PC-A         | TBD                                         | Customer Persistence بعدی و قرارداد عمومی Customers؛ Scope دقیق در Handoff فعال‌سازی می‌شود              | `PLANNED/RESERVED` | فعال‌سازی قفل‌ها فقط پس از Merge ترتیبی PRهای #25، #26 و #27                                                                                             |
| MASTER-004                      | PC-B         | TBD                                         | ادامه کاتالوگ‌ها، Antivirus/Documents، PII encryption/unmask و قابلیت‌های آینده Master Data              | `PLANNED`          | تا Handoff بعدی بدون Prisma، Migration، Seed، Root Contract، Dependency و اسناد مرکزی                                                                    |
| CUSTOMER-002A.1                 | PC-A         | `codex/pc-a-customer-next`                  | Timeline/Filters/Privacy در Customers؛ API/Web/Test/Contract و اسناد Task، بدون Database/Master Data     | `READY_FOR_REVIEW` | Draft PR #27 روی #26؛ Migration Lock نزد `PC-B/MASTER-003` و Schema نیازها در `BLOCKED_FOR_CUSTOMER_002B`                                                |
| CUSTOMER-CHAIN-REVIEW-001       | PC-A         | `codex/pc-a-customer-41-reconcile-20260831` | Customer PR chain review, conflict reconciliation and targeted safety gates                              | `READY_FOR_REVIEW` | #26/#27/#34 merged; 425 tests and 17 HTTP/database checks pass. DONE and Customer shared locks RELEASED upon #41 merge. No PC-B PR or real-data changes. |
| BOOT-001                        | PC-A         | `codex/pc-a-bootstrap-docs`                 | اسناد Bootstrap، معماری، ERD، workflow و backlog                                                         | `READY_FOR_REVIEW` | PC-B باید همه اسناد و تصمیم‌های باز P0 را مرور کند                                                                                                       |
| FOUNDATION-001                  | PC-A         | `codex/pc-a-technical-bootstrap`            | Technical Bootstrap: Monorepo، Web/API/Worker، Docker Compose و Prisma Client بدون مدل تجاری             | `DONE`             | Commit `d9a9793` ادغام شد؛ مبنای Work Itemهای Full-Stack                                                                                                 |
| FOUNDATION-002                  | تخصیص‌نیافته | TBD                                         | سخت‌سازی زیرساخت، CI و استقرار محیط‌های غیرمحلی                                                          | `PLANNED`          | FOUNDATION-001 و تصمیم‌های میزبانی/RPO/RTO                                                                                                               |
| FOUNDATION-003                  | تخصیص‌نیافته | TBD                                         | IAM/Audit foundation، schema دامنه و Migration اولیه                                                     | `PLANNED`          | با `IAM-001` جایگزین شده؛ برای جلوگیری از اجرای موازی رزرو جدید نگیرد                                                                                    |
| FOUNDATION-004                  | PC-B         | `codex/pc-b-frontend-foundation`            | Frontend Foundation: `apps/web/**`، تست Frontend و `docs/tasks/PC-B.md`                                  | `READY_FOR_REVIEW` | Base `b5b7c5d`؛ قفل Dependency/Lockfile آزاد شد                                                                                                          |
| DOCS-002                        | PC-A         | `codex/pc-a-hr-module-ownership`            | ثبت ماژول منابع انسانی، مالکیت نهایی ماژول‌ها و قرارداد همکاری Full-Stack                                | `READY_FOR_REVIEW` | فقط مستندات؛ بدون کد، Dependency، Schema یا Migration                                                                                                    |
| DOCS-003                        | PC-A         | `codex/pc-a-sprint-1-planning`              | ثبت برنامه Sprint اول، مرز کار و Handoff دو Task `IAM-001` و `MASTER-001`                                | `READY_FOR_REVIEW` | Base `c4f8bde`؛ فقط اسناد برنامه‌ریزی                                                                                                                    |
| ARCH-001                        | PC-A         | `codex/pc-a-approved-workflow-architecture` | معماری ۱۷ بخش، فروش/تخصیص، رزرواسیون/Manifest، تعریف بلیت، خرید/تخفیف و release مالی                     | `DONE`             | Merge `99dd1cf`؛ مرجع قطعی UI-ARCH-001                                                                                                                   |
| UI-ARCH-001                     | PC-A         | `codex/pc-a-approved-workflow-frontend`     | منوی ۱۷ بخشی، صفحات گردش فروش/رزرواسیون/خرید/مالی، تعریف بلیت و مدیریت سیستم در `apps/web/**`            | `DONE`             | Merge `543f6e2`؛ دسترسی عملی IAM از مدیریت سیستم و منوی ۱۷ بخشی تثبیت شد                                                                                 |
| IAM-001                         | PC-A         | `codex/pc-a-iam-foundation`                 | IAM Full-Stack: Database، API، Web، Test، امنیت، شعبه/دسترسی و Audit                                     | `DONE`             | Merge `50eaccaf`؛ Handoff عمومی IAM ثبت و قفل‌های مشترک آزاد شد                                                                                          |
| MASTER-001                      | PC-B         | `codex/pc-b-master-data-foundation`         | Foundation بدون Persistence اطلاعات پایه، UI، قرارداد ماژول‌محلی و تست                                   | `DONE`             | Merge `cda0f9a`؛ Persistence واقعی به `MASTER-002` منتقل شد                                                                                              |
| SPRINT1-HANDOFF-001             | PC-A         | `codex/pc-a-sprint-1-handoff`               | بستن Sprint اول، ثبت Mergeهای نهایی، آزادسازی قفل‌ها و برنامه اولیه Sprint دوم                           | `DONE`             | Merge `9c69124`؛ چهار قفل Sprint اول آزاد شدند                                                                                                           |
| SPRINT2-PLANNING-001            | PC-A         | `codex/pc-a-sprint-2-planning`              | ترتیب اجرا، قفل‌ها، مرز فایل و Handoff سه Task آغاز Sprint دوم                                           | `DONE`             | Merge `9efb37c`؛ فقط اسناد برنامه‌ریزی و وضعیت                                                                                                           |
| IAM-002                         | PC-A         | `codex/pc-a-iam-domain-permissions`         | انتشار Permission Codeهای Master Data و Customers، Seed تکرارپذیر و Handoff قرارداد عمومی                | `DONE`             | Merge `d1f1133`؛ ۱۷ Permission و بدون Schema/Migration/Dependency                                                                                        |
| IAM002-HANDOFF-001              | PC-A         | `codex/pc-a-iam-002-handoff`                | ثبت Merge، آزادسازی IAM contract lock و مجازکردن شروع دو Task مستقل Sprint دوم                           | `DONE`             | Merge `0af31c2`؛ دو Task مستقل مجاز به شروع هستند                                                                                                        |
| MASTER-002                      | PC-B         | `codex/pc-b-master-data-persistence`        | Database، Migration، Repository، Backend و اتصال واقعی Frontend اطلاعات پایه                             | `DONE`             | Merge `ddfebb3`؛ چهار قفل با Handoff مستقل آزاد شدند                                                                                                     |
| CUSTOMER-001                    | PC-A         | `codex/pc-a-customer-persistence`           | مشتریان، Persistence، رمزنگاری Contact، Audit redaction و Duplicate query                                | `DONE`             | PR #19؛ Merge `7d0a4f4`؛ Migration و قرارداد Customer پایدار و تحویل‌شده                                                                                 |
| CUSTOMER-002A                   | PC-A         | TBD                                         | Customer Operations Enhancement در مرز Web/API فعلی Customers و تست‌های اختصاصی                          | `PLANNED/RESERVED` | شروع از آخرین `origin/develop`؛ بدون قفل مشترک و بدون تداخل با MASTER-003                                                                                |
| CUSTOMER001-FINANCE-HANDOFF-001 | PC-A         | `codex/pc-a-customer-finance-handoff`       | آزادسازی چهار قفل CUSTOMER-001 و رزرو کنترل‌شده FINANCE-001؛ فقط اسناد مرکزی و سند Handoff               | `DONE`             | PR #20؛ Merge `11fc875`؛ بدون کد، Schema، Migration، Dependency یا Lockfile                                                                              |
| FINANCE-001                     | PC-A         | `codex/pc-a-finance-foundation`             | Foundation مالی و چهار Decision پذیرفته‌شده؛ Phase A بدون Persistence و Migration                        | `DONE`             | PR #21؛ Merge `45c107e`؛ قفل‌های stale با نبود FINANCE-002 آزاد شدند                                                                                     |
| LEGAL-ENTITY-CONTEXT-001        | PC-A         | `codex/pc-a-legal-entity-context`           | Legal Entity Full-Stack، Prisma، API، Contract، App Shell، صفحه مدیریت، Audit و Test                     | `DONE`             | PR #24؛ Merge `b6da5d6`؛ قفل‌ها با دلیل `DONE/MERGED via PR #24` آزاد شدند                                                                               |
| MASTER-003                      | PC-B         | `codex/pc-b-master-data-advanced`           | توسعه افزایشی Master Data: Schema/Migration، Contract، Backend، Frontend، Excel Import/Export و Test     | `IN_PROGRESS`      | Draft PR #25؛ خروجی XLSX واقعی فعال؛ سه قفل فعال و Dependency lock آزاد است                                                                              |
| CALENDAR-001                    | PC-B         | `codex/pc-b-master-data-advanced`           | تقویم مشترک آبی با سوییچ شمسی/میلادی در همه فرم‌های Web                                                  | `READY_FOR_REVIEW` | ۸۵ تست Web، Typecheck و Lint موفق؛ چهار route لوکال پاسخ ۲۰۰ دادند                                                                                       |
| MASTER-003B-GEO                 | PC-B         | `codex/pc-b-master-data-next`               | Vertical Slice جغرافیا: Country، Province/Region، City، Airport، Terminal و تست/مستندات همان Slice       | `READY_FOR_REVIEW` | Draft PR #28 روی PR #25؛ سه قفل MASTER-003 فعال می‌مانند                                                                                                 |
| MASTER-003C-FINANCIAL           | PC-B         | `codex/pc-b-master-data-financial`          | مالی و پولی در Master Data: Currency، Rate Workflow/History، Bank/Branch و Payment Method مرجع           | `READY_FOR_REVIEW` | Draft PR #29 روی PR #28 و به‌تبع آن #25؛ بدون Query مستقیم Finance                                                                                       |
| MASTER-003D-UI-POLISH           | PC-B         | `codex/pc-b-master-data-ui-polish`          | KPI پاستلی مشترک، نمای کامل جغرافیا و حذف underline کارت‌های Hub بدون تغییر Backend/Database             | `READY_FOR_REVIEW` | Draft PR #30 روی PR #29؛ ۳۳۵ تست، Typecheck و Build موفق                                                                                                 |
| MASTER-003E-SUPPLIERS           | PC-B         | `codex/pc-b-master-data-suppliers`          | Vertical Slice سازمان‌ها و تأمین‌کنندگان: Supplier، Broker، Contact ماسک‌شده، Service و Collaboration    | `READY_FOR_REVIEW` | Draft PR #31 روی PR #30؛ قفل‌های Migration/Contract/Docs فعال MASTER-003                                                                                 |
| MASTER-003F-ACCOMMODATION       | PC-B         | `codex/pc-b-master-data-accommodation`      | Vertical Slice اقامت: Hotel Profile، Chain، Room، Meal، Facility، Excel و Composite Hotel                | `READY_FOR_REVIEW` | Draft PR #32 روی PR #31؛ قفل‌های Migration/Contract/Docs فعال MASTER-003                                                                                 |
| MASTER-003G-UX-CONSOLIDATION    | PC-B         | `codex/pc-b-master-data-ux-consolidation`   | ادغام نرخ/تاریخچه در ارز، ادغام نمای شهر/استان، پروفایل‌های Popup و حذف نمای مستقل مخاطبان               | `READY_FOR_REVIEW` | Draft PR #33 روی PR #32؛ فقط Web/Test/Docs و بدون Schema، Migration یا API                                                                               |
| MASTER-003H-TRANSPORT           | PC-B         | `codex/pc-b-master-data-transport`          | Vertical Slice حمل‌ونقل: Airline، Aircraft، Cabin، Baggage، Manifest، Rail و Bus با پروفایل Popup        | `READY_FOR_REVIEW` | Draft PR #35 روی PR #33؛ سه قفل MASTER-003 فعال و Customers دست‌نخورده است                                                                               |
| MASTER-003I-SALES-REFERENCES    | PC-B         | `codex/pc-b-master-data-sales-references`   | Vertical Slice مراجع فروش: Acquaintance، Lead Source، Channel، Lost Reason، Customer Type، Tag، Campaign | `READY_FOR_REVIEW` | Draft PR #36 روی PR #35؛ سه قفل فعال و بدون Query مستقیم Customers                                                                                       |
| MASTER-003J-INSURANCE           | PC-B         | `codex/pc-b-master-data-insurance`          | Vertical Slice بیمه: Insurer، Insurance Plan، Coverage، روابط مرجع، Popup و آزمون کامل                   | `READY_FOR_REVIEW` | Draft PR #37 روی PR #36؛ سه قفل فعال و بدون داده عملیاتی Reservations                                                                                    |
| MASTER-003K-TRAVEL-SERVICES     | PC-B         | `codex/pc-b-master-data-travel-services`    | Vertical Slice تور و خدمات سفر: Leader، Tour/Transfer Type، CIP، Visa و Bus Catalog                      | `READY_FOR_REVIEW` | Draft PR #38، Stacked روی PR #37؛ همه Profileها Popup؛ Bus به Organization/Provider و Facility واقعی متصل است                                            |
| MASTER-003L-SECTION-CLEANUP     | PC-B         | `codex/pc-b-master-data-section-cleanup`    | حذف شش ورودی از رابط خدمات سفر و مراجع فروش؛ هماهنگی کارت‌ها و تست ناوبری                                | `READY_FOR_REVIEW` | Stacked روی PR #38؛ Web/Test/Docs زیر قفل MASTER-003؛ بدون حذف داده، تغییر API یا Customers                                                              |
| CUSTOMER-AFFAIRS-001            | PC-B         | `codex/pc-b-customer-affairs-foundation`    | Foundation امور مشتریان: Lead، پیش‌فروش، Follow-up، پشتیبانی پس از فروش و Ticket                         | `PLANNED`          | فاز A فقط Frontend، طراحی دامنه، قرارداد ماژول‌محلی و تست؛ بدون Persistence                                                                              |
| MODULES-FOUNDATION-001          | PC-A         | `codex/pc-a-all-modules-foundation`         | Foundation رابط ۱۷ بخش، تست Web و اسناد Task؛ `pnpm-workspace.yaml` فقط برای Build Policy Fix            | `READY_FOR_REVIEW` | PR #23؛ قفل موقت Dependency/Lockfile فقط برای Allowlist دقیق pnpm 11                                                                                     |
| MASTER002-HANDOFF-001           | PC-A         | `codex/pc-a-master-002-handoff`             | ثبت Mergeهای MASTER-002/Customer Phase A، انتقال قفل‌ها و مرز فاز B                                      | `READY_FOR_REVIEW` | فقط شش فایل مستنداتی؛ Draft PR به `develop`                                                                                                              |

### `MASTER-003-LOCAL-TRAVEL-FORMS` — PC-B — `READY_FOR_LOCAL_REVIEW` (فعال‌سازی معلق)

- تأیید کاربر برای تکمیل فرم‌های نوع ترانسفر و ویزا روی تغییرات موجود، بدون حذف یا بازنویسی کار نوع تور، حذف امن و سایر اصلاحات محلی.
- محدوده: دو فرم و نمایش فهرست/پروفایل آن‌ها، وضعیت مجوزدار اتمیک، ظرفیت بازه‌ای، نوع اعتبار مرجع ویزا، Migration افزایشی و آزمون‌های همان دو منبع.
- Schema، Migration `20260831100000_master_data_travel_reference_forms`، قرارداد افزایشی v12 و اسناد این اصلاح زیر قفل موجود `PC-B/MASTER-003` هستند؛ Dependency/Lockfile، Customers و IAM داخلی تغییر نمی‌کنند.
- در این گفت‌وگوی جانبی Branch/Commit/Push یا سرورهای مشترک تغییر نمی‌کنند؛ بررسی دیتابیس و ساخت در محیط آزمایشی جدا انجام می‌شود. جزئیات سازگاری در `docs/tasks/MASTER-003-LOCAL-TRAVEL-FORMS.md` ثبت می‌شود.
- فرم‌ها و ذخیره‌سازی پیاده شدند؛ ۷۰ تست هدفمند API، ۲۸ تست Web، ۱۳ تست واقعی PostgreSQL 18 و دو تست Migration موفق‌اند. اجرای Migration/بازسازی Client روی محیط مشترک در این کار انجام نشده و باید با کار هم‌زمان ترمینال هماهنگ شود.

### `MASTER-003Q-PARTNER-FORMS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-partner-forms` از `560b3c1` / PR #44؛ والدها تغییر نمی‌کنند.
- مجوز هماهنگی: درخواست صریح کاربر در 2026-08-31 برای تکمیل تأمین‌کننده/کارگزار روی نسخه فعلی با حفظ تغییرات محلی حذف امن و وضعیت همکاری. آن تغییرات جداگانه باقی می‌مانند و در Commit این کار وارد نمی‌شوند.
- محدوده: نام انگلیسی مستقل پروفایل، نوع شخصیت سازمان، تماس اصلی وابسته به همان سازمان، انتخاب چندگانه خدمات، فرم‌های Popup، Migration افزایشی، API/Permission/Audit، Test و اسناد همین Slice.
- سه قفل Migration/Contract/Docs همان `PC-B/MASTER-003`؛ Schema، قرارداد Master Data و اسناد وضعیت برای همین زیرواحد رزرو می‌شوند. بدون Dependency، Customers یا فایل داخلی ماژول دیگر.
- Producer: Master Data API، Consumer: Master Data Web. توسعه سازگار با v12: فیلدهای اختیاری `englishName`/`primaryContactId` برای Supplier/Broker و `personType` برای Organization؛ نبود فیلد در PATCH مقدار قبلی را حفظ می‌کند. فقط نام/Mask مخاطب در پاسخ عمومی؛ هیچ Ciphertext یا شماره کامل در List/Export/Audit پروفایل نیست.
- قرارداد و محدودیت خرید فاقد Public Service عملیاتی‌اند؛ اتصال آن‌ها Deferred و بدون جعل داده/نوشتن در مالک دیگر است.
- Draft PR #45: https://github.com/nirvanamahlou/Rubi/pull/45 — Stacked روی `codex/pc-b-master-data-clear-fields` و وابسته به #44 و زنجیره #25؛ پیش از والد Merge نشود.
- نتیجه: چهار فیلد/قابلیت اصلی با ذخیره واقعی، Mask، انتخاب چندگانه و Popup تکمیل شد. Migration `20260831090000_master_data_partner_forms` افزایشی است؛ PostgreSQL 18 خالی، Seed دوبار و چهار آزمون واقعی DB موفق‌اند. تست‌های واحد، typecheck، lint محدوده و Production Build موفق؛ lint کلی Web فقط ایراد قبلی DatePicker را دارد. Smoke احراز‌شده به Session کاربر نیاز دارد.

### `MASTER-003-LOCAL-TERMINAL-FORM` — PC-B — `READY_FOR_REVIEW` (محلی)

- تأیید صریح کاربر برای تکمیل ترمینال روی فایل‌های دارای تغییر محلی و Migration افزایشی در 2026-08-31؛ تغییرات حذف امن، تور و سایر کارها حفظ می‌شوند. کار محلی روی checkout فعلی، بدون تغییر Branch، Commit/Push، restart سرورها یا تغییر داده عملیاتی است.
- محدوده: مدل/Migration ترمینال، Policy و Repository/DTO/Export همان Master Data، Contract افزایشی، فرم/فهرست جغرافیا، آزمون‌ها و گزارش. فایل‌های مرکزی Schema/Contract/Docs زیر همان سه قفل PC-B/MASTER-003 رزرو هستند؛ Dependency/Lockfile آزاد و دست‌نخورده می‌ماند.
- Producer: Master Data API؛ Consumer: Master Data Web. `MIXED` به enum نوع ترمینال اضافه می‌شود. فیلدهای اختیاری `gateCount`، `operatingHoursMode`، `opensAt`، `closesAt` افزایشی و سازگار با payload قدیمی‌اند؛ نبود در PATCH مقدار قبل را حفظ می‌کند. ساعت‌ها ساعت محلی تکرارشونده در Timezone فرودگاه‌اند، نه زمان وقوع رویداد.
- `values.status` فقط در فرم ترمینال مقادیر active/inactive/maintenance دارد و با مجوز master_data.status.manage، همراه مشخصات در یک تراکنش/Audit ذخیره می‌شود. رکورد در تعمیرات isActive=false و isUnderMaintenance=true دارد؛ قرارداد عمومی status همچنان active/inactive است و مصرف‌کننده قدیمی آن را قابل استفاده نمی‌بیند.
- شهر، IATA/ICAO و Timezone از FK فرودگاه خوانده می‌شوند؛ نام تغییر‌دهنده فقط از API عمومی مجوزدار IAM، بدون Query مستقیم. Schema/Migration فقط افزایشی است؛ تست DB در پایگاه موقت مستقل انجام می‌شود. Customers و Finance خارج از محدوده‌اند.
- نتیجه: فرم و فهرست ترمینال شامل نوع مشترک، تعداد گیت، ساعت فعالیت و تعمیرات تکمیل شد. ۶۹ تست جدید API/Web و ۱۵ آزمون واقعی PostgreSQL 18 موفق؛ مجموعه جاری API با ۴۶۳، Web با ۳۰۴ و Contract با ۱۴ تست موفق است. lint محدوده، typecheck با قرارداد جاری، Prisma format/validate/generate و Build جداگانه API/Web موفق‌اند.
- Migration `20260831110000_master_data_terminal_details` و Seed دوبار فقط در DB مستقل آزموده شدند؛ Seed در نسخه آزمایشی با مهلت تراکنش ۶۰ثانیه‌ای اجرا شد چون مهلت پیش‌فرض ۵ثانیه‌ای در محیط جاری تمام می‌شد. DB آزمون حذف شد؛ فعال‌سازی روی دیتابیس/سرور مشترک هنوز انجام نشده و نیازمند هماهنگی است. گزارش: `docs/tasks/MASTER-003-LOCAL-TERMINAL-FORM.md`.

### `MASTER-003-LOCAL-TOUR-FORM` — PC-B — `READY_FOR_REVIEW` (محلی)

- کار محلی گفت‌وگوی جانبی با تأیید صریح کاربر برای اصلاح هم‌پوشان، با حفظ تغییرات موجود؛ در این گفت‌وگو Branch جابه‌جا نشد و Commit/Push انجام نشد. هنگام پایان بررسی، checkout مشترک روی `codex/pc-b-master-data-partner-forms` بود.
- Scope: فقط فرم/فهرست نوع تور، اعتبارسنجی و ذخیره اتمیک وضعیت در Master Data، نمایش metadata آخرین تغییر، آزمون‌ها و سند `docs/tasks/MASTER-003-LOCAL-TOUR-FORM.md`؛ بدون Customers، IAM داخلی، Schema/Migration/Seed یا Dependency/Lockfile.
- تغییر محدود فایل‌های مشترک `master-data.service.ts`، `master-data.repository.ts` و `master-data-travel-services-workspace.tsx` با حفظ کامل حذف امن و سایر تغییرات محلی؛ فایل‌های جدید فرم و آزمون مستقل‌اند. اسناد مرکزی زیر قفل فعال PC-B/MASTER-003 می‌مانند.
- Producer/Consumer: Master Data API/Web. قرارداد افزایشی سازگار با v12: `values.status` اختیاری فقط برای `tour-types`؛ تغییر وضعیت نیازمند `master_data.status.manage` و همراه سایر فیلدها در همان تراکنش/Audit است. نبود status رفتار قدیمی را حفظ می‌کند.
- پاسخ نوع تور در attributes، `updatedByUserId` واقعی و `usageCount=null`/`usageStatus=UNAVAILABLE` دارد. شمارش محصولات تا انتشار قرارداد مالک موجود نیست؛ نام کاربر فقط از API عمومی مجوزدار `GET /iam/users` خوانده می‌شود، بدون Query مستقیم یا ذخیره نام/PII در Master Data.
- بررسی: ۵۸ آزمون جدید نوع تور؛ مجموعه جاری Web با ۲۴۲ تست و API با ۳۸۴ تست موفق/۱۱ تست skipped؛ typecheck، lint فایل‌های متاثر و Build جدا از خروجی سرور موفق‌اند. Smoke احراز‌شده به‌دلیل نبود Session انجام نشد. شمارش استفاده همچنان وابسته به قرارداد محصولات است.

### `MASTER-003P-CLEAR-FIELDS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-clear-fields` از PR #43 / `b78d0a9`؛ والد دست‌نخورده می‌ماند.
- محدوده: پاک‌کردن انتخاب در فرم‌های Master Data (انتخاب ساده/مرجع/چندانتخابی/تاریخ)، کنترل محلی فرم، اعتبارسنجی و آزمون‌های Web و اسناد همین واحد کار.
- فیلد اجباری پس از پاک‌کردن بدون انتخاب دوباره قابل ذخیره نیست؛ فیلد فقط‌خواندنی یا در حال ذخیره قابل پاک‌کردن نیست. پاک‌کردن انتخاب هیچ رکورد مرجعی را حذف نمی‌کند.
- بدون تغییر UI مشترک، Customers، Backend، Contract، Schema/Migration/Seed یا Dependency/Lockfile؛ اسناد مرکزی تحت قفل فعال `PC-B/MASTER-003` و سه قفل اصلی ثابت‌اند.
- رزرو فایل مرکزی جدید `apps/web/vitest.config.mts` فقط برای اجرای آزمون واقعی کامپوننت‌های TSX با همان JSX خودکار Next و alias موجود Web؛ بدون Dependency یا تغییر تنظیمات ساخت Next.
- تغییرات محلی موجود در `master-data-suppliers-workspace.tsx` و `supplier-collaboration.ts` خارج از Scope‌اند و نه بازنویسی، نه stage می‌شوند.
- تحویل Draft Stacked روی `codex/pc-b-master-data-payment-form`؛ پیش از #43 و والدهای پشته Merge نشود.
- کنترل کیفیت روی checkout مستقل همین Commit (بدون تغییرات هم‌زمان دیگر): Frozen install، `175/175` تست Web شامل ۲۰ آزمون جدید، typecheck، lint فایل‌های متاثر و Production Build موفق؛ گزارش کامل در `docs/tasks/MASTER-003P-CLEAR-FIELDS.md`.

### `MASTER-003O-PAYMENT-FORM` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-payment-form` از PR #42 / `495af50`؛ والد دست‌نخورده می‌ماند.
- محدوده: حذف ورودی کد روش و نام انگلیسی فقط از فرم روش پرداخت، مدل فیلدهای فرم و validation، تولید کد داخلی در Master Data API و تست/اسناد همان کار؛ بدون Customers یا Finance.
- رفتار افزایشی سازگار با Contract v12: در `POST /api/v1/master-data/payment-methods` اگر `values.code` ارسال نشود، Backend کد یکتا تولید می‌کند. کد صریح مصرف‌کننده قدیمی همچنان پذیرفته و اعتبارسنجی می‌شود؛ Update بدون این دو فیلد، مقدارهای قبلی را حفظ می‌کند. Producer: Master Data API؛ Consumer: Master Data Web؛ هر دو PC-B.
- فیلدهای Catalog/Export، Schema، Migration، Seed، قرارداد عمومی و Dependency/Lockfile تغییر نمی‌کنند؛ اسناد مرکزی تحت قفل فعال `PC-B/MASTER-003` و سه قفل اصلی ثابت‌اند.
- Draft PR روی شاخه `codex/pc-b-master-data-clean-labels`؛ پیش از #42 و والدهای پشته Merge نشود.
- Web: `155/155` و API: `245/245` تست موفق؛ typecheck هر دو، lint فایل‌های Web متاثر و کل API و Production Build هر دو موفق‌اند. API محلی با کد جدید پاسخ ۲۰۰ می‌دهد؛ گزارش در `docs/PROJECT_STATUS.md`.

### `MASTER-003N-CLEAN-LABELS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-clean-labels` از PR #40 / `808ca13`؛ والد دست‌نخورده می‌ماند.
- محدوده: حذف متن و نشان فنی از Header فرم‌ها و Workspaceهای Master Data؛ فقط `apps/web/src/modules/master-data/components/**` و تست/اسناد همان کار.
- قرارداد API، اعتبارسنجی، Audit، نسخه رکورد، هشدار Preview، داده‌ها و فرم‌ها حفظ می‌شوند؛ بدون Backend/Schema/Migration/Seed/Dependency/Customers.
- اسناد وضعیت تحت قفل فعال `PC-B/MASTER-003`؛ سه قفل اصلی تغییر نمی‌کنند و Dependency آزاد می‌ماند. Draft PR مستقیم روی #40 و بدون Merge خودکار.
- Web: هر ۱۵۱ تست، typecheck، lint فایل‌های تغییرکرده و Production Build موفق؛ هشت صفحه ساخته‌شده فاقد برچسب‌های حذف‌شده‌اند. گزارش در `docs/PROJECT_STATUS.md` ثبت شد.

### `MASTER-003M-CURRENCY-FORM` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-currency-form` از PR #39 / `02f88e9`؛ والد دست‌نخورده است.
- گزارش پیاده‌سازی و کنترل کیفیت: `docs/tasks/MASTER-003M-CURRENCY-FORM.md`؛ Draft PR مستقیم روی #39، بدون Merge خودکار.
- محدوده: فرم ارز و ثبت نرخ خرید/فروش در Web، تست‌ها، API همان Master Data و اسناد.
- قفل مشترک: `packages/contracts/src/master-data/index.ts` و export لازم، تحت قفل فعال MASTER-003؛ بدون Schema/Migration/Dependency یا Customers.
- قرارداد افزایشی سازگار با v12: `POST /api/v1/master-data/currency-rates/quotes` با ارز مبدأ/مقصد، buyRate و sellRate اختیاری (حداقل یکی)، منبع، زمان UTC، بازه اعتبار و دلیل اصلاح؛ پاسخ فهرست نرخ‌های جدید. Producer: Master Data API؛ Consumer: فرم ارز Master Data Web، هر دو PC-B. مسیرهای قبلی و ساختار تاریخچه تغییر نمی‌کنند.
- دو نرخ در تراکنش واحد، Draft و `isAuthoritative=false` ثبت می‌شوند؛ ثبت‌کننده از actor است. ارز پایه فقط‌خواندنی و منتظر قرارداد Finance باقی می‌ماند. سیاست نمایش از UI حذف و مقدار ذخیره‌شده حفظ می‌شود؛ ایجاد جدید از Default موجود DB استفاده می‌کند.

### قفل موقت Supply-chain برای Review PR #23

- `Dependency/Lockfile Owner = PC-A/MODULES-FOUNDATION-001` در 2026-08-25 فقط برای
  اصلاح `allowBuilds` در `pnpm-workspace.yaml` رزرو شد؛ افزودن یا تغییر Dependency،
  Version و `pnpm-lock.yaml` مجاز نیست.
- Fresh Install frozen بدون `ERR_PNPM_IGNORED_BUILDS` پاس شد؛ فقط Scriptهای
  `@parcel/watcher` و `@swc/core` اجرا شدند، `pnpm-lock.yaml` ثابت ماند و قفل موقت
  Dependency/Lockfile در 2026-08-25 با وضعیت `RELEASED` آزاد شد.

## Sprint 1 — مرز فایل و Handoff

### `IAM-001` — PC-A

- محدوده مالکیت پیاده‌سازی: مدل و Migrationهای IAM، Backend احراز هویت و authorization،
  Frontend ورود/خروج و مدیریت کاربران/نقش‌ها، تست‌های unit/integration/permission/E2E و
  Audit رخدادهای امنیتی.
- فایل‌های رزروشده: `apps/api/src/iam/**`، پیکربندی ضروری API، مسیرهای احراز هویت و
  مدیریت دسترسی در `apps/web/src/**`، `packages/contracts/src/iam/**`،
  `packages/database/prisma/schema.prisma` و Migration/Seed نخست IAM، manifestهای
  ضروری، `pnpm-lock.yaml` و اسناد وضعیت/امنیت/Handoff همین Task.
- قفل‌های **Migration Owner = PC-A**، **Dependency/Lockfile Owner = PC-A** و
  **IAM shared-contract Owner = PC-A** در طول Task رزرو بودند و پس از Merge
  `50eaccaf` و Handoff مورخ 2026-08-23 آزاد شدند.
- خروجی لازم برای PC-B: قرارداد عمومی branch/reference مورد استفاده Master Data، شکل
  actor/audit و روش مصرف permission بدون import داخلی از IAM.

### `MASTER-001` — PC-B

- محدوده مالکیت پیاده‌سازی: کشور/شهر، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل،
  organizationهای آژانس/شرکت، کارگزار، لیدر، نحوه آشنایی، وضعیت فعال/غیرفعال،
  جست‌وجو/فیلتر، Excel/PDF، Frontend، API Contract و Test.
- در طول `MASTER-001` و تا Handoff از `IAM-001`، PC-B فقط بخش‌های بدون Migration را
  توسعه داد؛ Persistence واقعی اکنون به `MASTER-002` منتقل شده و پیش از شروع آن باید
  قفل مستقل Prisma/Migration و Dependency رزرو شود.
- قرارداد Master Data نباید ساختار داخلی IAM را تکرار کند. نیاز به branch access، actor
  یا permission ابتدا به‌صورت consumer requirement برای PC-A ثبت و از قرارداد عمومی IAM
  مصرف می‌شود.
- در شروع `MASTER-002`، PC-B باید آخرین `origin/develop` را دریافت، نبود
  Migration/Dependency Owner دیگر را تأیید و قفل لازم را پیش از هر تغییر Schema یا
  Dependency رسماً رزرو کند.
- قراردادهای این مرحله فقط داخل ماژول Web و سند Task تعریف می‌شوند و proposal هستند؛
  انتقال آن‌ها به `packages/contracts/**` یا پیاده‌سازی Backend نیازمند رزرو مستقل فایل
  مشترک و Handoff ثبت‌شده با producer/consumer است.
- Consumer requirementهای IAM شامل permission code، branch scope و actor/audit در
  `docs/tasks/MASTER-001.md` ثبت می‌شوند؛ هیچ فایل IAM در این Task تغییر نمی‌کند.

## قفل‌های آزادشده Sprint اول

| قفل                       | مالک پیشین/Task | وضعیت      | تاریخ و مبنای آزادسازی                                                           |
| ------------------------- | --------------- | ---------- | -------------------------------------------------------------------------------- |
| Migration Owner           | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ IAM baseline با Merge `50eaccaf` ادغام و Handoff عمومی ثبت شد        |
| Dependency/Lockfile Owner | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ Dependencyهای IAM با Merge `50eaccaf` تثبیت و Sprint اول بسته شد     |
| IAM shared-contract Owner | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ قرارداد عمومی IAM با Merge `50eaccaf` در `@rubi/contracts` منتشر شد  |
| Central architecture docs | PC-A/ARCH-001   | `RELEASED` | 2026-08-23؛ معماری تاییدشده با Merge `99dd1cf` وارد `develop` و به PC-B تحویل شد |

آزادشدن این قفل‌ها به معنی مجوز هم‌زمان برای دو Task نبود. وضعیت تاریخی این بخش با
برنامه Sprint دوم پایین تکمیل می‌شود: `MASTER-002` قفل‌های جدید را پس از Merge برنامه
رزرو می‌کند و `CUSTOMER-001` تا Handoff بعدی از آن‌ها استفاده نمی‌کند. در هر لحظه همچنان
فقط یک Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## Handoff رسمی IAM به PC-B

- قرارداد عمومی IAM فقط از `@rubi/contracts` مصرف می‌شود.
- `BranchReference`، `AuthenticatedActor` و `IamPermissionCode` (از جمله
  `iam.audit.read`) قراردادهای عمومی قابل مصرف برای `MASTER-002` هستند؛ Audit فقط با
  actor context عمومی ثبت می‌شود و مدل یا Repository داخلی Audit عمومی نیست.
- دسترسی مستقیم Master Data به جدول‌ها، Prisma modelها یا Repository داخلی IAM ممنوع
  است؛ ارتباط فقط از قرارداد یا سرویس عمومی versioned انجام می‌شود.
- این Handoff قفل‌های Sprint اول را آزاد می‌کند، اما به PC-B یا PC-A قفل Migration یا
  Dependency جدید نمی‌دهد؛ تخصیص بعدی فقط در PR برنامه‌ریزی Sprint دوم انجام می‌شود.

## Sprint 2 — ترتیب اجرا، مرز فایل و Handoff

مرجع جزئیات این Sprint در `docs/tasks/SPRINT-2-PLANNING.md` است. ترتیب الزامی:

1. `IAM-002` روی آخرین `origin/develop` قرارداد Permission عمومی Master Data و Customers
   را منتشر و Seed تکرارپذیر را بدون تغییر Schema/Migration تکمیل می‌کند.
2. پس از Merge و Handoff `IAM-002`، `MASTER-002` وارد فاز Full-Stack می‌شود و تنها مالک
   Migration و Dependency/Lockfile خواهد بود.
3. `CUSTOMER-001` می‌تواند هم‌زمان فقط فاز A بدون Persistence را پیش ببرد؛ تغییر Prisma،
   Migration، manifest، lockfile، root export قرارداد مشترک یا فایل IAM ممنوع است.
4. پس از Merge `MASTER-002` و آزادسازی صریح قفل‌ها، یک Handoff مستقل قفل Migration را
   برای فاز B `CUSTOMER-001` رزرو می‌کند؛ مالکیت خودکار منتقل نمی‌شود.

### `IAM-002` — PC-A

- فایل‌های رزروشده: `packages/contracts/src/iam/**`، export ضروری
  `packages/contracts/src/index.ts`، بخش permission در `packages/database/prisma/seed.ts`،
  تست‌های قرارداد/Seed و اسناد همان Task.
- خروجی: Permission Codeهای versioned حداقل برای read/create/update/status/export در
  Master Data و read/create/update/merge/consent/sensitive-read در Customers.
- این Task مجاز به تغییر `schema.prisma`، Migration، Dependency یا Lockfile نیست.

### `MASTER-002` — PC-B

- فایل‌های رزروشده پس از Handoff IAM-002: مدل‌های Master Data در
  `packages/database/prisma/schema.prisma`، Migration جدید همان Task،
  `apps/api/src/master-data/**`، `apps/web/src/modules/master-data/**`، route موجود،
  `packages/contracts/src/master-data/**`، export هماهنگ‌شده قرارداد و تست/اسناد Task.
- دسترسی مستقیم به `iam_*` یا Repository داخلی IAM ممنوع است؛ actor، branch و permission
  فقط از قرارداد عمومی IAM مصرف می‌شوند. جدول reference مشترک `branches` فقط در محدوده
  lifecycle تاییدشده Master و همراه contract test تغییر می‌کند.
- نرخ ارز authoritative تا حل `DEC-OPEN-004` خارج از Migration قطعی است؛ Currency و سایر
  Catalogها می‌توانند کامل شوند، اما نرخ Draft/Preview منبع گزارش مالی نیست.
- تولید واقعی artifactهای Excel/PDF تا قرارداد Documents/Worker مسدود است؛ MASTER-002
  فقط permission، فیلتر snapshot و قرارداد async export را پایدار می‌کند و فایل ساختگی
  تولید نمی‌کند.
- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` وارد
  `develop` شد؛ Task `DONE` است و مالکیت چهار قفل آن در Handoff مستقل پایان یافت.

### `CUSTOMER-001` — PC-A

- فاز A: `docs/tasks/CUSTOMER-001.md`، UI و stateهای Customers در `apps/web/**`، طراحی
  application/API در `apps/api/src/customers/**` و تست‌های دامنه بدون Persistence واقعی.
- فاز A حق تغییر Prisma، Migration، Dependency/Lockfile، `packages/contracts/src/index.ts`،
  فایل‌های Master Data یا IAM را ندارد و وضعیت Task تا Handoff `IN_PROGRESS` می‌ماند.
- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  ادغام و `DONE/MERGED` شد؛ وضعیت کلی Task تا پایان فاز B `IN_PROGRESS` می‌ماند.
- فاز B با این Handoff فقط در دامنه Customers مجاز است: مدل/Repository/Migration، قرارداد
  عمومی، اتصال واقعی UI، permission/audit و تست Migration را تکمیل می‌کند و حق تغییر فایل
  داخلی IAM یا Master Data را ندارد.
- Master Data فقط از قرارداد عمومی `@rubi/contracts` مصرف می‌شود؛ import یا query مستقیم
  از ساختار داخلی Master Data ممنوع است.
- ذخیره فایل یا مقدار حساس مدارک هویتی تا حل `DEC-OPEN-006` ممنوع است؛ فقط metadata/reference
  غیرحساس طراحی می‌شود. Duplicate auto-merge تا حل `DEC-OPEN-011` ممنوع و فقط candidate
  detection و review دستی طراحی می‌شود.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده: `codex/pc-b-customer-affairs-foundation`.
- هدف فاز A: Foundation امور مشتریان شامل درخواست مشتری، Lead و منبع آشنایی،
  مرحله‌بندی و Qualification قبل از فروش، نیاز سفر و بودجه اولیه، تماس‌ها،
  فعالیت‌ها و Follow-up و پشتیبانی پس از فروش.
- محدوده پشتیبانی شامل Ticket، دسته‌بندی، اولویت، وضعیت، SLA، مسئول، Escalation،
  یادآوری، شکایت، درخواست اصلاح، کنسلی/استرداد، رضایت‌سنجی و بستن Ticket است.
- تبدیل Lead به Customer یا Sales Request و ارتباط Ticket با مشتری، قرارداد، رزرو و
  خدمت فقط Contract پیشنهادی ماژول‌محلی است و هیچ mutation بین‌ماژولی اجرا نمی‌کند.
- مرز فایل آینده PC-B فقط `apps/web/src/modules/customer-affairs/**`، route موجود
  `apps/web/src/app/(crm)/customer-affairs/**`،
  `apps/api/src/customer-affairs/**` برای Domain/Application Port و Contract
  ماژول‌محلی بدون Controller فعال/Repository واقعی،
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` و تست‌های هدفمند همین محدوده است.
- UI فاز A فارسی، RTL، Responsive و هماهنگ با طراحی آبی Rubi است و Loading، Empty،
  Error، Forbidden، Preview، جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی را پوشش می‌دهد.
- Persistence، Prisma، Migration، Seed، Dependency، manifest، Lockfile، قرارداد
  مشترک/root export و داده واقعی مشتری یا PII در فاز A ممنوع است.
- PC-B حق تغییر `packages/database/**`، IAM، Master Data، فایل‌های داخلی Customers
  یا اسناد مرکزی Sprint را ندارد. Backend Persistence فقط پس از Handoff آینده
  Migration مجاز می‌شود.

#### مرز تداخل پس از Merge `CUSTOMER-001` فاز B

- قفل‌های Customer با Merge `7d0a4f4` و این Handoff آزاد می‌شوند؛ PC-B هیچ مالکیتی بر
  Migration، Finance contract یا اسناد مرکزی دریافت نمی‌کند.
- Migration Owner، Finance shared-contract/root export و Central Sprint docs برای
  PC-A/`FINANCE-001` رزرو می‌شوند؛ فعال‌سازی Schema تا عبور از Decision Gate ممنوع است.
- قرارداد اتصال Customer Affairs به Customers/Sales در فاز A فقط proposal داخل
  ماژول و سند Task است؛ انتشار Contract مشترک یا Persistence به Handoff صریح بعدی
  نیاز دارد.

## انتقال اتمیک قفل FINANCE-001 → LEGAL-ENTITY-CONTEXT-001

دلیل انتقال: `FINANCE-001 merged via PR #21 and no active FINANCE-002 task exists`.
ممیزی `origin/develop`، Git history، همه PRهای باز و بسته Finance، Remote Refها و اسناد
مرکزی نشان داد PR #21 با Merge `45c107e` ادغام شده و هیچ FINANCE-002، Branch یا PR فعال
Finance Persistence و هیچ مالک جدیدی برای قفل‌ها وجود ندارد.

### قفل‌های آزادشده از PC-A/FINANCE-001

- Migration Owner: `RELEASED`
- Dependency/Lockfile Owner: `RELEASED`؛ FINANCE-001 هیچ Dependency یا Lockfile تغییر نداد
- Central Sprint status docs: `RELEASED`

Finance shared-contract در `packages/contracts/src/finance/**` مرز دامنه Finance باقی
می‌ماند و به Task Legal Entity منتقل نمی‌شود.

### قفل‌های آزادشده PC-A/LEGAL-ENTITY-CONTEXT-001

مبنای آزادسازی: `DONE/MERGED via PR #24` با Source HEAD
`6f475c03eebc6379fc8be47a48eb0751d58f2d89` و Merge Commit
`b6da5d6300716a189958bc37d31ca195f0304dc5` در `origin/develop`.

- Migration Owner: `RELEASED`
- Legal Entity shared-contract/root export: `RELEASED`
- Central status/docs: `RELEASED`
- Dependency/Lockfile Owner: همچنان `RELEASED`

### سابقه Handoff مشروط قفل‌های MASTER-003 Phase A — انجام‌شده

این بخش سابقه پیش از ادغام است، نه وضعیت جاری قفل‌ها. #25/#26/#27 ادغام شده‌اند؛ وضعیت جاری و آزادسازی نهایی با Merge #41 فقط در ابتدای همین سند تعریف شده است.

این جدول در زمان ثبت، وضعیت آینده را رزرو می‌کرد و انتقال زودهنگام نبود. تا Merge PR #25، مالک
فعلی قفل‌های MASTER-003 همچنان PC-B است. فعال‌سازی قفل‌های CUSTOMER-002B فقط پس از
Merge ترتیبی PR #25، سپس PR #26 و سپس PR #27 و ثبت Handoff نهایی مجاز است.

| قفل                                     | وضعیت فعلی تا Merge PR #25 | رزرو/وضعیت بعدی                                                                           |
| --------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| Migration Owner                         | `ACTIVE — PC-B/MASTER-003` | `RESERVED — PC-A/CUSTOMER-002B`؛ فعال فقط پس از Merge #25 → #26 → #27                     |
| Central Sprint docs                     | `ACTIVE — PC-B/MASTER-003` | `RESERVED — PC-A/CUSTOMER-002B`؛ فعال فقط پس از همان سه Merge و Handoff نهایی             |
| Customer shared-contract/root export    | بدون تغییر توسط MASTER-003 | `RESERVED — PC-A/CUSTOMER-002B`؛ استفاده فقط پس از فعال‌سازی Handoff                      |
| Master Data shared-contract/root export | `ACTIVE — PC-B/MASTER-003` | پس از Merge PR #25 برابر `RELEASED / STABLE`؛ تغییر موازی در MASTER-003E/MASTER-004 ممنوع |
| Dependency/Lockfile Owner               | `RELEASED`                 | `RELEASED`؛ هیچ Dependency یا Lockfile جدیدی در این Handoff ایجاد نمی‌شود                 |

`MASTER-003E-SUPPLIERS` روی Branch مستقل در وضعیت
`PAUSED_FOR_CUSTOMER_002B_MIGRATION_HANDOFF` است و Migration آن تا Handoff بعدی حق
Merge ندارد. `MASTER-004` نیز تا فعال‌شدن قفل بعدی حق تغییر Prisma Schema، Migration،
Seed، Root Contract، Dependency/Lockfile یا اسناد مرکزی را ندارد.

### سابقه رزرو موازی PC-A/CUSTOMER-002A — ادغام‌شده با #26

#### زیرواحد Stacked `MASTER-003B-GEO`

- Branch مستقل `codex/pc-b-master-data-next` از
  `origin/codex/pc-b-master-data-advanced@f0d3b8c411d6e665147958e67193ac52c6ad4397`
  ساخته شده و Parent Branch نباید از این Task تغییر یا Push شود.
- محدوده انحصاری این Slice شامل مدل، Migration افزایشی، Repository/API/Contract،
  Permission/Audit، UI فارسی RTL و تست‌های Country، Province/Region، City، Airport و
  Terminal است؛ هیچ فایل Customers در این Task تغییر نمی‌کند.
- سه قفل فعال Migration، Master Data shared-contract/root export و Central docs همان
  قفل‌های `PC-B/MASTER-003` هستند و قفل جدید یا موازی ایجاد نمی‌شود؛ Dependency/Lockfile
  آزاد می‌ماند و این Slice مجاز به تغییر manifest یا lockfile نیست.
- PR این Slice باید Draft و با Base `codex/pc-b-master-data-advanced` باشد، وابستگی به
  PR #25 را صریح ثبت کند و پیش از Merge والد ادغام نشود.

#### زیرواحد `MASTER-003C-FINANCIAL`

- Branch مستقل `codex/pc-b-master-data-financial` از
  `origin/codex/pc-b-master-data-next@e0e3a5f` ساخته شده و Base PR آن باید همان
  Branch جغرافیا باشد؛ Draft PR #29 ایجاد شد و Parentهای #28 و #25 پیش از آن Merge
  می‌شوند.
- این Slice زیرمجموعه «اطلاعات پایه / مالی و پولی» است و در مسیر
  `/master-data/finance` ارائه می‌شود؛ ماژول مستقل Finance یا مسیر `/finance` نیست.
- محدوده مالکیت Master Data شامل تعریف ارز، تاریخچه نرخ دستی non-authoritative،
  Maker/Checker، بانک، شعبه بانک و روش پرداخت مرجع است. حساب، شبا، کارت، CVV، مانده،
  تسویه، تراکنش و تنظیم واقعی درگاه در مالکیت Finance باقی می‌مانند.
- Migration، Contract، Backend، UI RTL، Test و Documentation این Slice زیر همان سه
  قفل فعال `PC-B/MASTER-003` انجام می‌شود؛ Dependency/Lockfile آزاد و بدون تغییر است.
- هیچ نرخ واقعی یا ساختگی، بانک، شعبه یا روش پرداخت عملیاتی در Seed اضافه نمی‌شود؛
  Seed فقط ارزهای استاندارد موجود را با نام انگلیسی و سیاست نمایش تکمیل می‌کند.

### رزرو موازی PC-A/CUSTOMER-002A

- Task با عنوان `CUSTOMER-002A — Customer Operations Enhancement` و وضعیت
  `PLANNED/RESERVED` برای PC-A رزرو است و باید از آخرین `origin/develop` آغاز شود.
- محدوده مجاز فقط `apps/web/src/modules/customers/**`، صفحات مرتبط با `/customers`،
  `apps/api/src/customers/**` با Schema فعلی، تست‌های اختصاصی Customers و
  `docs/tasks/CUSTOMER-002A.md` است.
- تغییر Prisma Schema یا Migration، Dependency یا Lockfile، Master Data، Legal Entity و
  فایل‌های مرکزی قفل‌شده توسط MASTER-003 ممنوع است.
- تغییر Customer shared-contract یا root export بدون هماهنگی و ثبت مجدد Handoff مجاز
  نیست.
- Migration Lock، Master Data shared-contract/root export و Central Sprint docs همچنان
  در مالکیت PC-B/MASTER-003 باقی می‌مانند. وضعیت Dependency/Lockfile نیز همان وضعیت
  ثبت‌شده در PR #25 است و این رزرو آن را تغییر نمی‌دهد.

محدوده اجرایی MASTER-003 شامل `apps/api/src/master-data/**`،
`apps/web/src/modules/master-data/**`، route `/master-data`، قرارداد عمومی Master Data،
Schema/Migration افزایشی و تست‌های همان قابلیت است. فایل‌های داخلی IAM، Legal Entities،
Customers، Finance، Procurement، Reservations، Integrations و Documents خارج از مالکیت
این Task می‌مانند و فقط از Public Contract یا Port نسخه‌دار مصرف می‌شوند.

### قفل تحویلی PC-B/DOCUMENTS-004-OPERATIONS — Calendar follow-up

- محدوده: فقط `apps/web/src/components/ui/date-picker*` برای جایگزینی Dropdown ماه/سال
  با انتخاب شبکه‌ای هم‌تم Rubi؛ مصرف‌کننده‌های فعلی بدون تغییر API باقی می‌مانند.
- تغییر Dependency/Lockfile، API، Database، Contract و Migration مجاز نیست.
- مقدار ذخیره‌شده همچنان ISO Gregorian باقی می‌ماند؛ سوییچ شمسی/میلادی فقط لایه
  نمایش و انتخاب تاریخ است.
- وضعیت: `RELEASED — PC-B/DOCUMENTS-004-OPERATIONS ready for review`؛ Grid ماه/سال
  بدون تغییر API عمومی یا Dependency تحویل شد.

## قفل‌های آزادشده Sprint دوم

| قفل                             | مالک پیشین                | مبنای آزادسازی                                         |
| ------------------------------- | ------------------------- | ------------------------------------------------------ |
| IAM shared-contract             | PC-A/IAM-002              | Merge `d1f1133`، تست Contract/Seed و Handoff عمومی     |
| Central Sprint planning docs    | PC-A/SPRINT2-PLANNING-001 | Merge `9efb37c` برنامه Sprint دوم                      |
| Migration Owner                 | PC-B/MASTER-002           | Merge `ddfebb3` و Handoff مستقل به CUSTOMER-001        |
| Dependency/Lockfile Owner       | PC-B/MASTER-002           | Merge `ddfebb3` و تثبیت dependency/lockfile            |
| Master shared-contract/export   | PC-B/MASTER-002           | Merge `ddfebb3` و تحویل قرارداد عمومی Master Data      |
| Central Sprint status docs      | PC-B/MASTER-002           | Merge `ddfebb3` و Handoff اسناد مرکزی به PC-A          |
| Migration Owner                 | PC-A/CUSTOMER-001 Phase B | Merge PR #19 با Commit `7d0a4f4` و migration gate موفق |
| Dependency/Lockfile Owner       | PC-A/CUSTOMER-001 Phase B | Merge PR #19 بدون تغییر dependency/lockfile            |
| Customer shared-contract/export | PC-A/CUSTOMER-001 Phase B | `customers.v2`، contract tests و Merge PR #19          |
| Central Sprint status docs      | PC-A/CUSTOMER-001 Phase B | Merge PR #19 و Handoff مستقل به FINANCE-001            |

## قرارداد مالکیت

### CUSTOMER-002B — پیگیری نمایش و تماس (2026-08-31)

- مالک `PC-A`؛ روی همان Branch `codex/pc-a-customer-002b-national-id`.
- وضعیت `READY_FOR_REVIEW`؛ فقط UI/model/test مشتریان و سند همین Task؛ بدون Schema، Migration یا Dependency.
- میان‌بر نمایش شماره برای مشتری و مسافر و لینک تماس فقط پس از Reveal دلیل‌دار و Audit موجود؛ قفل دیگری منتقل نمی‌شود.
- ۱۲۳ تست Web و ۸۱ تست API Customers، lint/typecheck/build وب و diff check پاس شدند.

- یک فایل یا Migration هم‌زمان فقط یک مالک فعال دارد.
- تغییر محدود و ناگزیر در فایل مشترک باید در توضیح ردیف و Commit اعلام شود.
- وضعیت `DONE` یعنی Commit و Push شده و گزارش تست/ریسک در Project Status ثبت شده
  است؛ ادغام‌شدن را تضمین نمی‌کند.
- آزادکردن کار بدون تکمیل با تغییر مالک به `تخصیص‌نیافته` و ثبت دلیل انجام می‌شود.
