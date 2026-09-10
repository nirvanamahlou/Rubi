# وضعیت پروژه

## REPORTING — مجوز اجرای PC-C و Gate مرحله P0-04

- `COMPUTER_ID=PC-C` برای ادامه Reporting در محدوده ماژول‌های Web/API Reporting،
  اسناد `REPORTING-*` و اجرای محلی پورت 3000 مجاز شد. Workspace و Worktree اعلام‌شده
  مقصد به‌ترتیب `F:/Projects/Rubi` و `F:/Projects/Rubi/.worktrees/reporting` هستند؛
  وجود و Writable بودن آن‌ها باید روی خود PC-C تأیید شود.
- مالکیت دائمی تغییر نکرد: PC-A مسئول Backend/grain و PC-B مسئول رابط مرکزی است؛ PC-C
  مجری تفویض‌شده P0 با Branch مستقل است. هیچ قفل Migration، Schema، Seed، Dependency،
  Lockfile یا shared contract به این مجوز منتقل نشد.
- مبنای محلی اعلام‌شده P0-01=`dcf2b2e`، P0-02=`b429b94` و P0-03=`f4f85bc` است، ولی
  این Commitها و Branch ریموت Reporting در fetch مرجع 2026-09-10 قابل مشاهده نبودند.
  بنابراین شروع P0-04 از نظر مجوز آماده است و از نظر Git فقط پس از تأیید محلی Commitها،
  کنترل Working Tree و Push معمولی شاخه PC-C آماده محسوب می‌شود.
- جزئیات Scope، امنیت، پورت و Handoff در
  [REPORTING-PC-C-AUTHORIZATION](tasks/REPORTING-PC-C-AUTHORIZATION.md) ثبت شده است.

## HR-013 — اتصال فرم‌ها و ارجاع بین منابع انسانی و بخش‌های سامانه — آماده ادغام تأییدشده

- مالک محصول اتصال واقعی داده‌ها به فرم‌ها و سپس Push/Merge را صریحاً درخواست کرد. PR #139 شامل لایه ارجاع اولیه و این تکمیل فرم‌هاست؛ ادغام به develop پس از موفقیت CI نسخه نهایی انجام می‌شود. فعال‌سازی اجرای محلی مستقل از این ادغام است.

- شاخه مستقل `codex/pc-b-hr-module-connections` از `origin/develop@e07c0c6`: فرم ارجاع از پرونده HR، صندوق مقصدها در ۱۶ مسیر منو، ۱۳ مجوز دریافت مستقل، فیلتر/صفحه‌بندی/آمار درخواست‌ها و سابقه پاسخ اضافه شد. تعریف بلیط از صندوق رزرواسیون استفاده می‌کند و داشبورد/گزارش‌ها فقط نمای مجاز همین درخواست‌ها هستند.
- درخواست با FK پرونده و کارمند، نسخه مبنا و متن صریحاً قابل اشتراک ذخیره می‌شود؛ کنترل شعبه، مجوز مقصد، منع پاسخ به درخواست خود، idempotency و optimistic concurrency اعمال می‌شوند. پاسخ به فرستنده برمی‌گردد و اعلان پایدار دارد. پرونده محرمانه از صندوق مقصد قابل خواندن نیست.
- فرم کارمند از حساب‌های فعال و آزاد IAM گزینه می‌گیرد و userId واقعی را ذخیره/بازخوانی می‌کند. ارز فرم‌های مالی HR از اطلاعات پایه می‌آید و هنگام ذخیره اعتبارسنجی می‌شود. فایل آرشیو با جست‌وجو و صفحه‌بندی در فرم HR قابل انتخاب است و FK سند با کنترل شعبه ذخیره می‌شود. اسناد هم می‌تواند پرونده کارمند را مستقیم از HR انتخاب کند؛ مرجع و نام پیش از بارگذاری از سرویس عمومی HR تأیید می‌شوند.
- فهرست مشترک کارکنان برای طرف‌حساب مالی، مسئول امور مشتریان و مسئول فرم‌های پایه از جمله میز کار/خرید در دسترس است؛ شناسه از نام جدا می‌ماند و کارکنان غیرفعال/حذف‌شده یا خارج شعبه در انتخاب‌ها نمی‌آیند. مجوز مستقل `hr.directory.read` دسترسی به پرونده محرمانه نمی‌دهد. فرم‌های مقصدی که Backend ذخیره ندارند همچنان پیش‌نمایش بودن را نشان می‌دهند.
- ۴۶۹ تست هدفمند موفق: ۱۵۷ Web، ۱۵۰ API، ۲۶ PostgreSQL مجزا، ۶۳ Contracts و ۷۳ Database. آزمون‌ها رفت‌وبرگشت IAM ↔ HR، صفحه‌بندی و دامنه مجاز، ارز فعال/غیرفعال و سندِ هم‌شعبه/شعبه دیگر را پوشش می‌دهند. جزئیات lint/typecheck/build و handoff در سند Task است.
- پرداخت واقعی، صدور سفر، قطع خودکار دسترسی، تکمیل خرید و اتصال دستگاه اجرا نشده‌اند. بدون Migration، تغییر Dependency، تغییر کاربر واقعی یا جایگزینی اجرای ۳۱۰۰. جزئیات استقرار هماهنگ و موارد باقی‌مانده: `docs/tasks/HR-013-CONNECTIONS.md`.

## DOCUMENTS-008A — اصلاح قطعی رنگ CTA آبی — آماده ادغام تأییدشده

- در اجرای واقعی مشخص شد قانون عمومی و بدون لایه `a { color: inherit }` کلاس Tailwind سفید PR #130 را بازنویسی می‌کند. `PC-B` رنگ سفید را فقط روی دو CTA آبی ارتباطات اسناد در سطح خود لینک تثبیت کرد؛ قانون عمومی لینک‌ها و سایر بخش‌های سامانه تغییر نکردند.
- ۵ تست قراردادی Documents، Web lint/typecheck و Production Build با ۴۰ Route موفق‌اند. نسخه تولیدی روی `3100` اجرا و با Browser بررسی شد: همه CTAهای ماژول‌ها متن و آیکن سفید `rgb(255, 255, 255)` روی آبی `rgb(21, 87, 184)` دارند. بدون Schema/Migration/API/Dependency/Data؛ CI نسخه دقیق شاخه شرط ادغام است.

## HR-PUBLISH-012 — انتشار تأییدشده منابع انسانی برای PC-A

مالک در 2026-09-09 پوش و مرج HR-010/011 را صریحاً تأیید کرد. PRهای ۱۲۵ و ۱۲۷ با حفظ تاریخچه و کد آزموده‌شده به develop جاری متصل می‌شوند؛ فقط تعارض‌های افزایشی اسناد وضعیت حل شد. CI نسخهٔ نهایی هر PR و develop شرط تکمیل انتشار است. سرویس‌های محلی و کار جاری آژانس‌ها تغییر نمی‌کنند. روش دریافت و کنترل نسخه روی PC-A در [راهنمای تحویل](tasks/HR-PUBLISH-012.md) ثبت شده؛ دریافت یا اجرای واقعی روی آن دستگاه بدون شواهد ادعا نمی‌شود.

## HR-011 — اتصال هزینه به مأموریت — آماده بررسی

انتخاب مأموریت مرجع از رکوردهای واقعی مأموریت، با کد، کارمند، مقصد و تاریخ سفر انجام می‌شود؛ شرکت و کارمند انتخاب‌شده محدوده فهرست را تعیین می‌کنند و مأموریت‌های قدیمی هم پشتیبانی می‌شوند. اتصال، تغییر و برداشتن مرجع در هزینه پیش‌نویس ذخیره می‌شود؛ کنترل مجوز، شرکت، کارمند، نسخه و وضعیت نهایی در API برقرار است. ۹۹ تست وب و ۸۰ تست API، شامل ۲۱ تست PostgreSQL، موفق‌اند. بدون Migration، تغییر داده عملیاتی یا Merge؛ جزئیات و راه‌اندازی نسخه 3100 در [HR-011](tasks/HR-011.md).

## HR-010 — دکمه‌های عملیات منابع انسانی — آماده بررسی

دکمه‌های ویرایش و حذف از منوی سه‌نقطه به عملیات مستقیم هر ردیف منتقل شدند؛ همان Button حاشیه‌دار کوچک، آیکن‌ها، فاصله و رنگ حذف اطلاعات پایه استفاده می‌شود. مشاهده فقط در محل‌های قبلی خود باقی است و تأیید حذف منطقی و مجوزها حفظ شده‌اند. ۹۷ تست موجود، lint و typecheck موفق‌اند؛ اتصال مرورگر برای آزمون تصویری برقرار نشد. تغییر فقط در UI منابع انسانی است؛ بدون Migration یا Merge. جزئیات: [HR-010](tasks/HR-010.md).

## DOCUMENTS-008 — سفیدشدن متن دکمه‌های آبی ارتباطات — آماده ادغام تأییدشده

- `PC-B` روی شاخه مستقل `codex/pc-b-documents-button-contrast` متن و آیکن CTAهای آبی «رفتن به بخش مربوطه» را در کارت‌های ارتباطات اسناد، در حالت عادی و Hover، سفید کرد. تغییر فقط Presentation است و رفتار لینک‌ها یا سایر دکمه‌های سامانه را عوض نمی‌کند.
- نسبت کنتراست سفید روی رنگ آبی اصلی `6.80:1` و مطابق WCAG AA است. ۵ تست قراردادی Documents، Web lint/typecheck و Production Build با ۴۰ Route موفق‌اند؛ Schema/Migration/API/Dependency/Data و Runtime تغییر نکرده‌اند. مالک محصول در 2026-09-09 Push و Merge با `develop` را تأیید کرد و CI نسخه دقیق شاخه شرط ادغام است.

## B2B-AGENCIES-001 — ادغام تأییدشده PR #113

- مالک صریحاً Merge و Push را تأیید کرد. `develop@0261b91` با Merge معمولی وارد شاخه همین کار شد؛ نسخه آژانس‌ها در develop با منبع کپی‌شده `fc573ac` یکسان بود و تغییرات جدید فرم، اکسل، پرونده، اسناد و لوگو حفظ شدند. تغییرات سایر ماژول‌ها و سوابق هر دو سمت باقی ماندند.
- ۹۷ تست هدفمند Web، ۵۴ تست B2B شامل پنج PostgreSQL یک‌بارمصرف، lint/typecheck کامل و Build تولیدی همه بسته‌ها با ۴۰ مسیر Web موفق‌اند؛ CI نسخه ترکیبی شرط Merge است. این تحویل تغییر اجرای ۳۱۰۰/۴۱۹۰، داده عملیاتی یا تکمیل تمام PRD را شامل نمی‌شود.

## B2B-AGENCIES-001 — لوگوی آژانس و مشتری سازمانی — آماده بررسی

- کنار نام در سربرگ مشترک پرونده، دکمه بارگذاری/تغییر لوگو و پنجره انتخاب تصویر با پیش‌نمایش، ذخیره و برداشتن لوگو اضافه شد؛ PNG/JPEG تا ۵ مگابایت پذیرفته می‌شود.
- ذخیره از مسیر موجود Master Data و Documents انجام می‌شود؛ هویت، نسخه و همه نقش‌های سازمان حفظ می‌شوند. مجوز نمایش، وضعیت اسکن و اعتبارسنجی دومرحله‌ای آرشیو رعایت می‌شوند؛ نتیجه ناقص پیام موفقیت دریافت نمی‌کند.
- ۹۷ تست هدفمند سازمان‌ها و Client مالک، lint، typecheck و Build موفق‌اند. انتخاب فایل نامعتبر/معتبر، نمایش پس از ذخیره و برداشتن لوگو در مرورگر با سرویس‌های صرفاً آزمایشی بررسی شد. فایل واقعی، داده عملیاتی، schema/API و اجرای مستقل ۳۱۰۰/۴۱۹۰ تغییر نکردند.

## B2B-AGENCIES-001 — نمای ۳۶۰ درجه آژانس — آماده بررسی

- مسیر «مشاهده پرونده» دسکتاپ و موبایل برای آژانس، مشتری سازمانی و نقش دوگانه به یک نمای مشترک با هر هفت کارت Screenshot (524) می‌رود. عنوان اختصاصی آژانس و بازگشت به ابتدای صفحه هنگام ورود/تغییر بخش اضافه شد؛ صفحه از محل اسکرول ردیف فهرست باز نمی‌ماند.
- رندر واقعی کامپوننت برای هر سه نقش، ۶۲ تست موجود سازمان‌ها، lint، typecheck و Build نهایی Web موفق‌اند. داده، API، نقش‌ها، هدر و اجرای مستقل ۳۱۰۰/۴۱۹۰ تغییر نکردند؛ این پیگیری به معنی تکمیل قابلیت‌های باقی‌مانده PRD نیست.

## B2B-AGENCIES-001 — تطبیق PRD و اتصال اسناد — آماده بررسی، پذیرش کامل باقی است

- کل سند ۴۵۱‌بندی بررسی و پوشش ۴۰ نیازمندی عملکردی در `docs/tasks/B2B-AGENCIES-001-PRD-COVERAGE.md` ثبت شد. کل PRD هنوز تکمیل نیست؛ گردش تأیید/نسخه immutable، پروفایل نقش‌محور، کاربران/مسافران سازمان و تولیدکننده مالی باقی‌اند.
- اتصال واقعی آرشیو سازمان، فیلتر انقضا و بارگذاری، انتخاب/اعتبارسنجی سند پیش‌نویس، نمایش دقیق اعتبار هم‌ارز و زمان/نسخه Finance و جلوگیری از تغییر lifecycle بدون تأیید اضافه شد. تصمیم مالک: سقف مستقل هر ارز، بدون FX خودکار؛ مدل چندسیاست ارزی هنوز migration نشده است.
- شاخه مستقل و Draft PR #113 حفظ می‌شوند. پایگاه داده عملیاتی، ۳۱۰۰/۴۱۹۰، schema/migration، مجوزها و ماژول‌های مالک تغییر نمی‌کنند. نتیجه نهایی بررسی‌ها در گزارش Task ثبت می‌شود.
- ۶۲ تست سازمان‌ها، ۴۹ تست B2B و پنج تست PostgreSQL، lint/typecheck و Build هر دو بخش موفق‌اند. آزمون ظاهری جدید به علت timeout اتصال مرورگر انجام نشد. رزرو پیاده‌سازی این پیگیری برای Review آزاد است؛ استقرار و تکمیل کل PRD انجام‌شده محسوب نمی‌شوند.

## CI-002-MULTI-COMPUTER — PC-B — READY_FOR_REVIEW

CI push and stacked-PR base filters now cover `codex/pc-*`, including PC-A/B/C/D and future IDs. Existing main/develop triggers, all four hosted jobs, read-only credentials, disposable PostgreSQL and event/head-branch isolation are retained. Five dependency-free regression tests cover triggers, concurrency and retained safety/quality gates. Contributor IDs and branch instructions are aligned without transferring module ownership or granting account access. No application, migration, dependency, database or runtime changes. Final-head PR CI and post-merge develop CI are required; details: [CI-002](tasks/CI-002-MULTI-COMPUTER.md).

## HEADER-TODAY-001 — PC-B — ready for review

The header displays today's Persian date and weekday using Persian digits and Asia/Tehran, independent of browser timezone and login time. A stable server placeholder prevents a stale build-date/hydration mismatch; minute-aligned updates and focus/visibility refresh handle midnight and sleeping tabs. A separate compact header row preserves existing controls and company colors. No API, database, dependency, user identity or permission changes. Source is current develop@130606d; PR #115 integration and runtime handoff are separately coordinated to retain current HR/Agencies and its database/storage.

Twelve focused tests, Web lint and production build passed. CI and final local runtime verification are required before completion; implementation scope is released for review.

## CONTRACT-OUTPUT-SUMMARY-0908 — COMPLETE_LOCAL

کارت‌های «پرداخت تأییدشده مالی» و «مانده» فقط از قالب مشترک چاپ/PDF قرارداد حذف شدند؛ مبلغ توافق‌شده باقی است. محاسبات مالی، داشبورد، Excel، قیمت مسافران و سایر بخش‌های قرارداد تغییر نکردند. 199 تست Web فروش، lint محدوده، typecheck و Build تولیدی 36 مسیر موفق‌اند. PDF مصنوعی با رندر واقعی و بازبینی تصویری یک‌صفحه‌ای تأیید شد؛ آزمون احرازشده قرارداد واقعی ادعا نمی‌شود.

نسخه روی Web3100 با PID14136 فعال است و API4000 بدون تغییر مانده؛ هر دو پاسخ200 دارند. نسخه قبلی وب در tmp/contract-output-summary-web-before-0908 حفظ شده است. PDFهای دانلودشده قبلی تغییر نمی‌کنند و باید دوباره خروجی گرفت. بدون Migration، تغییر داده/مجوز یا Push؛ رزرو همین کار آزاد شد.

## SALES-EXCEL-0908 — COMPLETE_LOCAL

دکمه خروجی Excel کنار فهرست قراردادها اضافه شد؛ همه نتایج جست‌وجو و وضعیت تسویه اعمال‌شده را با مجوز خروجی و محدوده دسترسی قبلی دریافت می‌کند. فایل واقعی XLSX با تیتر فارسی، تم سرمه‌ای، فیلتر و سربرگ ثابت، تاریخ قابل مرتب‌سازی و مبلغ عددی است. هر قرارداد/ارز یک ردیف دارد؛ مبلغ توافقی، پرداخت تأییدشده و مانده جدا هستند. سقف ۲۰۰۰ قرارداد با خطای صریح، بدون خروجی ناقص؛ سابقه دریافت فقط قالب/نسخه را ثبت می‌کند.

67 تست API فروش و 198 تست Web فروش، lint محدوده، typecheck و Build تولیدی API/Web (36 مسیر) موفق‌اند. فایل مصنوعی با دو خواننده مستقل و پیش‌نمایش بررسی شد؛ بررسی احرازشده قرارداد واقعی ادعا نمی‌شود. Web3100 (PID6036) و API4000 (PID20132) فعال، پاسخ سلامت و فایل جدید 200، خروجی بدون نشست401؛ داده، تنظیمات PDF/مدارک و همه قابلیت‌های تور قبلی محفوظ‌اند. بدون Migration/Seed/مجوز جدید/Push عمومی؛ قفل‌های همین کار آزاد شد. جزئیات: docs/tasks/SALES-EXCEL-0908.md.

## TOUR-PACKAGES-0908 — COMPLETE_LOCAL

PC-A added the real Tour definition/departure tab in Ticket Management. Templates contain route, destination hotel options, registered insurance and included transfer/visa services. Dated departures reference the same published ticket offers used in standalone Sales. Weekly repetition prefills new dates and the old flight details for explicit confirmation/editing; it never changes old tickets or copies reservations. Sales chooses the tour before individual service details, expands its services without a duplicate tour charge, and persists a public versioned departure reference validated by Ticket Catalog.

QA: 22 isolated PostgreSQL/domain tests passed including concurrent tour-versus-standalone capacity and concurrent idempotent departure creation; 58 targeted Sales/Master tests and 291 final affected Web tests passed. Full Web baseline: 900 passed, plus the new tour provenance test. Full API run: 948 passed, 83 optional skipped, one unrelated Customers hook timeout; all 13 tests in that file passed on isolated rerun. Contracts60 and Database73 tests passed; affected lint/typecheck and API/Web production builds passed (36 Web routes). Synthetic browser QA verifies themed selection, hotel city filtering, save, repeat prefill, Sales offer linkage and desktop/mobile width; no live authenticated business mutation is claimed.

All43 migrations passed on an empty DB and the new additive migration passed on a restored backup. After a fresh private backup, only 20260908150000_tour_packages was applied to local rubi; existing record counts and historical migration checksums stayed unchanged. No live seed or permission change. Web3100/API4000 now serve the build; login/pages/health/new bundle HTTP200, protected tour routes401 without a session, credentialed CORS204. Existing Documents keys/storage and PDF browser/font environment preserved. Previous Web build and private backups remain under ignored tmp. Commits fd325c7 / 7844907 / 3949878; local-only, existing remote publication gate unchanged.

## SIDEBAR-LABELS-DOTS-0908 — COMPLETE_LOCAL

PC-A renamed the existing /sales navigation label to قرارداد and /tasks to میز کار per explicit owner request. Original routes, descriptions, content, permissions, compact behavior and group disclosure preserved. Added distinct static Tailwind group-dot colors aligned with reference3200, also visible on mobile. Final typecheck, scoped lint, 15 navigation/foundation tests and production build36 routes passed. Authenticated browser QA verifies new titles, seven rendered colored dots, group toggles, keyboard, compact17 links and mobile. Only verified Web1372 was replaced on3100 with the new integrated production build; existing PDF environment preserved, API/DB untouched. Local commit only, remote destination gate unchanged.

## SIDEBAR-GROUP-TOGGLE-0908 — COMPLETE_LOCAL

Independent accessible group buttons now run on integrated Web3100; whole-sidebar collapse and latest Sales preserved. Scoped lint/typecheck, 15 navigation/foundation tests, 36-route build and authenticated keyboard/desktop/mobile QA passed. Only Web restarted with existing PDF configuration; no API/data/migration change. See docs/tasks/SIDEBAR-GROUP-TOGGLE-0908.md. No remote push.


## SALES-RUNTIME-INTEGRATION-0908 — COMPLETE_LOCAL

User-approved normal local integration now serves latest Sales and both final grouped-sidebar changes, preserving current Customers, Notifications, branding and other CRM work. Source branches and old checkout remain intact. Branch codex/pc-a-sales-runtime-integration-0908, merges bd4fb50/a9223e0, active Web3100/API4000 from local-integration-0906. Production builds36 routes, source lint/typechecks and targeted integration tests pass; health200 and unauthenticated protected routes401. Existing DB has all42 migrations; no migration/seed/reset/data/permission/key change. Earlier SALES-FIRST-PASSENGER-ACQUAINTANCE-0908 activation-pending note is superseded by this activation. Historical migration checksum and index/default-name drift remain documented, not altered. No public push. See docs/tasks/SALES-RUNTIME-INTEGRATION-0908.md.
## SIDEBAR-REFERENCE-SIZE-0908 — منوی هم‌اندازه مرجع

PC-A follow-up on the approved sidebar: sidebar-icons.ts maps the existing 17 routes to outline Lucide symbols matching the3200 reference, without changing icons used elsewhere. Sidebar glyphs17px/stroke1.7, row text12px/semibold, minimum row40px with 3px gaps; group headings14px. All module names, routes, original widths/collapse/tooltips, mobile drawer and business pages preserved. Removed unintended row outlines during visual QA. Scoped lint, typecheck, 11 navigation tests, production build with 34 routes and authenticated browser collapse/expand/mobile checks passed. Final sidebar screenshot verified; final 390px viewport also measured390px without page overflow. Local-only on codex/pc-a-grouped-sidebar-0908; no runtime restart, migration, dependency, data or permissions. Handoff to separate Sales integration task required to retain this follow-up after its runtime cutover. Remote gate unchanged; no push attempted.

## GROUPED-SIDEBAR-0908 — COMPLETE_LOCAL

PC-A applied the owner-approved 7 sidebar groups to actual Web3100, retaining all 17 original names/routes/icons and existing 290/68px collapse, tooltips, mobile DrawerClose, header/branding/notifications/search/breadcrumb and module content. Expanded labels are 15px and headings 13px; labels can wrap and expanded navigation scrolls while footer remains reachable. No prototype pricing or synthetic pages transferred. 11 navigation tests, scoped lint, Web typecheck and production build with 34 routes passed. Authenticated Web3100 browser QA verified links/groups, collapse/expand, tooltips and mobile drawer; desktop screenshot reviewed. Drawer itself has no horizontal overflow; whole dashboard measured 398px at viewport390 after closing, so no claim to fix whole-page overflow. Branch codex/pc-a-grouped-sidebar-0908 from f2cc52a, active pc-b-sync-0908 checkout. No API/data/schema/dependency/permission changes or migration. Local commit only; remote push gate requires destination verification. Sales integration is separately coordinated and preserves this change.


## LOCAL-HR-AGENCIES-009 — آژانس‌ها و منابع انسانی در اجرای مشترک — آماده بررسی

- نسخه منتشرشده آژانس‌ها از `fc573ac` به شاخه مستقل `codex/pc-b-hr-agencies-local` بر پایه HR-008 اضافه شد؛ مسیرهای `/organizations` و `/hr` در همان برنامه پورت ۳۱۰۰ قرار دارند و کد منابع انسانی حفظ شده است.
- ۱۴ تست Web و ۲۸ تست API آژانس‌ها، شامل چهار سناریوی PostgreSQL، به همراه lint/typecheck و Build API موفق‌اند. هیچ Schema/Migration یا قرارداد مشترکی تغییر نکرده است؛ محدودیت‌های تأیید B2B حفظ شده‌اند. دستور اجرا و کنترل تحویل در `docs/tasks/LOCAL-HR-AGENCIES-009.md` ثبت است؛ بدون Merge.

## HR-008 — فرم‌های متصل و خروجی رکوردهای انتخاب‌شده — آماده بررسی

- گزینه‌های ارجاعی فرم‌ها از داده‌های مجاز ثبت‌شده خوانده می‌شوند؛ ورودی‌های تکراری کارمند/شرکت و فیلدهای اضافی شعبه، واحد، مصاحبه و تجهیز حذف شدند. جایگاه واحد در چارت با انتخاب شرکت، سطح و والد تنظیم می‌شود؛ ارتباط متقاضی و فرصت شغلی نیز پایدار و کنترل‌شده است.
- جدول‌ها انتخاب تکی/گروهی و خروجی واقعی Excel/PDF از انتخاب‌ها دارند. دکمه‌های مشاهده غیرضروری و آمار خروجی تکراری حذف شده‌اند؛ رسید هزینه واقعاً در اسناد بایگانی و به رکورد متصل می‌شود.
- ۹۴ تست HR Web، ۷۹ تست HR API شامل ۲۰ سناریوی PostgreSQL و ۲۲ تست Contracts موفق‌اند؛ lint/typecheck/build و آزمون مرورگری فرم‌ها، ذخیره متقاضی، خروجی انتخابی و بارگذاری رسید نیز موفق‌اند. نسخه بر پایه HR-007 روی ۳۱۰۰ و API۴۱۹۰ اجرا می‌شود؛ بدون Migration و بدون Merge. جزئیات در `docs/tasks/HR-008.md` است.

## HR-007 — منابع انسانی به‌روز روی ۳۱۰۰ — آماده بررسی

- `PC-B` روی `codex/pc-b-hr3100-current` و پایه `30d67ec`: پیاده‌سازی HR-005/HR-006 با نسخه فعلی روبی سازگار شد؛ چهار شرکت، هدر، پروفایل، اعلان‌های عمومی و امنیت اسناد حفظ شدند. زنگوله فقط یک پنجره دارد و اعلان‌های HR را از API خودش دریافت می‌کند.
- داده‌های موجود در کپی مستقل `rubi_hr_current_20260908` و فایل‌های اسناد در Snapshot جدا حفظ شدند؛ API۴۰۰۰، کپی یکپارچه قبلی و دیتابیس اصلی HR تغییر نکردند. تمام ۳۵ Migration از قبل اعمال شده‌اند.
- نسخه جدید روی `localhost:3100/hr` با API۴۱۹۰ فعال است. ورود واقعی، چهار شرکت، پروفایل/MFA، زنگوله واحد، شش کارمند، هدایت آدرس قدیمی و بارگذاری مجدد روی هر دو میزبان `localhost` و `127.0.0.1` در پورت ۳۱۰۰ موفق‌اند.
- lint/typecheck/build، آزمون‌های Web/API/Contracts و ۱۹ سناریوی PostgreSQL موفق‌اند؛ ۱۴ مقصد HR، فرم‌ها، خروجی‌های واقعی و نمایش موبایل بررسی شدند. جزئیات و فرمان اجرای همین نسخه در `docs/tasks/HR-007.md` ثبت است. هیچ Merge انجام نشده است.

## MASTER-006 — حذف کانال ایجاد روش پرداخت و چیدمان چپ عملیات — آماده بررسی

- در فرم افزودن روش پرداخت، فیلد «کانال» از UI و ترتیب Focus حذف شد؛ مقدار خنثی `OTHER` برای سازگاری قرارداد فعلی فقط هنگام ایجاد در State داخلی ارسال می‌شود و کانال رکوردهای قبلی در مشاهده/ویرایش باقی است.
- گروه‌های دکمه و عملیات تمام Workspaceهای اطلاعات پایه در سمت چپ فیزیکی صفحه، از جمله چیدمان موبایل، هم‌تراز شدند. قرارداد/API/Schema/Migration، داده و Dependency تغییر نکردند.
- Contracts build، ۳۳۸ تست Master Data در ۴۲ فایل، Web lint/typecheck، Production Build با ۳۶ Route و `git diff --check` موفق‌اند.

## LEGAL-ENTITY-HEADER-003 — رنگ مستقل چهار شرکت و اجرای مشترک PC-A/PC-B

- آماده بررسی روی `codex/pc-b-company-header-colors`؛ نیایش سیر آبی، جهان باستان سورمه‌ای، قسطی رو سبز و جهان آکادمیا بنفش هستند.
- مجوز مالک برای اجرا و توسعه این قابلیت به هر دو کامپیوتر تعلق دارد. تنظیمات کاربران یا مجوزهای IAM گسترش نمی‌یابند؛ قرارداد چهارشرکتی موجود عمومی باقی می‌ماند.
- آماده‌سازی شرکت‌های مفقود به‌صورت فرمان محلی مستقل از Seed مشترک، بدون تغییر رکورد موجود و بدون Migration ارائه می‌شود.
- ۱۳ تست هدفمند، lint/typecheck و Build API/Web موفق‌اند. دو اجرای واقعی روی کپی دیتابیس، تکرارپذیری و فعال‌بودن چهار شرکت را تأیید کرد. Preview روی `http://127.0.0.1:3101` آماده ورود است؛ اجرای قدیمی HR روی 3100/4000 همچنان جدا باقی مانده است. دستور یکسان برای هر دو PC در `docs/tasks/LEGAL-ENTITY-HEADER-003.md` ثبت شد؛ رزرو موقت CSS آزاد است.


## MARKETING-001G — حذف معرفی Hub مارکتینگ — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-marketing-remove-section-intro` بلوک نمایشی شامل عنوان «بخش‌های مارکتینگ» و راهنمای انتخاب کارت را از Hub حذف کرد. فاصله اضافه Wrapper نیز حذف شد و Grid کارت‌ها مستقیماً نمایش داده می‌شود؛ نام دسترس‌پذیر Section بدون متن دیداری حفظ شده است.
- هیچ Backend، Schema/Migration/Seed، API/Contract، Dependency/Lockfile، داده یا فایل مرکزی UI تغییر نکرد. ۱۸ تست هدفمند، Contracts build، Web typecheck/lint و Production Build با ۳۴ Route موفق‌اند و نسخه جدید روی پورت ۳۱۰۰ فعال است.

## LEGAL-ENTITY-BRAND-HEADER-002 — هدر جهان باستان و اطلاعات ورود — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-jahan-bastan-header-identity` تم Header را به Context موجود شرکت فعال متصل کرد. با انتخاب «جهان باستان»، Header بدون تغییر فایل مرکزی درگیر PR #99 به طیف سورمه‌ای تغییر می‌کند و کنترل‌های انتخاب شرکت، جست‌وجو و عملیات Header خوانا می‌مانند؛ سایر Contextها ظاهر پیشین را حفظ می‌کنند.
- نام نمایشی کاربر و ساعت ورود در Header دسکتاپ نمایش داده می‌شود. داده فقط از پاسخ عمومی و احرازشده Login/Refresh می‌آید و در Session Storage همان Tab نگه‌داری می‌شود؛ شناسه کاربر، نام کاربری، Password، Token، Cookie یا PII اضافی ذخیره نمی‌شود.
- ۱۳ تست هدفمند Legal Entity/Auth/Header، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. Preview ایزوله روی پورت ۳۱۰۱ به Login سالم رسید؛ سرویس‌های فعال Task دیگر روی ۳۱۰۰/۴۰۰۰ متوقف یا تغییر داده نشدند. هیچ Backend، Schema/Migration/Seed، API/Contract، Dependency/Lockfile یا داده کاربر تغییر نکرد.
- Follow-up مالک: `legal-entities.v3` گزینه‌های فعال «جهان آکادمیا» و «قسطی رو» را با کدهای `JAHAN_ACADEMIA` و `GHESATI_RO` به قرارداد، API و انتخاب‌گر افزود؛ عنوان مدیران «همه شرکت‌ها» شد و برای شرکت‌های بدون لوگوی تحویلی نشان خنثی نمایش داده می‌شود. Schema/Migration و Dependency/Lockfile تغییر نکردند.
- به‌علت تغییر فعال `packages/database/prisma/seed.ts` در PR #90، Seed مشترک دست‌نخورده ماند. دیتابیس اصلی پورت ۵۵۴۳۲ و سرویس‌های ۳۱۰۰/۴۰۰۰ بدون شرکت جدید حفظ شدند؛ Clone ایزوله Backup روی ۵۵۴۳۳ هر چهار شرکت فعال را دارد و نسخه جدید روی `127.0.0.1:3101` و API آن روی `127.0.0.1:4001` اجرا می‌شود.
- ۲۷ تست هدفمند Contract/API/Web، lint و typecheck بسته‌های متاثر، Production Build API/Web با ۳۴ Route و `git diff --check` موفق‌اند. Web، Health API و CORS احرازشده Preview ایزوله نیز سالم‌اند.
- PR #106 با Merge Commit `10fc98b1dd0f6df7ed006dfc65e952cac1d421dd` وارد `develop` شد؛ هر ۸ Gate ثبت‌شده CI سبز هستند. نسخه Merge‌شده روی `localhost:3100` و API روی `localhost:4000` اجرا می‌شوند و دیتابیس ایزوله محلی PC-B هر چهار شرکت فعال را دارد. قفل قرارداد Legal Entities نیز `RELEASED / STABLE` است.

## NOTIFICATIONS-001 — مرکز اعلان تغییرات — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-global-change-notifications` زنگوله App Shell را به Notification Center سراسری Web تبدیل کرد. هر Mutation موفق `POST/PUT/PATCH/DELETE` به API تنظیم‌شده Rubi پس از موفقیت Response، یک اعلان فارسی شامل نوع عملیات، بخش، زمان و لینک داخلی می‌سازد؛ عملیات ناموفق، Auth، Preview، Search، Validation و Export اعلان تغییر تولید نمی‌کنند.
- اعلان‌ها Payload درخواست یا PII نگه نمی‌دارند و در Browser Profile با سقف ۶۰ رکورد ذخیره می‌شوند. Badge خوانده‌نشده، فهرست RTL، Empty State، خواندن تکی/همه، پاک‌کردن خوانده‌شده‌ها، Sync بین Tabها و fallback امن Storage تکمیل است. اتصال DOCUMENTS-007، اعلان اسناد را از Backend پایدار می‌گیرد و برای آن مسیر اعلان مرورگری تکراری نمی‌سازد.
- PR #104 با همه Gateهای CI سبز روی `develop` ادغام شد. پیگیری DOCUMENTS-007 قرارداد، Persistence و API اعلان‌های اسناد را به همین مرکز اضافه می‌کند؛ Dependency/Lockfile تغییر نکرده است.

## DOCUMENTS-007 — اعتبارسنجی دومرحله‌ای نمایش اسناد — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-documents-step-up-security` دسترسی محدود IAM، Migration و Documents را برای همین Task گرفت؛ مالکیت Sales و PR #90 نزد PC-A دست‌نخورده ماند.
- فرم‌های بارگذاری اصلی و Customer گزینه «نیازمند اعتبارسنجی دومرحله‌ای» دارند. فعال‌سازی Authenticator با تأیید رمز جاری، TOTP واقعی، Secret رمز‌شده با کلید مستقل production، جلوگیری از Replay و قفل موقت تلاش‌های ناموفق انجام می‌شود.
- Preview/Download سند محافظت‌شده به Grant تصادفی و هش‌شده دو دقیقه‌ای محدود است که به همان User، Session، Document و Purpose متصل و اتمیک فقط یک بار مصرف می‌شود. کنترل Scan، Permission، Branch/Domain و Audit سمت Backend fail-closed است.
- پیش‌نمایش تصویر مجاز در Browser به PNG کم‌حجم واترمارک‌شده با نام سامانه، کد آرشیو و زمان تبدیل می‌شود و Headerهای امنیتی پاسخ/صفحه سخت‌تر شده‌اند؛ جلوگیری مطلق از Screenshot ممکن نیست.
- زنگوله مرکزی اکنون داده واقعی `notifications.v1` را نشان می‌دهد: Badge تعداد خوانده‌نشده، فهرست و Deep Link، خواندن تکی/همه و stateهای Loading/Empty/Error فعال‌اند. Upload، ویرایش، آرشیو، بازیابی، تغییر کامل/ناقص، عملیات گروهی و حذف دائمی سند در همان تراکنش تغییر، برای Actor و مالک سند اعلان پایدار و بدون گیرنده تکراری می‌سازند.
- ماژول مستقل Notifications مالک جدول و API است و همه List/Readها با User احراز‌شده Scope می‌شوند؛ Documents فقط Service عمومی ثبت را مصرف می‌کند. Migration افزایشی همراه Rollback و قرارداد عمومی نسخه‌دار اضافه شد و هیچ Dependency/Lockfile یا داده واقعی تغییر نکرد.
- Prisma، lint، typecheck و Production Build کامل با ۳۴ Route موفق است؛ `812` تست API و `633` تست Web سالم پاس شدند. Full Web فقط Assertion قدیمی و تغییرنیافته Customer وابسته به LF/CRLF را قرمز دارد. همه Migrationها روی PostgreSQL 18 خالی و ارتقای نمونه دارای User/Document موفق بود؛ Container موقت حذف شد و هیچ Secret واقعی در Git نیست.
- پیگیری اعلان با ۲۷ تست هدفمند API، ۸ تست هدفمند Web، Contract test و ۴ تست PostgreSQL واقعی Migration پاس شد؛ اجرای کامل API اکنون ۸۱۲ تست پاس و ۷۰ skip دارد.

## MARKETING-001F — اتصال مخاطب هدف پیشنهاد و تخفیف — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-marketing-offer-targets` فیلد اختیاری «مخاطب هدف» را به هر دو فرم «پیشنهاد ویژه» و «کد تخفیف» افزود. کاربر می‌تواند پیشنهاد را عمومی نگه دارد یا یک مشتری/آژانس مشخص را انتخاب کند؛ اگر نوع هدف را انتخاب کند، ذخیره بدون انتخاب رکورد مجاز نیست.
- گزینه‌های مشتری از Client عمومی Customers و فقط میان مشتریان فعال دارای رضایت جاری مارکتینگ دریافت می‌شوند. گزینه‌های آژانس از Client عمومی Master Data Organizations و فقط میان Organizationهای فعال با نقش canonical `AGENCY` می‌آیند. جست‌وجو، Loading/Empty/Error، Retry و لینک مستقیم به بخش مالک رکورد فعال است و Marketing هیچ Query مستقیم یا کپی داده هویتی ندارد.
- هیچ Schema/Migration/Seed، API/Shared Contract، Dependency/Lockfile، Permission یا فایل مرکزی UI تغییر نکرد. Web lint، typecheck، ۲۱ تست هدفمند و Production Build با ۳۴ Route موفق‌اند؛ نسخه متصل به API پورت ۴۰۰۰ جای اجرای قدیمی روی پورت ۳۱۰۰ فعال شد.

## MASTER-005 — خواندن، ثبت و نمایش نتیجه Excel — ادغام‌شده

- جریان موجود `HOTEL_IMPORT_V1` دوباره بررسی شد: Preview و اعتبارسنجی امنیتی قبل از Commit انجام می‌شوند و ثبت ردیف‌ها، ارتباطات مرجع و Audit در تراکنش اتمیک Backend باقی مانده است.
- نقص نمایش پس از ثبت برطرف شد؛ پس از Commit موفق، Workspace به فهرست هتل‌های همان کشور/شهر می‌رود، فیلتر وضعیت روی «همه» قرار می‌گیرد و شمارنده‌های ایجاد، به‌روزرسانی و ردشدن را نمایش می‌دهد.
- تست جدید سرویس، خواندن Workbook، ایجاد رکورد هتل در مقصد و ثبت Audit را پوشش می‌دهد. اجباری‌بودن فیلدهای Catalog اکنون علاوه بر ستارهٔ UI به semantics خود کنترل منتقل می‌شود و Backend نیز همان الزام‌ها را پیش از ثبت اعمال می‌کند. وعده/سرویس، نوع اتاق و امکانات هتل اختیاری‌اند و ثبت هتل بدون آن‌ها با تست سرویس تأیید شده است.
- Fixtureهای محلی و تست‌های فرم با قرارداد فعلی هم‌راستا شدند؛ کد خودکار خدمت در وابستگی تأمین‌کننده/کارگزار استفاده می‌شود و شرکت اتوبوس با سازمان مالک واقعی ثبت می‌شود. ۴۰۵ تست Master Data در API، ۳۳۶ تست Master Data در Web و ۶۶ تست یکپارچگی PostgreSQL، lint، typecheck و Build تولیدی هر دو بسته با ۳۴ Route موفق‌اند؛ Schema/Migration و Customer Import تغییر نکرده‌اند.

## TICKET-CATALOG-004 — حذف فضای خالی میان کارت‌های بلیت — آماده بررسی

- `PC-A` روی Branch مستقل `codex/pc-a-ticket-card-dense-layout` جای‌گذاری Grid کارت‌ها را Dense کرد؛ کارت‌های تک‌مسیر خانه‌های خالی کنار گروه‌های دو ستونه را پر می‌کنند و کارت‌های رفت‌وبرگشت همچنان در یک Wrapper و کنار هم می‌مانند.
- ۹۵/۹۵ تست Ticket Catalog Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. قانون Dense در CSS تولیدشده موجود است و نسخه جدید روی پورت ۳۱۰۰ پاسخ ۲۰۰ دارد. Browser QA خودکار به‌علت خطای ACL ابزار Windows ممکن نشد.
- هیچ Schema/Migration/Seed، API، Contract، Dependency/Lockfile یا ماژول دیگری تغییر نکرد.

## SALES-FIRST-PASSENGER-ACQUAINTANCE-0908 — COMPLETE_CODE / LOCAL_ACTIVATION_PENDING

New natural-person Sales contracts use passenger one as the customer, without a separate primary row or optional linkage checkbox. Agency customers remain independent. Each passenger has a themed registered acquaintance-method selector, persisted through public Customers create/update with existing permissions and optimistic versions. Legacy drafts and saved methods are preserved. 194 Sales tests, scoped lint/typecheck, synthetic browser QA and 36-route production build pass. Web3100/API4000 health is 200, but Web3100 runs the separate customer-direct-contact-0908 worktree; it was not replaced. Coordinate activation with that owner. No migration, IAM, real-data mutation or public push. See docs/tasks/SALES-FIRST-PASSENGER-ACQUAINTANCE-0908.md.

## SALES-PAYMENT-SEARCH-UPLOAD-0908 — COMPLETE_LOCAL

Tracking search in contract payments now opens the main server-backed search across authorized contracts rather than filtering only the current contract's payment rows. It clears old settlement filters/page and shows matching contracts under unchanged payment-read/ownership/branch gates. A prominent receipt section offers saved-payment selection and direct file upload/list/download through public Documents APIs; new payments select their saved ID automatically. Finance state, restricted confidentiality, scan/download and uncertain-upload guards are unchanged. 188 Web Sales and 5 API reference tests, scoped lint/typecheck, synthetic browser QA and 36-route build pass. Web3100 updated; Web/API health 200. No schema/API/IAM/real-data/public-push change. See docs/tasks/SALES-PAYMENT-SEARCH-UPLOAD-0908.md.

## SALES-INSURANCE-SELECTION-0908 — COMPLETE_LOCAL / ISSUANCE_DEFERRED

New Sales contracts select an active registered insurance plan from a themed dropdown instead of free-text description. Public Master Data lookup supports pagination, retry and empty/inactive states. Plan reference/name/record version and insurer selection metadata persist in the existing Sales service and version-1 reservation snapshot with passenger assignments; no issued-policy claim. User explicitly deferred insurer API connection to later Reservations/Integrations work. 185 Sales tests, scoped lint/typecheck, synthetic browser checks and 36-route Web production build pass. Web3100 updated; Web/API health 200. No schema, API, producer, IAM, real-data or public-push change. See docs/tasks/SALES-INSURANCE-SELECTION-0908.md.

## SALES-CONTRACT-ROOM-LOCATION-0908 — COMPLETE_LOCAL

User corrected room-total placement: saved single/double/extra-bed quantities now appear directly below the hotel table in Hotel Information (section 4), absent from Other Services. Passenger room column stays removed; calculations and all other fields unchanged. 34 focused tests, scoped lint/typecheck, 36-route build and all four synthetic PDF pages pass. Web3100 updated; Web/API 200. No schema/API/real-data/public-push change. See docs/tasks/SALES-CONTRACT-ROOM-LOCATION-0908.md.

## SALES-CONTRACT-ROOM-SUMMARY-0908 — COMPLETE_LOCAL

Removed per-passenger room labels from contract print/PDF and added saved purchased room counts (single, double, extra beds and total rooms) to Other Services, independently of passenger accommodation. Hotel Master Data product name, pricing/Finance rules, notices and QR remain unchanged. Older records with no breakdown are explicitly unrecorded, not inferred. 181 Sales tests, scoped lint/typecheck and 36-route Web build pass; all four synthetic PDF pages reviewed (six and agency-six one page, 42 two pages). Web3100 updated; Web/API 200. No schema, API, permissions, business-data or public-push change. See docs/tasks/SALES-CONTRACT-ROOM-SUMMARY-0908.md.

## SALES-CONTRACT-ONLY-FLIGHT-0907 — COMPLETE_LOCAL

Sales now supports a contract-only floating flight independently for outbound/return, alongside actual catalog offers. Version-1 details persist in existing Sales service metadata and the reservation request snapshot, not Ticket Management or inventory selections. Backend validates source exclusivity, route and timing; manual-only confirmation does not call the inventory reservation adapter. Print/PDF and Reservations ticket reopening include the pending-reservation flight. 59 public-contract, 54 API Sales and 181 Web Sales/Reservations tests, scoped lint/typechecks and API/36-route Web builds pass. Synthetic browser and both six-person one-page PDFs verified. Web3100/API4000 and existing database connectivity restored September 8. No migration, dependency, permissions, real records or public push changed. See docs/tasks/SALES-CONTRACT-ONLY-FLIGHT-0907.md.

## SALES-CONTRACT-QR-PLACEHOLDER-0907 — COMPLETE_LOCAL

User explicitly requested a non-working QR now. Print/PDF footer now has a sharp black/white QR at bottom right, with a small pending-server notice and existing contact details at left. QR contains only fixed pending-status text, no personal data, URL or access credential. It is not contract verification and existing copies will need regeneration after secure public-server viewing is implemented. 166 Sales tests, scoped lint/typecheck and 36-route build pass; all five synthetic PDF pages visually reviewed (six-person one-page layout retained). Web3100 updated; Web/API 200. No API, schema, dependency, IAM, real-data or public-push change. See docs/tasks/SALES-CONTRACT-QR-PLACEHOLDER-0907.md.

## SALES-PAYMENT-EVIDENCE-0907 — COMPLETE_LOCAL

Contract payments now accept optional tracking references in both creation and dashboard flows. Authorized dashboard search finds payment references within existing contract ownership/branch scope; payment rows can be filtered and show distinct Finance states. Saved payments expose receipt upload/list/download using public Documents APIs, registered FINANCE receipts, restricted confidentiality and unchanged scan/permission gates. Upload does not confirm payment; search is not a bank inquiry. 164 Web Sales tests, 62 API Sales/Documents tests, scoped lint/typechecks and API/Web production builds pass; synthetic browser workflow verified. Web3100/API4000 return 200; unauthenticated contract/document APIs return 401. No migration, grants, real-data upload or public push. See docs/tasks/SALES-PAYMENT-EVIDENCE-0907.md.

## SALES-CONTRACT-THEME-ROOM-0907 — COMPLETE_LOCAL

Hotel section now uses the selected room-type name from the existing public Master Data lookup, not passenger DBL/child accommodation labels. Updated reference-style Persian/navy header, left number badges, pale table headings, three-column financial summary, signatures and contact footer. User-requested phone/email apply only to Niyayesh issuer; prior terms, passenger/currency totals and finance logic are preserved. B Nazanin bold rendering corrected in print and PDF. 161 Sales tests, scoped lint/typecheck and 36-route build pass; all five final synthetic PDF pages inspected (2/6/agency-6: one page; 42: two). Web3100 updated; Web/API 200. QR remains deferred to server-hosted contract viewing. No migration/API/IAM/data change or public push. See docs/tasks/SALES-CONTRACT-THEME-ROOM-0907.md.

## SALES-CONTRACT-REFERENCE-THEME-0907 — THEME_COMPLETE_LOCAL / QR_DEFERRED_TO_SERVER

Contract print/PDF follows the supplied navy-header, teal-rule and soft-gray-table reference theme without changing fields, section order or business calculations. B Nazanin, English monetary digits, saved passenger amounts and notices remain. 159 Sales tests plus final 17 print tests, scoped lint/typecheck and 36-route production build pass; all five pages of four synthetic PDFs visually inspected (2/6/agency-6 passengers: one page; 42: two pages). Web3100 updated and Web/API health 200. User wants QR to open this specific contract online, like file viewing, after future server deployment. No public viewer/verification capability or QR is claimed or added now. No migration, API/IAM/data change or public push. See docs/tasks/SALES-CONTRACT-REFERENCE-THEME-0907.md.

## SALES-PAYMENT-CURRENCY-0907 — COMPLETE_LOCAL

Replaced the remaining free-text currency in saved-contract dashboard payments with a button-only themed registered-currency dropdown. Active references load across pages; failures/empty lists block submission with retry, and arbitrary codes cannot be entered. Existing new-contract currency selections remain unchanged. 158 Sales Web tests, scoped lint/typecheck and 36-route production build pass; synthetic actual-component browser tests cover retry, disabled submit, USD selection, inactive filtering and retention. Local Web3100 updated; API/database unchanged, no real payment created or public push. See docs/tasks/SALES-PAYMENT-CURRENCY-0907.md.

## RESERVATIONS-TICKET-ACCESS-0907 — COMPLETE_LOCAL

Reservations contract cards now reopen saved passenger ticket snapshots, select one passenger or print all (one A4 page each), and offer browser Save as PDF. Contract-number search and paging make requests older than the latest 100 accessible within existing permission/branch scope. Sales exposes a presentation-only public ticket entry; no live inventory reconstruction or private-module queries. 162 Web tests, 15 API tests, scoped lint/typechecks, API/Web production builds, synthetic interactive browser and both rendered PDF pages passed. Five unrelated PostgreSQL hotel-purchase tests skipped without their dedicated test database; an empty-authorized-scope history query was independently checked on local PostgreSQL without business-row access. Local Web3100/API4000 updated. Existing templates remain DRAFT/not issued; no direct ticket-PDF download endpoint or real issuance added. No migration/data/IAM/public push. See docs/tasks/RESERVATIONS-TICKET-ACCESS-0907.md.

## SALES-TICKET-THEME-0907 — COMPLETE_LOCAL

Passenger ticket preview/print uses contract blue, larger agency branding and no payment section. Recognized test flights show a test-airline icon plus explicitly sample-only e-ticket 7143/RLOC DEMO01; actual issuance remains blank and all copies remain DRAFT. 153 Sales tests plus seven final template/visual checks, scoped lint/typecheck/production build pass. Chromium screenshot verified; Web3100 active, Web/API 200. No schema/API/IAM/real-data changes or public push. See docs/tasks/SALES-TICKET-THEME-0907.md.

## SALES-OUTPUT-PAGINATION-0907 — COMPLETE_LOCAL

Contract print and PDF now fit standard 5–6 passenger examples (including agency, hotel, return flight and IRR/USD) on one A4 page. Wider room/currency columns and compact branding/section badges preserve legibility. All rows continue across pages with repeated headings, grouped totals and page counters; 42/100-person samples use 2/3 pages. Eight final pages visually checked, row/page counts verified, 150 Sales Web tests plus scoped lint/typecheck/production build pass. Web3100 active and Web/API health 200. No migration, API, IAM, real data change or public push; scoped locks released. See docs/tasks/SALES-OUTPUT-PAGINATION-0907.md.

## SALES-PEOPLE-CORRECTION-0907 — COMPLETE_LOCAL

Current national-ID corrections no longer require restoring an earlier attempted ID. Confirmation reads but never mutates the previous registration, then adopts/updates the accessible exact current-ID profile using existing permissions/version. Duplicate creates resolve on the same confirmation; blank optional entries preserve existing details. Optional Customers matchByNationalId retains strict legacy default, branch scope and sensitive-read audit. 249 Web + final 25 focused, 93 API Customers, 48 Contracts tests, scoped lint/typechecks and API/Web production builds passed. Local Web3100/API4000 updated and healthy; no migration/IAM/real-data walkthrough/public push. See docs/tasks/SALES-PEOPLE-CORRECTION-0907.md.

## SALES-PEOPLE-RECOVERY-0907 — COMPLETE_LOCAL

Sales people confirmation now separates definite rejection from unknown creation/contact outcomes. The same confirmation action recovers an exact existing identity or refreshes a known saved profile, preserving successful records/contact checkpoints. New public Customers registration lookup is POST-only, branch-scoped and sensitive-read permission/audit protected; no fuzzy identity binding or blind changed-national-ID retry. 243 combined Web + final 8 client tests, 91 Customers API + final 16 permission tests, 48 Contracts tests, scoped lint/typechecks and API/Web production builds pass. Local services updated; no migration/seed/IAM or real-customer walkthrough. See docs/tasks/SALES-PEOPLE-RECOVERY-0907.md.

## SALES-OUTPUT-TERMS-0907 — COMPLETE_LOCAL

Three user-supplied notices (similar hotel substitution, cashier receipt requirement, and overseas contract-conditions acceptance statement) are displayed below signatures and above Nystkt.ir in print/PDF. Persian spacing/spelling normalized without added terms; no legal review or automated consent/receipt-state change. Fourteen focused tests, scoped lint and production TypeScript/build passed. One-page normal and three-page large samples visually checked. Local Web3100 updated; API/database unchanged. No public push. See docs/tasks/SALES-OUTPUT-TERMS-0907.md.

## SALES-OUTPUT-HOTEL-CURRENCY-0907 — COMPLETE_LOCAL

Contract print/PDF now shows Nystkt.ir, hotel Latin name and website from public Master Data, explicit guest accommodation categories, separate IRR and foreign amount columns, and exact passenger-summed totals per currency. Existing missing data remains unrecorded, not inferred. Additive Sales passenger accommodation migration is live locally after empty/seed-twice and backup-restore gates; old records/history preserved. 132 Web Sales / 45 API Sales / 48 Contracts tests, scoped lint/typechecks and production builds passed. All four synthetic PDF pages inspected. Web3100/API4000 return 200; authenticated real-customer walkthrough not performed. Local-only; scoped ownership released. See docs/tasks/SALES-OUTPUT-HOTEL-CURRENCY-0907.md.

## SALES-OUTPUT-CLEANUP-0907 — COMPLETE_LOCAL

Removed the user-marked operator notes under signatures and technical generation footer from customer print/PDF, preserving company/signatures and all amounts. Operator disclosures and browser header/footer instructions remain in the preview dialog. Eleven tests, scoped lint and Web production TypeScript/build passed; all four synthetic PDF pages inspected. Web3100 restarted; API/database unchanged. Local-only; scoped locks released. See docs/tasks/SALES-OUTPUT-CLEANUP-0907.md.

## SALES-CUSTOMER-PRICING-0907 — COMPLETE_LOCAL — 2026-09-07

Individual agreed package totals per passenger/currency are persisted with exact reconciliation, without inferred age allocation. Direct PDF download is beside Print; amounts use English digits while Persian prose retains B Nazanin. Latest local Web3100/API4000 are active. 129 Web Sales / 44 API Sales / 47 Contracts tests, scoped lint, typechecks and production builds passed. Additive migration passed empty/seed-twice and backup-restore gates; operational historical checksums/business counts unchanged. No historical rebaseline, IAM grant, producer modification or public push. Legacy per-passenger amounts remain unrecorded; no fabrication. Task-specific locks released. Details: docs/tasks/SALES-CUSTOMER-PRICING-0907.md.

## رنگ خروجی و ویرایش مشتری از فروش — 2026-09-07 — تحویل جزئی در لوکال

- آبی جدول‌ها و کارت‌های خروجی قرارداد به آبی تیره هماهنگ شد؛ ب‌نازنین و جمع مالی قبلی حفظ شدند و همه صفحات PDF آزمایشی بازبینی شدند.
- انتخاب شخص موجود، اطلاعات مجاز را در جدول باز می‌کند و فوکوس به ردیف قابل ویرایش می‌رود. اصلاح نام، هویت، تولد، پاسپورت و تماس با API عمومی مشتریان، مجوزهای قبلی و کنترل نسخه ذخیره می‌شود. مقادیر ماسک‌شده دست‌نخورده ارسال نمی‌شوند؛ تماس قبلی حذف نمی‌شود و مشتری همان مسافر اول همگام می‌ماند.
- ۲۳۶ تست وب و ۱۴ تست نهایی مدل افراد، lint، typecheck و Build تولیدی ۳۶ مسیر موفق‌اند. آزمون تعاملی داده مصنوعی با CSS نهایی موفق؛ وب۳۱۰۰ فعال، ورود و سلامت API۲۰۰ و حفاظت فرم۳۰۷ است. بررسی احرازشده یا تغییر داده واقعی انجام نشد.
- بخش مبلغ هر مسافر هنوز انجام نشده: انتخاب ورود قیمت روز/توافقی بر اساس رده سنی یا فردی در انتظار پاسخ است. هیچ تقسیم فرضی جمع یا تخفیف سنی ساختگی اضافه نشده. بدون Migration، تغییر API/مجوز یا Push عمومی؛ جزئیات: docs/tasks/SALES-CUSTOMER-PRICING-0907.md.

## خروجی قرارداد و اصلاح عرض فرم — 2026-09-07 — فعال در لوکال

- عنوان «قرارداد جدید» در راهنمای بالای صفحه تعریف شد؛ پیام «در دسترس نیست» ناشی از نبود عنوان مسیر بود، نه قطع سرور. ستون فرم از عرض حداقل جدول مستقل شد و پیمایش افقی داخل جدول می‌ماند.
- پس از تأیید قرارداد و در داشبورد، «خروجی قرارداد / PDF» اطلاعات ذخیره‌شده را در قالب شش‌بخشی با ب‌نازنین نشان می‌دهد. دریافت فایل با «چاپ / ذخیره PDF» مرورگر است، نه دانلود خودکار یا ارسال به مشتری. مبلغ توافق‌شده و پرداخت تأییدشده مالی مصرف می‌شوند؛ قیمت خرید/پیشنهاد و کمیسیون فرضی وارد جمع نمی‌شوند.
- این نسخه کپی اطلاعات قرارداد است، نه رسید پرداخت، فاکتور مالیاتی یا صدور رسمی بایگانی‌شده. نام شرکت از شرکت فعال هنگام تهیه خروجی است و این محدودیت صریح نمایش داده می‌شود. سیاست صدور رسمی Legal Entity همچنان بدون تغییر است.
- ۲۳۳ تست وب، ۴۴ تست API فروش، ۴۱ تست قرارداد عمومی، lint محدوده، typecheck و Build وب/API موفق‌اند. پیش‌نمایش و چاپ در iframe و عرض فرم دسکتاپ/موبایل با داده مصنوعی آزموده شد؛ PDF نمونه عادی یک صفحه و ۴۲ مسافر سه صفحه است. ۳۱۰۰/۴۰۰۰ فعال و حفاظت ورود برقرار؛ بررسی احرازشده روی قرارداد واقعی ادعا نمی‌شود.
- بدون Migration، تغییر مجوز، داده واقعی آزمایشی یا انتشار عمومی. جزئیات و محدودیت‌ها: docs/tasks/SALES-OUTPUT-LAYOUT-0907.md.

## تقویم مستقیم جدول مشتری و مسافر — 2026-09-06 — فعال در لوکال

- پنجرهٔ واسط تاریخ حذف شد؛ تقویم هم‌تم مستقیم کنار خانهٔ تاریخ تولد یا انقضای پاسپورت باز می‌شود. سوییچ شمسی/میلادی داخل تقویم است و فرم اصلی با Escape بسته نمی‌شود. همین جدول در فروش نیز مصرف می‌شود؛ مقدار ISO، ردیف‌ها و قواعد ویرایش حفظ شدند.
- ۲۲۲ تست هدفمند وب، lint، typecheck و Build تولیدی ۳۶ مسیر موفق‌اند. آزمون تعاملی با دادهٔ مصنوعی و CSS نهایی، انتخاب سال/ماه/روز، حفظ فرم، کلیک بیرون، فوکوس، انقضای مستقل و محدودهٔ موبایل را تأیید کرد. وب۳۱۰۰ و API۴۰۰۰ پاسخ موفق دارند؛ بررسی احرازشده و تغییر دادهٔ واقعی انجام نشد.
- بدون تغییر API، دیتابیس، مجوز، وابستگی یا انتشار عمومی؛ نسخهٔ قبلی وب محفوظ است. جزئیات: docs/tasks/CUSTOMER-INLINE-CALENDAR-0906.md.

## اتصال مشتری به مسافر اول و انقضای پاسپورت — 2026-09-06 — فعال در لوکال

- تیک «این مشتری مسافر اول هم هست» اطلاعات مشتری را بدون افزایش تعداد در ردیف اول قرار می‌دهد؛ ویرایش‌ها همگام می‌مانند و برداشتن تیک ردیف قبلی را بازمی‌گرداند. جایگزینی ردیف پُر نیازمند تأیید است و مشتری حقوقی مسافر نمی‌شود.
- شماره و تاریخ انقضای پاسپورت از جدول قرارداد در پرونده Customers ذخیره می‌شوند. شماره همچنان رمزنگاری/ماسک می‌شود و خواندن اطلاعات حساس مجوز و Audit قبلی را دارد. انقضا ستون nullable از نوع Date با قرارداد اختیاری سازگار است؛ اطلاعات خام وارد localStorage فروش نمی‌شود.
- ۲۱۱ تست مشترک Web و ۱۱ تست نهایی مدل افراد، ۸۸ تست API مشتریان، ۴۱ Contracts و ۷۱ Database، lint/typecheck و Build وب/API موفق‌اند. ۳۸ Migration و Seed دوبار روی دیتابیس خالی، ارتقای نسخه بکاپ و تست ذخیره واقعی/نسخه/شعبه موفق بودند. پس از بکاپ جدید، تنها Migration افزایشی روی لوکال اعمال شد؛ شمار داده‌های قبلی و checksumهای تاریخی حفظ شدند.
- وب ۳۱۰۰ و API۴۰۰۰ فعال‌اند؛ پاسخ ورود، فایل جدید و سلامت API برابر ۲۰۰ و منع دسترسی بدون ورود برقرار است. بدون تغییر مجوز، Seed عملیاتی یا انتشار عمومی؛ بررسی بصری احرازشده انجام نشده است. جزئیات: docs/tasks/SALES-PASSPORT-EXPIRY-0906.md.

## جدول مشترک مشتری و مسافر در فروش — 2026-09-06 — فعال در لوکال

- مرحله افراد قرارداد از همان جدول افزودن مشتریان استفاده می‌کند؛ تمام ردیف‌های مسافر مطابق تعداد مرحله اول یکجا باز می‌شوند. فقط افزودن نوزاد در این مرحله ممکن است و تعداد بزرگسال/کودک از مرحله اول تغییر می‌کند. مشتری حقوقی و «مشتری همان مسافر اول» حفظ شدند.
- اعتبارسنجی همه ردیف‌ها پیش از ثبت انجام می‌شود؛ پرونده‌های موجود دوباره ساخته نمی‌شوند و نتیجه نامطمئن ثبت نیازمند بررسی است. اطلاعات خام ورودی در حافظه فرم است، نه پیش‌نویس localStorage. مرز عمومی مشتریان، کنترل شعبه/مجوز، ظرفیت و قواعد مالی حفظ شدند.
- ۲۰۸ تست مشترک فروش/مشتریان و ۷ تست نهایی جدول مشترک، lint محدوده، typecheck و Build تولیدی ۳۶ مسیر موفق‌اند. وب ۳۱۰۰ و فایل جدید پاسخ ۲۰۰ دارند؛ API بدون تغییر سالم است. بدون Migration، تغییر مجوز، داده واقعی آزمایشی یا انتشار عمومی. بررسی بصری احرازشده انجام نشده؛ جزئیات در docs/tasks/SALES-PEOPLE-SHEET-0906.md.

## یکسان‌سازی تم داشبورد فروش — 2026-09-06 — فعال در لوکال

- چهار کارت شاخص فروش با گرادیان، تایپوگرافی و فاصله‌گذاری بخش مشتریان/مسافران هماهنگ شد؛ اعداد و محاسبات قبلی حفظ شدند. منوی وضعیت تسویه، روش پرداخت، بانک چک و مسافر پیش‌نمایش بلیت از Select آماده برنامه با پشتیبانی RTL و کیبورد استفاده می‌کنند.
- ۹۹ تست فروش، lint محدوده، typecheck وب و Build تولیدی ۳۶ مسیر موفق بود. نسخه روی ۳۱۰۰ فعال؛ فایل جدید و ورود پاسخ ۲۰۰، حفاظت ورود داشبورد پاسخ ۳۰۷ و سرور پاسخ سلامت ۲۰۰ دارند. بدون تغییر API، پایگاه داده، مجوز یا انتشار عمومی؛ بررسی بصری احرازشده ادعا نمی‌شود.

## بازطراحی برنامه پرداخت قرارداد — 2026-09-06 — فعال در لوکال

- کارت‌های فشرده و شماره‌دار، تعداد پرداخت و چک، عنوان مستقل مبلغ/ارز/روش/سررسید، اطلاعات چک در بخش مشخص و حذف با تأیید اضافه شد. داده چک پیش‌نویس در ورودی‌های کنترل‌شده نمایش داده می‌شود؛ تغییر روش به غیرچک، داده غیرفعال چک را از درخواست حذف می‌کند تا اعتبارسنجی فعلی سرور حفظ شود.
- ۹۶ تست فروش، lint محدوده، typecheck نهایی و Build تولیدی ۳۶ مسیر پاس شدند. پنج تست جزء جدید پس از اصلاح نوع فیلد اختیاری چک تکرار و موفق شدند. نسخه روی ۳۱۰۰ فعال و پاسخ صفحه ورود و فایل جدید ۲۰۰ است. API، پایگاه داده، مجوزها و قواعد تأیید مالی تغییر نکرده‌اند. نسخه قبلی در tmp/payment-layout-web-before-0906 نگهداری شد؛ بدون انتشار عمومی یا ادعای بررسی بصری احرازشده.

## ارز و ترانسفر همراه قرارداد — 2026-09-06 — فعال در لوکال

- ارز قیمت خدمات و پرداخت‌ها از فهرست فعال اطلاعات پایه با جست‌وجو انتخاب می‌شود؛ منوی روش پرداخت و مراجع فرم با تم برنامه یکسان شد. ارز نامعتبر یا غیرفعال در فرم جدید پذیرفته نمی‌شود.
- ترانسفر رفت/برگشت در قرارداد جدید خدمت همراه بدون هزینه اضافه است؛ ردیف قیمت ندارد، سرور قیمت اضافه برای آن را رد می‌کند و جهت آن در خروجی بلیت و اطلاعات تحویل رزرواسیون باقی می‌ماند. قیمت قراردادهای قدیمی، محاسبه هتل و تسویه بر اساس تأیید Finance تغییر نکرد.
- ۴۱ تست Contracts، ۹۱ تست Sales Web، ۴۴ تست API فروش/رزرواسیون، همه ۱۱ بررسی lint/typecheck و وابستگی، Build سرور و Build وب با ۳۶ مسیر پاس شدند؛ ۵ تست اختیاری دیتابیس اجرا نشدند. نسخه جدید روی ۳۱۰۰/۴۰۰۰ فعال است و پاسخ HTTP و فایل نسخه جدید تأیید شد. بدون Migration، تغییر مجوز یا انتشار عمومی؛ بررسی بصری احرازشده ادعا نمی‌شود. جزئیات: docs/tasks/SALES-CURRENCY-INCLUDED-TRANSFER-0906.md.

## ورودی عددی تعداد مسافر — 2026-09-06

- منوهای تعداد بزرگسال، کودک و نوزاد در قرارداد جدید با ورودی مستقیم عدد صحیح جایگزین شدند؛ انتخاب مقدار با کلیک، پاک‌کردن/تایپ مجدد و واحد «نفر» حفظ است. عدد منفی/اعشاری رد می‌شود و محدودیت منوی ۰ تا ۳۰ حذف شده؛ منطق ظرفیت صندلی و ترکیب سنی تغییر نکرد.
- ۸۵ تست فروش، lint محدوده، typecheck وب و Build تولیدی ۳۶ مسیر پاس شدند. نسخه جدید روی ۳۱۰۰ فعال و وب/API پاسخ موفق دارند. تغییر فقط Web است؛ بدون Migration، تغییر مجوز یا انتشار عمومی. بررسی بصری احرازشده ادعا نمی‌شود.

## قیمت‌گذاری فروش و خرید هتل — 2026-09-06 — فعال در لوکال

- پیگیری با تأیید کاربر: ادغام معمولی e31b8d1 سه تغییر فروش تا 3d3095e را با قیمت‌گذاری ترکیب کرد؛ هر دو تاریخچه و Handoff حفظ شدند. شاخه مالک، main/develop و ریموت تغییر نکردند. نسخه مستقل هزینه خرید و چیدمان در یک پاسخ عمومی بازمی‌گردند و Snapshot قرارداد ثابت می‌ماند.
- بررسی ترکیبی: ۷۳۳ تست Web، ۸۸۳ تست API، ۳۸ تست Contracts، ۷۱ تست Database، lint/typecheck و Build وب/API موفق؛ ۳۷ Migration روی دیتابیس تازه، Seed دوگانه و ۴۶ تست واقعی دامنه/ظرفیت/رزرواسیون پاس شدند. اجرای اولیه Seed زیر بار هم‌زمان timeout شد؛ تکرار مستقل دوگانه موفق بود.
- ارتقا روی نسخه بازیابی‌شده بکاپ و سپس دیتابیس اصلی با بکاپ تازه موفق شد؛ فقط Migration افزایشی قیمت‌گذاری اعمال شد و شمار داده‌های قبلی و checksumهای تاریخی ثابت ماندند. نسخه کامل اکنون روی ۳۱۰۰ و API۴۰۰۰ فعال است؛ پاسخ وب/سرور، CORS، منع ثبت بدون ورود و دسترسی مؤثر خواندن/ثبت خرید هتل برای Ramtin تأیید شدند. هیچ Seed عملیاتی، مجوز اضافی یا ثبت قرارداد واقعی برای آزمایش انجام نشد.
- بندهای توقف اولیه در ادامه، سابقه پیش از این ادغام موفق‌اند و دیگر مانع فعال‌سازی نیستند. بررسی تصویری احرازشده ادعا نمی‌شود.

- قیمت روز فروش و مبلغ توافقی هر خدمت/ارز جدا شده‌اند؛ ورودی مبلغ سه‌رقمی، قیمت هر شب/کل اقامت با حفظ جمع دقیق و تخفیف خودکار فروشنده پیاده شد. ثبت هزینه خرید هتل در رزرواسیون نسخه‌دار و دارای کنترل شعبه، مجوز اختصاصی، ثبت تکرارپذیر و سابقه تغییرات است. مانده مالی همچنان فقط بر اساس پرداخت تأییدشده محاسبه می‌شود.
- lint/typecheck، ۷۲۷ تست Web و ۳ تست نهایی پنل قیمت، ۸۸۲ تست API، ۳۸ تست Contracts، ۷۱ تست Database و Build وب/API پاس شدند. ۳۵ Migration روی دیتابیس خالی، Seed دوگانه و ۳۷ تست هدفمند دامنه/ذخیره واقعی موفق بودند؛ ۷۸ تست اختیاری API اجرا نشدند.
- پیش‌بررسی عملیاتی دو Migration تازه ظرفیت بلیت و چیدمان رزرواسیون از شاخه فروش را یافت که در این پایه یکپارچه نیستند؛ هیچ Migration قیمت‌گذاری یا تعویض API انجام نشد. نسخه قبلی وب روی ۳۱۰۰ بازگردانده شد و API۴۰۰۰ در دسترس است. فعال‌سازی نیازمند هماهنگی و یکپارچه‌سازی با کار مالک آن شاخه است؛ بدون Push عمومی یا ادعای بررسی تصویری احرازشده.
- طبق تأیید صریح کاربر، فقط مجوز ثبت خرید هتل به Ramtin با نقش اختصاصی اضافه شد؛ بکاپ و Audit ثبت و عدم تغییر سایر کاربران/نقش‌های مشترک کنترل شد. جزئیات: docs/tasks/HOTEL-SALES-PRICING-0906.md.

## ورود جدولی مشتری و مسافران — 2026-09-06

- فرم ایجاد شخص در Customer 360 به جدول قابل ویرایش تبدیل شد؛ مدارک هر ردیف جدا باز می‌شوند. اعتبارسنجی نام خالی و کد ملی تکراری پیش از ثبت، تأیید حذف/تغییر شخص و تقویم سلولی اضافه شد. اتصال عمومی Customers/Documents و حفاظت اطلاعات محفوظ است؛ API و دیتابیس تغییر نکردند.
- روی شاخه مستقل codex/pc-a-customer-entry-sheet-0906: ۱۰۰ تست مشتریان، همه ۷۲۵ تست Web، lint بخش مشتریان، typecheck و Build تولیدی ۳۶ مسیر پاس شدند. وب جدید ۳۱۰۰ و API۴۰۰۰ پاسخ موفق دارند؛ بررسی احرازشده تصویری و ثبت مشتری واقعی ادعا نمی‌شود. جزئیات: docs/tasks/CUSTOMER-ENTRY-SHEET-0906.md.

## فعال‌شدن نسخه یکپارچه محلی — 2026-09-06

- ارتقا روی کپی بازیابی‌شده بکاپ موفق بود؛ پس از بکاپ تازه، فقط Migration افزایشی آژانس‌ها روی rubi اجرا شد. checksumهای قبلی و شمار مشتری/کاربر/مدرک حفظ شدند؛ هیچ reset یا Seed عملیاتی انجام نشد.
- وب ۳۱۰۰ و API۴۰۰۰ اکنون از شاخه یکپارچه اجرا می‌شوند و پاسخ HTTP موفق دارند. کلید و مسیر مدارک قبلی محفوظ است. ریشه تاریخی اختلاف checksum همچنان ثبت است، اما آزمون ارتقای کپی مانع اجرای محلی را رفع کرد.

## یکپارچه‌سازی محلی — 2026-09-06

- نسخه آخر فروش، develop، آژانس، مارکتینگ، منابع انسانی، تقویم و بازیابی پاسپورت در شاخه مستقل codex/pc-a-local-integration-0906 ترکیب شدند. شاخه‌های اصلی، main/develop و ریموت تغییر نکردند.
- lint، typecheck، تست کامل و Build موفق؛ ۳۴ Migration روی دیتابیس خالی و Seed دوگانه موفق. جزئیات و آزمون‌های اجرا‌نشده در docs/tasks/LOCAL-INTEGRATION-0906.md ثبت است.
- اجرای نسخه جدید متوقف است: دو checksum قدیمی در دیتابیس rubi با تاریخچه Git تطبیق ندارند. بکاپ محلی تهیه شد؛ Migration عملیاتی، Seed یا جابه‌جایی سرور انجام نشده و نسخه جاری محفوظ است.

## ترکیب مسافر و چیدمان نسخه‌دار هتل — 2026-09-06

- شمارنده‌های بزرگسال، کودک و نوزاد در فروش جمع‌وجور هستند؛ تعداد اتاق، یک‌تخته، دوتخته و تخت اضافه با ورودی عددی مستقیم نمایش داده می‌شوند. واحد اتاق «باب» و تخت اضافه «نفر» است و خلاصه پایین ترکیب بزرگسال، کودک و نوزاد را نشان می‌دهد. تعداد مسافر پیش از انتخاب بلیت تعیین می‌شود و نوزاد صندلی مصرف نمی‌کند؛ کنترل ظرفیت اتمیک قبلی حفظ شده است.
- پس از ثبت قرارداد، رزرواسیون می‌تواند چیدمان اجرایی هتل و اعضای اقامت را فقط از میان مسافران همان Snapshot و با دلیل تغییر ثبت کند. هر تغییر یک Revision افزایشی با کنترل نسخه هم‌زمانی می‌سازد و Snapshot فروش بازنویسی نمی‌شود. افزودن/تعویض مسافر یا افزایش صندلی همچنان از اصلاح قرارداد فروش و کنترل ظرفیت می‌گذرد.
- ستون‌های چیدمان برای قراردادهای تاریخی nullable هستند تا هیچ مقدار فرضی روی داده قبلی نوشته نشود؛ قراردادهای جدید مقادیر واقعی را ذخیره می‌کنند. Migration `20260906113000_reservation_arrangements` پس از pg_dump روی دیتابیس لوکال اعمال شد و هر ۳۴ Migration روی PostgreSQL خالی موفق بود.
- ۶۸۰ تست Web، ۸۲۳ تست API با ۷۶ skip اختیاری و ۱۸ تست Contracts موفق؛ lint، typecheck و Production Build وب/API و تست یکپارچه چیدمان رزرواسیون موفق‌اند. تعریف مجوز جدید آماده است، اما تخصیص آن به نقش‌ها به تأیید صریح امنیتی نیاز دارد. بررسی بصری احراز‌شده ادعا نمی‌شود.
## ظرفیت مسافر بلیت و اعضای هتل — 2026-09-06

- ترکیب بزرگسال، کودک و نوزاد پیش از انتخاب بلیت ثبت می‌شود؛ فقط بزرگسال و کودک صندلی مصرف می‌کنند و وجود نوزاد بدون بزرگسال رد می‌شود. کارت پیشنهاد ظرفیت کل و مانده را نشان می‌دهد و پیشنهاد ناکافی قابل انتخاب نیست.
- تأیید قرارداد، ظرفیت هر جهت را با قفل ردیفی PostgreSQL و کلید قرارداد/جهت اتمیک رزرو می‌کند؛ اجرای هم‌زمان از بیش‌فروشی جلوگیری می‌کند و لغو قرارداد ظرفیت را آزاد می‌کند. Migration افزایشی `20260906095000_ticket_offer_capacity_allocations` روی دیتابیس خالی با هر ۳۳ Migration موفق بود.
- برای هتل، تعداد اتاق جداست و اعضای اقامت از میان مسافران قرارداد انتخاب می‌شوند؛ occupancy از همان اعضا ساخته و در Snapshot رزرواسیون ثبت می‌شود. موجودی قطعی هتل همچنان نیازمند تأیید رزرواسیون است و موجودی ساختگی تولید نمی‌شود.
- کل تست‌ها: ۶۷۸ تست Web و ۸۲۳ تست API موفق (۷۵ تست اختیاری API skip)؛ ۴۶ تست هدفمند Web و ۳۱ تست هدفمند API نیز مستقل موفق؛ lint، typecheck و Production Build وب/API و تست PostgreSQL مستقل جلوگیری از بیش‌فروشی موفق‌اند. تست هم‌زمانی قدیمی Reservations در اجرای کامل PostgreSQL یک خطای race در upsert خود Reservations نشان داد که خارج از این تغییر است؛ تست ظرفیت مستقل دوباره موفق شد. پس از پشتیبان‌گیری داخل کانتینر، Migration لوکال اعمال شد و Web 3100، API 4000 و CORS به‌ترتیب 200/200/204 پاسخ دادند. بررسی بصری احراز‌شده به‌دلیل خطای ACL ابزار مرورگر ادعا نمی‌شود.

## بازطراحی داشبورد فروش — 2026-09-05

- سربرگ و کارت‌های خلاصه بازطراحی شدند؛ مانده ارزها جدا، پیگیری مالی/رزرواسیون و مسیر ثبت اولین قرارداد مشخص‌اند. فهرست دارای جست‌وجوی واقعی شماره/مشتری، فیلتر تسویه، صفحه‌بندی و برچسب‌های فارسی است.
- ارقام فارسی بدون تبدیل Decimal به Number؛ آمار کل از فهرست فیلترشده مستقل و کنترل دسترسی و مانده تأییدشده Finance بدون تغییر است. ۷۲ تست فروش، lint محدوده، typecheck و Production Build وب موفق‌اند.
- تحویل محلی روی ۳۱۰۰؛ بدون Migration، تغییر مجوز، Push یا Merge. تست بصری احراز‌شده ادعا نمی‌شود.

## بازطراحی مشتری و مسافران فروش — 2026-09-05

- دو بخش شماره‌دار مشتری قرارداد و مسافران، سه انتخاب خریدار (شخص/آژانس/مسافر اول)، کارت مختصر مشتری انتخاب‌شده و تغییر صریح آن. جست‌وجوی نقش‌محور و صفحه‌بندی‌شده مشتری/مسافر جداست؛ نتایج جمع‌وجور و محدود به ارتفاع‌اند و کد ملی/تماس فقط Masked نمایش داده می‌شود. UUID و role انگلیسی از این بخش حذف شد. در هر بخش فقط جست‌وجو یا ثبت باز است؛ ردیف‌های اضافه مسافر در صف جمع‌وجور ثبت می‌شوند و علت غیرفعال‌بودن «بعدی» مشخص است.
- کد ملی مشتری حقیقی هم مطابق Backend اجباری شد. Backend فروش در ایجاد/ویرایش/تأیید از Public masked API مشتریان دسترسی و وضعیت هر مسافر را کنترل می‌کند؛ مسافر باید شخص فعال دارای نقش مسافر باشد. مشتری غیرفعال و مسافر تکراری رد می‌شوند. هیچ Query مستقیم یا تغییر Customers/Schema انجام نشد.
- ۶۹ تست Web فروش و ۳۵ تست API فروش، lint و typecheck و Build هر دو موفق؛ وب ۳۱۰۰ و API۴۰۰۰ به‌روزرسانی شدند. بررسی بصری احراز‌شده و ایجاد شخص واقعی انجام نشده؛ انتشار عمومی هنوز مجاز نشده است.

## تاریخ خواناتر کارت بلیت فروش

- تاریخ حرکت و رسیدن در کارت بلیت رفت و برگشت از ۱۱px کم‌رنگ به ۱۴px موبایل/۱۶px دسکتاپ، پررنگ و با کنتراست کامل تغییر کرد؛ متن قابلیت شکستن خط دارد. منطق زمان تهران و انتخاب بلیت ثابت است. ۶۶ تست فروش، lint، typecheck و Build وب موفق؛ تغییر محلی و بدون Push عمومی.

## SALES-ORGANIZATION-CUSTOMER-0905 — اتصال مشتری حقوقی/آژانس

- ۶۴ تست فروش، lint، typecheck و Production Build وب با ۳۵ مسیر موفق؛ نسخه جدید روی پورت ۳۱۰۰ اجرا شد. تغییرات فقط محلی ثبت می‌شوند؛ انتشار عمومی فروش هنوز تأیید نشده است.

- فرم فروش نوع مشتری حقیقی یا حقوقی/آژانس دارد. سازمان‌های فعال از Public API اطلاعات پایه با جست‌وجو انتخاب می‌شوند؛ پرونده مشتری حقوقی قابل‌دسترسی از API مشتریان، با صفحه‌بندی کامل، دوباره استفاده می‌شود. اگر پرونده موجود نباشد، دکمه صریح ثبت فقط Customer از نوع organization با همان organizationId می‌سازد؛ MasterOrganization جدید ساخته نمی‌شود.
- پرونده غیرفعال یا بدون نقش مشتری دوباره ساخته نمی‌شود و برای اصلاح به مشتریان ارجاع داده می‌شود. Permission/Branch scope همان APIهای مالک است. مشتری حقوقی با customerId واقعی به Sales وصل می‌شود؛ مسافران مستقل‌اند و گزینه مشتری‌بودن مسافر اول در حالت حقوقی غیرفعال است. تغییر سازمان، انتخاب مشتری قبلی را پاک می‌کند تا تأیید دوباره انجام شود.
- این اتصال از مدل موجود استفاده می‌کند و به معنی تکمیل endpointهای Agency agreed-rates یا credit-summary نیست. بدون Schema/Migration/API مشترک یا تغییر ماژول‌های دیگر؛ ثبت واقعی سازمان/شخص در تست انجام نشده است.

## SALES-PASSENGER-ROWS-0905 — تعداد مسافران و مشتری همراه

- ۵۸ تست فروش، lint محدوده، typecheck و Production Build وب با ۳۵ مسیر موفق؛ نسخه جدید وب روی ۳۱۰۰ اجرا شد. PR #90 همچنان Draft است و قفل‌ها آزاد نشدند.

- در مرحله مشتری و مسافران، ردیف‌های مستقل به تعداد موردنیاز اضافه/حذف می‌شوند؛ شمارنده ثبت‌شده و در حال ورود و شماره هر مسافر نمایش داده می‌شود. ردیف‌های جدید به ترتیب از Public API مشتریان ثبت می‌شوند و ردیف ناقص اجازه ادامه قرارداد نمی‌دهد. حذف از قرارداد، پرونده مشتری را حذف نمی‌کند.
- کد ملی مسافر جدید الزامی و دقیقاً ۱۰رقمی است؛ ارقام فارسی/عربی به انگلیسی تبدیل و صفر ابتدایی حفظ می‌شود. رقم کنترل و یکتایی همچنان توسط ماژول Customers بررسی می‌شوند. کد خام فقط در حافظه فرم ورود است و وارد localStorage یا payload فروش نمی‌شود؛ اشخاص موجود از جست‌وجوی قبلی قابل انتخاب‌اند.
- گزینه «مسافر اول، مشتری قرارداد هم هست» به همان شخص اشاره می‌کند و با حذف نفر اول، نفر بعدی را انتخاب می‌کند؛ در نبود مسافر، مشتری خالی می‌شود. ایجاد مسافر اول با این گزینه هر دو نقش را در API مشتریان درخواست می‌کند. بدون تغییر API/Schema/Migration/Permission یا شاخه‌های دیگر.

## جداسازی تغییرات خارج از فروش — 2026-09-05

- با اجازه مالک، تمام ۲۷ فایل Customers/Documents/Passport/Button در شاخه محلی codex/pc-a-customer-passport-preservation-0905 با Commit 75afc50 و پشتیبان خام مستقل محفوظ شدند. تطبیق SHA256 هر فایل در مبدا، پشتیبان و Worktree بازیابی موفق بود؛ فروش به وضعیت تمیز برگشت.
- ۱۲ فایل با شاخه فعال مشتریان برابر است و ۱۵ فایل به تطبیق توسط مالک نیاز دارد؛ هیچ نسخه‌ای روی شاخه فعال مشتریان بازنویسی نشد. انتشار پشتیبان بررسی‌نشده توسط کنترل ایمنی متوقف شد؛ فقط محلی است. PR جدید، Merge، اجرای Migration یا آزادسازی قفل انجام نشد.
- مانع فایل محلی Prisma رفع شد؛ این کار به معنی تکمیل ویرایش رزرواسیون، قراردادهای Agency یا رفع Conflict کلی PR #90 نیست. بررسی این مرحله صحت بازیابی و جداسازی فایل‌هاست، نه تأیید عملکرد کد پشتیبان.

## SALES-CONTRACTS-001 — بلیت و هتل در یک بخش

- جزئیات بلیت و هتل در یک زیرمرحله، بلیت بالا و هتل پایین، نمایش داده می‌شوند. انتخاب هتل با جست‌وجوی یکپارچه نام/کد و فقط مراجع شهر مقصد از Public API اطلاعات پایه است.
- ورود پیشنهادی روز بعد از پرواز رفت و خروج روز قبل از پرواز برگشت، مطابق تاریخ نمایشی تهران، است. تاریخ دستی محفوظ می‌ماند؛ بازنشانی از بلیت ممکن است و بازه نامعتبر اجازه ادامه نمی‌دهد. تاریخ‌های نهایی از قرارداد عمومی فعلی به رزرواسیون ارسال می‌شوند.
- تغییر چیدمان اجرایی هتل اکنون در رزرواسیون با Revision نسخه‌دار انجام می‌شود؛ Snapshot فروش immutable می‌ماند و اصلاح مسافر/ظرفیت همچنان از Sales عبور می‌کند.
- ۵۰ تست فروش، lint محدوده فروش، typecheck وب و Production Build با ۳۵ مسیر موفق‌اند. بدون تغییر Schema/Migration/Dependency و بدون دست‌کاری تغییرات محلی کار دیگر؛ بررسی بصری احراز‌شده انجام نشده است.

## SALES-CONTRACTS-001 — دو ستون مسیر و میلادی انگلیسی

- کشور مبدأ بالای شهر مبدأ و کشور مقصد بالای شهر مقصد قرار گرفت؛ دو گروه در دسکتاپ کنار هم و در موبایل زیر هم‌اند.
- تمام DatePickerهای فروش (هتل، تولد، خدمات و پرداخت‌ها) از گزینه اختیاری انگلیسی میلادی استفاده می‌کنند؛ بازه پرواز نیز هماهنگ شد. نام ماه/روز، ارقام و متن‌های پنجره میلادی انگلیسی و چیدمان LTR است؛ شمسی و پیش‌فرض سایر بخش‌ها فارسی می‌ماند. مقدار ISO تغییر نکرده است.
- ۴۸ تست فروش/تقویم مشترک، lint/typecheck و Production Build وب موفق؛ تغییر مشترک افزایشی و opt-in است. بررسی بصری احراز‌شده ادعا نمی‌شود.

## SALES-CONTRACTS-001 — تقویم هماهنگ و کارت بلیت خواناتر

- فیلتر بازه با ظاهر تقویم مشترک، کلید شمسی/میلادی و شبکه انتخاب ماه و سال هماهنگ شد؛ همچنان یک تقویم اختیاری است. پنجره بر اساس فضای موجود بالا/پایین باز می‌شود و ارتفاع قابل اسکرول دارد. فایل تقویم مشترک تغییر نکرده است.
- کارت بلیت نام شرکت/شماره، شهرهای مسیر، ساعت و تاریخ جداگانه حرکت/رسیدن، مدت سفر، کلاس واقعی و ظرفیت کل را نشان می‌دهد. ساعت بدون ثانیه و با برچسب وقت تهران نمایش داده می‌شود؛ انتخاب آبی و دارای علامت است. قیمت یا ظرفیت باقی‌مانده ساختگی درج نشده است.
- ۳۹ تست فروش وب و lint/typecheck موفق‌اند. فیلتر اختیاری و جست‌وجوی برگشت بدون سقف بازه رفت حفظ شدند؛ Schema/API/مجوزها دست‌نخورده‌اند. بررسی بصری احراز‌شده ادعا نمی‌شود.

## SALES-CONTRACTS-001 — مشتری و مسافران در یک مرحله

- مراحل از شش به پنج رسید: جست‌وجو/انتخاب مشتری، افزودن مسافر و تاریخ تولد/رده سنی در یک مرحله مشترک هستند. تغییر مشتری مسافران قبلی را پاک نمی‌کند و انتخاب تکراری مسافر رکورد جدید نمی‌سازد.
- دکمه‌های مشتری جدید و مسافر جدید، فرم کوچک داخل همان صفحه باز می‌کنند؛ نام، نام خانوادگی، تاریخ تولد و کد ملی اختیاری از Customers API موجود ثبت می‌شوند. مشتری می‌تواند هم‌زمان نقش مسافر داشته باشد. فرد فقط پس از موفقیت API به قرارداد انتخاب می‌شود؛ ثبت شخص مستقل از ثبت نهایی قرارداد است.
- ۳۵ تست فروش وب، lint/typecheck و Production Build موفق؛ Schema، مجوزها و کد ماژول مشتریان تغییر نکرده‌اند. ایجاد فرد واقعی/آزمون احراز‌شده در مرورگر انجام نشده است.

## SALES-CONTRACTS-001 — فرم جمع‌وجور و رفع اتصال داشبورد

- فرم تمام‌صفحه با عرض محدود، عنوان/مراحل کوچک‌تر، چهار فیلد کشور/شهر در یک ردیف دسکتاپ، گزینه‌های خدمات کم‌ارتفاع و نوار دکمه‌های در دسترس بازطراحی شد. موبایل همچنان چیدمان واکنش‌گرا دارد.
- علت تأییدشده اتصال: bundle تولیدی قبلی بدون NEXT_PUBLIC_API_BASE_URL ساخته شده بود. مقدار عمومی localhost:4000/api/v1 در فایل محلی ignored تنظیم و بیلد مجدد شد؛ هیچ Secret یا تنظیم محیط محلی وارد Git نمی‌شود. Queryهای داشبورد و فهرست در scope بدون رکورد موفق‌اند و API، CORS پورت 3100 را مجاز می‌داند.
- آمار و فهرست مستقل بارگذاری می‌شوند؛ خطای یکی داده سالم دیگری را حذف نمی‌کند. خطاهای واقعی اتصال/نشست پنهان یا با داده جعلی جایگزین نمی‌شوند. ۲۷ تست فروش وب، lint، typecheck و Production Build موفق؛ بررسی بصری احراز‌شده به‌دلیل خطای ابزار ویندوز انجام نشده است.

## SALES-CONTRACTS-001 — خدمات ساده و فیلتر اختیاری بلیت

- انتخاب پرواز، قطار و اتوبوس را حذف/غیرفعال می‌کند؛ API نیز ترکیب نامعتبر را رد می‌کند. ترانسفر فقط علامت رفت/برگشت است، مرحله جزئیات ندارد و در پیش‌نمایش بلیت درج می‌شود.
- تاریخ از مرحله مسیر حذف شد؛ جست‌وجو به‌صورت پیش‌فرض بلیت‌های آینده با ترتیب نزدیک‌ترین تاریخ است. شروع/پایان بازه در یک تقویم شمسی/میلادی اختیاری انتخاب و فیلتر قابل پاک‌کردن است. سقف بازه رفت به برگشت اعمال نمی‌شود.
- تاریخ معتبر قرارداد از بلیت انتخاب‌شده یا ورود هتل گرفته می‌شود؛ برای خدمت بدون این تاریخ‌ها فقط در مرحله مسافر جهت محاسبه سن درخواست می‌شود. این تغییر جایگزین توضیحات قدیمی جزئیات ترانسفر در پایین سند است. Schema/Migration و ماژول‌های دیگر تغییر نکرده‌اند.

## SALES-CONTRACTS-001 — رفت/برگشت کنار هم و پیش‌نمایش بلیت

- انتخاب هر دو جهت در یک مرحله و دو ستون انجام می‌شود؛ تیک بیزینس فقط برچسب خروجی است و کلاس واقعی موجودی/بازاعتبارسنجی را عوض نمی‌کند.
- چهار پیشنهاد کاملاً آزمایشی تهران/آنتالیا روی شعبه HQ برای تست قرارداد منتشر و از جست‌وجوی عمومی تأیید شدند: دو رفت در 2026-09-10 و برگشت در 2026-09-17 و 2026-09-20. هر پیشنهاد ظرفیت ۲۰ دارد و انتشار دوباره تکراری نمی‌سازد.
- قالب پیش‌نمایش چاپی بر اساس تصویر کاربر، با رنگ سرمه‌ای/فیروزه‌ای، اطلاعات سفر و برچسب BUSINESS آماده شد. پیش‌نمایش عمداً فاقد اعتبار سفر است؛ شماره بلیت، PNR و اطلاعات صدور/پرداخت واقعی جعل نمی‌شوند. صدور و آزادسازی واقعی همچنان در مالکیت رزرواسیون/مالی/اسناد است.
- ۱۵ تست فروش وب موفق؛ جزئیات کیفیت و محدودیت بررسی بصری در سند Task ثبت است. Schema/Migration و کد ماژول‌های دیگر دست‌نخورده‌اند.

## SALES-CONTRACTS-001 — ثبت مرجع ترکیه/آنتالیا و حذف پنل بلیت زمان‌دار

- مانع ثبت مرجع رفع شد: ترکیه با کد TR، استان لازم آنتالیا و شهر آنتالیا در دیتابیس محلی از سرویس مالک اطلاعات پایه ثبت شدند؛ وضعیت فعال و ارتباط کشور/استان بررسی شد. اجرای دوباره هر سه رکورد را بازاستفاده کرد و داده تکراری نساخت. هیچ مجوز، نشست، کاربر یا شعبه IAM تغییر نکرد؛ Audit با انتساب شفاف نگهداری آفلاین ثبت شد.
- فقط نمایش پنل «ثبت بلیت زمان‌دار برای فروش» از مدیریت بلیت حذف شد؛ دکمه تکرار هفتگی/ماهانه، رکوردهای قبلی و API بلیت دست‌نخورده‌اند. این تغییر تکرار بلیت محلی را به انتشار پیشنهاد فروش متصل نمی‌کند.
- ۹۶ تست Ticket Catalog موفق؛ تغییرات هم‌زمان Customers/Documents و Prisma در کامیت این کار وارد نمی‌شوند.

## SALES-CONTRACTS-001 — انتخاب خدمت و بازگشت داشبورد

- انتخاب خودِ بلیت یا ترانسفر، هر دو جهت را فعال می‌کند؛ تیک‌های رفت/برگشت زیر همان خدمت باز می‌شوند و مستقل قابل تغییرند. فرم جدید لینک بازگشت به `/sales` دارد؛ ورودی فروش همان داشبورد قراردادهاست.
- ۱۲ تست فروش وب، lint فروش و typecheck وب موفق؛ Schema/Migration و Backend تغییر نکرده‌اند.
- ثبت کشور ترکیه و شهر آنتالیا هنوز انجام یا تأیید نشده: ابزار مرورگر خطای ACL ویندوز و ابزار کنترل کامپیوتر خطای Runtime داد؛ API عمومی بدون نشست ورود پاسخ 401 داد. ثبت از رابط عمومی احراز‌شده باقی مانده و هیچ جدول خصوصی مستقیم تغییر نکرده است.

## SALES-CONTRACTS-001 — جست‌وجوی مسیر و خدمات جهت‌دار — آماده بررسی

- انتخاب کشور و شهر مبدأ/مقصد جست‌وجوپذیر، RTL، گرد و هم‌تم شد؛ شهرها به کشور انتخابی محدودند. پیش‌فرض فرم جدید از رکورد واقعی ایران/تهران و ترکیه/آنتالیا پیدا می‌شود؛ Draft موجود بازنویسی و داده مرجع ساختگی ایجاد نمی‌شود.
- بلیت و ترانسفر رفت و برگشت چهار تیک مستقل‌اند. جزئیات فقط برای خدمات انتخاب‌شده و به‌ترتیب نمایش داده می‌شود؛ ترانسفر تاریخ، محل سوارشدن و پیاده‌شدن دارد. بلیت برگشت مسیر معکوس را از تاریخ بلیت رفت به بعد و بدون سقف تاریخ جست‌وجو می‌کند؛ برگشت قبل از رسیدن رفت قابل تأیید نیست.
- جهت خدمت در metadata موجود Sales v1 ذخیره و به Snapshot رزرواسیون منتقل می‌شود؛ اعتبارسنجی قدیمی بدون direction سازگار باقی ماند. Schema/Migration، Dependency، مجوزها و ماژول‌های دیگر در این Follow-up تغییر نکردند.
- ۹ تست Web Sales و ۲۶ تست API Sales، شامل هر ۱۵ ترکیب غیرخالی چهار تیک، موفق؛ typecheck وب/API، lint فروش و Production Build وب/API موفق (۳۵ Route). سرور نسخه جدید روی پورت 3100 اجرا شد. بررسی بصری/ورود احراز‌شده ادعا نمی‌شود.
- مانع مجوزِ گزارش قبلی با تأیید صریح کاربر رفع شد: چهار ارتباط نقش‌ـ‌مجوز در دیتابیس محلی ثبت و Audit شدند؛ عضویت شعبه‌ها ثابت ماند. همان Branch و Draft PR #90 ادامه دارد؛ تغییرات هم‌زمان Customers/Documents در کامیت فروش قرار نمی‌گیرند.

## SALES-CONTRACTS-001 — ادامه اجرایی 2026-09-05 — IN_PROGRESS

- با اجازه صریح کاربر، Public API واقعی انتشار/جست‌وجو/بازاعتبارسنجی پیشنهاد بلیت و صندوق دریافت نسخه‌دار Reservations اضافه شد؛ ارتباط Sales فقط از سرویس عمومی ماژول‌هاست.
- فرم تمام‌صفحه شش‌مرحله‌ای با مسیر/خدمات در ابتدا، انتخاب آبی بلیت، برگشت مستقل بدون سقف تاریخ، جست‌وجوی هتل مقصد، ویزای مقصد، کلاس پرواز و رده سنی مسافر پیاده شد. قیمت توافقی ریالی/ارزی و اقساط/چک به API متصل‌اند؛ مانده فقط با تأیید Finance کاهش می‌یابد و اضافه‌پرداخت یک ارز، بدهی ارز دیگر را تسویه نمی‌کند.
- Migration افزایشی `20260905070000_travel_runtime_intake`؛ هر ۳۲ Migration روی PostgreSQL 18 خالی و Seed دو بار موفق. پنج تست اختصاصی شامل چهار تست واقعی PostgreSQL موفق؛ Full test/typecheck/lint و Production Build موفق‌اند. بررسی کامل محلی شامل تغییرات هم‌زمان و کامیت‌نشده Customers/Documents نیز بوده؛ آن فایل‌ها در کامیت‌های فروش قرار نگرفته‌اند.
- پیشنهادهای منتشرشده پایدار از تعریف‌های قدیمی محلی Ticket Catalog جدا هستند؛ مهاجرت خودکار داده قدیمی یا داده عملیاتی ساختگی نداریم. Reservations فعلاً دریافت پایدار/تکرارناپذیر و صف بررسی است، نه Hold ظرفیت یا صدور بلیت.
- وب پورت 3100 و Health API پورت 4000 پاسخ 200 دادند؛ بررسی تعاملی مرورگر به‌علت خطای ACL ابزار ممکن نشد. اعطای مجوزهای جدید روی دیتابیس عملیاتی اجرا نشده: بررسی خودکار مجوز، تأیید صریح نقش/دسترسی/محدوده را لازم دانست. فعال‌سازی تا این تأیید باز می‌ماند.
- همان Branch و Draft PR #90 ادامه دارد؛ Rebase، Force Push، Merge و تغییر main/develop انجام نشده است. گزارش قبلی زیر، سابقه Slice پیش از این ادامه است.

## CUSTOMER-CONNECTIONS-0905 — local integration ready for review

- Customer Documents and master-data reference refresh are integrated and validated (163 tests; lint/typecheck/build successful). Independent local runtime: Web 3101 / API 4101. Existing 3 pending additive migrations were applied to localhost:5432; no reset, new migration or seed. Persistent protected local Documents key is configured. Authenticated user upload/download has not been manually exercised in this session.

- Customer Documents and master-data session retry are integrated in an isolated checkout based on committed Sales. The following historical entries retain their original scope; this task does not change Ticket Catalog.

## CUSTOMER-MASTERDATA-RETRY — بازیابی اطلاعات پایه پس از تمدید نشست

- `PC-A` روی Branch مستقل `codex/pc-a-customer-masterdata-retry` خطای هم‌زمانی
  بارگذاری Public Master Data در فرم Customers را اصلاح کرد. پاسخ 401 اکنون از همان
  Refresh مشترک نشست استفاده می‌کند و درخواست Organization، نحوه آشنایی، کشور یا شهر
  فقط یک بار تکرار می‌شود؛ سایر خطاها رفتار صریح قبلی را حفظ می‌کنند.
- همه قابلیت‌های ادغام‌شده CUSTOMER-002B، نمایش/خروجی تماس و اتصال امن Documents در
  همین مبنا موجودند. Passport/Visa ساختاری به‌دلیل بازبودن `DEC-OPEN-006` فعال نشده و
  هیچ داده ساختگی جایگزین نشده است. ۵۶۵ تست Web، lint، typecheck و Production Build
  موفق‌اند. جزئیات در `docs/tasks/CUSTOMER-MASTERDATA-RETRY.md`.

## TICKET-CATALOG-EDIT-COMPLETENESS — نمایش کامل اطلاعات هنگام ویرایش

- PC-A is validating PR #85 Customer Documents against committed Sales plus the existing master-data session-refresh retry. Separate worktree preserves active Sales changes; prior test results below do not establish validation of this integration.
## SALES-CONTRACTS-001 — Vertical Slice فروش — آماده بررسی

- PR #91 با Merge Commit `b69b7fa` قفل‌های Migration، Central Docs و Sales shared-contract/root export را به `PC-A/SALES-CONTRACTS-001` منتقل کرد؛ Merge معمولی `8d3b89d` این Handoff را وارد Branch فروش کرد. آخرین `origin/develop@85204a4` نیز با Merge معمولی `dbaf450` وارد و تعارض اسناد با حفظ هر دو Handoff حل شد.
- Branch `codex/pc-a-sales-contracts` و Draft PR #90 مالک Prisma/Migration افزایشی Sales، Permission Seed، قرارداد عمومی، Backend، UI و تست‌های این Slice هستند؛ Dependency/Lockfile تغییر نمی‌کند.
- تمام ارتباط‌های Customers، Ticket Catalog، Master Data، Finance، Reservations، Documents و Legal Entity فقط از Public Contract/Port انجام می‌شود و هیچ Query مستقیم جدول خصوصی مجاز نیست.
- PR #85 و خروجی PC-B دست‌نخورده‌اند؛ `main`/`develop` مستقیم تغییر نمی‌کنند و Merge/Rebase/Force Push انجام نمی‌شود.
- Slice واقعی تکمیل است: قرارداد عمومی Sales v1، ۱۱ جدول مالک Sales با Migration افزایشی، Permission Seed، Repository/API، Scope مالک/شعبه، Audit، Optimistic Lock، Idempotency، صف نسخه‌دار ReservationRequest و داشبورد/فرم تمام‌صفحه قرارداد تحویل شد.
- مانده فقط از پرداخت `FINANCE_CONFIRMED` کم می‌شود؛ پرداخت pending/scheduled اثر ندارد. تأیید Offer بلیت تا انتشار Public API اجرایی Ticket Management fail-closed است و پاسخ ساختگی ساخته نمی‌شود.
- Gate نهایی پس از آخرین Merge: Prisma معتبر، ۳۱ Migration روی PostgreSQL 18 خالی، Seed دوباره‌پذیر، Full lint/typecheck، ۱٬۴۸۵ تست و Full Production Build با ۳۵ صفحه موفق است. Draft PR #90 همان PR جاری باقی می‌ماند.
## AGENCY-B2B-INTEGRATIONS-001 — اتصال عملیاتی و تجاری آژانس — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-agency-b2b-integrations` و PR [#98](https://github.com/nirvanamahlou/Rubi/pull/98) مانع ثبت‌شده در PR #90 را پس از اعلام رفع قفل از سوی مالک محصول تکمیل کرد. هویت آژانس همان `MasterOrganization` دارای نقش `AGENCY` باقی می‌ماند و هیچ موجودیت موازی یا Query مستقیم Sales/Finance ساخته نشده است.
- آدرس پایه سازمان با FK واقعی کشور/شهر، پروفایل عملیاتی شعبه‌ای، قرارداد B2B، سیاست اعتبار، نرخ توافقی و Audit افزایشی پیاده‌سازی شدند. قراردادهای عمومی نسخه‌دار، Permissionهای deny-by-default، Branch scope و Optimistic Version در API اعمال می‌شوند.
- Popup موجود آژانس اطلاعات واقعی آدرس، تماس ماسک‌شده، پروفایل، قرارداد، اعتبار و نرخ را از APIهای عمومی می‌گیرد. تاریخ‌ها از تقویم مشترک شمسی/میلادی استفاده می‌کنند و Finance exposure تا انتشار Adapter مالک Finance صریحاً ناموجود است؛ مقدار صفر ساختگی تولید نمی‌شود.
- Migrationها روی PostgreSQL موقت خالی از ابتدا تا انتها اجرا و ۶ جدول و ۲۲ Index جدید بررسی شدند. Prisma، lint، typecheck، ۲۱ تست هدفمند و Production Build وب با ۳۴ Route موفق‌اند. Full Test فقط روی assertion قدیمی و تغییرنیافته Customer که در Checkout ویندوز LF را با CRLF مقایسه می‌کند قرمز است.
- قفل‌های محدود Migration، قرارداد عمومی B2B و Central Docs تا پایان Review نزد همین Task می‌مانند؛ Branchهای PC-A و PR #90 دست‌نخورده‌اند و Merge خودکار انجام نمی‌شود.

## MARKETING-001E — بازگردانی ارتباطات مارکتینگ — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-marketing-communications-restore` بخش «ارتباطات» را به Hub، Route مستقیم و Breadcrumb پویا برگرداند. چهار تب «ارسال پیام»، «ارسال‌های زمان‌بندی‌شده»، «تاریخچه ارسال‌ها» و «قالب‌های پیام» فعال‌اند و «عملکرد کانال‌ها» مطابق درخواست قبلی حذف باقی مانده است.
- فرم ارسال با انتخاب کمپین، مخاطب، قالب، کانال، روش و تاریخ ارسال کار می‌کند و ورودی‌های لازم را اعتبارسنجی می‌کند. Action «ارسال پیام» فقط در تب ارسال و Action «قالب جدید» فقط در تب قالب‌ها دیده می‌شود. جدول‌ها داده آزمایشی مستقل، فیلتر تاریخ Rubi، خروجی Excel و عملیات رکورد دارند؛ هیچ ارسال واقعی یا نگهداری PII انجام نمی‌شود.
- Follow-up مالک تکمیل شد: «سناریو جدید» با فیلدهای واقعی و ثبت فوری، ویرایش مشخصات اتوماسیون و افزودن مرحله در سازنده فعال‌اند. دکمه‌های افزودن مخاطب کمپین، منبع ورود، کد تخفیف و پیشنهاد ویژه کنار خروجی Excel هم‌راستا شده‌اند.
- فرم محتوای جدید و Upload متصل به Documents اکنون ده نوع محتوای مارکتینگ و دو انتخاب «نیایش سیر سحر» و «جهان باستان» دارد؛ شناسه‌های مجاز نوع سند/دسته/مالک/شعبه همچنان از Options احراز‌شده Documents گرفته می‌شوند و هیچ قرارداد یا Schema تغییر نکرده است.
- ۱۸/۱۸ تست هدفمند مارکتینگ، lint کامل Web، typecheck کامل Web و Production Build با ۳۴ Route پاس شدند. Smoke لوکال Hub و مسیر ارتباطات پاسخ ۲۰۰ و محتوای مورد انتظار را تأیید کرد. یک تست قدیمی Customer به‌علت تطبیق متن LF روی Checkout ویندوز در اجرای کامل محلی شکست دارد و خارج از محدوده این Task دست‌نخورده مانده است.

## MARKETING-001D — پالایش ناوبری و فرم مارکتینگ — آماده بررسی

- Follow-up 2026-09-05: کلیک Breadcrumb والد اکنون با کلید Route، Workspace را از آدرس تازه بازسازی می‌کند؛ «ارتباطات»، دکمه بازگشت داخلی، منوی سه‌نقطه عملیات و تب مستقل «قوانین استفاده» حذف شدند. فرم‌های عملیاتی «مخاطبان کمپین» و «منابع ورود» با اعتبارسنجی و افزودن فوری رکورد ساخته شدند و قواعد استفاده به فیلدهای کد تخفیف/پیشنهاد ویژه منتقل شد.
- بارگذاری کتابخانه محتوا به Client عمومی موجود Documents متصل است: نوع `BRAND_ASSET_TEMPLATE`، دسته `BRAND_ASSETS`، شعبه و مالک از گزینه‌های احراز‌شده دریافت می‌شوند و Relation امن `marketing/content-asset` همراه فایل ثبت می‌شود. فایل ثبت‌شده در کارت محتوا ظاهر می‌شود و با همان شناسه در `/documents?document=...` باز می‌شود؛ هیچ API، Repository، Shared Contract، Schema/Migration/Seed یا Dependency تغییر نکرد.
- اعتبارسنجی نهایی این Follow-up: `603/603` تست Web، lint بدون هشدار، typecheck و Production Build با ۳۴ Route موفق‌اند. Smoke مستقیم همه مسیرهای audiences/content/offers و مسیر حذف‌شده communications پاسخ `200` و متن/نبود متن مورد انتظار را تأیید کرد؛ Web/API همین Worktree روی پورت‌های ۳۱۰۰/۴۰۰۰ فعال‌اند.
- Follow-up مالک روی Branch `codex/pc-b-marketing-workspace-completion`: گزارش‌ها، عضویت‌های تبلیغاتی، عملکرد کانال‌ها و خروجی داشبورد کامل حذف شدند؛ کمپین‌ها RTL و Breadcrumb مارکتینگ با نام سکشن انتخاب‌شده پویا است.
- سگمنت‌ساز اکنون سه Dropdown کامل، افزودن/حذف قانون و فرم سگمنت جدیدِ محدود به همان تب دارد. قانون‌های امتیازدهی سرنخ، قالب جدید، محتوای جدید، فرم‌های لازم و سناریوهای آماده نیز باز و ذخیره محلی می‌شوند و Actionهای نابجا فقط در تب مرتبط نمایش داده می‌شوند.
- همه فهرست‌های مارکتینگ فیلتر بازه تاریخ با DatePicker مشترک Grid ماه/سال، داده‌های آزمایشی متناسب با نوع تب، دکمه پاور قرمز و در محل لازم خروجی واقعی Excel امن دارند. پیاده‌سازی API/Persistence مارکتینگ، Schema/Migration/Seed، Dependency/Lockfile و Shared Contract تغییر نکرده است؛ فقط Client موجود Documents برای بارگذاری فایل مصرف می‌شود.
- Web typecheck، lint، همه `603/603` تست Web و Production Build با ۳۴ Route موفق‌اند. نسخه Branch روی پورت `3100` فعال است؛ بررسی مرورگر آزمایشی به‌دلیل جدا بودن نشست Login از Chrome بدون دست‌کاری حساب متوقف شد.
- Follow-up تصویر 486: Breadcrumb مسیر مستقیم کمپین با Router رسمی Next کامل شد و Server Page پارامتر `section` را پیش از رندر به Workspace می‌دهد؛ بنابراین عنوان مسیر و محتوای کمپین از همان پاسخ اولیه هماهنگ‌اند. نسخه مورد انتظار فرم، عبارت انگلیسی ویرایش، تب A/B و دکمه تکراری ایجاد کمپین حذف و فقط «افزودن کمپین جدید» فعال باقی ماند. کش اجرای قدیمی ایزوله شد؛ `603/603` تست، lint، typecheck و Build موفق‌اند و Web/API همین Worktree روی ۳۱۰۰/۴۰۰۰ پاسخ `200` می‌دهند.
- `PC-B` روی Branch مستقل `codex/pc-b-marketing-navigation-polish` اعلان‌ها و شناسه‌های فنی Preview، Eyebrow آبی `CRM / Marketing` و توضیحات نمایشی داشبورد را حذف کرد. صفحه اصلی مارکتینگ اکنون همان رنگ، Glow و حرکت کارت‌های Hub اطلاعات پایه را دارد.
- انتخاب هر سکشن در History مرورگر ثبت می‌شود؛ Back مرورگر واقعاً به نمای قبلی برمی‌گردد. تمام Workspace، جدول‌ها، تب‌ها و Dialog کمپین RTL و راست‌چین‌اند و بازخورد دکمه‌ها بدون نوار اولیه مزاحم، بعد از عمل نمایش داده می‌شود.
- داشبورد دیگر دکمه «ایجاد کمپین» ندارد و نمودار ۳۰روزه دو سری مستقل و قابل‌تشخیص «سرنخ جدید» و «فروش منتسب» با خط، نقطه و راهنما نمایش می‌دهد.
- فرم کمپین هشت‌مرحله‌ای است: مرحله پیشنهاد حذف شد؛ عبارت UTC، اعلان حریم خصوصی، Badge امن Preview و توضیحات زیر فیلدها/سکشن‌ها حذف شدند. DatePicker، اعتبارسنجی و مسیرهای Create/Edit/View فعال باقی مانده‌اند.
- Web lint، typecheck، Production Build با ۳۴ Route و همه `602/602` تست Web موفق‌اند. Browser QA دسکتاپ و موبایل `390×844`، Back واقعی، RTL، دو سری نمودار و نبود متن‌های حذف‌شده را تأیید کرد. هیچ API، Persistence، Schema/Migration/Seed، Dependency/Lockfile، Shared Contract، UI مرکزی یا داده واقعی تغییر نکرد.

## DOCUMENTS-004-HANDOFF — انتقال اتمیک قفل‌ها به Sales — آماده بررسی

- PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شده است؛ `DOCUMENTS-004-OPERATIONS` اکنون `DONE/MERGED` است.
- قفل‌های Documents با این وضعیت پایان می‌یابند: Documents shared-contract و Shared Calendar برابر `RELEASED / STABLE` و Dependency/Lockfile برابر `RELEASED`.
- انتقال اتمیک برای ادامه کار: Migration، Central Docs و Sales shared-contract/root export به `PC-A/SALES-CONTRACTS-001` رزرو می‌شوند. Dependency/Lockfile برای Sales آزاد می‌ماند و فقط پس از اثبات نیاز واقعی و رزرو جداگانه قابل تغییر است.
- Documents فقط مالک نگهداری، نسخه‌بندی و دسترسی فایل است. Sales فقط قرارداد عمومی Documents را مصرف می‌کند و حق Query مستقیم جدول‌ها یا استفاده از Repository/زیرساخت داخلی Documents را ندارد.
- این Handoff فقط چهار فایل مستنداتی را تغییر می‌دهد؛ PR #90، Branch فروش، `main`، کد، Schema، Migration، Seed، Dependency، Lockfile و فایل‌های ماژولی دست‌نخورده می‌مانند. جزئیات: `docs/tasks/DOCUMENTS-004-HANDOFF.md`.

## DOCUMENTS-004 — عملیات واقعی اسناد و آرشیو — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-documents-workflows` جزئیات سند را ساده و فارسی کرد؛ مسیر پیشنهادی، SHA/MIME و توضیح فنی منبع از UI حذف و نوع فایل به شکل پسوندی مانند `.PNG` نمایش داده می‌شود.
- فهرست‌های عملیاتی و اشتراک‌گذاری تا انتخاب فیلتر خالی می‌مانند. اشتراک‌گذاری جست‌وجو و فیلتر فشرده دارد؛ پاک‌سازی با آیکون سطل قرمز انجام می‌شود و Export رابط حذف شده است.
- ویرایش، حذف دائمی، ناقص/کامل، آرشیو/بازیابی و عملیات گروهی به API و Persistence واقعی متصل‌اند. حذف دائمی با مجوز، دلیل، تأیید کد، کنترل نسخه و رد Legal Hold انجام می‌شود و تمام رکوردهای وابسته و فایل ذخیره‌شده را پاک می‌کند.
- مدیریت آرشیو به چهار مسیر واقعی مدارک ناقص، اسناد تحت مسئولیت کاربر، نگهداری/انقضا و بازیابی اسناد آرشیوشده محدود شد. «پیگیری» نمای کلی و همه نماهای شخصی نیز به Queryهای واقعی وصل‌اند.
- تقویم فرم‌های اسناد دیگر Dropdown ماه/سال ندارد: ماه‌ها و سال‌ها در شبکه‌های ۱۲تایی هم‌تم Rubi انتخاب می‌شوند و پیمایش بازه سال، شمسی/میلادی و ذخیره Gregorian ISO حفظ شده است. ۵۹۸ تست Web، lint، typecheck و Production Build موفق و انتخاب واقعی `۱۴۰۶ / مهر / ۱` در مرورگر تأیید شد.
- Migration افزایشی `20260903110000_documents_incomplete_status` روی PostgreSQL خالی و دیتابیس محلی اعمال شد. ۷ Fixture تصویری آماده مشاهده‌اند؛ Full lint/typecheck/build و ۱٬۴۷۰ تست موفق است و ۷۰ تست PostgreSQL اختیاری skip شدند. Smoke مرورگر بدون تغییر داده تمام رفتارهای اصلی را تأیید کرد.
- PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شد؛ `main` دست‌نخورده ماند و Task برابر `DONE/MERGED` است. جزئیات: `docs/tasks/DOCUMENTS-004-OPERATIONS.md`.

## TICKET-CATALOG-003 — نمایش ظرفیت باقی‌مانده روی کارت بلیت — آماده بررسی

- `PC-A` روی Branch مستقل `codex/pc-a-ticket-card-remaining-capacity` کارت بلیت را به مدل موجودی Ticket Catalog متصل کرد؛ کارت اکنون ظرفیت کل و مانده را کنار هم و با تفکیک دیداری روشن نمایش می‌دهد.
- مانده با تابع دامنه `inventoryTotals` محاسبه می‌شود و تخصیص‌های `held` و `confirmed` را کسر می‌کند. Workspace مرورگر فعلی تا اتصال قرارداد عمومی Reservations تخصیص ساختگی ایجاد نمی‌کند، بنابراین در داده‌های فعلی مانده با کل برابر است.
- هر ۹۵ تست Ticket Catalog Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. هیچ Schema/Migration/Seed، Dependency/Lockfile، قرارداد عمومی، IAM یا فایل ماژول Reservations تغییر نکرد.

## MARKETING-001C — تکمیل صفحات داخلی مارکتینگ — ادغام‌شده

- `PC-B` روی `codex/pc-b-marketing-inner-pages-parity` صفحات عمومی داخل سکشن‌ها را با
  ۴۵ زیرصفحه تخصصی همان مرجع جایگزین کرد؛ داشبورد کامل، ۹ تب جزئیات کمپین و همه داده‌های
  آزمایشی مرجع نیز وارد Workspace واقعی Rubi شدند.
- جست‌وجو، فیلتر، صفحه‌بندی، سگمنت‌ساز، پیش‌نمایش زنده پیام، کتابخانه محتوا، پیشنهادها،
  سفر مشتری، گزارش‌های ده‌گانه و تنظیمات تعاملی‌اند. تقویم و فیلترها فقط از کامپوننت‌های
  مشترک Rubi استفاده می‌کنند و هیچ Persistence، API، ارسال واقعی یا اثر مالی ندارند.
- Web lint و `599/599` تست، Full lint با ۶ Task و Full test با `1,464` تست موفق و ۷۰
  تست PostgreSQL اختیاری skip شدند. Browser QA همه تب‌ها، فرم ۹مرحله‌ای و Mobile
  `390×844` را بدون Overflow یا Console warning/error تأیید کرد.
- Typecheck محلی بدون کش و هر چهار Job تمیز CI شامل Full Typecheck، Full Production
  Build، Full Test و PostgreSQL 18/Migration/Seed موفق‌اند. خطای موقت `observedAt` فقط
  از کش افزایشی قدیمی محلی بود و فایل Master Data در این Task تغییر نکرد.
- PR [#86](https://github.com/nirvanamahlou/Rubi/pull/86) با Merge Commit `4ea7b27`
  وارد `develop` شد؛ اجرای کامل CI پس از ادغام روی خود `develop` نیز سبز است.
## CUSTOMER-DOCUMENTS-001 — مدارک واقعی در Customer 360 — آماده بررسی

- `PC-A` وضعیت «در انتظار زیرساخت مدارک» را با پنل واقعی فهرست و بارگذاری فایل جایگزین کرد. هر مشتری اکنون تعداد، کد آرشیو، نوع، نسخه، تاریخ اعتبار و وضعیت اسکن مدارک خودش را می‌بیند و می‌تواند از همان پرونده فایل جدید اضافه کند.
- قرارداد عمومی Documents به‌صورت backward-compatible فیلتر exact source گرفت. Backend مرجع سه‌بخشی را کامل اعتبارسنجی و همراه Branch/Domain/Permission scope روی Relation اصلی اعمال می‌کند؛ پاسخ هیچ source id خامی افشا نمی‌کند.
- Customers فقط مصرف‌کننده Public Contract/API است و هیچ دسترسی مستقیم به Repository یا جدول Documents ندارد. UI باز PR #80 و فایل‌های تقویم/اسناد PC-B نیز تغییر نکرده‌اند.
- ذخیره ساخت‌یافته شماره پاسپورت، کشور صادرکننده و شماره ویزا همچنان تا تصمیم `DEC-OPEN-006` مسدود است؛ ولی خود فایل‌ها اکنون با قرنطینه، نسخه و کنترل دسترسی فعلی Documents عملیاتی‌اند.
- Full lint/typecheck/build پاس و `1470` تست Monorepo موفق است؛ `70` تست PostgreSQL اختیاری skip شدند. Migration، Schema، Seed، Dependency و Lockfile تغییر نکرده‌اند. جزئیات: `docs/tasks/CUSTOMER-DOCUMENTS-001.md`.

## MASTER-004-FORM-ALIGNMENT — هم‌ترازی فرم‌های اطلاعات پایه — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-master-data-form-alignment` تجربه جغرافیا را در یک نمای شهر/استان یکپارچه و فرم شهر را به انتخاب اجباری کشور و سپس استان وابسته کرد؛ Schema مستقل Region/City و FK واقعی آن‌ها حفظ شده است.
- ترتیب نمایش به همه فرم‌های اطلاعات پایه افزوده شد؛ وضعیت پیش‌فرض فعال است، اعداد طولانی در ورودی سه‌رقمی گروه‌بندی می‌شوند و DatePicker مشترک انتخاب مستقیم ماه/سال و رقم انگلیسی در تقویم میلادی دارد.
- فرم‌های ارز، گردش نرخ، سازمان/تأمین‌کننده/کارگزار، هتل، حمل‌ونقل، ویزا و مراجع فروش مطابق درخواست مالک ساده شدند. Exportهای Excel ارز، روش پرداخت و جغرافیا حذف و لوگوی شرکت‌ها/سازمان‌ها از مسیر عمومی Documents در همان فرم قابل بارگذاری است.
- Migration افزایشی `20260902173500_master_data_form_alignment` فقط ستون یا default سازگار اضافه و چند FK/فیلد را اختیاری می‌کند؛ هیچ ستون قدیمی حذف نشده است. Migration روی PostgreSQL محلی اعمال و Prisma validate موفق شد.
- Web با `586/586` تست و API با `776/776` تست موفق است؛ lint، typecheck، قرارداد مشترک، API build و Web production build پاس شدند. هشدارهای CSS قدیمی build مانع تولید خروجی نشدند.
- قفل‌های Migration، Master Data Contract، Shared Calendar و Central Docs تا پایان Review نزد `PC-B/MASTER-004-FORM-ALIGNMENT` می‌مانند. Merge خودکار به `develop` انجام نمی‌شود و PC-A باید پس از Review، Branch/PR تحویلی و Migration جدید را مصرف کند.

## TICKET-CATALOG-002 — حذف الزام زمان از تعریف بلیت — آماده بررسی

- `PC-A` روی Branch مستقل `codex/pc-a-ticket-catalog-optional-schedule` تاریخ حرکت/رسیدن و شروع/پایان اعتبار نرخ را از فرم تعریف بلیت حذف کرد. ثبت بلیت جدید دیگر مقدار زمانی ساختگی تولید نمی‌کند و مقادیر زمان‌بندی‌شده قبلی هنگام ویرایش دست‌نخورده باقی می‌مانند.
- اعتبارسنجی Web و API جفت‌های زمانی کاملاً خالی را می‌پذیرد و فقط ورود ناقص یا ناسازگار را رد می‌کند. فهرست و جزئیات برای بلیت بدون تاریخ عبارت «بدون زمان‌بندی» نشان می‌دهند و فیلتر تاریخ رکورد بدون زمان‌بندی را به‌اشتباه برنمی‌گرداند.
- Follow-up مدیریت فروش بلیت نیز آماده است: توقف فروش با دکمه واضح، فیلتر مبدأ/مقصد، شمارش موجودی تعریف‌شده هر مسیر و تب فقط‌خواندنی «بلیت‌های صادرشده مسافران» با فیلتر قرارداد، مسافر، شماره بلیت/PNR، مسیر، ایرلاین، وضعیت و بازه صدور.
- همه کارت‌ها کنترل آیکونی پاور دارند: قرمز برای توقف فروش، سبز برای فعال‌سازی و خاکستری غیرفعال برای بلیت لغوشده؛ متن دیداری حذف شده و عنوان راهنما و aria-label باقی مانده‌اند. ویرایش در پیش‌نویس، فعال، متوقف و لغوشده قابل انجام است؛ وضعیت خود بلیت هنگام ویرایش حفظ می‌شود و بلیت لغوشده همچنان مستقیماً قابل فعال‌سازی نیست.
- فعال‌سازی مجدد دیگر به بازه اعتبار نرخ خرید وابسته نیست؛ این بازه قدیمی یا منقضی مانع فروش نمی‌شود، چون قیمت فروش در Sales تعیین می‌شود. ظرفیت مثبت و اعتبار اطلاعات اصلی بلیت حفظ شده‌اند.
- تعریف بلیت ترکیبی نیز اضافه شد: یک بلیت می‌تواند ۲ تا ۸ قطعه متصل هم‌نوع داشته باشد؛ فرم قطعه‌ها را اضافه/حذف/ویرایش می‌کند، اتصال شهر/فرودگاه و ترتیب زمانی در Web و API اعتبارسنجی می‌شود و فهرست، جزئیات، جست‌وجو، فیلتر و تکرار از اولین مبدأ تا آخرین مقصد کار می‌کنند. نمونه مشهد–تهران–شیراز برای بازبینی رابط آماده است.
- صدور/استرداد و رکورد مسافر همچنان متعلق به Reservations است؛ تب جدید تا انتشار قرارداد عمومی آن ماژول هیچ داده ساختگی یا Persistence ایجاد نمی‌کند. ۹۵ تست Ticket Web و ۴۷ تست Ticket API، lint و typecheck کامل، ۱٬۴۵۹ تست Monorepo و Production Build کامل با ۳۴ Route موفق است. هیچ Prisma، Migration، Seed، Dependency، Lockfile یا قرارداد عمومی تغییر نکرد.

## DOCUMENTS-003F — انتخاب پرونده جست‌وجویی در بارگذاری سند — ادغام‌شده

- PR #81 با Merge Commit `ad6ff5d` پس از موفقیت کامل CI وارد `develop` شد. `PC-B` چهار ورودی فنی ارتباط سند را با یک Dropdown جست‌وجویی «پرونده مربوطه» جایگزین کرد؛ کاربر اکنون نام پرونده را می‌بیند و دیگر ماژول، نوع رکورد یا شناسه مبدأ را دستی وارد نمی‌کند.
- Endpoint افزایشی `case-options` فقط Relationهای موجود Documents را در شعبه انتخاب‌شده، Domain مجاز و سطح محرمانگی قابل مشاهده جست‌وجو می‌کند. پاسخ فقط شناسه داخلی انتخاب و عنوان نمایشی دارد و شناسه واقعی رکورد مبدأ را افشا نمی‌کند.
- Upload، Relation انتخاب‌شده را دوباره سمت سرور و با همان Scope کنترل می‌کند و مقادیر canonical را استفاده می‌کند؛ بنابراین تغییر دستی درخواست نمی‌تواند سند را به پرونده حذف‌شده، محرمانه غیرمجاز یا شعبه دیگر متصل کند. فیلدهای قدیمی API فقط برای سازگاری مصرف‌کننده‌های قبلی باقی مانده‌اند.
- هیچ Schema/Migration/Seed، Permission، Dependency/Lockfile یا Query مستقیم جدول ماژول دیگر اضافه نشد. اتصال پرونده کاملاً داخل مرز Documents باقی می‌ماند.
- Full lint/typecheck/build موفق و ۱٬۳۹۵ تست موفق‌اند؛ ۷۰ تست PostgreSQL اختیاری طبق Suite معمول skip شدند. Smoke واقعی روی دیتابیس محلی، نمایش ۱۴ گزینه، جست‌وجوی دو نتیجه‌ای «قرارداد» و انتخاب موفق را بدون ثبت داده تأیید کرد. جزئیات: `docs/tasks/DOCUMENTS-003F-RELATED-CASE-PICKER.md`.

## LEGAL-ENTITY-BRAND-LOGO-001 — لوگوی پویا برای شرکت فعال — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-jahan-bastan-logo`، نمایش برند App Shell را به شرکت فعال متصل می‌کند تا با انتخاب «جهان باستان»، لوگوی افقی ارسالی جای برند نیایش سیر نمایش داده شود.
- این Slice فقط Web UI، Asset و تست هدفمند را دربر می‌گیرد و هیچ تغییر Database، Migration، Seed، Backend، Contract، Dependency/Lockfile، Permission یا داده کاربر ندارد.
- پیاده‌سازی تکمیل شد: Brand داخل Provider، تغییر Context را بلافاصله دریافت می‌کند؛ لوگو، نام و متن جایگزین برای جهان باستان پویا هستند و نیایش سیر بدون تغییر باقی می‌ماند. فایل خروجی با تصویر ورودی SHA-256 یکسان دارد.
- پیش از Integration هر ۵۵۲ تست Web و Smoke لوکال API/Web/Asset موفق بود. پس از ادغام بدون Conflict تغییرات PC-A از `origin/develop@f78e70e`، Full lint/typecheck/build و ۱٬۳۸۳ تست Workspace موفق شدند؛ Web هر ۵۶۵ تست را گذراند و ۷۰ تست PostgreSQL اختیاری طبق Suite معمول skip ماندند. قفل‌های این کار آزاد شدند.

## DOCUMENTS-003D — تعاملات آرشیو، فرم پایدار و راه‌اندازی PC-A — ادغام‌شده

- PR #78 با Merge Commit `869a043` وارد `develop` شد؛ `main` تغییر نکرده است. PC-A پس
  از Pull همین `develop` و اجرای فرمان محلی مستندشده، دیتابیس و Storage آزمایشی خودش را
  می‌سازد.
- `PC-B` کارت‌های مدیریت آرشیو را از نمایش‌های بی‌عمل به دکمه‌های قابل دسترس تبدیل کرد؛
  هر کارت اکنون نمای مرتبط اسناد را با فیلتر یا مرتب‌سازی مشخص باز می‌کند و بازخورد روشن
  می‌دهد.
- گزینه‌های فرم بارگذاری، کاربر جاری و شعبه‌های مجاز اکنون با یک پاسخ Documents دریافت
  می‌شوند. خطای تمدید مستقل نشست IAM دیگر Dropdownهای سالم را خالی نمی‌کند؛ مقدارهای
  اولیه داخل فرم ثبت، ورودی‌های غیر Native صریح اعتبارسنجی و منوی Select بالاتر از Dialog
  نمایش داده می‌شود. خطای Upload نیز دیگر فایل و فیلدهای واردشده را پاک نمی‌کند.
- فرمان `documents:demo:apply` برای هر دستگاه یک مسیر آماده‌سازی کامل دارد: تولید Client،
  اعمال Migrationهای موجود، Seed معمول، Build و ساخت idempotent هفت سند محلی. پایان موفق
  فقط وقتی اعلام می‌شود که هر هفت رکورد واقعاً `CLEAN` و قابل مشاهده باشند. Git همچنان
  فقط کد و Fixture ساختگی را منتقل می‌کند، نه دیتابیس یا Secret محلی.
- هیچ Schema/Migration، Permission، Dependency/Lockfile یا Seed عمومی تغییر نکرده است؛
  Runner فقط خطای گذرای Seed اتمیک و idempotent محلی را یک‌بار تکرار می‌کند.
  جزئیات و دستور PC-A در `docs/tasks/DOCUMENTS-003D-LOCAL-INTERACTIONS.md` ثبت شده است.
- lint، typecheck و Build کامل Monorepo موفق‌اند؛ ۱٬۳۹۰ تست موفق و ۷۰ تست PostgreSQL
  اختیاری skip شدند. Apply واقعی و تکراری پس از Backup خصوصی هر هفت سند را با
  `readyForViewing=true` و `verifiedRecords=7` تأیید کرد.

## CI-001 — CI مشترک PC-A و PC-B — آماده بررسی

- `PC-B` روی Branch و Worktree مستقل `codex/pc-b-ci-foundation` یک GitHub Actions
  مشترک برای Push و PRهای `codex/pc-a-*`، `codex/pc-b-*`، `develop` و `main` آماده
  کرده است. این Workflow فقط Checkout خواندنی دارد و هیچ Commit، Push، Merge یا Deploy
  انجام نمی‌دهد.
- Concurrency با ترکیب نوع رخداد و Head Branch جدا می‌شود؛ اجرای PC-A و PC-B مستقل است،
  Push و PR یکدیگر را لغو نمی‌کنند و فقط اجرای قدیمی همان رخداد روی همان Branch متوقف
  می‌شود. PostgreSQL 18 و تمام داده‌های آزمون داخل runner موقت و synthetic هستند.
- Gateها شامل نصب frozen با Node/pnpm دقیق Repository، Prisma format/validate/generate،
  Prettier فایل‌های تغییرکرده، Full Monorepo lint/typecheck/test/build و اجرای هر ۲۸
  Migration به‌همراه Seed دوگانه است. Prettier فقط تغییرات جدید را کنترل می‌کند تا بدهی
  قالب‌بندی ۵۰۷ فایل قدیمی باعث توقف Branchهای جاری نشود.
- اعتبارسنجی محلی: lint، typecheck، همه تست‌ها و Production Build موفق؛ ۲۸ Migration روی
  PostgreSQL 18 خالی اعمال شد و Seed دوبار موفق بود. هیچ Schema، Migration، Dependency،
  Lockfile، کد ماژول، دیتابیس توسعه یا سرور PC-A/PC-B تغییر نکرد. جزئیات:
  `docs/tasks/CI-001.md`.

## DOCUMENTS-003C — بسته داده نمایشی قابل اجرای اسناد — ادغام‌شده

- `PC-B` بسته صریح و محلی ساخت هفت سند نمونه را با PR #72 و Merge Commit `a2b5b9e`
  وارد `develop` کرد. Git فقط تعریف‌های ساختگی و مولد تصویر را نگه می‌دارد؛ هر دستگاه
  رکوردها و فایل‌های رمزگذاری‌شده را روی PostgreSQL و Storage محلی خودش می‌سازد.
- دامنه‌های هویت مشتری، فروش، سفر، خرید و منابع انسانی پوشش داده شده‌اند. دو سند نزدیک
  انقضا و یک سند منقضی وجود دارد و هر هفت فایل PNG واقعی پس از Scan پاک قابل Preview
  هستند. هیچ نام/شماره هویتی، مسافر، مبلغ، حساب، رمز یا فایل واقعی در بسته نیست.
- Preview بدون Write، Apply با Microsoft Defender واقعی، اجرای مجدد بدون Duplicate و
  مشاهده هفت سند و یک Preview PNG از API زنده موفق بود. تست PostgreSQL مستقل، تست‌های
  عمومی و Build API نیز موفق‌اند. راه‌اندازی PC-A در
  `docs/tasks/DOCUMENTS-003C-DEMO-BOOTSTRAP.md` ثبت شده است.
- Follow-up یکپارچه‌سازی CI، تشخیص Windows drive root و UNC را روی Windows/Linux یکسان
  و fail-closed کرد؛ مسیرهای scoped معتبر حفظ و ۱۴ تست Fixture موفق شدند.

## IAM-003 — پایداری ورود و نشست چندتب — ادغام‌شده

- `PC-B` با درخواست صریح مالک روی `codex/pc-b-iam-login-stability`، Hotfix محدود IAM را
  پیاده کرد و PR #68 با Merge Commit `bba6cc0` در `develop` ادغام شد. اجرای مجدد Bootstrap دیگر رمز، وضعیت یا شمارنده
  ورود کاربر موجود را بازنویسی نمی‌کند و فقط اتصال idempotent نقش مدیر/شعبه را تضمین می‌کند.
- Rotation نشست اکنون با claim اتمیک انجام می‌شود. Token منطبق که حداکثر پنج ثانیه قبل
  توسط تب دیگر Rotate شده، پاسخ conflict قابل‌بازیابی می‌گیرد و خانواده Session را revoke
  نمی‌کند؛ Token نامنطبق یا reuse خارج از grace همچنان fail-closed است. Customers و
  Documents از helper و Web Lock مشترک استفاده می‌کنند.
- صفحه Login فقط پاسخ 401 را «نام کاربری یا رمز نادرست» نشان می‌دهد؛ Validation، محدودیت
  تلاش، خطای سرور و قطع ارتباط پیام‌های مستقل دارند.
- ۷۱۷ تست API و ۵۴۴ تست Web، lint، typecheck و Build کامل API/Web موفق‌اند. نسخه جدید
  روی API4000/Web3100 فعال است؛ Health/Login برابر ۲۰۰ و Validation خالی برابر ۴۰۰ است.
  پس از Merge و با درخواست صریح مالک، بازیابی محلی رمز `nirvana` روی PC-B با Backup، لغو نشست‌های
  قدیمی و ورود/خروج واقعی ۲۰۰/۲۰۴ انجام شد؛ هیچ Secretی وارد Git نشد. جزئیات:
  `docs/tasks/IAM-003-LOGIN-STABILITY.md`.

## DOCUMENTS-003B — پیش‌نمایش امن تصویر — آماده بررسی

- `PC-B` روی شاخه فرزند `codex/pc-b-documents-image-preview` و Draft PR #67 پیش‌نمایش
  واقعی JPEG/PNG را به تب جزئیات سند افزود. فایل فقط پس از Scan واقعی `CLEAN`، مجوز
  مشاهده، Scope شعبه و کنترل محرمانگی تحویل می‌شود؛ URL عمومی یا ذخیره پایدار در مرورگر
  ساخته نمی‌شود.
- مسیر inline احراز‌شده، Audit مستقل `documents.file.preview`، دلیل مشاهده سند محرمانه
  و کدگذاری امن متن فارسی تکمیل شدند. Blob URL با Abort و cleanup آزاد می‌شود؛ فایل‌های
  غیرتصویری همچنان از دانلود مجاز استفاده می‌کنند.
- API و Web: lint/typecheck/build موفق؛ ۷۰۸ تست API موفق با ۶۶ skip اختیاری و ۵۱۶ تست
  Web موفق. نسخه جدید روی API4000 و Web3100 لوکال فعال است. جزئیات:
  `docs/tasks/DOCUMENTS-003B.md`.

## DOCUMENTS-003A — تجربه کامل لوکال و اسکن واقعی — آماده بررسی

- `PC-B` روی شاخه مستقل `codex/pc-b-documents-usability`، فرزند
  `codex/pc-b-documents-vertical-slice@37558aa`، Draft PR #65 را آماده کرد. نمای مستقل
  فعالیت حذف و Timeline فقط داخل جزئیات فایل حفظ شد. این Slice به `develop` Merge نشده و
  والدها را تغییر نمی‌دهد.
- اشتراک‌گذاری داخلی اکنون برای تمام اسناد لینک مستقیم قابل کپی دارد؛ لینک ورود و مجوز
  همان سند را الزام می‌کند و هیچ دسترسی عمومی یا دانلود بدون Scan نمی‌سازد.
- چهار نمای شخصی فعال‌اند: مالکیت و بارگذاری از Backend، اخیراً دیده‌شده از Audit همان
  کاربر و علاقه‌مندی‌ها به‌صورت شناسه‌های تفکیک‌شده کاربر در مرورگر. رابط و منوی داخلی با
  رنگ آبی روشن، Active state، سایه و Hover یکدست شده‌اند.
- Microsoft Defender واقعی روی PC-B به صف پردازش متصل شد. تطبیق SHA-256 قبل از اسکن و
  رفتار fail-closed حفظ شده است. هر ۶ فایل آزمایشی لوکال واقعاً `CLEAN`، Jobها `COMPLETED`
  و قرنطینه‌ها `RELEASED` شدند؛ Backup خصوصی پیش از پردازش تهیه شد.
- lint/typecheck/build API، Web و Contracts موفق؛ ۱٬۲۳۴ تست موفق و ۶۶ تست اختیاری skip.
  Smoke مرورگر احراز‌شده تمام مسیرهای شخصی، لینک، جزئیات، Timeline و وضعیت اسکن را پوشش داد.
  جزئیات: `docs/tasks/DOCUMENTS-003A.md`.

## DOCUMENTS-002 — Vertical Slice واقعی و Stacked — آماده بررسی

- `PC-B` یک Slice مستقل روی `codex/pc-b-documents-vertical-slice` و والد
  `codex/pc-b-documents-foundation@05b09e8` آماده کرده است. Phase A همچنان Draft PR #61
  و ادغام‌نشده است؛ Draft PR #64 مستقیماً به `develop` نمی‌رود و تا Merge والد همان
  Branch والد را هدف می‌گیرد.
- Persistence افزایشی Documents، قرارداد `documents.v1`، ۲۸ Permission، ۱۹ نوع سند،
  ۹ دسته، REST API واقعی، Storage محلی رمزگذاری‌شده، `/documents` متصل، Dialog بارگذاری
  و جزئیات شش‌تب تکمیل شدند. Binary در Database نیست و دانلود تا Scan پاک fail-closed است.
- نقش‌های Archive/Sales/Finance/HR از هم جدا هستند؛ Finance و HR به محتوای خارج از Domain
  خود دسترسی ندارند و Archive محتوای حساس را Mask‌شده و بدون دانلود می‌بیند.
- ۲۸ Migration از صفر و Seed دوگانه روی PostgreSQL 18، lint/typecheck/build کامل و
  ۱٬۲۹۶ تست عمومی پاس شدند. Smoke واقعی مرورگر بارگذاری، تاریخ شمسی/میلادی، دسترسی چهار
  نقش و Desktop/Mobile را پوشش داد؛ تمام داده‌ها و زیرساخت Synthetic پس از تست حذف شدند.
- Adapter تولیدی S3/MinIO، Antivirus Worker، retention قطعی، اشتراک امن، Export و اتصال
  producerها Deferred هستند. جزئیات: `docs/tasks/DOCUMENTS-002.md`.

## یکدست‌سازی اکشن‌های فیلتر اطلاعات پایه — 2026-08-31

- `MASTER-003-FILTER-ACTIONS` روی شاخه `codex/pc-b-master-data-filter-actions` به‌صورت Stacked روی تحویل حذف نوارهای قفل‌دار آماده Review است. تمام Workspaceهای تخصصی و fallback عمومی از کامپوننت مشترک «پاک‌کردن / تازه‌سازی» استفاده می‌کنند.
- اکشن‌ها در ردیف پایینی تمام‌عرض FilterBar و سمت چپ چیدمان RTL قرار دارند؛ هر دو Button دارای Border، پس‌زمینه، آیکون و حالت‌های Hover/Focus هستند. منطق فیلترها، داده، مجوز، صفحه‌بندی و API تغییر نکرده است.
- ۵۳۴ تست Web، Typecheck، lint کامل Web و Production Build موفق‌اند. بررسی زنده روی `localhost:3101/master-data/geography` چیدمان، فیلتر تاریخ و نبود نوار قفل را تأیید کرد. سرور PC-A روی پورت ۳۱۰۰ و Checkout آن دست‌نخورده‌اند.

## تثبیت حذف نوارهای قفل‌دار زیر KPI اطلاعات پایه — 2026-08-31

- `MASTER-003-REMOVE-LOCK-NOTES` روی شاخه `codex/pc-b-master-data-remove-lock-notes` و به‌صورت Stacked روی تحویل فیلتر تاریخ آماده Review است. هر هشت Workspace تخصصی و fallback عمومی مستقیماً از KPI به فیلترها می‌رسند و نوار ثابت قفل/قاعده میان آن‌ها ندارند.
- آزمون رگرسیون از تطبیق ۱۸۰ نویسه‌ای به بررسی کامل محتوای بین `MasterDataKpiGrid` و `FilterBar` ارتقا یافت؛ `Alert`، `Card`، آیکون‌های قفل/قاعده و عنوان‌های «قاعده یکپارچگی/مرز دامنه» در این محل رد می‌شوند. پیام‌های دسترسی، نتیجه عملیات و منطق حذف امن حفظ شده‌اند.
- ۵۲۳ تست Web، Typecheck، lint کامل Web و Production Build موفق‌اند. بررسی Process نشان داد `localhost:3100` از Checkout مستقل PC-A در `C:\Users\admin\Rubi-documents-vertical-slice` اجرا می‌شود؛ به همین علت نسخه قدیمی هنوز در آن پورت دیده می‌شود. Checkout و پردازش PC-A تغییر یا متوقف نشدند.

## فیلتر بازه تاریخ اطلاعات پایه — 2026-08-31

- `MASTER-003-DATE-RANGE-FILTERS` روی شاخه `codex/pc-b-master-data-date-filters` به‌صورت Stacked روی نسخه حذف نوارهای KPI آماده Review است؛ `develop`، Checkout و Web پورت ۳۱۰۰ متعلق به PC-A تغییر نکردند.
- در مالی و پولی، جغرافیا، سازمان‌ها و تأمین‌کنندگان، اقامت، حمل‌ونقل، بیمه، تور و خدمات سفر، مراجع فروش و fallback عمومی یک گروه جمع‌وجور «از تاریخ / تا تاریخ» افزوده شد. تقویم مشترک داخل Popup کلید شمسی/میلادی دارد، تاریخ پایدار Gregorian ISO نگهداری می‌شود و بازه مستقل یا همراه پاک‌کردن همه فیلترها قابل حذف است.
- Query افزایشی `createdFrom`/`createdTo` روی `createdAt` پیش از Pagination و Export اعمال می‌شود؛ روز پایان inclusive است. تاریخچه نرخ ارز همین کنترل را روی `observedAt` می‌گیرد. ورودی نامعتبر یا بازه معکوس در API رد می‌شود؛ نبود تاریخ دقیقاً رفتار قبلی را حفظ می‌کند. بدون Schema/Migration، Calendar، Customers، Dependency یا تغییر داده.
- ۵۲۳ تست Web و ۶۷۱ تست API موفق؛ Typecheck، lint محدوده و Production Build Web/API/Contract پاس شدند. بررسی بصری روی پورت موقت ۳۱۰۱ چیدمان فشرده، برچسب‌ها و هر دو تقویم را تأیید کرد؛ سرور موقت سپس بسته شد.

## حذف نوارهای توضیحی زیر KPI اطلاعات پایه — 2026-08-31

- `MASTER-003-REMOVE-KPI-NOTES` روی شاخه `codex/pc-b-master-data-remove-kpi-notes` از `origin/develop@03e4c43` آماده Review است.
- نوارهای قاعده/مرز دامنه بلافاصله زیر کارت‌های KPI در هفت Workspace جغرافیا، سازمان‌ها و تأمین‌کنندگان، اقامت، حمل‌ونقل، بیمه، خدمات سفر و مراجع فروش حذف شدند. صفحه مالی و پولی چنین نوار مستقلی نداشت؛ KPIها، تب‌ها، فیلترها، جدول‌ها، Popupها و پیام‌های عملیاتی حفظ شدند.
- تغییر فقط در Presentation و آزمون Web است؛ Customers، Calendar، API/Contract، Schema/Migration، Seed، Dependency/Lockfile و داده محلی تغییر نکردند. یک آزمون سراسری از بازگشت Alert/Card توضیحی بلافاصله پس از KPI جلوگیری می‌کند.
- ۵۱۱ تست Web، Typecheck، lint فایل‌های متاثر و Production Build موفق‌اند. API روی پورت ۴۰۰۰ پاسخ ۲۰۰ دارد و Web روی ۳۱۰۰ فعال است؛ مسیر اطلاعات پایه بدون Session مطابق قرارداد ۳۰۷ به Login هدایت می‌شود.

## انتشار قابل اجرای داده نمایشی برای PC-A — 2026-08-31

- پس از Merge #60، تعریف ۷۸ Fixture در `develop` موجود است اما رکوردهای PostgreSQL میان کامپیوترها با Git منتقل نمی‌شوند. `MASTER-003-DEMO-BOOTSTRAP` یک فرمان استاندارد Root برای Preview و Apply همان Fixture روی دیتابیس لوکال هر توسعه‌دهنده اضافه می‌کند.
- محافظ‌های محیط/مقصد، تراکنش، Audit، تکرارپذیری و عدم بازنویسی داده کاربر حفظ می‌شوند. این کار Seed عمومی یا Startup را تغییر نمی‌دهد و هیچ داده نمایشی را وارد Production نمی‌کند.
- فرمان Preview روی DB لوکال هر ۷۸ Fixture را بدون ساخت تکراری بازیابی و Rollback کرد؛ ۹ آزمون PostgreSQL روی DB مستقل و حذف‌شونده موفق بودند. ۱٬۲۵۹ تست عمومی، lint، typecheck و Production Build کامل نیز پاس شدند. Dependency/Lockfile، Migration و داده کاربردی تغییر نکردند.

## ادغام تکمیلی اطلاعات پایه با develop — 2026-08-31

- با تأیید صریح مالک برای Push و Merge، شاخه `codex/pc-b-master-data-develop-integration` از `origin/develop@e25f288` (#58 ادغام‌شده) ساخته شد و تاریخچه دقیق #59 / `b04c2bd` شامل #57 را دریافت کرد. والد #55/#54 و حمل‌ونقل جداگانه #47 قبلاً در #58 حضور دارند؛ تغییرات PC-A و اصلاح امنیتی XLSX/Calendar حفظ شدند.
- نسخه ترکیبی: نصب frozen، lint و typecheck کامل، Production Build، ۱٬۲۵۷ تست عمومی و ۶۶ آزمون واقعی PostgreSQL موفق. ۲۷ Migration از صفر و Seed دوگانه روی دیتابیس مستقل پاس شدند. تنها Migration تازه نسبت به develop همان ترتیب کشور است؛ هیچ Migration تاریخی تغییر نکرده است.
- Smoke احراز‌شده: فهرست هر ۴۵ کاتالوگ، ثبت/نمایش/فیلتر، پاور وضعیت و خطای نسخه قدیمی، وابستگی‌ها و Excel واقعی؛ همچنین ۱۱ مسیر Production فارسی RTL شامل اطلاعات پایه، Customers و Ticket Catalog موفق. این بررسی HTTP است و ادعای تست تعاملی مرورگر ندارد.
- گزارش ابزار OpenAPI تغییر ناسازگار جدیدی نیافت؛ کمبود مستندات Swagger قبلی با امتیاز یکسان F باقی است و «بازبینی کامل و پاک API» ادعا نمی‌شود. جزئیات و خروجی‌های بررسی در `docs/tasks/MASTER-003-DEVELOP-INTEGRATION.md` ثبت شده‌اند.
- Merge نهایی فقط با نتیجه تأییدشده PR گزارش می‌شود. Checkout و سرورهای اصلی، داده و کلیدهای محلی، شاخه‌های منبع و قفل‌های توسعه PC-B دست‌نخورده‌اند؛ تنها دیتابیس‌ها/کانتینرهای آزمایشی همین اجرا پس از آزمون حذف شدند. گزارش‌های زیر تاریخچه Snapshotهای قبلی‌اند.

## نسخه مشترک دو کامپیوتر — SHARED-INTEGRATION-0831 — در حال اعتبارسنجی

- هدف مالک محصول یک نسخه مشترک در develop است: اطلاعات پایه PC-B تا PR #55، مشتریان PC-A تا PR #56 و بلیت PC-A تا PR #46.
- سه Snapshot منتشرشده ترکیب و تعارض‌ها با حفظ اصلاح امنیتی Excel و گزارش‌های دو طرف حل شدند؛ Merge نهایی به develop و همگام‌سازی PC-B هنوز انجام نشده است.
- ۲۶ Migration با حفظ بایت‌های تاریخی روی PostgreSQL آزمایشی خالی اعمال شدند. داده کاربردی، کلیدها، Volumeها و Branchهای منبع دست‌نخورده‌اند.
- نصب frozen، lint، typecheck، ۱۲۲۱ تست عمومی، ۵۷ تست واقعی PostgreSQL، Seed دوگانه، Build کامل و Smoke احراز‌شده مشترک پاس شدند. Dependency/Lockfile تغییر نکرده است. اختلاف قدیمی نام Constraint/Indexها و Default لیدر در گزارش Task ثبت شده؛ هیچ Migration تاریخی بازنویسی نشد.
- بلیت همچنان Phase A/Preview است. قیمت نهایی فروش متعلق به Sales است؛ صدور و Manifest در Reservations می‌مانند. تغییر رمز IAM موجود در PR #46 برابر حداقل ۱۰ نویسه همراه همه شروط نوع نویسه است؛ این Task حسابی ایجاد نمی‌کند.
- گزارش‌های پایین تاریخی‌اند. قفل‌های توسعه اطلاعات پایه نزد PC-B باقی می‌مانند و این ادغام قفل توسعه جدیدی منتقل نمی‌کند.

آخرین به‌روزرسانی: 2026-08-31 — اصلاح نمایش فهرست مالی و جغرافیا پس از ثبت فرم

آخرین به‌روزرسانی: 2026-08-31 — کنترل وضعیت، فیلترها و تکمیل فهرست‌های اطلاعات پایه

## اصلاح کاربردپذیری کاتالوگ‌ها — 2026-08-31

- `MASTER-003-CATALOG-USABILITY` روی شاخه مستقل `codex/pc-b-master-data-catalog-usability` از #57 / `6abd960` آماده Review است. نسخه‌های تحویلی/والدها و PC-A دست‌نخورده‌اند. در بررسی نهایی #58 در `origin/develop@e25f288` ادغام شده بود؛ تغییرات این درخواست هنوز جزو آن Snapshot نیستند.
- دکمه Power برای وضعیت واقعی با نسخه و Permission، دو فیلتر ستونی قابل پاک‌کردن در هر کاتالوگ و ستون‌های ماکاپ حمل‌ونقل/هتل/جغرافیا تکمیل شد. تعداد وابستگی‌ها از FKهای واقعی Master Data است. داده بیرون از مالکیت ماژول بدون قرارداد جعل نمی‌شود؛ نرخ‌ها تابع گردش اختصاصی خود هستند، نه Power عمومی.
- Migration افزایشی `20260831140000_master_country_display_order` ترتیب کشور را با پیش‌فرض صفر و قید 0..100000 اضافه می‌کند. روی PostgreSQL 18 خالی همراه ۲۴ Migration قبلی و سپس روی لوکال پس از Backup اجرا شد. هیچ Customer، Calendar، Dependency یا داده عملیاتی دیگر تغییر نکرد.
- فقط ۷۸ Fixture قابل انتساب و بدون ویرایش کاربر به نام‌های طبیعی‌تر تغییر یافتند؛ ID/FK محفوظ و اجرای دوم صفر تغییر داشت. کسب‌وکارها نمایشی‌اند؛ اطلاعات تماس واقعی، نرخ ارز، حساب، کارت، کلید یا Connection ساختگی افزوده نشد.
- ۹۹۴ تست عمومی، ۹ تست یکپارچه مستقل، Typecheck و Build API/Web موفق؛ lint محدوده موفق، lint عمومی Web تنها خطای قبلی DatePicker را دارد. API health و Login برابر 200؛ درخواست بدون ورود به اطلاعات پایه 307 و API محافظت‌شده 401 است. تست کلیک احراز‌شده معلق به ورود کاربر است؛ ادعای Smoke کامل وجود ندارد.
- [گزارش تحویل](tasks/MASTER-003-CATALOG-USABILITY.md) شامل Scope، سازگاری قرارداد، Migration، داده نمایشی، آزمون و استثناهای مالکیت است. هیچ Merge یا Force Push توسط این Task انجام نشده است.

## داده آزمایشی تمام بخش‌های اطلاعات پایه — 2026-08-31

- `MASTER-003-LOCAL-DEMO-DATA` روی `codex/pc-b-master-data-demo-fixtures` از `241308e` / PR #55: ۷۸ رکورد با برچسب «آزمایشی» در ۴۰ کاتالوگ هشت بخش اصلی روی لوکال ثبت شد. داده‌ها FK واقعی دارند؛ هیچ نرخ ارز، حساب/کارت، PII واقعی یا اتصال خارجی ساختگی ساخته نشد.
- اجرای صریح ابزار مستقل، محدود به DB مشخص لوکال و محیط development/test است؛ از Service و اعتبارسنجی موجود استفاده می‌کند. تراکنش واحد، قفل اجرای هم‌زمان و Audit marker مانع ثبت ناقص، بازنویسی داده موجود و تکرار نمونه‌ها می‌شوند. Seed عمومی، IAM، Customers، Schema، Migration و Dependency تغییر نکردند.
- پیش از اجرا Backup خصوصی گرفته شد. Preview کامل Rollback شد؛ اجرای اول ۷۸ Create و اجرای دوم صفر Create / ۷۸ Reuse داشت. تمام نمونه‌ها از List با جست‌وجوی «آزمایشی» و Detail در DB محلی بازیابی شدند.
- ۵۴۶ تست API موفق، شامل ۹ تست واحد و ۴ آزمون واقعی PostgreSQL 18 جدید با تمام Migrationها؛ ۵۷ آزمون اختیاری دیگر skip شدند. lint، Typecheck و Build API موفق‌اند. API `/api/v1/health` و Login پاسخ ۲۰۰؛ مرورگر بدون Session به Login هدایت می‌شود و Smoke احراز‌شده ادعا نمی‌شود.
- ابزار فقط به‌صورت دستی اجرا می‌شود و هنگام Startup/Seed عمومی فعال نیست. سرورها، داده قبلی و شاخه‌های والد/PC-A/main/develop محفوظ‌اند؛ قفل‌های PC-B/MASTER-003 تغییر نکردند. گزارش و دستور اجرا: `docs/tasks/MASTER-003-LOCAL-DEMO-DATA.md`.

## اصلاح نمایش فهرست پس از ثبت فرم — 2026-08-31

- `MASTER-003-LIST-VISIBILITY` روی `codex/pc-b-master-data-list-visibility` از نسخه تجمیعی `790c20a`: درخواست‌های KPI مالی و جغرافیا از pageSize نامعتبر 1 به helper مشترک با اندازه معتبر 10 منتقل شدند؛ فهرست اصلی، فیلترها، مجوزها و قرارداد Backend بدون تغییرند.
- ثبت فرودگاه در Audit محلی موجود بود؛ داده حذف نشده بود و خطای درخواست KPI باعث شکست بارگذاری فهرست می‌شد. هیچ Migration، Reset، Seed یا ویرایش داده کاربردی انجام نشد.
- ۹۵۸ تست عمومی موفق، از جمله سه تست Web جدید و نه تست HTTP اعتبارسنجی برای منابع مالی/جغرافیا؛ ۵۷ تست اختیاری PostgreSQL در اجرای عمومی skip شدند. این اصلاح Schema یا Repository را تغییر نمی‌دهد.
- Typecheck و Production Build موفق؛ lint محدوده موفق و lint کل همان خطا/هشدار DatePicker مشترک را دارد. API4000 و Login3100 پاسخ ۲۰۰؛ Web نسخه اصلاح‌شده را اجرا می‌کند. مرورگر تست به Login هدایت شد و Smoke با حساب کاربر انجام نشده است.
- کاربر درخواست Merge به develop داده است؛ PRهای والد هنوز Draft و بدون Review هستند. بررسی غیرمخرب Merge نیز در WORK_ASSIGNMENTS، PROJECT_STATUS و master-data.xlsx تعارض یافت. هیچ Merge یا تغییر شاخه والد/PC-A/main/develop انجام نشده است. گزارش نهایی: `docs/tasks/MASTER-003-LIST-VISIBILITY.md`.

## انتشار و فعال‌سازی تمام تغییرات محلی — 2026-08-31

- کاربر انتشار همه اصلاحات موجود و فعال‌سازی محلی را تأیید کرد. تغییرات در شش Slice سربرگ، وضعیت همکاری، حذف امن، فرم‌های سفر، ترمینال و وعده/سرویس در Draft PRهای #48 تا #53 منتشر شدند؛ حمل‌ونقل #47 نیز در نسخه تجمیعی حضور دارد. گزارش‌های «محلی/بدون Push» پایین، تاریخچه مرحله پیاده‌سازی هستند.
- از داده‌های کاربردی Backup خصوصی گرفته شد. چهار Migration سفر/ترمینال/حمل‌ونقل/وعده با موفقیت Deploy شدند؛ دیتابیس محلی با ۲۴ Migration به‌روز است. هیچ Reset، حذف داده یا Seed کاربردی انجام نشد.
- API4000 پاسخ Health سالم دارد؛ Web3100 و Login پاسخ ۲۰۰ می‌دهند. مسیرهای محافظت‌شده بدون Session به Login هدایت می‌شوند؛ Smoke احراز‌شده ادعا نمی‌شود. اتصال ابزار مرورگر داخلی در این اجرا در دسترس نبود.
- کل پروژه: API ۵۲۴، Web ۳۴۶، Contract ۱۴، Database ۵۹ و Config/Worker سه تست موفق؛ Typecheck و Production Build موفق. lint محدوده Master Data و API موفق؛ lint کلی فقط خطا/هشدار قدیمی DatePicker مشترک را دارد.
- آزمون واقعی مستقل PostgreSQL 18: حذف امن ۷، فرم‌های سفر ۱۳ و وعده ۸ موفق؛ در نسخه تجمیعی نهایی ترمینال ۱۵ و حمل‌ونقل ۱۰ آزمون موفق با تمام Migrationها و Seed دوگانه. مشکل Fixture قدیمی ترمینال برطرف شد؛ اجرای نخست Seed هم‌زمان با تست کل پروژه به Timeout خورد و اجرای مستقل مجدد موفق بود.
- Customers، Dependency/Lockfile و شاخه‌های والد/PC-A محفوظ‌اند؛ سه قفل PC-B/MASTER-003 فعال می‌مانند. گزارش انتشار و محدودیت‌های تأیید: `docs/tasks/MASTER-003-LOCAL-PUBLISH.md`.

### `MASTER-003-LOCAL-MEAL-SERVICE-FORM` — PC-B — آماده بررسی؛ فعال‌سازی محلی معلق

- فرم Popup وعده/سرویس: کد قابل تعریف با پیشنهاد RO/BB/HB/FB/ALL/UALL/BRN، عنوان فارسی/انگلیسی، دسته، انتخاب چندگانه وعده‌ها و پاک‌کردن، تعداد واقعی هتل مرتبط فقط‌خواندنی و فعال/غیرفعال/در حال بررسی.
- وضعیت و محتوا با مجوز، Version و Audit در تراکنش واحد ثبت می‌شوند. فیلتر و Excel وضعیت بررسی را مستقل نمایش می‌دهند؛ مصرف‌کننده قدیمی آن را inactive می‌بیند. کدهای خودکار قدیمی و وعده‌های سفارشی بدون بازنویسی حفظ می‌شوند.
- Migration افزایشی `20260831130000_master_data_meal_service_forms` و همه Migrationهای نسخه محلی روی PostgreSQL 18 خالی اجرا شدند؛ Seed دوبار و ۸ آزمون واقعی ذخیره/Audit/فیلتر/Export/FK/Constraint موفق. آزمون‌های API/Web/Contract/Database، Typecheck و Build جداگانه موفق‌اند؛ خطای lint کلی Web همان DatePicker قبلی است.
- تغییرات محلی کاربر، سه قفل PC-B/MASTER-003 و Branch جاری محفوظ‌اند؛ Customers/Dependency/Seed، دیتابیس کاربردی و Client سرور تغییر نکردند. API4000 در کنترل نهایی در دسترس نبود؛ Smoke احراز‌شده ادعا نمی‌شود. فعال‌سازی نیازمند هماهنگی Migrationهای محلی معلق است. گزارش: `docs/tasks/MASTER-003-LOCAL-MEAL-SERVICE-FORM.md`.

گزارش‌های مرحله‌ای پایین تاریخی هستند؛ فعال‌سازی و تجمیع حمل‌ونقل PR #47 اکنون با تأیید صریح کاربر در `MASTER-003-LOCAL-PUBLISH` انجام می‌شود.

## خلاصه

### CUSTOMER-CHAIN-REVIEW-001 — 2026-08-31

- با تأیید صریح مالک، فقط زنجیره مشتریان #26 → #27 → #34 → #41 در حال بررسی و ادغام ترتیبی است.
- PR #26 پس از ۳۴۴ تست و Smoke واقعی روی مبنای ادغام‌شده، با Commit `a470d06` ادغام شد.
- PR #27 پس از حل تعارض، انتقال زودتر کنترل‌های امنیتی XLSX، ۳۹۹ تست و Smoke واقعی با Commit `eb2fe1e` ادغام شد.
- PR #34 پس از Migration افزایشی رفع CHECK با مقدار NULL، حفظ تاریخ تولد در ویرایش نامرتبط، ۴۲۰ تست، ۱۱ Migration از صفر و ۱۱ کنترل HTTP/Database ساختگی با Commit `b5f06a2` ادغام شد.
- PR #41 روی develop شامل والدها بازبینی شد: ۴۲۵ تست در ۸۱ فایل، lint/typecheck/build کامل و ۱۷ کنترل HTTP/Database موفق؛ آماده ادغام همین Slice است. قفل‌های Customer طبق Handoff صریح WORK_ASSIGNMENTS بلافاصله پس از Merge #41 آزاد می‌شوند.
- کل CUSTOMER-002B هنوز Partial است: هویت خارجی، پاسپورت، Documents امن، نگهداری/حذف، Import اتمیک و Merge مشتریان تکمیل‌شده اعلام نمی‌شوند. مرحله محصول بعدی مورد درخواست مالک «مدیریت و تعریف بلیت‌ها» است؛ صدور و Manifest در رزرواسیون باقی می‌مانند.
- هیچ PR کامپیوتر B، کلید، داده واقعی یا سرویس لوکال اصلی تغییر نکرده است؛ تصمیم‌های باز امنیتی خودکار پذیرفته نمی‌شوند.

### CUSTOMER-002B — پیگیری نمایش شماره و تماس (2026-08-31)

- روی همان Branch مشتریان و Preview اصلی؛ میان‌بر تماس برای هر مشتری یا مسافر اضافه شد.
- شماره کامل فقط با دلیل مجاز و Permission/Audit موجود نمایش داده می‌شود؛ لینک تماس پس از Reveal و پنهان‌کردن دستی در دسترس است.
- ۱۲۳ تست Web، ۸۱ تست API Customers، lint، typecheck و Production Build وب پاس شدند؛ هیچ تغییر Database یا داده مشتریان انجام نشد.

### `CUSTOMER-002A.1` — PC-A — `READY_FOR_REVIEW`

- Branch فرزند `codex/pc-a-customer-next` از Remote Parent
  `codex/pc-a-customer-operations@5e9503d0b09560ed266aeaaa800d2fe701d1f712` ساخته شد؛ Parent PR #26 و Branch آن تغییر نکردند.
- فیلترهای مدل فعلی، Status History، Customers-only Activity Timeline، Audit API حداقلی، Privacy UX و Deep Link امن Customer 360 تکمیل شدند.
- قرارداد `customers.v2` به‌صورت additive/backward-compatible باقی ماند و هیچ فایل Customer Affairs یا Master Data تغییر نکرد.
- Migration Lock نزد `PC-B/MASTER-003` باقی ماند؛ Prisma/Migration/Seed/Dependency/Lockfile بدون تغییر هستند.
- ۵۲ تست API Customers، ۱۴ تست Web Customers، ۱۵ تست Contract و ۲۶۹ تست کامل پاس شدند؛ lint، typecheck، Production Build و Smoke احراز‌شده `/customers` نیز پاس شدند.
- نام لاتین، جنسیت، note، business code، idempotency persistence، Address Masking کامل، cross-module timeline و Merge واقعی در `BLOCKED_FOR_CUSTOMER_002B` باقی ماندند.
- Draft Stacked PR #27 با Base اولیه `codex/pc-a-customer-operations` باز شد؛ به #26 وابسته است، پیش از Parent Merge نمی‌شود و پس از Merge والد Base آن به `develop` تغییر می‌کند.

- مرحله جاری: **Advanced Master Data Management Full-Stack**
- وضعیت: **انتشار اصلاحات محلی در Sliceهای مستقل و تجمیع نسخه اجرایی کامل**
- Repository: `Rubi`، Remote با نام `origin`
- Baseline: `origin/develop@b6da5d6300716a189958bc37d31ca195f0304dc5` شامل Merge PR #24
- شاخه جاری: `codex/pc-b-master-data-demo-fixtures` از `codex/pc-b-master-data-list-visibility`، شامل نسخه تجمیعی و اصلاح نمایش فهرست؛ Runtime برنامه تغییر نکرده و داده آزمایشی به DB لوکال اضافه شده است.
- Work Item جاری: `MASTER-003-LOCAL-DEMO-DATA` روی والد PR #55؛ نسخه تجمیعی و Sliceهای انتشار قبلی حفظ شده‌اند.
- محیط مسئول: `COMPUTER_ID=PC-B`؛ داده‌های Checkout اصلی محفوظ‌اند؛ API4000 و Web3100 محل اجرای نسخه تجمیعی هستند.
- نوع تغییر: Master Data Database/API/Contract/Web/Test/Docs؛ بدون تغییر Seed، Customers،
  UI مشترک، Dependency یا Lockfile.

### `MASTER-003R-TRANSPORT-FORMS` — PC-B — `READY_FOR_REVIEW`

- پوشش تصاویر ۴۳۹ تا ۴۴۵ در هفت فرم ایرلاین، هواپیما، قواعد بار، شرکت ریلی، قطار، شرکت اتوبوس و نوع اتوبوس بررسی و تکمیل شد. فیلدهای نام فارسی/انگلیسی، کشور/سازمان، سازنده/مدل و دسته‌های موجود حفظ شدند؛ وضعیت بررسی، مشخصات سیستمی فقط‌خواندنی و تاریخچه واقعی داخل پروفایل Popup اضافه شد.
- امکانات قطار به رابطه چندبه‌چند واقعی Facility متصل است؛ امکانات متنی قدیمی باقی می‌ماند. فیلتر وضعیت قبل از Pagination و در خروجی Excel اعمال می‌شود. تغییر وضعیت مجوز اختصاصی می‌خواهد و همراه Version/Audit در همان تراکنش ثبت می‌شود.
- Migration افزایشی `20260831120000_master_data_transport_forms`: هفت پرچم بررسی با Constraint و جدول ارتباطی قطار/امکانات با FK محدودکننده؛ هر ۲۱ Migration روی PostgreSQL 18 موقت، Seed دوبار و ۹ آزمون واقعی موفق شدند. فقط دیتابیس موقت آزمون حذف شد؛ دیتابیس اصلی Deploy نشد.
- کنترل کیفیت: API ۲۶۵، Web ۲۰۳، Contracts ۱۴ و Database ۵۵ تست موفق؛ Prisma format/validate/generate، typecheck و Production Build API/Web موفق. lint API/Database و کل ماژول Master Data وب موفق؛ lint سراسری Web فقط خطا/هشدار قبلی DatePicker مشترک را دارد و آن فایل دست‌نخورده است.
- اتصال واقعی Documents/Integrations، شمارش انواع ناوگان و ظرفیت عملیاتی همچنان منتظر قرارداد مالک هستند. مرجع لوگوی قبلی فقط‌خواندنی نمایش داده می‌شود؛ UUID جدید تاییدنشده پذیرفته نمی‌شود. مقدار، Connection، Secret یا داده ساختگی ماکاپ Seed نشد.
- Checkout مستقل `C:/Users/admin/Rubi-transport-forms` از `2088010` برای حفظ تغییرات محلی حذف امن، فرم ترمینال/تور/سفر و سایر کارهای هم‌زمان استفاده شد. Health API و Login نسخه اصلی ۲۰۰ هستند؛ Smoke مرورگر احراز‌شده نسخه جدید ادعا نمی‌شود. ادغام در Checkout مشترک و Deploy محلی نیازمند هماهنگی جداست.
- سه قفل Migration/Contract/Docs زیر `PC-B/MASTER-003` فعال باقی می‌مانند؛ والد #45 و کل زنجیره Stacked، Customers، Seed و Dependency/Lockfile تغییر نکردند. قبل از والدها Merge نشود. گزارش و جدول فیلدها: `docs/tasks/MASTER-003R-TRANSPORT-FORMS.md`.

### `MASTER-003Q-PARTNER-FORMS` — PC-B — `READY_FOR_REVIEW`

- نام انگلیسی مستقل Supplier/Broker، نوع حقیقی/حقوقی Organization، تماس اصلی فعال همان سازمان و انتخاب چندگانه خدمات واقعی اضافه شدند؛ فرم‌های مرتبط Popup هستند و در فهرست/پروفایل فقط Mask تماس نمایش داده می‌شود.
- FK مرکب مانع اتصال مخاطب سازمان دیگر، جابه‌جایی هویت و حذف مخاطب استفاده‌شده است. PATCH مقادیر غایب را حفظ و فیلدهای اختیاری صریحاً خالی را پاک می‌کند؛ مجوز، Version و Audit موجود حفظ شدند.
- Migration افزایشی `20260831090000_master_data_partner_forms` روی PostgreSQL 18 خالی و دیتابیس محلی اجرا شد؛ Seed دوبار فقط در DB موقت، چهار آزمون واقعی FK/رمزنگاری/ذخیره/Audit موفق‌اند. DB موقت آزمون حذف شد؛ داده عملیاتی حذف نشد.
- نسخه جداشده از سایر تغییرات محلی: API ۲۵۴ تست، Web ۱۸۶ تست (شامل ۶ تست SSR فرم واقعی)، typecheck و Production Build API/Web موفق. نسخه مشترک نیز API ۳۸۴، Web ۲۴۸، Contract ۱۴ و Database ۵۳ تست موفق دارد (شامل کارهای هم‌زمان دیگر).
- lint API و فایل‌های Web متاثر موفق؛ lint کلی Web فقط خطا/هشدار قبلی DatePicker مشترک را دارد. مرورگر به Login هدایت شد؛ Smoke احراز‌شده ادعا نمی‌شود. API روی ۴۰۰۰ و Web روی ۳۱۰۰ روشن‌اند.
- قرارداد و سقف خرید تا Public Service واقعی B2B/Procurement و اتصال Provider تا سرویس Integrations، Deferred هستند؛ عدد، قرارداد یا اتصال جعلی ثبت نشد. سه قفل PC-B/MASTER-003 ثابت و تغییرات محلی حذف امن، همکاری و اصلاحات جانبی محفوظ و خارج از Commit این Slice هستند.
- والد #44 دست‌نخورده است؛ [Draft PR #45](https://github.com/nirvanamahlou/Rubi/pull/45) روی آن Stacked است و پیش از والدها Merge نمی‌شود. گزارش: `docs/tasks/MASTER-003Q-PARTNER-FORMS.md`.

### `MASTER-003-LOCAL-TRAVEL-FORMS` — PC-B — آماده بررسی محلی؛ فعال‌سازی معلق

- فرم Popup نوع ترانسفر: کد خودکار فقط‌خواندنی، عنوان فارسی/انگلیسی، وسیله، شیوه سرویس، حداقل/حداکثر ظرفیت، شرح، ترتیب و وضعیت. استفاده فقط‌خواندنی و تا اتصال رزرو فاقد عدد ساختگی است.
- فرم Popup ویزا: کد، عنوان‌ها، کشور مقصد، نوع ویزا، Provider، اعتبار روزشمار یا تا پایان پاسپورت، شناسه مدارک راهنمای عمومی، شرح، ترتیب و وضعیت؛ بدون اطلاعات متقاضی/پاسپورت.
- دو ستون و سه CHECK افزایشی در `20260831100000_master_data_travel_reference_forms`؛ ذخیره وضعیت/مشخصات اتمیک با مجوز، کنترل نسخه و Audit. رکوردهای قدیمی محفوظ‌اند.
- ۷۰ تست هدفمند API، ۲۸ تست Web، ۱۳ آزمون واقعی PostgreSQL 18 و دو تست ساختار Migration موفق؛ Web typecheck، lint فایل‌های همین تغییر و Build جداگانه API/Web موفق‌اند. آزمون گسترده‌تر، خطاهای خارج از Scope در فرم ترمینال را نشان داد؛ جزئیات و مراحل فعال‌سازی در `docs/tasks/MASTER-003-LOCAL-TRAVEL-FORMS.md`.
- Migration و Prisma Client جدید فقط در محیط آزمایشی جدا بررسی شدند؛ دیتابیس کاربردی، سرورها، Branch و Git staging/Commit/Push تغییر نکردند. تغییرات هم‌زمان محفوظ‌اند.

### `MASTER-003-LOCAL-TERMINAL-FORM` — PC-B — آماده بررسی محلی

- فرم و فهرست ترمینال مطابق فیلدهای تصویر تکمیل شد: نوع داخلی/بین‌المللی/مشترک/VIP، گیت، ساعت ۲۴ساعته یا بازه محلی با پشتیبانی از 24:00 و عبور از نیمه‌شب، فعال/غیرفعال/تعمیرات. مشاهده و ویرایش Popup است؛ کد، شهر و کدهای فرودگاه و آخرین تغییر فقط‌خواندنی‌اند.
- Migration افزایشی `20260831110000_master_data_terminal_details` با CHECKهای واقعی و بدون تغییر رکوردهای قبلی؛ وضعیت و مشخصات در یک تراکنش مجوزدار با Version/Audit ذخیره می‌شوند. تعمیرات برای مصرف‌کننده قدیمی غیرفعال محسوب می‌شود.
- ۴۱ تست جدید API، ۲۸ تست Web و ۱۵ آزمون PostgreSQL 18 موفق. مجموعه جاری API: ۴۶۳ موفق، Web: ۳۰۴ موفق، Contract: ۱۴ موفق؛ lint محدوده، typecheck با Source قرارداد جاری، Prisma format/validate/generate و Production Build جداگانه API/Web موفق.
- Seed دوبار در دیتابیس موقت و با مهلت بیشتر فقط در Client آزمایشی اجرا شد؛ مهلت پیش‌فرض Seed در این محیط تمام می‌شد. DB آزمایشی حذف شد. Migration کاربردی، Client سرور مشترک، سرورها، Branch و Git staging/Commit/Push تغییر نکردند؛ Smoke احراز‌شده ادعا نمی‌شود. قفل‌های PC-B/MASTER-003 ثابت‌اند. گزارش و فعال‌سازی: `docs/tasks/MASTER-003-LOCAL-TERMINAL-FORM.md`.

### `MASTER-003-LOCAL-TOUR-FORM` — PC-B — آماده بررسی محلی

- فرم Popup نوع تور با کد خودکار، عنوان فارسی/انگلیسی، دامنه، شرح، ترتیب و وضعیت تکمیل شد؛ کد، استفاده و آخرین تغییر فقط‌خواندنی‌اند. ذخیره وضعیت و مشخصات اتمیک، مجوزدار و دارای کنترل نسخه/Audit است.
- نمایش نام تغییر‌دهنده از API عمومی مجوزدار IAM است؛ شمارش محصولات تا قرارداد مالک مربوط در وضعیت «در انتظار اتصال محصولات» باقی می‌ماند.
- ۵۸ آزمون جدید؛ Web جاری ۲۴۲ موفق، API جاری ۳۸۴ موفق/۱۱ skipped، typecheck، lint فایل‌های متاثر و Build جدا از سرور موفق. Smoke احراز‌شده انجام نشد.
- تغییر محلی بدون Commit/Push، تغییر Branch، Schema/Migration/Seed، Dependency یا دست‌زدن به سرورها؛ تغییرات هم‌زمان حفظ شدند. گزارش: `docs/tasks/MASTER-003-LOCAL-TOUR-FORM.md`.

### `MASTER-003P-CLEAR-FIELDS` — PC-B — `READY_FOR_REVIEW`

- دکمه «×» برای انتخاب‌های ساده، مرجع اجباری/اختیاری، چندانتخابی و تاریخ در فرم‌های
  ایجاد/ویرایش Master Data، فرم ارز/نرخ، Preview و ورود گروهی هتل اضافه شد.
- دکمه نام فارسی دسترس‌پذیر و فضای لمس ۴۴ پیکسل دارد؛ Submit نیست و پس از پاک‌کردن،
  فوکوس به همان فیلد برمی‌گردد. در حالت خالی، فقط‌خواندنی و ذخیره نمایش داده نمی‌شود.
- پاک‌کردن فقط state همان فیلد را تغییر می‌دهد؛ انتخاب اجباری تا انتخاب دوباره قابل ذخیره
  نیست. در ورود گروهی هتل، پاک‌کردن کشور، شهر و Preview وابسته را نیز خالی می‌کند.
- آزمون واقعی TSX با پیکربندی Vitest محلی Web فعال شد؛ تنظیمات Next و Dependency ثابت‌اند.
- کنترل کیفیت روی checkout مستقل `687a183` برای جداسازی از تغییرات هم‌زمان Workspace:
  Frozen install، `175/175` تست Web (۲۰ تست جدید)، typecheck، lint فایل‌های متاثر و Production Build موفق.
- lint کل Web همچنان فقط ایراد قبلی DatePicker مشترک در خطوط ۶۷ و ۹۹ را گزارش می‌کند؛
  آن فایل خارج از Scope و دست‌نخورده است. `git diff --check` و Scope/Secret-pattern scan موفق‌اند.
- Health API و Login پاسخ ۲۰۰ دارند؛ بدون Session مسیر `/master-data` به Login می‌رود.
  Smoke احراز‌شده ادعا نمی‌شود. سرورهای محلی روشن و تغییرات محلی دیگر حفظ شده‌اند.
- Parent #43 / `b78d0a9` و سه قفل `PC-B/MASTER-003` ثابت‌اند؛ Draft روی شاخه والد،
  وابسته به #43 و زنجیره #25؛ بدون Merge خودکار. گزارش: `docs/tasks/MASTER-003P-CLEAR-FIELDS.md`.

### `MASTER-003O-PAYMENT-FORM` — PC-B — `READY_FOR_REVIEW`

- ورودی «کد روش» و «نام انگلیسی» فقط از فرم ایجاد/ویرایش/مشاهده روش‌های پرداخت حذف شدند؛
  سایر فرم‌ها، Catalog مرجع و ستون‌های Export بدون تغییر باقی می‌مانند.
- فهرست فیلدهای فرم از Catalog جدا شد؛ دو فیلد حذف‌شده در state یا payload ویرایش خالی
  نمی‌شوند، بنابراین کد و نام انگلیسی ذخیره‌شده قبلی حفظ می‌شوند.
- ایجاد روش پرداخت بدون code از تولیدکننده موجود کد یکتای Backend استفاده می‌کند؛ کد
  صریح مصرف‌کننده قدیمی همچنان پذیرفته/اعتبارسنجی می‌شود و شکل پاسخ تغییر نکرده است.
- تغییر الزامی‌بودن code سازگار و افزایشی است؛ producer/consumer و رفتار Update در
  `WORK_ASSIGNMENTS.md` ثبت شده‌اند. Schema/Migration/Seed و داده‌های موجود تغییر نکردند.
- Web: `155/155` و API: `245/245` تست موفق؛ شامل نبود دو فیلد، حفظ Export و سایر فرم‌ها،
  ایجاد بدون کد، رفع برخورد نام/کد، سازگاری کد صریح و حفظ مقادیر قبلی هنگام ویرایش.
- typecheck و Production Build هر دو برنامه، lint فایل‌های Web متاثر و کل API موفق؛
  `git diff --check` و Scope/Secret-pattern scan موفق‌اند. ایراد پیشین DatePicker مشترک خارج از Scope است.
- API محلی پس از تغییر Source توسط watcher راه‌اندازی مجدد شده و Health پاسخ ۲۰۰ می‌دهد؛
  Web بدون Session به Login سالم با پاسخ ۲۰۰ می‌رود. Smoke احراز‌شده ادعا نمی‌شود؛ سرورها روشن‌اند.
- Parent #42 / `495af50` و قفل‌های `PC-B/MASTER-003` ثابت‌اند؛ Draft PR روی
  `codex/pc-b-master-data-clean-labels` و وابسته به #42 و زنجیره #25 است؛ پیش از والد Merge نشود.

### `MASTER-003N-CLEAN-LABELS` — PC-B — `READY_FOR_REVIEW`

- متن فنی اعتبارسنجی Backend/Audit از بالای فرم‌های واقعی و نشان نسخه قرارداد از
  فرم‌های واقعی/Preview حذف شد؛ اعتبارسنجی، ذخیره‌سازی، Audit و Contract تغییر نکردند.
- نشان «Backend واقعی · مشترک بین شرکت‌ها» در مالی و جغرافیا و نمونه جداگانه نشان
  Backend/توضیح scope در نمای عمومی Master Data حذف شدند؛ سایر ماژول‌ها دست‌نخورده‌اند.
- عنوان دسترس‌پذیر Dialog، توضیح نمای فقط‌خواندنی، نسخه رکورد و هشدار Preview حفظ شدند؛
  فرم بدون توضیح به شناسه توضیح ناموجود ارجاع نمی‌دهد و نوار خالی نشان‌ها باقی نمی‌ماند.
- Web tests: `151/151` و typecheck موفق؛ تست بازگشت، همه کامپوننت‌های Master Data را پوشش می‌دهد.
- lint هر شش فایل تغییرکرده و Production Build موفق؛ هر هشت HTML زیرمجموعه اطلاعات پایه
  بدون متن/برچسب‌های حذف‌شده ساخته شدند. `git diff --check` و Scope/Secret-pattern scan موفق‌اند.
- API Health پاسخ ۲۰۰ و Web بدون Session به Login سالم پاسخ ۲۰۰ می‌دهد؛ سرورها روشن‌اند.
  Smoke احراز‌شده انجام نشد؛ ایراد قدیمی lint تقویم مشترک خارج از محدوده این اصلاح باقی است.
- والد #40 / `808ca13` و قفل‌های `PC-B/MASTER-003` ثابت‌اند؛ PR باید Draft و روی شاخه
  `codex/pc-b-master-data-currency-form` باشد و پیش از والد #40 و زنجیره #25 Merge نشود.

### `MASTER-003M-CURRENCY-FORM` — PC-B — `READY_FOR_REVIEW`

- فرم اختصاصی ارز: نام فارسی/انگلیسی، ISO، نماد، تعداد اعشار و وضعیت؛ سیاست نمایش از
  فرم و پروفایل حذف شد، ولی مقدار ذخیره‌شده قبلی و پیش‌فرض Database حفظ می‌شوند.
- ثبت نرخ خرید/فروش، ارز مقابل، منبع، تاریخ/ساعت و بازه اعتبار در همان Popup؛ تاریخچه
  مستقل باقی می‌ماند. ارز پایه فقط‌خواندنی و در انتظار قرارداد واقعی Finance است.
- endpoint افزایشی `/api/v1/master-data/currency-rates/quotes` نرخ‌های ارسالی و Audit را
  در یک تراکنش ثبت می‌کند؛ Decimal تا ۱۰ اعشار، UTC، مجوز، DRAFT و `isAuthoritative=false`.
- ثبت‌کننده از Session تعیین می‌شود؛ وضعیت تأیید از فرم قابل تحمیل نیست. نام نمایشی
  کاربر تا اتصال قرارداد عمومی هویت موجود نیست و نتیجه ثبت، شناسه واقعی کاربر را نشان می‌دهد.
- تست‌ها، محدودیت Smoke احراز‌شده و خطای پیشین lint مشترک در گزارش همین کار ثبت شده‌اند.
- والد #39 و سه قفل فعال `PC-B/MASTER-003` دست‌نخورده‌اند؛ Dependency/Lockfile آزاد است.
- جزئیات: `docs/tasks/MASTER-003M-CURRENCY-FORM.md`.

### `MASTER-003L-SECTION-CLEANUP` — PC-B — `READY_FOR_REVIEW`

- شرکت اتوبوس، نوع اتوبوس و CIP از رابط تور و خدمات سفر حذف شدند؛ چهار تب لیدرها،
  نوع تور، نوع ترانسفر و ویزا باقی ماندند. اتوبوس فقط در حمل‌ونقل نمایش داده می‌شود.
- نوع مشتری، منبع سرنخ و نوع کمپین از مراجع فروش حذف شدند؛ نحوه آشنایی، کانال فروش،
  دلیل از دست رفتن و Tag باقی ماندند. متن و شمارنده کارت‌های Hub هماهنگ شدند.
- داده‌ها و قرارداد هر ۴۵ منبع حفظ شده‌اند؛ موارد بدون ورودی ناوبری صریحاً ثبت شده‌اند.
- Web tests: `133/133`، typecheck، lint فایل‌های تغییرکرده و Production Build موفق؛
  خروجی HTML ساخته‌شده دقیقاً چهار تب و چهار زیرمجموعه در هر یک از دو بخش دارد.
- Full Web lint فقط همان خطا/هشدار پیشین `date-picker.tsx` را گزارش می‌کند؛ فایل تغییر نکرد.
  مرورگر بدون Session به Login می‌رود؛ Smoke احراز‌شده در این اصلاح ادعا نمی‌شود.
- سه قفل فعال `PC-B/MASTER-003` و وضعیت آزاد Dependency/Lockfile تغییر نکرده‌اند.
- جزئیات: `docs/tasks/MASTER-003L-SECTION-CLEANUP.md`.

### `MODULES-FOUNDATION-001` — PC-A — `READY_FOR_REVIEW`

- ۱۲ Workspace باقی‌مانده با UI مشترک فارسی، RTL، Responsive، KPI، navigation داخلی،
  جست‌وجو، فیلتر، sort، pagination، Preview CRUD، stateها، permission، audit و reference
  بین‌ماژولی تکمیل شد؛ Customers، Customer Affairs، Finance، Master Data و IAM حفظ شدند.
- Dashboard برای صف‌های فروش، رزرواسیون، ظرفیت، مالی و مدیریت تکمیل و Sidebar در برابر
  overflow افقی و محوشدن عنوان سخت‌سازی شد.
- lint، typecheck، test و production build کل Monorepo پاس شدند؛ ۱۷۸ تست Web/API
  و ۲۵ تست package/worker پاس شدند. هر ۱۷ route در HTTP smoke پاسخ 200 و HTML معتبر داد.
- QA مرورگر داخلی به‌علت خروج ناگهانی trusted browser process ممکن نشد؛ build و HTTP
  smoke مطابق قرارداد Task جایگزین شدند.
- Prisma/Migration/Seed، Dependency/Lockfile، Persistence، Secret/PII و artifact جعلی
  تغییری نکردند؛ اتصال واقعی Provider/Worker/Documents/Reporting همچنان Deferred است.

### `MASTER-002` — PC-B — `DONE`

- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` وارد
  `origin/develop` شد.
- Persistence، REST، قرارداد عمومی و UI واقعی Master Data تحویل شدند.
- چهار قفل Migration، Dependency/Lockfile، Master shared-contract و اسناد مرکزی آزاد شدند.

### `CUSTOMER-001` — PC-A — `DONE/MERGED`

- PR شماره ۱۹ با Source HEAD `19cb597cd9c4137021bc53e3f85d4cd682de51de` و
  Merge Commit `7d0a4f42e978b468263efdc83f780fa656fbd613` وارد `develop` شد.
- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  به‌صورت `DONE/MERGED` وارد `origin/develop` شد.
- فاز B از baseline قطعی `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb` روی شاخه
  `codex/pc-a-customer-persistence` تکمیل شد؛ اصلاحات Review در Commitهای `c85de3d`،
  `004b9cb` و `6e6df8c` روی همان Draft PR شماره ۱۹ قرار دارند.
- Migration اصلی `20260824093000_customer_persistence` byte-for-byte دست‌نخورده ماند؛
  Migration افزایشی `20260824113000_customer_contact_encryption_hardening` ستون‌ها،
  constraintها و indexهای رمزنگاری Contact را بدون عملیات مخرب اضافه کرد.
- Contact با AES-256-GCM و کلید نسخه‌دار ذخیره می‌شود؛ fingerprint از HMAC-SHA-256 با
  کلید مستقل ساخته می‌شود. reveal فقط با `customers.sensitive.read` و Audit مستقل است.
- Auditهای Customer/Contact/Address/Consent/Companion/Duplicate فقط snapshot allowlist دارند؛
  duplicate query نیز branch-scoped، index-backed و محدود به ۵۰ کاندید است.
- قرارداد عمومی به `customers.v2` ارتقا یافت. migration deploy/status، Seed دوگانه، lint،
  typecheck، build و ۱۲۰ تست Monorepo پاس شدند؛ Dependency/Lockfile تغییری نکرد.
- سه تنظیم blank-only در `.env.example`، `apps/api/.env.example` و validation رزرو و ثبت شدند:
  `CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64`، `CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64` و
  `CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION`. Fixtureها کاملاً ساختگی هستند.
- `DEC-OPEN-006` و `DEC-OPEN-011` باز می‌مانند. نگهداری مدرک حساس، auto-merge و
  merge واقعی ممنوع‌اند؛ فقط Candidate Detection و Review دستی ثبت و Audit می‌شوند.
- نرخ ارز authoritative و تولید واقعی Excel/PDF خارج از این Handoff باقی می‌مانند.

### `CUSTOMER001-FINANCE-HANDOFF-001` — PC-A — `DONE`

- PR شماره ۲۰ با Merge Commit `11fc875` وارد `origin/develop` شد.
- چهار قفل Migration، Dependency/Lockfile، Customer shared-contract/export و اسناد مرکزی
  پس از Merge PR #19 از CUSTOMER-001 آزاد می‌شوند.
- Migration Owner، Dependency/Lockfile Owner مشروط، Finance shared-contract/export و اسناد
  مرکزی برای PC-A/FINANCE-001 رزرو می‌شوند؛ هیچ قفلی به PC-B منتقل نشده است.
- `FINANCE-001` با Foundation و حل تصمیم‌ها آغاز می‌شود. `DEC-OPEN-001/004/005/016`
  Gate قطعی هر Schema، Migration، posting model، FX/tax و approval workflow هستند.
- Finance فقط قرارداد عمومی ماژول‌های دیگر را مصرف می‌کند؛ query مستقیم جدول‌های Customers،
  Sales، Reservations، Procurement یا HR ممنوع است.
- این Handoff فقط مستندات است و هیچ dependency، lockfile، Schema یا Migration تغییر نمی‌دهد.

### FINANCE-001 — PC-A — DONE/MERGED

- PR شماره ۲۱ با Merge Commit `45c107e471d53d1c724303de02ba01a5e0e16b2a` وارد `origin/develop` شد.
- هیچ `FINANCE-002`، PR باز Finance یا Branch فعال Finance Persistence وجود ندارد.
- Migration، Dependency/Lockfile و اسناد مرکزی stale آن آزاد شدند؛ Dependency/Lockfile
  تخصیص‌نیافته ماند و Migration/اسناد مرکزی به `LEGAL-ENTITY-CONTEXT-001` منتقل شدند.
- مالک محصول و کسب‌وکار در 2026-08-24 هر چهار Decision مالی `DEC-OPEN-001/004/005/016`
  را رسماً پذیرفت؛ این موارد دیگر تصمیم باز نیستند.
- پذیرش Decisionها Scope Phase A را توسعه نمی‌دهد: Prisma Schema، Migration، Repository،
  Persistence، Dependency و Lockfile همچنان در این PR بدون تغییر می‌مانند.
- پس از Merge PR #21، ایجاد Schema و Migration افزایشی مالی فقط در Task مستقل Phase B،
  با رزرو مجدد قفل‌ها و اجرای Migration gate کامل، مجاز خواهد بود.
- قرارداد عمومی finance.v1-proposal، producer/consumer eventهای versioned، Permission
  Matrix و Domain/Application Port بدون Controller یا Persistence تکمیل شدند.
- Money/Decimal، rounding، Journal balance، Check lifecycle، Maker/Checker، Release policy،
  optimistic concurrency و idempotency با تست پوشش داده شدند.
- مسیر /finance اکنون Workspace فارسی/RTL/Responsive با Dashboard، ۳۰ قابلیت قابل جست‌وجو،
  فیلتر، sort، pagination، فرم‌های Preview، stateهای کامل و route خروجی Excel/PDF است.
- lint، typecheck و build کل Monorepo پاس شدند؛ ۱۷۲ تست در ۵۱ فایل پاس شد و /finance در
  Production Build تولید شد.
- Dependency/Lockfile، Prisma، Migration و Seed تغییر نکردند. داده‌ها فقط synthetic هستند.
- QA مرورگر داخلی به‌دلیل خطای ACL ابزار Windows و redirect احراز هویت انجام نشد؛ HTTP
  redirect و Production Build route تایید شدند و dev server موقت متوقف شد.

### `LEGAL-ENTITY-CONTEXT-001` — PC-A — `DONE/MERGED`

- PR #24 با Source HEAD `6f475c03eebc6379fc8be47a48eb0751d58f2d89` و Merge Commit
  `b6da5d6300716a189958bc37d31ca195f0304dc5` وارد `origin/develop` شد.
- Migration، Legal Entity shared-contract/root export و اسناد مرکزی با دلیل
  `DONE/MERGED via PR #24` آزاد شدند؛ Dependency/Lockfile از قبل آزاد بود.

### `MASTER-003 Phase A` — PC-B — `DONE / READY_FOR_REVIEW`

- Branch مستقیماً از `origin/develop@b6da5d6` ساخته شد و Frozen Install بدون تغییر Lockfile پاس شد.
- Migration Owner، Master Data shared-contract/root export و اسناد مرکزی برای MASTER-003 رزرو شدند.
- `fflate@0.8.3` پس از اثبات نیاز، Pin و با فایل واقعی بدروم آزموده شد؛ قفل Dependency/Lockfile سپس آزاد شد.
- Import واقعی هتل با قالب `HOTEL_IMPORT_V1`، Preview Token، Idempotency، Commit اتمیک،
  کاتالوگ Meal/Room/Facility و UI متصل پیاده‌سازی شد.
- فایل واقعی `hotel-data-بدروم.xlsx` روی PostgreSQL 18.1 با نتیجه ۲۲ ایجاد، صفر خطا
  و صفر تکراری آزموده شد؛ دیتابیس موقت پس از آزمون حذف شد.
- Review رسمی PR #25 روی همان Draft/Branch اعمال شد: اعتبارسنجی runtime DTO، رد کامل
  External Relationship/Data در OOXML و منع update/status عمومی نرخ ارز سخت‌سازی شدند.
- پذیرش production-like و session واقعی: Preview فایل ۲۲ ردیفی، Commit اول ۲۲ ایجاد،
  فایل دوم ۲۲ Skip، rollback اتمیک، تعارض هم‌زمان ۲۰۱/۴۰۹ و `/master-data` با پاسخ ۲۰۰.
- ورود دستی کد یکتا از تمام فرم‌های اطلاعات پایه حذف شد؛ Backend کد داخلی یکتا را
  از نام رکورد تولید می‌کند و ویرایش آن ممنوع است. در Import هتل نیز شناسه خالی
  به‌صورت خودکار تولید می‌شود و فایل‌های قدیمی دارای شناسه سازگار باقی مانده‌اند.
- توضیح فرعی PageHeader و Alert فنی Persistence از بالای صفحه اطلاعات پایه حذف شدند
  تا کاربر مستقیماً کاتالوگ بخش‌ها را ببیند.
- فرم‌های Create/View/Edit اطلاعات پایه از Drawer کناری به Dialog وسط صفحه منتقل شدند؛
  فیلد و selector سازمان هتل نیز از فرم هتل حذف شد.
- خروجی واقعی XLSX برای همه منابع اطلاعات پایه با فیلتر و مرتب‌سازی جاری، چیدمان RTL،
  سقف ۱۰٬۰۰۰ ردیف، کنترل مجوز و Audit فعال شد؛ PDF آرشیوی همچنان منتظر Documents/Worker است.
- Scanner مستقل آنتی‌ویروس و Documents برای تصاویر هنوز متصل نیستند و وضعیت آن‌ها
  صریحاً `UNAVAILABLE`/در انتظار گزارش می‌شود.
- Scope توسعه افزایشی MASTER-002 شامل Master Data مشترک دو شرکت، نرخ مرجع غیر authoritative،
  کاتالوگ‌های پیشرفته، Import امن Excel، UI واقعی و تست کامل است.
- این وضعیت فقط Phase A شامل نرخ ارز پیشرفته، Import امن هتل، کاتالوگ‌های موجود و UI
  فعلی را می‌بندد؛ کل اطلاعات پایه Complete نیست و ادامه در `MASTER-004` برابر `PLANNED` است.
- مانع lint مربوط به `no-control-regex` بدون Disable/Suppress و با بررسی صریح code point
  رفع شد؛ C0های ممنوع حذف و TAB/CR/LF و DEL طبق Policy قبلی حفظ می‌شوند.
- ادامه Suppliers روی Branch مستقل وارد PR #25 نمی‌شود و با وضعیت
  `PAUSED_FOR_CUSTOMER_002B_MIGRATION_HANDOFF` باقی می‌ماند.
- Migration و Central Docs برای `PC-A/CUSTOMER-002B` رزرو شده‌اند، اما فقط پس از Merge
  ترتیبی PRهای #25، #26 و #27 و Handoff نهایی فعال می‌شوند. Customer shared-contract/root
  export نیز با همین Gate رزرو است؛ Master shared-contract پس از Merge #25 پایدار و
  `RELEASED` و Dependency/Lockfile همچنان `RELEASED` خواهد بود.
- مرجع Handoff: [MASTER-003-HANDOFF.md](tasks/MASTER-003-HANDOFF.md). برنامه ادامه:
  [MASTER-004.md](tasks/MASTER-004.md).

### `MASTER-003B-GEO` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-next` دقیقاً از Remote Parent
  `origin/codex/pc-b-master-data-advanced@f0d3b8c4` ساخته شد و Parent Branch
- Draft PR #28 با Base `codex/pc-b-master-data-advanced` ایجاد شد و تا Merge
  PR #25 نباید ادغام شود؛ سپس Base آن به `develop` تغییر می‌کند.
  دست‌نخورده ماند.
- Migration افزایشی `20260827090000_master_data_geography` مدل‌های Region، Airport
  و Terminal و توسعهٔ غیرمخرب City را اضافه می‌کند؛ ISO/IATA/ICAO، مختصات،
  same-country hierarchy و delete restrict در PostgreSQL enforce می‌شوند.
- Contract عمومی به `master-data.v5` ارتقا یافت و Backend/Frontend واقعی پنج منبع
  جغرافیا با Search/Filter/Sort/Pagination، Create/View/Edit، Status، Optimistic Lock،
  Audit، Permission و UI فارسی RTL responsive تکمیل شد.
- داده جغرافیا global است؛ هیچ Legal Entity filter یا branch ownership روی رکوردها
  اعمال نمی‌شود و branch فقط در Audit metadata ثبت می‌گردد.
- همه ۱۰ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه، constraint test و smoke
  احراز‌شده login + پنج API + `/master-data` با HTTP 200 پاس شدند؛ دیتابیس موقت
  پس از آزمون حذف شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده است. این Slice زیر
  همان سه قفل فعال `PC-B/MASTER-003` باقی می‌ماند و PR آن باید Draft و stacked روی
  PR #25 باشد.
- full typecheck، ۳۱۶ تست در ۷۷ فایل و production build کل Monorepo پاس شدند؛ lint
  همه فایل‌های Slice نیز پاس است. full lint فقط روی DatePicker بدون تغییر Parent
  متوقف می‌شود و برای حفظ Vertical Slice وارد این PR نشده است.

### `MASTER-003C-FINANCIAL` — PC-B — `READY_FOR_REVIEW`

- «مالی و پولی» زیرمجموعه Master Data در `/master-data/finance` است و شش نمای واقعی
  ارزها، تاریخچه نرخ، گردش تأیید، بانک‌ها، شعب بانک و روش‌های پرداخت مرجع دارد.
- Migration افزایشی `20260829100000_master_data_financial_reference` سیاست نمایش ارز،
  نام انگلیسی/SWIFT بانک، شعبه مستقل و روش پرداخت مرجع را بدون عملیات مخرب اضافه می‌کند.
- نرخ‌ها همچنان تاریخچه مستقل، Decimal مثبت با حداکثر ۱۰ اعشار، Maker/Checker، Audit،
  Optimistic Lock و `isAuthoritative=false` دارند؛ Seed نرخ عمداً خالی است.
- حساب، شبا، کارت، CVV، مانده، تسویه، تراکنش و پیکربندی درگاه وارد Master Data نشده‌اند
  و هیچ Query مستقیمی به جداول Finance وجود ندارد.
- همه ۱۱ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و Constraintهای SWIFT، کد
  شعبه، ترتیب روش پرداخت و خالی‌بودن Seed نرخ با موفقیت آزموده شدند.
- هیچ فایل Customers، manifest یا lockfile تغییر نکرده است؛ آیکن/لوگوی بانک تا قرارداد
  رسمی Documents به‌صورت upload جعلی پیاده‌سازی نشده است.
- Branch `codex/pc-b-master-data-financial` دقیقاً روی
  `origin/codex/pc-b-master-data-next@e0e3a5f` پشته شده است؛ Draft PR #29 با Base همین
  Branch ایجاد شد و قبل از Merge والدهای #28 و #25 نباید ادغام یا به `develop` منتقل شود.

### `MASTER-003D-UI-POLISH` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-ui-polish` از
  `origin/codex/pc-b-master-data-financial@e7e6180` ساخته شد و PR مالی #29 را تغییر
  نمی‌دهد.
- Draft PR #30 با Base همان Branch مالی ایجاد شد و تا Merge والدهای #29، #28 و #25
  نباید ادغام شود.
- کارت KPI مشترک با شش رنگ پاستلی، آیکن معنایی، Dark Mode و چینش Responsive به همه
  Workspaceهای اطلاعات پایه اضافه شد.
- KPIهای شش نمای مالی و پنج نمای جغرافیا دقیقاً با نام‌های ماکاپ نمایش داده می‌شوند؛
  مقادیر فاقد قرارداد واقعی Finance/Aggregate با `—` مشخص‌اند و عدد ساختگی ندارند.
- جغرافیا اکنون پنج تب کشور، استان/ناحیه، شهر، فرودگاه و ترمینال، فیلترهای رابطه‌ای،
  جدول تخصصی، قاعده یکپارچگی، عملیات واقعی و Export دارد.
- خط رنگی پایین کارت‌های Hub در Hover حذف شد؛ حرکت و Focus Ring دسترس‌پذیر حفظ شدند.
- تست کامل Repository برابر ۳۳۵ تست، Typecheck کل Monorepo و Production Build موفق
  است. Lint فایل‌های تغییرکرده موفق است؛ Full Web Lint فقط روی ایراد قدیمی و دست‌نخورده
  `apps/web/src/components/ui/date-picker.tsx` متوقف می‌شود.
- Database، Migration، Backend، Contract، Customers، Dependency و Lockfile در این
  Slice تغییر نکردند.

### `MASTER-003E-SUPPLIERS` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-suppliers` از
  `origin/codex/pc-b-master-data-ui-polish@920328e` ساخته شد و PR والد #30 را تغییر
  نمی‌دهد.
- Draft PR #31 با Base همان Branch والد ساخته شد و پیش از Merge زنجیره
  #30 ← #29 ← #28 ← #25 نباید ادغام شود.
- شش نمای دقیق تأمین‌کنندگان، پروفایل تأمین‌کننده، کارگزاران، پروفایل کارگزار،
  اطلاعات تماس و وضعیت همکاری در `/master-data/organizations-suppliers` پیاده‌سازی شدند.
- Migration افزایشی `20260829133000_master_data_suppliers` پروفایل Supplier، خدمات
  رابطه‌ای Supplier/Broker و مخاطبان چندگانه را با FK محدودکننده اضافه می‌کند.
- Contactهای سازمانی فقط رمز‌شده/Mask/Fingerprint ذخیره می‌شوند؛ Unmask مجوز مستقل،
  Audit و Mask مجدد خودکار دارد و plaintext وارد List، Excel یا Audit نمی‌شود.
- KPIها با نام و آیکن ماکاپ از Summary واقعی Backend تغذیه می‌شوند؛ تعداد قرارداد که
  متعلق به Procurement است بدون جعل قرارداد با `—` نمایش داده می‌شود.
- همه ۱۲ Migration روی PostgreSQL 18 خالی، Seed دوگانه و رد زنده داده Contact نامعتبر
  موفق بودند؛ Seed هیچ Supplier، Contact، Contract یا Provider ساختگی اضافه نمی‌کند.
- Lint، Typecheck، Production Build و همه `349/349` تست Repository موفق هستند و مسیر
  `/master-data/organizations-suppliers` در خروجی SSG ساخته می‌شود.
- هیچ Query مستقیمی به Procurement، Finance یا Integrations و هیچ تغییری در Customers،
  dependency manifest یا lockfile وجود ندارد.

### `MASTER-003F-ACCOMMODATION` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-accommodation` از
  `origin/codex/pc-b-master-data-suppliers@02d4101` ساخته شد و PR والد #31 را تغییر
  نمی‌دهد.
- Draft PR #32 با Base `codex/pc-b-master-data-suppliers` ایجاد شد و پیش از Merge
  زنجیره #31 ← #30 ← #29 ← #28 ← #25 نباید ادغام شود.
- هفت نمای کاتالوگ اقامت شامل هتل‌ها، زنجیره، نوع اتاق، وعده/سرویس، امکانات، ورود
  گروهی Excel و هتل ترکیبی در `/master-data/accommodation` به Backend واقعی متصل
  هستند؛ پروفایل هتل طبق MASTER-003G از فهرست در Popup باز می‌شود.
- Migration افزایشی `20260829150000_master_data_accommodation` زنجیره هتل، روابط
  چندبه‌چند Meal/Room/Facility و هتل ترکیبی/اعضا را اضافه و مشخصات هتل را با وب‌سایت،
  زمان ورود/خروج، مختصات و لوگوی مرجع توسعه می‌دهد.
- Check Constraintهای زمان، جفت و بازه مختصات، ترتیب نمایش و اولویت عضو و همه FKهای
  جدید با `ON DELETE RESTRICT` در PostgreSQL اعمال می‌شوند؛ Migration دادهٔ قدیمی
  Meal/Room را بدون حذف به روابط جدید backfill می‌کند.
- Contract عمومی `master-data.v8` شامل ۲۵ منبع و Summary واقعی اقامت است. KPIهای
  هر شش کاتالوگ دقیقاً با نام و آیکن ماکاپ از Aggregate واقعی Backend تغذیه می‌شوند.
- قرارداد، نرخ خرید، موجودی، Voucher و تخصیص مسافر جعل نشده‌اند؛ این داده‌ها در
  Procurement/Reservations باقی می‌مانند و مرجع Documents تا قرارداد رسمی با `—`
  یا وضعیت در انتظار نمایش داده می‌شود.
- همه ۱۳ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و Constraintهای زنده زمان،
  مختصات، ترتیب و اولویت موفق‌اند؛ Seed هیچ Hotel/Chain/Composite یا قرارداد ساختگی
  اضافه نمی‌کند.
- Frozen install، Prisma format/validate/generate، Lint فایل‌های Slice، Typecheck و
  Production Build و هر `366/366` تست Repository موفق‌اند. Full Web Lint فقط روی
  ایراد قدیمی و خارج از Slice در
  `apps/web/src/components/ui/date-picker.tsx` متوقف می‌شود.
- هیچ فایل Customers، dependency manifest یا lockfile و هیچ جدول عملیاتی ماژول دیگر
  تغییر نکرده است.

### `MASTER-003G-UX-CONSOLIDATION` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-ux-consolidation` از HEAD تأییدشده PR #32
  ساخته شد و شاخه‌های والد یا PC-A را تغییر نمی‌دهد.
- Draft PR #33 با Base `codex/pc-b-master-data-accommodation` ایجاد شد و پیش از PR
  #32 یا سایر والدهای پشته Merge نمی‌شود.
- تاریخچه و نمودار نرخ داخل Popup جزئیات ارز قرار گرفت و با انتخاب ارز، جفت/نوع نرخ
  و بازه زمانی از Backend واقعی خوانده می‌شود؛ تب مستقل تاریخچه حذف شد.
- شهر و استان/ناحیه در یک تب بالادستی تجمیع شدند و نوع رکورد در همان صفحه انتخاب
  می‌شود؛ Schema و FKهای مستقل بدون تغییر باقی ماندند.
- پروفایل هتل، تأمین‌کننده و کارگزار با کلیک نام/مشاهده در Dialog مشترک باز می‌شود؛
  تب‌های پروفایل و نمای مستقل اطلاعات تماس از رابط حذف شدند.
- برچسب `MASTER-003 · PC-B` از Header صفحه اصلی حذف و شمارنده‌های Hub با نماهای
  قابل مشاهده هماهنگ شدند.
- ESLint تمام فایل‌های Slice، Typecheck و Production Build موفق‌اند؛ هر `366/366`
  تست Repository پاس شد. API Health پاسخ ۲۰۰ و Routeهای محافظت‌شده پاسخ ۳۰۷ به Login
  می‌دهند.
- Full Web Lint فقط به‌علت خطای قدیمی `react-hooks/set-state-in-effect` و هشدار
  `aria-required` در `apps/web/src/components/ui/date-picker.tsx` خارج از این Slice
  متوقف می‌شود.
- هیچ فایل Customers، Prisma/Migration/Seed، API/Contract، Dependency/Lockfile،
  Secret یا PII تغییر نکرده است.

### `MASTER-003H-TRANSPORT` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-transport` از
  `origin/codex/pc-b-master-data-ux-consolidation@70d97ea` ساخته شد و هیچ شاخه والد
  یا متعلق به PC-A را تغییر نمی‌دهد.
- Draft PR #35 با Base `codex/pc-b-master-data-ux-consolidation` ساخته شد و پیش از
  Merge PR #33 نباید ادغام شود؛ پس از Merge والد Base آن به `develop` تغییر می‌کند.
- Migration افزایشی `20260829170000_master_data_transport` مشخصات دوزبانه ایرلاین،
  نوع هواپیما، کلاس پروازی، قاعده بار، قالب Manifest، شرکت/نوع قطار و شرکت/نوع
  اتوبوس را با FK محدودکننده، Optimistic Lock و Constraintهای واقعی اضافه می‌کند.
- Contract عمومی به `master-data.v9` ارتقا یافت و هر ۹ منبع حمل‌ونقل به Backend واقعی
  Search/Sort/Pagination، Create/Edit، Active/Inactive، Audit، Permission و Export
  متصل شدند.
- Workspace فارسی RTL Responsive مطابق ماکاپ ۹ تب و KPIهای پاستلی هم‌نام دارد؛ تب
  مستقل پروفایل ایرلاین وجود ندارد و پروفایل همه ردیف‌ها از نام یا دکمه مشاهده در
  Popup باز می‌شود.
- Credential/Secret اتصال Provider، موجودی/قیمت/رزرو، قرارداد/تسویه و Manifest مسافر
  وارد Master Data نشده‌اند؛ Connection یا Documents فاقد قرارداد با `—`/وضعیت
  در انتظار نمایش داده می‌شود و Seed حمل‌ونقل عمداً خالی است.
- تمام ۱۴ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migration روی
  دیتابیس محلی Deploy و Seed دو بار بدون ایجاد داده ساختگی اجرا شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده و سه قفل فعال
  Migration/Contract/Docs همچنان زیر `PC-B/MASTER-003` باقی می‌مانند.

### `MASTER-003I-SALES-REFERENCES` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-sales-references` از
  `origin/codex/pc-b-master-data-transport@1049928` ساخته شد و روی Draft PR #35 پشته
  می‌شود؛ هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Draft PR #36 با Base `codex/pc-b-master-data-transport` ساخته شد و پیش از Merge
  PR #35 و تمام والدهای آن نباید ادغام شود؛ پس از Merge والد، Base مطابق زنجیره به
  `develop` تغییر می‌کند.
- Migration افزایشی `20260829190000_master_data_sales_references` شش کاتالوگ جدید
  Lead Source، Sales Channel، Lost Reason، Customer Type، Tag و Campaign Type را
  اضافه و کاتالوگ موجود Acquaintance Method را با نام انگلیسی و ترتیب نمایش تکمیل
  می‌کند؛ Check واقعی ترتیب نامنفی و رنگ Hex Tag و Unique Code فعال است.
- Contract عمومی به `master-data.v10` ارتقا یافت و هر هفت مرجع به Backend واقعی
  Search/Sort/Pagination، Create/Edit، Active/Inactive، Optimistic Lock، Audit،
  Permission و Export متصل شدند.
- Workspace فارسی RTL Responsive مطابق ماکاپ هفت تب و چهار KPI پاستلی هم‌نام دارد.
  هیچ تب پروفایل مستقلی وجود ندارد و جزئیات هر ردیف از نام یا دکمه مشاهده در Popup
  مشترک باز می‌شود.
- شمارنده استفاده به‌دلیل مالکیت آن توسط Consumer Aggregate و ممنوعیت Query مستقیم
  Customers/Sales صادقانه با `—` نمایش داده می‌شود؛ پس از قرارداد عمومی نسخه‌دار قابل
  اتصال است. Seed این Slice عمداً هیچ مرجع ساختگی اضافه نمی‌کند.
- تمام ۱۵ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migration روی
  دیتابیس محلی Deploy و Seed دو بار اجرا شد. هیچ فایل Customers، dependency manifest
  یا lockfile تغییر نکرده و سه قفل MASTER-003 فعال می‌مانند.
- Full Test شامل API `204/204`، Web `120/120`، Database `42/42`، Contracts `14/14`
  و سه تست سایر بسته‌ها موفق بود؛ Full Typecheck و Production Build نیز پاس شدند.
  Smoke احراز‌شده API و `/master-data/sales-references` هر دو پاسخ ۲۰۰ دادند. Lint
  فایل‌های دو Workspace حمل‌ونقل و مراجع فروش موفق است؛ Full lint فقط به‌دلیل ایراد
  قدیمی DatePicker خارج از این Slice متوقف می‌شود.

### `MASTER-003J-INSURANCE` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-insurance` از
  `origin/codex/pc-b-master-data-sales-references@fbc423d` ساخته شد و روی Draft PR
  #36 پشته می‌شود؛ هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Draft PR #37 با Base `codex/pc-b-master-data-sales-references` ساخته شد و پیش از
  Merge PR #36 و تمام والدهای آن نباید ادغام شود؛ پس از Merge والد، Base مطابق
  زنجیره به `develop` تغییر می‌کند.
- دو Migration افزایشی بیمه، Insurer را با Country و نام انگلیسی تکمیل و مدل‌های
  Insurance Plan، Coverage و رابطه چندبه‌چند آنها را با FK محدودکننده، Check مبلغ،
  سن، اعتبار و Version اضافه می‌کنند؛ عملیات مخرب وجود ندارد.
- Contract عمومی به `master-data.v11` و ۴۱ Resource ارتقا یافت. سه کاتالوگ شرکت‌های
  بیمه، طرح‌ها و پوشش‌ها به API واقعی، Permission، Audit، Optimistic Lock، Export،
  Search/Filter/Sort/Pagination و Summary واقعی متصل‌اند.
- Workspace فارسی RTL Responsive مطابق ماکاپ سه تب و KPIهای پاستلی هم‌نام دارد؛
  مشاهده جزئیات فقط Popup است و هیچ صفحه مستقل پروفایل ساخته نشده است.
- Pricing، Policy، Passenger، Reservation، Provider و Documents در مالکیت ماژول‌های
  مربوط باقی مانده‌اند؛ Query مستقیم بین‌ماژولی و Seed عملیاتی/ساختگی اضافه نشده است.
- تمام ۱۷ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migrationها
  روی دیتابیس محلی Deploy شدند. هیچ فایل Customers، dependency manifest یا lockfile
  تغییر نکرده و سه قفل MASTER-003 فعال می‌مانند.
- Full Test شامل API `211/211`، Web `124/124`، Database `46/46`، Contracts `14/14`
  و سه تست سایر بسته‌ها موفق بود؛ Full Typecheck و Production Build نیز پاس شدند.
  Lint تمام فایل‌های این Slice موفق است؛ Full lint فقط به‌دلیل ایراد قدیمی DatePicker
  خارج از این Slice متوقف می‌شود.

### `MASTER-003K-TRAVEL-SERVICES` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-travel-services` از
  `origin/codex/pc-b-master-data-insurance@1a94fca` ساخته شد و روی Draft PR #37
  پشته می‌شود؛ Draft PR #38 ایجاد شد و هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Migrationهای افزایشی `20260829220000_master_data_travel_services` و
  `20260829221000_master_data_travel_bus_connections` چهار کاتالوگ Tour
  Type، Transfer Type، CIP Service و Visa Service را اضافه و Leader را با Location،
  نام انگلیسی، مقصد و تماس رمزنگاری/ماسک‌شده تکمیل می‌کند؛ FK محدودکننده و Check
  ظرفیت، اعتبار، ترتیب و Version فعال است. Bus Company دقیقاً به یک Organization
  یا Provider متصل و Facilityهای Bus Type با رابطه M:N نگهداری می‌شوند.
- Contract عمومی به `master-data.v12` و ۴۵ Resource ارتقا یافت. هفت تب ماکاپ به API
  واقعی، Permission، Audit بدون Ciphertext، Optimistic Lock، Export و Summary واقعی
  متصل‌اند؛ شرکت و نوع اتوبوس در سطح Hub به این بخش تخصیص یکتای UI دارند.
- Workspace فارسی RTL Responsive KPIهای پاستلی هم‌نام و ستون‌های دقیق ماکاپ دارد؛
  مشاهده همه جزئیات، به‌ویژه پروفایل لیدر، فقط Popup است و مسیر مستقل ساخته نشده است.
- اسناد/آدرس/بانک/دستمزد لیدر، پرونده و سند مسافر، قیمت، ظرفیت، Reservation، Voucher،
  قرارداد و Settlement وارد Master Data نشده‌اند؛ شمارنده بدون Public Contract با
  `—` نمایش داده می‌شود و Seed این Slice عمداً خالی است.
- تمام ۱۹ Migration روی PostgreSQL 18 خالی، Constraintهای زنده و Seed دوگانه موفق
  بودند؛ همان Migration روی دیتابیس محلی Deploy و Seed دو بار اجرا شد. هیچ فایل
  Customers، dependency manifest یا lockfile تغییر نکرده است.
- Full Test شامل API `218/218`، Web `129/129`، Database `51/51`، Contracts `14/14`
  و سه تست سایر بسته‌ها، در مجموع `415/415` موفق بود؛ Full Typecheck و Production
  Build نیز پاس شدند. Lint فایل‌های Slice موفق است؛ Full lint فقط به‌دلیل ایراد قدیمی
  DatePicker خارج از این Slice متوقف می‌شود.

### `CALENDAR-001` — PC-B — `READY_FOR_REVIEW`

- کامپوننت مشترک DatePicker با تم آبی و سوییچ بالای تقویم برای شمسی/میلادی ایجاد شد.
- همه ورودی‌های خام `date` و `datetime-local` در Customers، Customer Affairs، Finance
  و Master Data با کامپوننت مشترک جایگزین شدند.
- مقدار ارسالی و ذخیره‌شده همچنان ISO Gregorian است و سوییچ فقط نمایش/انتخاب را تغییر می‌دهد.
- انتخاب ساعت برای فیلدهای datetime حفظ شد؛ ناوبری ماه، امروز، تاریخ انتخاب‌شده،
  بستن با Escape و کلیک بیرون و ویژگی‌های دسترس‌پذیری پوشش داده شدند.
- Web Typecheck، Lint و ۸۵ تست پاس شدند و چهار route متاثر روی dev server پاسخ ۲۰۰ دادند.
- Production build به‌دلیل dev server فعال و قفل `.next` هم‌زمان اجرا نشد؛ dev compilation موفق بود.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده `codex/pc-b-customer-affairs-foundation` و هدف آن Foundation مستقل
  امور مشتریان برای Lead/پیش‌فروش و پشتیبانی پس از فروش است.
- فاز A فقط Frontend فارسی/RTL/Responsive، Domain/Application design، قراردادهای
  ماژول‌محلی و تست‌های هدفمند را شامل می‌شود.
- محدوده آینده PC-B به ماژول/route `customer-affairs` در Web،
  `apps/api/src/customer-affairs/**` بدون Controller فعال یا Repository واقعی و
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` محدود است.
- درخواست مشتری، Lead source، Qualification، نیاز سفر/بودجه، فعالیت/Follow-up،
  Ticket/SLA/Escalation، شکایت، اصلاح، کنسلی/استرداد و رضایت‌سنجی در Scope طراحی
  قرار دارند؛ اتصال Customers/Sales/Reservation فقط proposal ماژول‌محلی است.
- Persistence، Prisma، Migration، Seed، Dependency/Lockfile، قرارداد مشترک و PII
  واقعی ممنوع‌اند.
- قفل‌های مشترک CUSTOMER-001 با Merge `7d0a4f4` آزاد و برای PC-A/`FINANCE-001`
  رزرو شده‌اند؛ PC-B حق تغییر Database، IAM، Master Data، Customers داخلی، Finance
  contract یا اسناد مرکزی را در Task خودش ندارد.

### `IAM-002` — PC-A — `DONE`

- قرارداد عمومی IAM به نسخه ۲ ارتقا یافت و ۵ Permission برای Master Data و ۶ Permission
  برای Customers منتشر شد؛ ۶ Permission قبلی IAM بدون تغییر حفظ شدند.
- Seed دو بار متوالی روی PostgreSQL 18 موفق بود؛ هر ۱۷ Permission یکتا و به نقش
  `administrator` متصل هستند.
- Prisma validate/generate، lint، typecheck، ۴۳ تست در ۱۹ فایل و build تولیدی کل
  Monorepo پاس شدند.
- Schema، Migration، Dependency و Lockfile تغییر نکردند. PR شماره ۱۱ با Merge Commit
  `d1f1133` ادغام و قفل IAM shared-contract آزاد شد.
- PC-B مجاز است `MASTER-002` را Full-Stack آغاز کند و تنها Migration و
  Dependency/Lockfile Owner باشد. PC-A هم‌زمان فقط فاز A بدون Persistence
  `CUSTOMER-001` را آغاز می‌کند.
- Handoff با PR شماره ۱۲ و Merge Commit `0af31c2` وارد `develop` شد.

## برنامه اجرایی Sprint دوم

### `SPRINT2-PLANNING-001` — PC-A — `DONE`

- سه Task آغاز Sprint شامل `IAM-002`، `MASTER-002` و `CUSTOMER-001` با Branch و مرز فایل
  مستقل ثبت شدند.
- `IAM-002` پیش‌نیاز کوتاه انتشار Permission Code و Seed عمومی برای دو دامنه است و هیچ
  Schema، Migration یا Dependency تغییر نمی‌دهد.
- پس از Handoff IAM-002، `MASTER-002` تنها Migration و Dependency/Lockfile Owner می‌شود.
- `CUSTOMER-001` فاز A بدون Persistence موازی است؛ فاز B فقط پس از Merge Master و Handoff
  صریح قفل Migration مجاز خواهد بود.
- نرخ ارز authoritative با `DEC-OPEN-004`، PII حساس با `DEC-OPEN-006` و auto-merge با
  `DEC-OPEN-011` تا تصمیم محصول/امنیت خارج از Scope قطعی هستند.
- مرجع دقیق: `docs/tasks/SPRINT-2-PLANNING.md`.
- PR شماره ۱۰ با Merge Commit `9efb37c` وارد `develop` شد.
- Scoped Prettier، لینک‌های Markdown، تعادل Fence، Scope/Secret scan و
  `git diff --check` پاس شدند؛ هیچ تست یا Build نرم‌افزاری لازم نبود چون Task فقط مستندات است.

## نتیجه نهایی Sprint اول

|  PR | Work Item     | Merge Commit                               | نتیجه                                             |
| --: | ------------- | ------------------------------------------ | ------------------------------------------------- |
|  #5 | `IAM-001`     | `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` | IAM Full-Stack و قرارداد عمومی ادغام شد           |
|  #6 | `MASTER-001`  | `cda0f9a67589974458a4261b753152a796fa1d0b` | Foundation بدون Persistence اطلاعات پایه ادغام شد |
|  #7 | `ARCH-001`    | `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` | معماری تاییدشده گردش سفر و منوی ۱۷ بخشی ادغام شد  |
|  #8 | `UI-ARCH-001` | `543f6e2b2f55833a2d1ae02440a9495f1510a112` | Frontend معماری و دسترسی عملی IAM ادغام شد        |

- منوی اصلی دقیقاً ۱۷ بخش دارد و «مدیریت سیستم» تنها آیتم اصلی IAM/Settings است.
- صفحه `/system` دسترسی عملی به رابط موجود `/users` و مسیر `/settings` فراهم می‌کند؛
  هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند.
- مرحله Foundation بسته شده است؛ Persistence واقعی Master Data قابلیت تکمیل‌شده محسوب
  نمی‌شود و در `MASTER-002` برنامه‌ریزی خواهد شد.

## برنامه Sprint اول

### `UI-ARCH-001` — PC-A — `DONE`

- Merge Commit: `543f6e2b2f55833a2d1ae02440a9495f1510a112` روی `origin/develop`

- منوی اصلی مطابق معماری ۱۷ بخشی تاییدشده بازچینی شد؛ Customer Affairs قبل/بعد،
  Reservation، Ticket Management، Sales و System Management مرز مستقل و روشن دارند.
- نمای معماری ماژول‌های فروش، رزرواسیون، خرید و مالی همراه زنجیره تحویل اطلاعات ایجاد شد.
- صفحات مستقل امور مشتریان، تعریف بلیت و مدیریت سیستم افزوده شدند؛ مسیر قدیمی خدمات مشتریان
  به Customer Affairs هدایت می‌شود.
- صفحه مدیریت سیستم اکنون ورودی عملی به رابط موجود IAM در `/users` و تنظیمات در
  `/settings` دارد؛ هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند و منوی اصلی ۱۷ بخشی
  بدون آیتم مستقل جدید حفظ شده است.
- تغییر فقط در Frontend و اسناد Task است؛ Prisma، Migration، Dependency/Lockfile، IAM و
  فایل‌های `MASTER-001` تغییر نمی‌کنند.
- نصب frozen، ESLint کل Web، Typecheck، نه فایل تست با ۲۶ تست و Production Build پاس شدند.
- خروجی Build شامل ۲۴ Route قابل اجرا است و Smoke احراز‌شده هر ده مسیر اصلی روی پورت ۳۱۰۰
  با HTTP 200 و محتوای مورد انتظار پاس شد؛ `git diff --check` نیز پاس است.

### `ARCH-001` — PC-A — `DONE`

- Merge Commit: `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` روی `origin/develop`
- ساختار ۱۷ بخشی شامل «مدیریت و تعریف بلیت‌ها» و «مدیریت سیستم» ثبت شده است.
- Customer Affairs مالک Lead/Support؛ Sales مالک قرارداد و تخصیص passenger/service؛
  Reservations مالک استعلام/Hold/صدور/Manifest؛ Procurement مالک خرید و Finance مالک
  financial release است.
- رزرواسیون Purchase Request را با قرارداد/service/supplier و قیمت/تخفیف کارگزار ایجاد
  می‌کند؛ Procurement approval/net purchase را مالک و margin از داده approved محاسبه می‌شود.
- مرجع جزئیات: `docs/TRAVEL_WORKFLOW_ARCHITECTURE.md`.
- این Work Item فقط اسناد است و هیچ Schema، Migration، Dependency یا Lockfile تغییر نمی‌دهد.
- Prettier، لینک‌های Markdown، تعادل fenceها، secret/scope scan و `git diff --check` پاس شدند.

### `IAM-001` — PC-A — `DONE`

- Merge Commit: `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` روی `origin/develop`
- ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend/Frontend و Audit امنیتی را Full-Stack پوشش می‌دهد.
- PC-A در طول `IAM-001` مالک انحصاری Migration، Dependency/Lockfile و قراردادهای مشترک IAM بود.
- معیار تحویل شامل Database، API، Frontend، تست‌های permission/security و Handoff
  قرارداد عمومی IAM به مصرف‌کنندگان است.
- Migration `20260822120000_iam_foundation` روی PostgreSQL توسعه اعمال شد؛ Seed دو بار
  متوالی بدون duplicate پاس شد و `prisma migrate status` دیتابیس را up-to-date اعلام کرد.
- Migration غیرمخرب `20260822150000_username_login` ورود case-insensitive با نام کاربری
  اختصاص‌یافته مدیر و ایمیل اختیاری را اضافه کرد و روی PostgreSQL لوکال پاس شد.
- Merge انجام شده و قفل‌های Migration، Dependency/Lockfile و IAM shared-contract در
  2026-08-23 با `SPRINT1-HANDOFF-001` رسماً آزاد شدند.

### `MASTER-001` — PC-B — `DONE`

- Branch: `codex/pc-b-master-data-foundation`
- Merge Commit: `cda0f9a67589974458a4261b753152a796fa1d0b` روی `origin/develop`
- Catalog دوازده‌گانه، UI فارسی/RTL responsive، فرم‌های Create/View/Edit، search/filter/
  sort/pagination و Stateهای Loading/Empty/Error/Permission/Preview تکمیل شد.
- Contractهای ماژول‌محلی list/detail/mutation/status و async Excel/PDF همراه validation،
  error envelope، Permission Matrix و ۲۰ تست پاس‌شده در `develop` قرار دارند.
- Prisma schema/Migration/repository، Backend پایدار، mutation واقعی، نرخ ارز authoritative
  و export artifact تکمیل نشده‌اند و در `MASTER-002` برنامه‌ریزی شده‌اند؛ هنوز هیچ قفل
  Migration یا Dependency به آن Task تخصیص ندارد.
- هیچ manifest، lockfile، Prisma، Migration یا فایل IAM تغییر نکرده است.
- Consumer requirementهای IAM در `docs/tasks/MASTER-001.md` ثبت شده‌اند؛ مصرف
  `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` اکنون از قرارداد عمومی
  `@rubi/contracts` انجام می‌شود.

## وضعیت Baseline مشترک

- Technical Bootstrap با Merge Commit `bdb5461` روی `develop` قرار دارد.
- مالکیت Full-Stack ماژول‌ها و Human Resources با Merge Commit `b5b7c5d` ثبت شده است.
- Frontend Foundation و طراحی Dashboard با Merge Commit `c4f8bde` روی `develop` قرار دارد.
- Prisma baseline شامل مدل‌های IAM، branch reference، Session و Audit و دو Migration غیرمخرب
  با Merge Commit `50eacca` وارد `develop` شده است.
- Master Data Foundation بدون persistence با Merge Commit `cda0f9a` وارد `develop` شده است.

## تکمیل‌شده در DOCS-002

- مدل همکاری به Full-Stack برای هر دو PC تغییر کرد؛ تقسیم ثابت Backend/Frontend حذف شد.
- مالکیت نهایی ماژول‌ها و تفکیک Backend/UI گزارش‌ها در `MODULE_OWNERSHIP.md` ثبت شد.
- قفل هم‌زمان Migration Owner، Dependency/Lockfile Owner، فایل مرکزی و API/Event Contract ثبت شد.
- منابع انسانی به منوی اصلی ۱۷ بخشی اضافه و دامنه، مرز، مدل مفهومی، امنیت و گزارش آن مستند شد.
- Employee از Customer/Passenger مستقل و ارتباط HR → Finance به payroll input تاییدشده محدود شد.
- حقوق و دستمزد قانونی و کامل در نسخه اولیه خارج از محدوده باقی ماند.

## تکمیل‌شده در Technical Bootstrap

- pnpm 11 workspace و Turborepo با Node 24، TypeScript strict، ESLint flat config و Prettier
- `apps/web`: Next.js App Router، Tailwind، فارسی/RTL، صفحه اجرا و `/status`
- `apps/api`: NestJS REST، prefix `/api/v1`، Swagger، ValidationPipe، error envelope، request ID،
  CORS قابل تنظیم، logging و graceful shutdown
- endpoint پایه `GET /api/v1/health` با قرارداد مشترک `packages/contracts`
- `apps/worker`: Nest standalone، BullMQ/ioredis، startup Redis health و graceful shutdown
- `packages/database`: Prisma 7، PostgreSQL datasource، Client factory و scriptهای
  format/validate/generate بدون model مصنوعی
- Compose محلی PostgreSQL 18، Redis 8 و MinIO با health check، volume نام‌دار و ساخت bucket
- lockfile pin‌شده و scriptهای root برای dev/build/lint/typecheck/test/database/infrastructure

## وضعیت تاریخی هنگام `DOCS-003`

- در زمان آن Task، قابلیت IAM یا Master Data هنوز پیاده‌سازی نشده و وضعیت هر دو `PLANNED` بود؛
  وضعیت جاری آن‌ها در بخش Sprint اول ثبت شده است.
- خود Commit مستنداتی `DOCS-003` هیچ فایل نرم‌افزاری، Prisma schema، Migration، Seed،
  Dependency یا Lockfile را تغییر نداد.
- Nginx، CI و deployment محیط غیرمحلی هنوز ساخته نشده‌اند.
- تصمیم‌های P0 بازِ `docs/DECISIONS.md` همچنان مانع schema دامنه/مالی و adapter واقعی هستند.

## کنترل کیفیت Technical Bootstrap

- نصب dependency و lockfile supply-chain policy: پاس
- Prisma format، validate و generate روی schema بدون model: پاس
- peer dependency check، ESLint، TypeScript typecheck و Prettier check: پاس
- Vitest: ۷ تست در ۶ suite، همگی پاس
- production build: Web، API، Worker و packageهای buildable پاس؛ routeهای `/` و `/status` static
- Compose config: پاس؛ PostgreSQL/Redis/MinIO healthy و MinIO init با exit 0
- smoke: API health، Swagger JSON، Web status/RTL، MinIO live و Worker→Redis/BullMQ پاس
- `git diff --check` و secret scan در gate نهایی پیش از commit تکرار می‌شوند.

## کنترل کیفیت IAM-001

- Prisma format/validate/generate پاس؛ Migration deploy و status روی PostgreSQL 18 پاس.
- Seed فقط permission، نقش سیستمی و شعبه مرکزی را می‌سازد و اجرای تکراری آن پاس است.
- lint کل Monorepo پاس؛ typecheck کل Monorepo پاس.
- Vitest: ۱۸ تست در ۱۱ suite شامل login HTTP contract، refresh cookie، validation،
  password policy و permission guard همگی پاس.
- Build تولیدی API، Worker، Web و packageهای مشترک پاس؛ `/login` و `/users` در خروجی Web هستند.
- `git diff --check`، بررسی Secret و Markdown links در gate نهایی تکرار می‌شوند.

## Handoff نهایی Sprint اول

1. PR شماره ۵ با Merge Commit `50eacca` وارد `develop` شده و قرارداد عمومی IAM در دسترس است.
2. قرارداد `@rubi/contracts` و جزئیات مصرف در `docs/IAM.md` مبنای PC-B است؛ دسترسی مستقیم
   به جدول‌ها یا repository داخلی IAM ممنوع می‌ماند.
3. PR شماره ۶ با Merge Commit `cda0f9a` وارد `develop` شده است؛ Foundation بدون
   Persistence تکمیل و Persistence واقعی به `MASTER-002` منتقل شده است.
4. PRهای شماره ۷ و ۸ با Merge Commitهای `99dd1cf` و `543f6e2` معماری تاییدشده و
   Frontend منوی ۱۷ بخشی را وارد `develop` کرده‌اند.
5. قفل‌های Migration، Dependency/Lockfile و shared-contract متعلق به `IAM-001` و قفل
   اسناد مرکزی متعلق به `ARCH-001` در 2026-08-23 آزاد شدند.
6. قرارداد عمومی IAM از `@rubi/contracts` مصرف می‌شود؛ `BranchReference`،
   `AuthenticatedActor` و `IamPermissionCode` (از جمله `iam.audit.read`) عمومی‌اند و
   Audit با actor context عمومی ثبت می‌شود. مدل/Repository داخلی IAM یا Audit قابل
   دسترسی مستقیم برای Master Data نیست.
7. آزادشدن قفل‌ها مجوز اجرای هم‌زمان نیست. `MASTER-002` و `CUSTOMER-001` پیش از هر
   تغییر Prisma، Migration یا Dependency باید قفل مستقل رزرو کنند و در هر لحظه فقط یک
   Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## برنامه اولیه Sprint دوم

- `MASTER-002` — PC-B — `DONE`: Merge `ddfebb3`؛ Persistence، REST، قرارداد عمومی،
  UI واقعی و async export request تکمیل و چهار قفل آزاد شدند. نرخ ارز authoritative و
  تولید artifact واقعی Documents/Worker همچنان خارج از Scope است.
- `CUSTOMER-001` — PC-A — `DONE/MERGED`: PR #19 با Merge `7d0a4f4` ادغام و چهار قفل آن در Handoff مستقل آزاد شدند.
- `FINANCE-001` — PC-A — `READY_FOR_REVIEW`: چهار Decision مالی ACCEPTED؛ Phase B مستقل برای Schema/Migration فقط پس از Merge PR #21 مجاز است.
- `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`: Phase A مستقل بدون Persistence؛
  فقط Frontend، طراحی دامنه/Application، Contract ماژول‌محلی و تست در مسیرهای
  `customer-affairs`. این Task هیچ قفل مشترکی دریافت نمی‌کند و Backend Persistence
  آن تا Handoff آینده Migration مسدود است.

## ریسک‌ها و تصمیم‌های باز

- دامنه Sub-ledger عملیاتی و مرز integration حسابداری قانونی با DEC-OPEN-001 نهایی شد.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست ارز، rounding، FX و Tax/Recognition با DEC-OPEN-004 پذیرفته شد؛ شماره‌گذاری اسناد همچنان باز است.
- schema و نرخ authoritative فقط در Task مستقل Phase B پس از Merge PR #21 و Migration gate مجاز است.
- ذخیره PII حساس و مدارک هویتی تا تصمیم قطعی retention/رمزنگاری ممنوع می‌ماند.
- اجرای Persistence مالی فقط در Task مستقل Phase B پس از Merge PR #21 و با قفل یگانه Migration/Dependency مجاز است؛ تاریخچه Migration یا داده محلی نباید دستی دست‌کاری شود.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.

## LOCAL-UNIFIED-3100-0909 — PC-A — READY_FOR_REVIEW
Port 3100 composes Sales 385efaa (includes 3d3095e), sidebar efe6287 and Reservations 0946bdd. Main reservations route uses colored queue; original processing retained at /reservations/processing. Source worktrees preserved. API/Web builds, 41 navigation/reservation tests and targeted lint passed. Existing DB 55432 restarted; private pre-update pg_dump retained inside container; 14 existing non-destructive migrations applied. Official Sales/Reservations permissions synchronized to existing administrator. Stored local login and both API lists returned 200. No new migration/dependency or production deployment.

### Local database correction — 2026-09-09
The 55432 preview database was the wrong dataset for the user's current work (2 customers, 0 contracts). Runtime now uses the original root .env database localhost:5432/rubi, with its matching contact keys explicitly loaded. Read-only verification found 350 customers and 5 contracts; all 43 migrations already applied, no main-database migration or data changes. Contact integrity check: 542 valid, 4 failed; those records remain unchanged. API remains loopback-only. Previous preview database and its backup are preserved. Login may need renewal after the database/session change.

## RESERVATIONS-ACTION-PANEL-003 — PC-A
Implemented the selected option 3 on the isolated local branch: twenty buttons grouped in a sticky right panel; all disabled until an authorized contract is selected. Each opens the standard accessible Dialog with selected-contract context. Changing selection/access unmounts the previous dialogs. Available overview/passenger/customer projections are read-only; unspecified forms explicitly remain pending with no write controls. Small screens stack the panel above the list. No API, credentials, database or migration changes. 34 reservation tests passed.

Final verification: targeted lint and production Web build/TypeScript passed (39 routes). Local Web 3100 restarted; no API restart or database switch.

## NAV-FINANCE-TICKET-LABELS-0909 — PC-A
Purchases now appears in the Finance sidebar group; route and permissions are unchanged. Visible Web copy uses the requested Persian spelling بلیط, with existing fixture/test text updated consistently. 57 relevant tests passed; no backend, data, migration or dependency change.

Final validation: Web lint, TypeScript and production build passed (40 routes); local Web3100 refreshed. API and original database unchanged.

## NEUTRAL-DARK-MODE-0909 — PC-A — READY_FOR_REVIEW
Replaced navy dark theme surfaces with neutral charcoal tokens; desktop sidebar and company header now follow dark mode. Reservations queue, filters and action panel use shared theme tokens, with distinct pink, light/dark gray and red status palettes. Foreground and secondary text meet 4.5:1 contrast on base surfaces; input boundaries and focus rings meet 3:1. These checks cover declared token pairs, not every composed screen. Light palette and Finance/ticket label changes are preserved. Web lint, TypeScript, 66 relevant tests and production build (40 routes) passed. Web 3100 restarted; API/main database unchanged. Browser visual review unavailable due to browser tool startup failure. No migration, dependency, backend or production deployment changes.

## HR-DARK-NAVIGATION-0909 — PC-A
Fixed Navigation collapse state resetting whenever pathname changed. Group toggles now remain independent across route navigation in the persistent application layout. Added dark overrides for HR and Frappe landing cards, tables, controls, organization chart, payroll and portalled dialogs; light styles remain unchanged. Semantic success/warning/error indicators and keyboard focus remain distinct. 87 scoped tests, Web lint and standalone TypeScript passed. No migration, dependency, API or data changes. Browser visual QA is not claimed.
Final validation: production build (40 routes) passed and local Web 3100 refreshed; login returned HTTP 200. Scoped reservations released.

## PUBLISH-DARK-HR-0909 — PC-A — READY_FOR_REVIEW
User explicitly authorized merge to develop. PR #120 now contains the full stack from #117/#119/#120: Finance purchase grouping, بلیط spelling, neutral dark shell and Reservations, dark HR legacy surfaces and persistent collapsed navigation. Integrated develop 679e516 while preserving PC-B connected HR/agencies and responsive Tehran-date header. Resolved the header conflict by retaining both responsive grid and dark border. Updated three mirrored API ticket validation strings to match Web; existing parity assertion retained. 23 focused integration tests passed. Final combined GitHub quality, tests, build and PostgreSQL gates must all pass before merge. No local database migration or API/Web restart during this publication task. Other computers must pull develop using the existing workflow and apply the already-merged HR migrations through their normal release procedure. Scoped integration reservation ends on successful PR #120 merge; PRs #117 and #119 are superseded by the complete stack.
