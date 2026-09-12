# Work Assignments

## WORKBENCH-017-PUBLISH — PC-B — IN_PROGRESS

- CI integration follow-up reserves user-menu.spec.ts only to update obsolete profile heading/navigation expectations; credential/access-mutation assertions remain intact. Combined local170tests/lint passed; final CI is the merge gate.

- User explicitly authorizes push and merge of current changes to develop via PR190. Integration-only reservation for the five conflicting files in profile/Workbench/B2B status stack; preserve current develop, owner exports, requested label and boundary-note removal. No runtime/API/database changes. Personal-profile persistence remains awaiting separate owner handoff. Merge only after final combined CI gates pass.

## WORKBENCH-017-PERSONAL-PROFILE — PC-B — UI_VERIFIED / PERSISTENCE_AWAITING_HANDOFF

- User requests editable personal information and profile photo in preferences. Reserve Web profile module/form/model/tests plus own task/status docs on codex/pc-b-personal-profile-editor frome4ddc02. Consume existing native controls/theme. IAM has no self-edit/avatar contract; backend/schema ownership handoff requested before edits. No new browser persistence, fake saved records or profile data in source. Runtime API cutover remains a separate previously blocked action; no retry.

- Delivered UI6e6ad65 with owner exportsbc4c6b9 and datefix7fc5b05 preserved.20 targeted tests, lint, typecheck and43-route build passed. Browser verified local photo preview, phone editing, reset and disabled real-save state; test selection/input removed. Web3100 source1af4c0c/PID19708/manifesthr005-b7ab66ff79101b7b; API untouched. Draft PR190; no merge. Web implementation reservation released, backend/schema unreserved pending explicit handoff.

## WORKBENCH-016-PROFILE-VIEWS — PC-B — DONE / UI_VERIFIED

- User follow-up: reserve and replace only the profile permission-summary heading with «خلاصه دسترسی‌ها» on the same task branch; no behavior changes. Runtime inclusion coordinated with the current B2B owner.

- Reserve Web profile-workspace.tsx and Workbench settings session label plus own status docs on codex/pc-b-profile-settings-views. User requests separate session logs, working personal preferences and removal of duplicate profile navigation. Consume existing IAM public session response and shared theme provider only; no IAM backend, schema, dependency or shared provider edits. Coordinate B2B toolbar source preservation before Web3100 handoff.

- Delivered a744f0c; preserved toolbar patches as357d025/86bb4a3. Eight profile tests, scoped lint, TypeScript and43-route build passed. Authenticated browser verified session-only table, absent duplicate nav, real theme change and persistence after reload; original light theme restored. Web3100/PID2772/source86bb4a3/manifesthr005-2463c93fed3bee9e; handed to B2B for subsequent boundary-note-only build. Draft PR186, no merge; scoped reservation released.

## UNIFIED-LATEST-0912 — PC-A — READY_FOR_MERGE

- با تأیید صریح مالک محصول، آخرین نسخه‌های منتشرشده PC-A، PC-B و مجوز Reporting
  برای PC-C روی شاخه مستقل `codex/pc-a-unified-latest-0912` تجمیع شدند تا پس از
  کنترل کامل از یک Pull Request به `develop` برسند. `main` تغییر نمی‌کند.
- ورودی‌های تجمیع‌شده شامل رزرواسیون و خروجی‌ها تا `af77d07`، رابط مشترک تا
  `bc40d8b`، مالی تا `f2085c1`، مدیریت قیمت تا `135260f`، آژانس‌ها تا
  `5322656`، میزکار تا `40fa1d6` و مجوز Reporting تا `a9300cc` است. تاریخ‌های
  خام بازگشتی نیز به DatePicker مشترک تبدیل شدند.
- Conflictهای اسناد به‌صورت افزایشی حل شده‌اند؛ هیچ Workspace دارای تغییر محلی
  reset، stash یا overwrite نشده است. مالکیت Taskهای مستقل با Merge این شاخه
  منتقل نمی‌شود و ادامه هر ماژول همچنان به رزرو جدید نیاز دارد.
- نصب Frozen، Prisma، lint، typecheck، ۲۶۵۴ تست و Production Build شش Task با
  ۴۶ Route پاس شدند. کنترل Diff و Secret نیز سالم است؛ اجرای نهایی Web 3100 و
  API پس از Merge همین Baseline انجام می‌شود. جزئیات در
  `docs/tasks/UNIFIED-LATEST-0912.md` ثبت شده است.

## B2B-CONTRACT-FILTER-LAYOUT-001 — PC-B — READY_FOR_REVIEW

Reserve corporate-design.css agreement filter layout on codex/pc-b-b2b-contract-filter-layout from2e43e0e. Resolve flex overriding the shared filter grid; maintain date/branch filters and compact aligned actions. No data/API/dependency changes.

Sourcecc3027d+d1160ed: explicit grid specificity and6/3/1 responsive columns;113 tests/typecheck pass. Combined buildfe0ae53 preserves12c7c41. Release source reservation.

## B2B-REMOVE-SUBTITLE-001 — PC-B — READY_FOR_REVIEW

Reserve Organizations workspace heading copy on codex/pc-b-b2b-remove-subtitle from282227a. Remove requested directory subtitle only; no data/API/dependency changes.

Sourcee03afcf; scoped lint/typecheck and113 tests pass. Runtime buildd59b860 preserves current1e295db. Release source reservation.

## B2B-BACK-NAVIGATION-001 — PC-B — READY_FOR_REVIEW

Reserve corporate-profile.tsx on codex/pc-b-b2b-back-navigation from40da905. Correct in-page back from dossier sections to same organization360, retaining directory exit only at home. No API/data/dependency changes; coordinate Web3100.

User clarified browser Back. Extend scope to organizations-workspace.tsx and module-local history helper/tests. Sourcea753d86 preserves Next history metadata, records organization/screen/tab identifiers, restores Back/Forward without duplicate pushes.113 tests, scoped lint/typecheck pass; combined build1995e16 preserves8492a36. Release source reservations.

## B2B-CONNECTIONS-AUDIT-001 — PC-B — READY_FOR_REVIEW

Reserve Organizations directory enrichment, dossier role summary and focused connection tests/report on codex/pc-b-b2b-connections-audit. Consume existing B2B/MasterData/IAM public APIs only. Finance producer and shared Sales contracts remain with PC-A; no migration/dependency/central API edits. Preserve latest Web runtime29cfe14 and coordinate integration.

Source9b1c33c includes scoped corporate-profile boundary copy.111 tests, scoped lint and typecheck pass. Audit/handoff: docs/tasks/B2B-CONNECTIONS-AUDIT-001.md. Combined Web build on9d05cd6 preserves latest7bae2a4; source reservations released. Missing Finance/Sales/notification producers remain explicitly incomplete.

## WORKBENCH-015-SETTINGS-CENTER — PC-B — DONE / UI_VERIFIED

- Reserve only account action-grid alignment in workbench-workspace.tsx and own status docs. Center all settings buttons/links, no shared UI/API/dependency change. Base78bda1f; branch codex/pc-b-workbench-settings-center. Coordinate inclusion in next shared Web3100 build.

## WORKBENCH-014-NOTE-CARDS — PC-B — UI_READY / LOCAL_RUNTIME_3100

- PC-B reserves Workbench note board/editor/model and workspace integration to match screenshots552/553: cream cards, folders/search/date filters, pin/edit/remove and checklist strike-through. UI drafts only with explicit unsaved label; no persistence, fake server records, API/schema/dependency changes. Branch codex/pc-b-workbench-note-cards from e701b49; preserve pending B2B history fix on runtime handoff.

## WORKBENCH-013-INTERACTIONS — PC-B — UI_READY / PERSISTENCE_BLOCKED

- User requests screenshot-aligned settings, larger centered tabs, colored KPIs, removal of Documents shortcut, chat layout, functional request/message/note forms and private checklist notes. Reserve Workbench-local UI and own docs on codex/pc-b-workbench-interactions; preserve B2B9b1c33c. Persistence requires current migration-owner handoff, requested from coordinator before schema work; no fake storage or transmission. Shared layout and other owner modules unchanged.

## WORKBENCH-012-MESSAGE-TEMPLATES — PC-B — UI_READY / LOCAL_RUNTIME_3100

- Reserve message-composer.tsx and module-local message-templates.ts plus own docs. Add Finance, Reservations, AI and Sales recipient choices with editable prepared texts. Branch codex/pc-b-workbench-message-templates, base d8b3e15. No message service, transmission, storage, owner API, schema or dependency changes. Existing authenticated desktop Rubi UI and accessibility conventions retained; runtime build coordinated with B2B.

## REPORTING-PC-C-AUTHORIZATION — PC-A → PC-C — AUTHORIZED / P0-04 LOCAL-GATE

- مالک هماهنگی پروژه در 2026-09-10 به `COMPUTER_ID=PC-C` اجازه داد توسعه Reporting
  را در Workspace اعلام‌شده `F:/Projects/Rubi` و Worktree مستقل
  `F:/Projects/Rubi/.worktrees/reporting` ادامه دهد. این ثبت، مجوز سیستم‌عامل یا وجود
  مسیر روی دستگاه مقصد را از PC-A ادعا نمی‌کند؛ PC-C باید آن‌ها را محلی تأیید کند.
- محدوده انحصاری Task: `apps/web/src/modules/reports/**`،
  `apps/web/src/app/(crm)/reports/**`، `apps/api/src/reporting/**` و
  `docs/tasks/REPORTING-*.md`. ثبت وضعیت همین Task در این فایل و
  `docs/PROJECT_STATUS.md` مجاز است. شاخه‌های جدید فقط با الگوی
  `codex/pc-c-reporting-<task>` ساخته می‌شوند.
- PC-C مجاز به Terminal، test/lint/typecheck/build، اجرای Reporting روی پورت 3000 و
  توقف/جایگزینی فقط Listener متعلق به همان Reporting worktree است. Process ناشناس یا
  متعلق به Workspace دیگر نباید متوقف شود.
- مبنای اعلام‌شده از دستگاه مقصد: P0-01=`dcf2b2e`، P0-02=`b429b94` و
  P0-03=`f4f85bc`؛ ادامه `REPORTING-P0-04`. این سه Commit پس از fetch مورخ
  2026-09-10 در Clone مرجع و Remote قابل resolve نبودند و هیچ Branch ریموت
  `codex/pc-c-reporting-*` مشاهده نشد. PC-C پیش از P0-04 باید وجود و ترتیب این Commitها
  را در Worktree خودش تأیید و شاخه را با Push معمولی منتشر کند؛ Commit ساختگی یا تغییر
  Base ممنوع است.
- هیچ Migration، Schema، Seed، Dependency، Lockfile یا shared/root contract برای این
  مجوز رزرو نشده است. نیاز واقعی به هرکدام، Task و قفل مستقل می‌خواهد. Reporting فقط
  Approved View یا Public Projection نسخه‌دار را مصرف می‌کند؛ Query مستقیم جدول‌های
  عملیاتی و دورزدن Permission/Branch/Legal-Entity scope ممنوع است.
- مالکیت دائمی Reporting منتقل نشده است: PC-A مالک زیرساخت Backend و صحت grain و PC-B
  مالک رابط مرکزی باقی می‌مانند؛ PC-C مجری تفویض‌شده P0 است. تغییر Contract یا فایل
  خارج از Scope باید پیش از اجرا با هر دو مالک ثبت شود. Merge، Force Push و تغییر
  مستقیم `main`/`develop` مجاز نیست. مرجع کامل:
  `docs/tasks/REPORTING-PC-C-AUTHORIZATION.md`.

## SALES-PRICE-MANAGEMENT-0912 — PC-A — READY_FOR_REVIEW / UI_PREVIEW

- درخواست صریح مالک در 2026-09-12: افزودن آیتم مستقل «مدیریت قیمت» در گروه «فروش»
  برای تغییر روزانه قیمت تورها و بلیت‌های ملکی و دریافت خروجی بنر قیمت. `COMPUTER_ID=PC-A`.
- Branch مستقل `codex/pc-a-pricing-management` به‌صورت stacked از نسخه قابل مشاهده
  Finance `77e181d` ساخته شد تا ناوبری تأییدشده کاربر حفظ شود؛ Merge مقصد فقط پس از
  تعیین تکلیف PR #153 انجام می‌شود.
- محدوده رزروشده: ماژول Web جدید `apps/web/src/modules/pricing-management/**`، route
  `/pricing-management`، metadata/icon/render ناوبری و تست‌های مربوط، و اسناد همین Task.
  فایل‌های API/Ticket/Tour/Sales موجود، Schema/Migration/Seed، Permission، داده عملیاتی،
  Dependency/Lockfile و Listenerهای دیگر تغییر نمی‌کنند.
- قیمت فروش طبق قرارداد موجود متعلق به Sales است، اما Producer فعلی تور/بلیت قرارداد
  قیمت روزانه و mutation پایدار ندارد. این Slice فقط ویرایش/اعتبارسنجی Preview و تولید
  واقعی PNG در مرورگر از داده صریحاً synthetic دارد؛ ذخیره سروری یا ادعای انتشار قیمت
  تا قرارداد عمومی، Permission و Migration مستقل ممنوع است.
- نتیجه تحویل: route مستقل `/pricing-management` بلافاصله پس از «قرارداد» در گروه فروش،
  فیلتر تاریخ/نوع/جست‌وجو، ویرایش و اعتبارسنجی قیمت، انتخاب اقلام بنر، سه تم و خروجی
  واقعی PNG مربع ۱۲۰۰ پیکسل. ۲۳ تست هدفمند، Web typecheck، lint محدود و Production
  Build با ۴۲ مسیر موفق‌اند. Browser صفحه و پیام موفقیت ساخت PNG را بدون خطای Console
  تأیید کرد؛ Commit `c8f41fc` Push و Draft PR #161 به شاخه مالی stacked باز شد؛ ذخیره
  عملیاتی همچنان خارج از این Slice است.

## FINANCE-002A-ACCOUNTING-AND-INBOX — PC-A — READY_FOR_REVIEW / FX_SNAPSHOT_FOLLOWUP / PERSISTENCE_BLOCKED

- درخواست مالک محصول در 2026-09-12: تکمیل Phase A حسابداری و Vertical Slice کارتابل
  دریافت/پرداخت در فضای مستقل `/finance`. Branch مستقل
  `codex/pc-a-finance-core-accounting` از `origin/develop@4717b13` و Worktree مستقل
  `C:/Users/niayeshseir-1/Rubi-finance-core-accounting` است؛ `COMPUTER_ID=PC-A`.
- محدوده رزروشده: `apps/api/src/finance/**`، `apps/web/src/modules/finance/**`، route موجود
  `/finance`، `packages/contracts/src/finance/**`، تست‌های Finance و سند
  `docs/tasks/FINANCE-002A-ACCOUNTING-AND-INBOX.md`. تغییرات اسناد مرکزی فقط به ورودی
  افزایشی همین Task محدود است و ورودی هیچ مالک دیگری بازنویسی نمی‌شود.
- قفل Migration/Central Docs و قراردادهای IAM/Sales/Travel نزد Task فعال رزرواسیون باقی
  می‌ماند. بنابراین Prisma Schema/Migration/Seed، Permission seed، Root contract export،
  Dependency/Lockfile، فایل‌های Sales/Reservations/Procurement/HR/Documents و Runtime یا
  Portهای آن‌ها تغییر نمی‌کند. Finance فقط Reference/Snapshot نسخه‌دار مصرف می‌کند.
- اجرای مجاز تا آزادشدن قفل: Domain/Application و UI واقعی از نظر validation و state
  handling، بدون Controller/Persistence یا موفقیت عملیاتی جعلی. Web مالی فقط روی 3200 و
  API مالی فقط روی 4200 Smoke می‌شود و هیچ listener متعلق به رزرواسیون متوقف نمی‌شود.
- معیارها، قفل‌ها، قراردادهای producer/consumer و موارد مسدود در
  `docs/tasks/FINANCE-002A-ACCOUNTING-AND-INBOX.md` ثبت می‌شوند. Push و Draft PR به
  `develop` مجاز است؛ Merge، Force Push و تغییر مستقیم `main`/`develop` ممنوع است.
- نتیجه مجاز تحویل شد: حسابداری و کارتابل مستقل، درخت حساب، کنترل‌های دوره/Posting، قراردادهای
  versioned و کارتابل Preview با validation دریافت/پرداخت. Contractها ۶۴ تست، API مالی
  ۱۹ تست و Web مالی ۱۴ تست پاس؛ lint/typecheck/build و Smoke پورت‌های 3200/4200 موفق.
  Commit قابلیت `6de5d94` Push و Draft PR #153 به `develop` باز شد. Persistence، Audit
  پایدار، Outbox/Event و Posting واقعی همچنان `BLOCKED_BY_MIGRATION_LOCK` هستند.
- پیگیری اصلاح‌شده مالک در 2026-09-12 با مرجع تصویری: «کارتابل درخواست‌ها» باید کاملاً
  از صفحه حسابداری جدا و به‌عنوان آیتم مستقل بین «حسابداری» و «خرید و تأمین» در گروه
  «مالی» قرار گیرد. `/finance` فقط حسابداری و `/finance/requests` فقط کارتابل را نمایش
  می‌دهد. نگاشت عمومی مقصد درخواست‌های HR و اعلان‌های مالی نیز به مسیر جدید منتقل شد؛
  محدوده این پیگیری به metadata ناوبری، routeها، Web مالی، همین نگاشت‌های عمومی و تست‌های
  مربوط محدود است.
  ۳۱ تست هدفمند Web و ۶۴ تست Contract، lint/typecheck و Build نهایی ۴۱ مسیر موفق‌اند.
- پیگیری دوم مالک در 2026-09-12 با مرجع تصویری: فرم بررسی دریافت باید نام و مبلغ/مانده
  قرارداد و حساب مقصد موجود را روشن نشان دهد؛ فرم پرداخت باید قرارداد، کارگزار، حساب
  مبدأ، سابقه پرداخت و مانده را نمایش دهد و ردیف‌های پرداخت جزئی قابل افزودن/حذف باشند.
  محدوده رزروشده همان مدل/Workspace/Test مالی و Domain validation پرداخت جزئی است؛
  قرارداد v1 موجود شکسته نمی‌شود و Schema/Migration/Persistence/Posting همچنان قفل است.
- نتیجه پیگیری دوم: کارت‌ها و Dialog نام قرارداد و مانده را نمایش می‌دهند؛ دریافت به
  حساب مقصد قابل Posting و هم‌ارز متصل می‌شود؛ پرداخت قرارداد/کارگزار، حساب مبدأ، سابقه،
  جمع و مانده پس از عملیات دارد و ردیف‌های پرداخت جزئی قابل افزودن/حذف‌اند. فیلدهای فنی
  Version/Idempotency از فرم کاربر حذف و در state داخلی حفظ شدند. ۳۲ تست هدفمند Web،
  typecheck، lint محدود، Build ۴۱ مسیر و Browser QA هر دو فرم موفق‌اند؛ ثبت قطعی همچنان
  `BLOCKED_BY_MIGRATION_LOCK` است. Commit قابلیت `70fde9b` به Draft PR #153 Push شد.
- پیگیری سوم مالک در 2026-09-12: «توضیح مالی» در فرم دریافت/پرداخت اختیاری باشد و
  فیش‌های همراه درخواست در همان Dialog نمایش داده شوند. محدوده فقط مدل/Workspace/Test
  مالی و اسناد همین Task است؛ فایل جدید، Upload، Documents persistence یا قرارداد v1
  شکسته ایجاد نمی‌شود و attachment فقط از snapshot مرجع درخواست نمایش داده می‌شود.
- نتیجه پیگیری سوم: حداقل طول توضیح مالی حذف و label آن اختیاری شد. Dialog فیش/مدرک
  همراه را با نام، نوع، حجم، UTC و وضعیت Scan نمایش می‌دهد و حالت بدون فایل نیز روشن است؛
  باینری در Finance کپی نمی‌شود. ۳۳ تست هدفمند Web، typecheck، lint محدود، Build ۴۱
  مسیر و Browser QA نمایش فیش و label اختیاری موفق‌اند. Commit `7e673e8` به Draft PR
  #153 Push شد.
- پیگیری چهارم مالک در 2026-09-12: Finance باید روش هر پرداخت را از میان حواله، چک،
  نقد، کارت‌خوان و روش‌های متعارف مشخص کند. محدوده فقط مدل ردیف پرداخت، Dialog و تست‌های
  Finance است؛ قرارداد v1، Schema/Migration/Persistence و داده عملیاتی تغییر نمی‌کنند.
- نتیجه پیگیری چهارم: برای هر ردیف پرداخت جزئی، روش پرداخت مستقل و اجباری از میان حواله
  بانکی، چک، نقد، کارت‌خوان، کارت‌به‌کارت، برداشت مستقیم و سایر اضافه شد. انتخاب چک،
  شماره چک را اجباری می‌کند و سایر روش‌ها مرجع/شماره پیگیری اختیاری دارند. ۳۴ تست هدفمند
  Web، typecheck، lint محدود، Production Build با ۴۱ مسیر و Browser QA فهرست روش‌ها و
  تغییر پویا به «شماره چک» موفق‌اند. Commit قابلیت `801455f` به Draft PR #153 Push شد؛
  ثبت عملیاتی همچنان `BLOCKED_BY_MIGRATION_LOCK` است.
- پیگیری پنجم مالک در 2026-09-12: اگر دریافت یا پرداخت ارزی است، نرخ روز ارز باید همراه
  زمان همان عملیات در سابقه دریافت/پرداخت قابل مشاهده باشد. محدوده رزروشده فقط مدل Draft،
  داده Preview سابقه، محاسبه Decimal معادل ریالی، Dialog و تست‌های Finance است؛ منبع نرخ
  authoritative، Schema/Migration/API/Persistence و قرارداد cross-module تغییر نمی‌کنند.
- نتیجه پیگیری پنجم: نرخ هر واحد ارز به ریال برای دریافت/پرداخت غیرریالی اجباری شد و
  معادل ریالی همان عملیات به‌صورت Decimal محاسبه می‌شود. سابقه هر عملیات ارزی مبلغ، نرخ
  Snapshot، معادل ریالی و UTC را کنار هم نمایش می‌دهد؛ سابقه دریافت و پرداخت نیز عنوان
  متناسب دارد. ۳۶ تست هدفمند Web، typecheck، lint، Build ۴۱ مسیر و Browser QA موفق‌اند؛
  Commit قابلیت `9f4e01d` به Draft PR #153 Push شد. ذخیره پایدار و منبع خودکار نرخ
  همچنان `BLOCKED_BY_MIGRATION_LOCK` هستند.

## HR-013-CONNECTIONS — PC-B — READY_FOR_OWNER_APPROVED_MERGE

- User requests HR connections to all main-menu modules. Reserve HR API/Web and HR contracts, HR receiving-permission seed entries, and one additive AppShell connection outlet on `codex/pc-b-hr-module-connections` from `origin/develop@e07c0c6`. Scope, producer/consumer compatibility and acceptance boundaries: `docs/tasks/HR-013-CONNECTIONS.md`.
- Uses existing HR-owned persistence/FKs; no Migration or Dependency lock is needed. Destination domain services and active B2B runtime remain untouched. No existing source owner reservation is taken over; receiver UI uses the additive public HR service.
- Follow-up explicitly authorizes bidirectional form reference wiring, push and merge to develop. Extend this reservation to additive HR directory/contracts, Master Data public currency directory/export, Documents employee-case selection/validation, Finance party selection and foundation owner selection. Reuse existing IAM user FK and document source contract; no migration or runtime takeover. Public options must retain canonical IDs, branch scopes and live validation. Preview consumers remain explicitly non-persistent.
- The existing Customer Affairs follow-up owner field is included in the same public employee selector scope; its preview draft retains the selected employee ID.
- Follow-up delivered: active IAM account selection/persisted employee FK, active Master Data currency selection/validation, existing Documents selection with HR document FK, direct employee-case selection in Documents with public validation, and scoped/paginated employee selection in destination owner/party fields. All 469 targeted tests passed (157 Web, 150 API unit/boundary, 26 isolated PostgreSQL, 63 contracts, 73 database). Code reservation is released for the explicitly authorized CI-gated PR139 merge. Runtime/DB/migration ownership remains unchanged.
- Delivered the durable referral/response layer with 16 menu destinations, 13 scoped receiving permissions, source FK/version, department inboxes, request reports and response notifications. Broad domain execution (payment, issuance, IAM changes, procurement fulfillment, external synchronization) remains unfinished and is explicitly listed in the task handoff. Implementation reservations are released for review; runtime ownership is unchanged.

## RESERVATION-TICKET-PDF-0912 — PC-A — LOCAL_COMPLETE

- گزارش مالک محصول: خروجی بلیط در رزرواسیون کار نمی‌کند. Branch `codex/pc-a-reservation-settings-0912`؛ محدودهٔ رزروشده: مدل/رابط خروجی بلیط، Route و Renderer دانلود PDF، تست‌های هدفمند و اسناد همین واحد کار.
- خروجی فقط از snapshot ذخیره‌شده و مجاز همان درخواست ساخته می‌شود؛ هیچ شماره بلیط، PNR، بار مجاز یا وضعیت صدور جعل نمی‌شود. چاپ مرورگر حفظ و دانلود مستقیم PDF یک مسافر/همه مسافران افزوده می‌شود. بدون Migration، IAM grant، دادهٔ واقعی، ارسال خارجی یا public push.
- دانلود واقعی با Chrome ویندوز نیز بررسی شد؛ Renderer تا تکمیل فایل پردازش headless صبر می‌کند. ۱۱ تست هدفمند، lint، typecheck، build تولیدی و بازبینی تصویری PDF یک‌صفحه‌ای A4 موفق‌اند.

## RESERVATION-RECEIPT-SUMMARY-0912 — PC-A — LOCAL_COMPLETE

- درخواست مالک محصول: در پنجرهٔ «دریافت‌ها»ی رزرواسیون مشخص باشد برای قرارداد انتخاب‌شده از طرف پرداخت‌کننده چه مبلغی دریافت شده است.
- Branch `codex/pc-a-reservation-settings-0912`. محدودهٔ رزروشده: نمایش و تست جمع دریافت‌های همان قرارداد در `reservation-receipts` و اسناد وضعیت همین واحد کار. فقط رکوردهای موجود Sales خوانده می‌شوند؛ مبلغ تأییدشده مالی از مبالغ در انتظار/برنامه‌ریزی‌شده جدا است و هیچ دریافت، وضعیت مالی، مجوز، Schema یا Migration ایجاد یا تغییر نمی‌کند.
- اجرای محلی Web3100/API4000 حفظ می‌شود و public push همچنان ممنوع است.
- نتیجه: نام پرداخت‌کنندهٔ قرارداد، مجموع دریافت تأییدشده و مبلغ در انتظار تأیید مالی به تفکیک ارز بالای جدول نمایش داده می‌شود و هر ردیف ستون «از طرف» دارد. نام پرداخت‌کننده از API عمومی Customers خوانده و در نبود دسترسی از snapshot معتبر قرارداد/مسافر استفاده می‌شود. ۱۱ تست هدفمند، lint، typecheck و build تولیدی ۴۱ مسیر موفق؛ Web3100/API4000 پاسخ ۲۰۰. Scope آزاد شد.

## RESERVATION-FORM-SETTINGS-0912 — PC-A — LOCAL_COMPLETE

- درخواست مالک محصول: تنظیمات و سابقهٔ اصلاح فقط زیر دکمهٔ «رزرواسیون» باشد؛ تاریخ اقامت، تعداد و نوع اتاق و ردهٔ سنی مسافران با تقویم مشترک ماه/سال قابل ویرایش باشند. انتخاب صریح تعیین می‌کند تغییر فقط در فرم ارسالی و مبنای خرید ثبت شود یا در خروجی قرارداد و واچر هم اعمال گردد.
- Branch `codex/pc-a-reservation-settings-0912` از نسخهٔ محلی کامل `0ef39f2`. محدودهٔ رزروشده: Travel workflow قرارداد/API، فرم و خروجی رزواسیون/واچر، خلاصهٔ مبنای خرید، overlay عملیاتی خروجی قرارداد، تست‌های هدفمند و اسناد وضعیت. معماری append-only، optimistic version، مجوزها، قیمت‌های تجاری و گیت مالی/بیمه حفظ می‌شوند.
- بدون Migration، Dependency/Lockfile، IAM grant، دادهٔ واقعی، ارسال خارجی، merge یا public push. اجرای فعلی Web3100/API4000 پس از تست و build با همین checkout تازه می‌شود.
- نتیجه: رابط مستقل تنظیمات واچر حذف شد؛ تنظیمات و سابقه فرم رزواسیون، تقویم مشترک، انتخاب دامنه اصلاح و مبنای خرید از نسخه ارسال‌شده پیاده شد. ۱۲ تست API، ۱۲ تست Web، lint/typecheck و build API/Web موفق؛ هر دو سرویس محلی ۲۰۰. رزرو فایل‌ها برای بازبینی آزاد است.

## WORKBENCH-006-HOME-LABEL — PC-B — READY_FOR_REVIEW / LOCAL_RUNTIME_3100

- User requests renaming the personal workspace tab from «امروز من» to «خانه». Reserve only workbench/model.ts and own status entries on codex/pc-b-workbench-home-label. Keep the today tab identifier, routes and all services unchanged. Preserve native runtime and owner B2B KPI changes; coordinate owned Web3100 rebuild. No shared shell/API/schema/dependency change.
- Scoped lint,10model tests and production build/typecheck passed. Source d711222, manifest hr005-2471b6a3c0f957a5, Web3100/PID27380. API4190 health200 unchanged. Restart completed in owner-confirmed pause between agency forms; owner notified to resume. PR165draft; release label reservation. No merge.

## WORKBENCH-005-NATIVE-SHELL — PC-B — READY_FOR_REVIEW / LOCAL_RUNTIME_3100

- User explicitly rejects the standalone demo and requests alignment with Rubi theme and application structure. Reserve native Workbench module/routes, restoration of original/tasks, compatibility redirect from/workbench/demo, additive Workbench sidebar/user entry via lib/navigation.ts, messages/fa.ts, sidebar-icons.ts, user-menu.tsx and their tests. Keep the seventeen business modules separate; use existing shared UI/theme/provider/auth.
- Public consumers only: current identity, recipient-scoped Notifications, personal Documents lists/detail/upload and existing profile. No counterfeit requests/messages/notes/favorites, localStorage or new persistence. No changes to owner service contracts, API, permissions, schema/migration or dependencies. Migration remains with Reservations per active PR153; request storage/messaging/private features cannot be represented as operational without that handoff.
- UI is functional for existing owner services and explicitly unavailable where services do not exist. Preserve runtime base8bf0446 including B2B date filters. Runtime changes coordinated with existing owners; API4190/data/storage remain untouched. No merge.
- Shared shell reservation additionally covers the compact sidebar grid row sizing for the added personal entry. No business module is removed. B2B owner supplied c83d530 (KPI colors), authorized for inclusion in the combined build.
- Native runtime verified at source2d5d5e8, manifest hr005-f74450ea05fc1fa7, Web3100/PID28628. API4190/PID15024 unchanged and health200. Includes owner KPI deltas c63ec00 +8b6cd35. 157 targeted tests, Web lint, follow-up scoped lint, typecheck/build and authenticated browser verification passed. PR164 draft. Release implementation locks; preserve this combined runtime for subsequent owner work.

## WORKBENCH-004-MENU-CURRENT-RUNTIME — PC-B — READY_FOR_REVIEW / LOCAL_RUNTIME_3100

- User reports Workbench menu opens old `/tasks`. Runtime3100 changed to B2B source56d5d48/PID12500 after prior handoff; preserve the new B2B date filters by basing `codex/pc-b-workbench-menu-current-runtime` on56d5d48. Own worktree only; no edits to B2B checkout.
- Reserve Workbench demo files, existing task page and own status/report entries. `/tasks` directly redirects to the demo when RUBI_WORKBENCH_DEMO=1; flag-off keeps the original workspace. All isolated demo protections remain. No shared shell/proxy/API/data/schema/dependency changes.
- B2B owner notified to coordinate3100 before replacement. Build/test candidate first; verify expected source/PID again. API4190 and all B2B/HR code remain unchanged. No merge.

## B2B-DOSSIER-DATE-FILTERS-001 — PC-B — IN_PROGRESS

- Add themed responsive date-range filters beside existing dossier filters. Reserve Organizations date helper/component, agreement/rates/users/signatories/documents/finance/activity panels, CSS and tests/status docs on `codex/pc-b-b2b-dossier-date-filters` from0300a34. Previous locks released. Preserve date meaning, inclusive boundaries, server pagination and organization/branch authorization. No API/schema/dependency change; runtime3196/API4191 retained and unrelated3100 untouched. No merge.

## B2B-NAMED-BRANCHES-001 — PC-B — DONE / LOCAL_RUNTIME_3196

- User explicitly repeats that the four company names must be branches and requests alignment of the contract branch selector. Reserve a local branch-reference provisioning script, agreement header CSS/component, and status docs on `codex/pc-b-b2b-named-branches` from0146c4f. No active IAM implementation lock found; consume public IAM access updates, preserve roles/other users and existing HQ records. Back up before additive reference writes. New branches are distinct from LegalEntity records; no reassignment of existing business rows. No migration/dependency change or merge.
- Created four references and verified existing operator sees all four plus retained HQ. Public IAM update preserves existing roles and other users; repeated preview has zero missing branches. Backup: C:/Users/admin/Rubi-backups/cooperation-branches/before-1789146731135.dump (SHA25686534a4b44ec8d932a98119d613d0d668e724e1981e3c5c8cf8836d77221af42). Script/Web lint, typecheck, 97 Organizations tests and production build pass. Source7ada379, PR157 draft, no merge.
- During build, another workbench demo acquired3100 (PID22408, apps/web/src/modules/workbench/demo/preview.mjs); launcher refused to stop it. Preserve that process. Served owned build hr005-a63a90ce0594f86b on3196 with API4191 CORS verified for3196. Release implementation reservations; runtime coordination needed before restoring3100.

## B2B-FINANCE-DOCUMENTS-EXPORT-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Add document metadata/file entry to finance dossier and Excel export of filtered preview rows. Reserve finance preview, organization document panel, corporate profile and status docs on `codex/pc-b-b2b-finance-documents-export` from417831f. Prior locks released. Use Documents owner storage, not new financial transactions; PC-A Finance accounting remains separate. No schema/API/dependency change. Clarification requested about accounting transactions; proceed with explicitly labelled document intake and preview export. No merge.
- Sourcec37060c: per-tab financial document entry/list through Documents with a visible title prefix; current document-page XLSX and filtered synthetic finance XLSX. No ledger writes. Browser verifies intake form and export controls; Web lint/typecheck/build and 97 Organizations tests pass. Web3100 PID28836/hr005-2b88eb2834942f39 and API4191 healthy. QA3196 stopped; PR154 draft, no merge. Release implementation reservations.

## B2B-CREDIT-SECTION-FORMS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Add section-specific policy, guarantee and dated temporary-credit forms inside existing agreement workflow. Reserve Organizations editor/workflow/navigation/workspace and tests/status docs on `codex/pc-b-b2b-credit-section-forms` fromde48b4a. Prior locks released. Preserve complete revision terms and independent approval; Exposure remains read-only pending Finance adapter. No API/migration/dependency or Finance owner changes. Verify and refresh3100; no merge.
- Source3cf0715 adds agreement selection and focused modal editors, scoped summaries and exact per-currency temporary-increase validation. Other revision fields remain preserved and accessible through expandable contract details. Web lint/typecheck/build and 97 Organizations tests pass; actual React browser confirms guarantee entry and temporary-credit focus. Web3100 PID13748/hr005-56ff1e665ae9fa09 and API4191 healthy. QA3196 stopped, PR152 draft, no merge. Release implementation reservations.

## B2B-CONTRACT-DOCUMENT-FORM-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Replace contract document picker with the expanded metadata/file form, preserving existing attachments and Documents storage. Reserve agreement-terms-editor.tsx, inline-document-upload.tsx and status docs on `codex/pc-b-b2b-contract-document-form` fromc5f66ca. Previous locks released. Guarantee selectors unchanged; no API/data/migration/dependency changes. Verify and refresh owned3100; no merge.
- Source1ed0a1c verified in actual React browser: contract metadata/file fields visible without attachment dropdown. Web lint/typecheck, 95 Organizations tests and production build pass. Web3100 PID8332/hr005-e7a497343c731ef1 and unchanged API4191 healthy. QA3196 stopped; PR151 draft, no merge. Release implementation reservations.

## B2B-UNIFIED-USERS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Remove the circled roles/scopes tabs from access navigation and display their values in the organization-user cards. Reserve corporate-profile.tsx, organization-users-panel.tsx and status docs on `codex/pc-b-b2b-unified-users` from1bb99f7. Prior locks released. Preserve users/history navigation, forms, permissions and all data. No migration/dependency/API changes. Verify Web checks and refresh owned3100 only; no merge.
- Completed source f50d293: actual React browser verifies only users/history tabs and visible per-user role/allowed sections. Web lint/typecheck, 95 Organizations tests and production build pass. Web3100 PID3508/hr005-a1e5ed333149bb40 active; API4191 preserved. Temporary QA3196 stopped. Draft PR150, no merge. Release implementation reservations.

## B2B-ALL-AGENCIES-DEMO-001 — PC-B — DONE / LOCAL_DATA_ACTIVE

- User explicitly requests synthetic dossier data, including contracts, for all existing agencies. Reserve a new local public-service fixture loader and task/status docs on `codex/pc-b-b2b-all-agencies-demo` from289fb8f. Previous implementation locks released. Preserve existing user records, permissions and runtime; no migration/dependency/API or Finance owner changes.
- Discover all existing agency organizations with pagination; add clearly labelled sample records using existing operator grants and owner services after backup. Keep contracts draft and currency limits independent. Verify persistence and repeat-run idempotency. No merge.
- Extended the three existing B2B fixture scripts with explicit opt-in discovery and a shared tested selector; dossier fixtures also add inactive sample signatories and read existing document references through Documents. No existing account grants changed. All seven existing agencies now have samples: 14 new draft agreements, 28 guarantee terms, 28 per-currency policies, six new proof uploads, seven signatories, six addresses, eight contacts, nine rates, two missing profiles and 21 scoped sample users. Existing records preserved; repeated previews produce zero additions. Public activity reads verify all seven dossiers and all three owner audit sources. Runtime unchanged; data is available on3100. See docs/tasks/B2B-ALL-AGENCIES-DEMO-001.md. Release implementation reservations.

## B2B-PROFILE-TABS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests removing the four circled top shortcuts (branches, representatives, signatories, account manager) from the organization profile. Reserve only corporate-profile.tsx and task/status docs on clean `codex/pc-b-b2b-remove-profile-tabs` from ff4060d, preserving PR147 and existing runtime. Previous reservations released; no conflicting owner found.
- Keep the profile/roles tab and all inline section cards/forms; filter only top navigation. No API/data/migration/dependency change. Run existing checks and refresh owned Web3100, preserving API4191. No merge.
- Completed source c7f919e: browser verification, formatting, Web lint/typecheck, 95 Organizations tests and production build pass. Web3100 PID14820/hr005-38075313afdd12a7 and API4191 health verified. Temporary QA3196 stopped. Draft PR148 opened to develop; no merge. Release implementation reservations.

## B2B-DOSSIER-REPORTS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests working Reports/Audit for all agency dossier activity. Reserve B2B activity projection/controller/client/UI/tests, additive contracts/root export, public MasterOrganizationDirectory and Documents owner audit projections, and task/status documentation on `codex/pc-b-b2b-dossier-reports` from df19788. Prior task released its implementation locks; preserve the owned PR146 stack and Web3100/API4191 runtime.
- Read existing persisted owner audit streams through public services; B2B never queries Master Data/Documents tables. This is a B2B dossier projection, not a change to PC-A central reporting or Finance. Preserve organization/branch scope and existing per-source permissions, redact snapshots, support bounded stable pagination/date filtering and matching export. Finance preview remains explicitly synthetic/unconnected. No migration, IAM grants or dependency lock. Additive v1 producer/consumer: B2B/Master Data/Documents to Organizations Web. No merge.
- Documents inspection found permanent deletion erased audit rows. Reserve the owner deletion implementation/tests to retain a minimal DELETED tombstone and append-only metadata history while removing file versions; deleted documents remain inaccessible/unrestorable. Existing schema supports this; no migration. Historical already-erased events cannot be reconstructed.
- Final review extends the Master Data owner slice to preserving organizationId in future contact deletion audits. Historical child events resolve the parent at the event time; moving a contact must not expose later events to its former organization. No schema or contact-value disclosure.
- Completed Web01ff6d1/API63bad33: real Reports/Audit/Excel projection, 613 affected API +95 Web +19 PostgreSQL tests, final owner-transfer checks, lint/typecheck/build and all four source CI gates (34469825061) pass. Live synthetic dossier returns22 events across all three owners. Web3100 PID19116/hr005-e8ec9ec662bd3909 and API4191 PID28340 healthy; QA3196 stopped. Draft PR147, no merge or local business-data mutation. Release implementation reservations; coordinate future runtime changes. Details: docs/tasks/B2B-DOSSIER-REPORTS-001.md.

## B2B-CONTRACT-CREDIT-DEMO-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests nesting credit/guarantees under contracts in the 360 dossier and synthetic guarantee/finance data. Reserve Organizations navigation/components/models/tests, a bounded public-owner-service B2B/Documents fixture loader, and task/status/decision documentation on clean `codex/pc-b-b2b-contract-credit-demo` from49d578e. Preserve PR145 stack and owned Web3100/API4191 runtime. Prior implementation reservations are released.
- Credit becomes a contracts subview while keeping existing credit permission boundaries and approval workflow. No IAM grants or permission identifier migration. Guarantee fixtures persist as DRAFT agreement terms using public B2B/Documents services, additive/idempotent and restricted to existing explicitly synthetic agencies. No automatic approval, activation or real balances.
- Finance Phase B persistence/owner adapter is absent in this checkout (FINANCE-001 is a preview foundation). Provide clearly labelled synthetic finance previews within B2B, separate from operational exposure/available-credit calculations; do not create or query Finance tables, invent confirmed payment events, or modify PC-A Finance producers. No schema/migration/dependency lock required. Back up before fixture writes, preserve user changes, verify actual navigation, fixtures and runtime before handoff. No merge.
- Completed source6ec0cd7: five home cards with nested credit/guarantees, six labelled finance preview tabs and filters/details; four persisted DRAFT agreements with 12 guarantees/eight proofs, idempotent repeat verified. 92 Organizations tests, browser QA, 41-route Web build and all four CI gates (34466246227) pass. Web3100 PID14180/hr005-ee20b418202c6261 healthy; API4191 PID21516 preserved/healthy. Draft PR146 targets develop, no merge. Release task implementation reservations; coordinate future runtime changes. Details: docs/tasks/B2B-CONTRACT-CREDIT-DEMO-001.md.

## B2B-CONTRACT-FORMS-002 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests working contract/dossier dates, additional agreement types, payment method selection from Master Data, inline contract/guarantee document uploads stored in Documents, removal of limit-type UI and separate document-upload section, and closing single-select rate reference options. Clean owned runtime branch `codex/pc-b-b2b-contract-forms` starts from 2bdde76, retaining the PR143 stack and fetched develop4717b13. Prior task releases its locks; existing runtime3100/API4191 belongs to this checkout.
- Reserve B2B Web/API/contracts/tests and task/status/domain docs; reserve a narrowly scoped shared DatePicker modal-container option and MasterDataReferenceSelector close-on-select option, preserving default behavior for other consumers. Reserve public MasterOrganizationDirectory payment reference lookup; consume existing Documents upload/list APIs and policies without direct Documents tables/storage writes.
- Migration Owner = PC-B for additive nullable agreement-revision payment-method FK and reverse relation, preserving legacy payment terms and immutable revisions. Producer B2B/Master Data, consumers agreement forms and read projections; optional v1 reference fields preserve legacy client compatibility. Expanded agreement-type values use existing string storage with validation. No dependency lock or IAM grants. Inline files are linked to the same organization/branch through Documents, keep scan/access requirements, and do not imply contract approval. Default new credit limit remains HARD; hidden existing limit type is preserved. Rehearse and back up migration before local cutover; no merge.
- Implementation and 109 Web / 24 workflow-document / 18 PostgreSQL tests pass, with browser date/selector verification and two real synthetic CLEAN document uploads attached to a DRAFT agreement. Migration applied after restored-database rehearsal and backup, preserving 129 business tables/history. Final Web3100 build and CI remain; keep runtime reservation until handoff.
- Completed source3c6b3cb: 41-route production build, Web3100 PID20400/hr005-f4de59bf61e65404 and API4191 PID21516 healthy. Public-service reload confirms payment and contract/guarantee document references; VALID/EXPIRED filters pass. Draft PR145 targets develop, all four source CI gates pass (34464367220). QA3196 stopped; no merge. Release B2B/migration/shared-file implementation reservations and coordinate future runtime changes. Details: docs/tasks/B2B-CONTRACT-FORMS-002.md.

## B2B-ORGANIZATION-USERS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests users/access forms, synthetic data and per-user section selection; explicitly confirms access is restricted to the same agency's 360 dossier, not the whole Rubi system. Reserve B2B org-user domain/API/portal access enforcement, Organizations UI and new standalone agency portal page, public Master Data reference projection if required, contracts/root export, scoped tests and docs. Clean branch `codex/pc-b-b2b-organization-users` starts from 3a3b9ab and preserves the owned runtime/PR142 stack. Prior implementation locks are released.
- Migration Owner = PC-B for additive B2bOrganizationUser and FK/index/checks; reserve only its schema relations. No dependency lock. IAM remains owner of credentials, login, sessions and global permissions: consume existing exported IamService methods, with no IAM source/table writes outside that public service. New agency accounts have no global roles or branches. Organization membership/section grants are B2B-owned, rechecked on each portal request, with an additional global interceptor denying these accounts access to non-portal authenticated endpoints. Existing staff accounts are not converted to agency accounts.
- Forms manage organization role, active status and viewable dossier sections; grants do not authorize contract/credit approval or administrative writes. Portal projections are scoped to the server-side membership and selected internal cooperation branch. No organization/branch supplied by a portal client is trusted. Preserve permissions, optimistic concurrency, atomic B2B audit and separate Master Data/Finance/Documents ownership.
- Use existing modular monolith/PostgreSQL and synchronous service ports, existing backup/restore and operational targets; no new infrastructure/SLO is introduced. Data is internal identity/contact PII. Synthetic usernames/passwords are isolated from real users, credentials remain outside Git, and loader is idempotent with backup/verification. Rehearse additive migration before local3100/4190 cutover. No merge.
- Completed source d8de690: popup users/access forms, six per-user view sections, scoped portal and 12 synthetic accounts across four agencies. Existing user grants are preserved. Migration rehearsal/application preserved 128 business tables and 48 prior migration entries. 139 B2B/IAM + 90 Organizations + 17 PostgreSQL tests and all four CI gates (34460651768) pass; 41-route build and browser create/edit/disable/history/portal checks pass. Four normal password logins verify own-organization projections, rejected unselected sections/global endpoints/inactive membership and logout. Web3100 PID26256 / hr005-67cffe6403214472 and API4191 PID27972 are healthy. API moved from4190 because Fetch rejects that restricted port; local Web configuration is updated, DB/storage unchanged. PR143 draft, no merge. Release B2B/shared-file/migration implementation reservations; coordinate future runtime changes.

## B2B-DOSSIER-SHORTCUTS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests removal of the circled registration shortcut row on the 360 home page (Screenshot532). Reserve only `corporate-profile.tsx` and task/status documentation. Clean branch `codex/pc-b-b2b-remove-dossier-shortcuts` starts from 82f003c, preserving the owned combined runtime and fetched develop. Prior Organizations reservation is released; no conflicting active owner found.
- Remove the shortcut panel and its now-empty heading. The six section cards and their actual forms remain available. Presentation only: no API, data, permission, migration or dependency change. Run existing Organizations tests, Web lint/typecheck/build and browser verification, then refresh owned Web3100 with API4190 preserved.
- Completed source e1f8d3e: 90 Organizations tests, Web lint/typecheck/format, 40-route build and all four CI gates (34456782273) pass. Actual React browser confirms no shortcut panel, six cards, working profile navigation and empty console errors. Web3100 PID22988 / hr005-32d45f524f9da7a2 is healthy; API4190 PID16408 is preserved and independently health-checked. PR142 is draft, no merge/data change. Release implementation reservation; coordinate subsequent runtime changes.

## B2B-UNIFIED-PROFILE-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests company national ID in the initial form and all agency branches, representatives, signatories and account manager together on the profile/roles page, each with a popup entry form. Clean branch `codex/pc-b-b2b-unified-profile` starts from 5182c27, retaining the owned combined runtime and fetched develop. Reserve Organizations components/models/client/tests, existing Master Data contact form integration and public directory reference method.
- Reserve Migration Owner = PC-B for additive B2bOrganizationSignatory table and its restrictive relations, scoped Prisma schema, B2B module/controller/service/repository/DTO, `packages/contracts/src/b2b-signatories.ts` and root export, DATA_MODEL/DECISIONS/status/task docs. Producer B2B, consumers Organizations Web and tests; additive v1 endpoints under existing B2B agency routes. Existing Master Data contacts identify the person; Documents public service validates/pins proof versions; currency comes from Master Data public references. No IAM grant or automatic signing/approval privilege is created. No dependency/lockfile changes. Previous task released migration lock; no newer conflicting reservation found.
- Preserve contact encryption, actor/branch authorization, versions and atomic audit. Signatory form captures document types, optional Decimal/currency limit, dates and proof; a record without valid proof stays inactive. Rehearse migration against a restored backup before updating the owned 3100/4190 local runtime; no merge or unrelated checkout changes.
- Completed source 08d2107: five cards with popup forms on the profile/roles page, initial company national-ID field and persisted signatory CRUD. 90 Web + 496 API + 16 PostgreSQL + 61 Contracts tests, affected lint/typecheck/build and all four CI gates (34455845286) pass. Actual React checks cover nested representative creation, signatory create/edit/delete, branch creation/selection and manager update. Migration applied alone after restore rehearsal/fresh backup, preserving all 127 prior table digests and 47 historical migrations. Web3100 PID6320 / hr005-885cff5dba39ac2b and API4190 PID16408 are healthy on the existing database/storage. PR141 is draft; no merge. Release implementation/migration locks and coordinate any subsequent runtime replacement.

## B2B-PROFILE-CLARITY-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner clarifies that the requested branch options are the counterparty agency's own branches, and asks where cooperation status, account manager and national ID are determined. Clean branch `codex/pc-b-b2b-profile-clarity` starts from 65042b4, preserving the current combined runtime and fetched develop e07c0c6. Reserve Organizations profile/address presentation, cooperation form/model, scoped tests and documentation.
- Counterparty branches come from the existing public Master Organization addresses service; never use an address ID as an IAM branch scope. Preserve internal Rubi branch authorization separately. Clarify the responsible employee and provide working navigation to the existing independent contract review flow.
- Reserve the Master Data organization identity slice (API allowed fields/validation, form catalog and tests), the additive optional organization national-ID column/migration, and its DATA_MODEL/DECISIONS entries. Migration Owner = PC-B/B2B-PROFILE-CLARITY-001; no other current active migration reservation was found. Producer = Master Data; consumer = Organizations Web through the existing generic values/attributes contract, additive and optional for legacy clients/rows. No dependency/lockfile or IAM changes. Validate and back up/rehearse before applying the additive migration to the owned local runtime.
- Completed source dbd7329: agency-address selector and CRUD, account-manager explanation/review navigation, optional persisted company national ID in forms/dossier/directory. 90 Web + 479 API + 14 PostgreSQL targeted tests, lint/typecheck/schema/API/Database/Web builds and all four CI gates (34450246803) pass. Migration applied after restore rehearsal and fresh cutover backup; all data across 127 business tables and historical migration checksums preserved. Web3100 PID12100 / hr005-b0658359a760157c and API4190 PID19300 are healthy on the same database/storage. Real React browser checks passed; production browser currently needs login. PR140 is draft against develop, no merge. Release implementation and migration locks; coordinate any subsequent runtime replacement with this task.

## B2B-DIRECTORY-ACTIONS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests the Customers registration/Excel action bar shown in Capture.PNG on the Agencies home page. COMPUTER_ID=PC-B; clean `codex/pc-b-b2b-directory-actions` starts from 38203ea, preserving the owned combined runtime and fetched develop e07c0c6. Reserve only Organizations workspace presentation and task/status documentation; prior Organizations implementation locks are released. The Customers component is a read-only visual reference.
- Reuse Rubi Card/Button styling for registration, Excel import, template download and filtered export. Connect to the existing cooperation wizard and validated import/export implementations, preserving permissions and data boundaries. No API/schema/migration/dependency, IAM or business-data change. Run affected checks and browser verification, then refresh the owned Web3100 runtime while preserving API4190.
- Completed source 963978d: 89 Organizations tests, Web lint/typecheck/format/build (40 routes), all four push CI gates and actual React browser checks pass. Template/export workbooks, registration/import dialogs, permission-disabled actions and final styling match the intended flow. LOCAL3100-LATEST-0909 explicitly handed over its temporary runtime; Web3100 PID13656 / hr005-78e8e205babdeb9f and API4190 PID8236 now serve the combined B2B source with existing database/storage. Temporary API4000 was stopped after 4190 health; no other checkout or data was changed. Release implementation reservation; coordinate subsequent runtime changes with this task.

## B2B-DOSSIER-SALES-REMOVAL-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests removal of the Sales Operations section from the 360 dossier. Clean branch `codex/pc-b-b2b-remove-sales-section` starts from 3bb9fe1, continuing the owned combined runtime and retaining fetched develop e07c0c6. Reserve only `corporate-profile.tsx` and this task's documentation; prior Organizations implementation reservations are released.
- Remove the shared agency/corporate dossier card and its local subpage navigation. This is a presentation-only change with no Sales data/API, IAM, schema, migration or dependency change. Validate existing Organizations tests, Web lint/typecheck/build and the actual component, then refresh the owned Web3100 listener while preserving API4190.
- Completed source 4d49975: six dossier sections remain and Sales Operations/subpages are removed. All 89 Organizations tests, Web lint/typecheck, formatting and the 40-route production build pass; all four push CI gates pass. Browser verification with the actual component confirms six cards, remaining section navigation/return and no errors. Web3100 PID3644 serves 4d49975 / hr005-3d2484aaec769e16; API4190 PID14320 remains healthy. No merge or data change; release implementation reservation.

## B2B-DOSSIER-ACCESS-001 — PC-B — DONE / LOCAL_ACCESS_APPLIED

- Owner explicitly requests full access to every agency 360 section after the missing commercial-dossier permission error, continuing the concrete Nirvana-account permission question. COMPUTER_ID=PC-B; clean branch `codex/pc-b-b2b-dossier-access` starts from 1369efa, retaining the active runtime aa964d6 and fetched develop e07c0c6. Reserve only this local access administration and task/status documentation; no IAM implementation, schema, migration, dependency or runtime-listener change.
- Inspect exact public IAM catalog/current role assignments, grant the missing dossier permissions to Nirvana through the existing IAM owner service, preserve all existing roles/branches and other users, and audit the action. Full B2B access may include reviewing another user's proposals; the enforced independent-review rule remains. Verify organization/Documents permissions and the existing branch scope, plus public B2B reads using the resulting permissions. No blanket grant of unrelated module administration.
- Inspection found only the two B2B approval codes in the local permission catalog; the eight read/manage codes were absent. Reconcile only missing B2B entries from the existing canonical PERMISSION_SEED_DATA, following the repository's targeted permission-seed maintenance pattern. This is local reference-data administration, with no full seed, administrator-role expansion, or IAM source edit.
- Completed: added the 8 missing canonical B2B permissions and assigned a dedicated `b2b-dossier-manager` role with all 10 B2B permissions only to Nirvana in existing HQ. Catalog repair, owner-service role creation/access update and audits committed in one serializable transaction. Existing roles/branches and other users were verified unchanged. All 21 related Master Data/Documents permissions already existed; four live synthetic dossier workspace/profile/rate/agreement/address reads succeed using the resulting effective permissions. 36 permission/workflow tests and runtime health checks pass; independent self-approval denial remains. Follow-up preview reports no missing catalog entries. No application source/build/migration or listener change; release this administration reservation. Private before/verified evidence is in `C:/Users/admin/Rubi-backups/b2b-dossier-access`.

## B2B-DOSSIER-FORMS-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests test data and entry forms in the agency 360 dossier. Branch `codex/pc-b-b2b-dossier-forms` starts from clean 7518154, retaining PR132/133 and fetched develop e07c0c6. Reserve Organizations Web, B2B profile/rate CRUD and its contract slice, the public Master Organization address deletion endpoint, scoped tests/docs and a guarded local fixture loader. Published reservations show no competing active work in this scope; coordinator was notified. No migration or dependency change is planned.
- Add popup create/edit/delete for organization addresses and rate/discount/commission records, account-manager/profile registration, visible shortcuts/counts, and use existing representative and versioned contract/credit/guarantee forms. Draft rate rows may be stored against an under-review profile but cannot become active until that profile is active. Keep optimistic versions, branch/role ownership, relevant permissions and audit. Read-only Finance/Sales sections do not fabricate balances or permit B2B writes to another owner.
- Fixtures target only explicitly named existing test agencies, use owner public services, and retain all unrelated data. Re-running must not duplicate or overwrite modified records. Preview, back up and verify before applying locally. No actual IAM account grant or approval bypass. Preserve Web3100/API4190 database/storage configuration and coordinate listener changes.
- Completed source aa964d6: popup address/profile/rate/discount/commission forms, overview counts/shortcuts and guarded fixtures. Four synthetic agencies now contain 8 addresses, 8 contacts, 12 inactive commercial terms and 4 draft agreements with 8 currency policies/4 deposit requirements. Post-apply preview has zero pending changes. 176 API, 14 disposable PostgreSQL, 89 Web and 61 Contracts tests pass; API/Web lint/typecheck/build and all four push CI gates pass. Web3100 PID15740 serves aa964d6 / hr005-96235a5b777bc891; API4190 PID14320 is healthy. Draft PR134 depends on PR132/133; no merge. Browser component CRUD and final styling pass; production session needs login, and adding B2B writer access to Nirvana awaits the owner's answer. All 177 IAM role grants are unchanged. Release implementation reservations; coordinate subsequent runtime changes with this task.

## B2B-BREADCRUMB-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests one working breadcrumb at the top of Organizations and its contract/terms dossier section. Branch `codex/pc-b-b2b-breadcrumb` continues the clean combined runtime source 92e7a81 (PR132); fetched develop e07c0c6 is already included. Reserve Organizations' directory/profile presentation, a small shared page-breadcrumb context and the breadcrumb/provider integration in `components/layout/app-shell.tsx`, plus task documentation. PC-B Uniting confirms no active conflicting shell/breadcrumb/runtime reservation in its coordination; the shared edit is limited to this breadcrumb connection, preserving HR/Marketing trails and other header controls.
- Keep the existing global route breadcrumb as the default; register the active organization/section only while its dossier is mounted. Ancestor actions return to the directory or dossier overview without discarding the directory filters. Remove duplicate local breadcrumb rows. No API, schema, migration, permission, dependency, or operational data changes.
- Verify parent navigation, section changes, unmount cleanup and responsive layout with the actual React components, then run affected Web checks/build and refresh only the verified owned Web3100 listener. API4190 and the existing runtime database/Documents storage remain in place.
- Completed: 137 targeted tests, Web lint/typecheck and 40-route production build pass; all four GitHub gates for source 0aca6c1 also pass. Browser StrictMode verifies the contract trail and both parent actions/cleanup with actual components. Web3100 PID8140 serves source 0aca6c1 / hr005-6f6f8acf19ba25a8, with API4190 PID17316 unchanged and healthy. Only the test harness was used for authenticated-content UI checks; production session needs re-login. No migration/data/permissions change. Release Organizations/shared breadcrumb implementation reservations; coordinate future runtime changes with this task.

## B2B-CONTRACT-CREDIT-001 — PC-B — READY_FOR_REVIEW / LOCAL_RUNTIME_ACTIVE

- Owner asks to complete Screenshot527's contract/credit wizard step. Explicit decisions: one independent reviewer with the appropriate contract/credit permission; proposer cannot approve; separate limits per currency without automatic FX.
- Continue clean 8853c27 on codex/pc-b-b2b-contract-credit in the owned combined runtime worktree. Reserve B2B API/Web, additive B2B contracts and scoped task/status/decision documentation. Extend existing profile/agreement/credit tables and routes; preserve legacy records/API defaults, HR and other module work. No parallel organization or agreement module.
- Proposed shared scope, pending coordinator lock confirmation: additive B2B revision/approval/guarantee schema and migration plus FK reverse relations, role-aware MasterOrganizationDirectory lookup and B2B approval-permission catalog slice. No dependency change or direct query/write to another module's tables. No real IAM grants; Documents and Master Data are consumed through public services.
- Coordinator confirms no remaining lock in its task; latest develop/open PRs and published reservations work show no active conflicting B2B implementation. Reserve Migration Owner = PC-B/B2B-CONTRACT-CREDIT-001 for this B2B migration; B2B contracts, the two approval permission catalog entries and the public Master Data lookup are limited shared reservations. Preserve unrelated unmerged PC-A migrations and never apply them implicitly to this runtime.
- Implement draft/edit/reload, contract conditions and per-currency policy/guarantee fields for both roles, immutable submitted versions, independent approval/rejection, optimistic concurrency, conflict checks and transactional audit. Financial balances remain owner projections. Build/test with disposable data before any coordinated local migration; back up and rehearse first, preserving current runtime data/storage.
- Public Documents version-reference lookup is part of this scope: only DocumentsService/Repository and its focused test are extended; B2B reads pinned reference IDs through the owner service rather than joining Documents tables. The Documents owner's completed Web contrast scope remains byte-identical to merged develop.
- Completed implementation and additive migration after backup, restore rehearsal and explicit Documents runtime handoff. Current Web3100 PID7740 serves a8c986d / hr005-54d77a794617c989 with the correct `/api/v1` base; API4190 PID17316 is healthy. Existing business rows and all 177 IAM role grants are preserved. All four GitHub gates pass on a8c986d. PR132 is ready for review; no merge or actual B2B account grant. Final authenticated browser verification awaits re-login, and writer/reviewer account selection has been requested. Release B2B/shared-code and migration implementation reservations; coordinate any subsequent runtime change with this task.

## B2B-FONT-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner requests the Agencies/Organizations section to use the same font as the rest of Rubi. Continue the clean combined runtime at 2c434c1 on codex/pc-b-b2b-font-alignment; fetch and PC-B module/runtime ownership verified.
- Reserve only corporate-design.css and this task's status/report entries. Remove the reference-specific Tahoma override so the directory, dossier and popup forms inherit the existing global Vazirmatn font. No new font/dependency, shared theme, API, HR or business-data change.
- Validate affected Web checks and production build, then refresh only this task's owned Web3100 listener. Keep API4190 and the existing database/Documents configuration. Verify computed fonts and popup appearance in the real browser before handoff.
- Completed: 87 Organizations tests, Web lint/typecheck, formatting and the 40-route production build passed. Web3100 serves source da1ed41 with the same global Vazirmatn family on the directory, table, dossier and all popup controls; browser font loading and the desktop popup were verified. API4190 PID18812 is unchanged and healthy. No data mutation or migration. Implementation reservation released; shared runtime coordination remains with this task.

## B2B-FORM-RUNTIME-001 — PC-B — DONE / LOCAL_RUNTIME_ACTIVE

- Owner reports that localhost:3100/organizations still opens the generic organization form instead of the requested four-step B2B popup. Read-only diagnosis: active HR-011 checkout at 13b6f49 predates merged B2B PR113 (develop@7d716af).
- Reserve this task's documentation and isolated runtime integration only on codex/pc-b-b2b-form-runtime. Combine published HR-010/011 with current develop, retaining both module implementations unchanged; do not modify the source checkouts or merge the HR PRs into develop.
- HR owner explicitly handed over Web3100/API4190 after confirming no active work. Validate/build before replacing the reverified listeners. Preserve rubi_hr_current_20260908 on 127.0.0.1:55432 and hr007-documents; no schema, migration, seed, credential, permission, dependency or business-data changes.
- Acceptance: the real organizations entry opens the four-step cooperation popup on port 3100 while retaining current HR and the existing application shell. Record runtime identity and checks before releasing this reservation.
- Completed: 196 targeted Web tests, 108 API tests, full lint/typecheck and production builds passed. The authenticated localhost:3100 browser now opens all four cooperation steps; existing organization search, seven-card agency profile, logo dialog and HR navigation work. No business form was submitted. Runtime source is f2981b5, fingerprint hr005-2fbd1e21da23276d; final listener/data configuration is recorded outside Git in Rubi-backups/b2b-form-runtime-final.json. Documentation-only follow-up commits do not change the built source. Implementation reservation released; coordinate later runtime changes with this task to preserve combined HR/B2B.

## TOUR-RUNTIME-0910 — PC-A — VALIDATED / STARTUP_POLICY_BLOCKED

User explicitly requests local activation. Integrated released hotel-rates5b1d287 with tour6ba6661 on codex/pc-a-tour-runtime-0910, preserving both histories and source branches. Reserve combined validation and runtime/task docs only. No new schema/migration/data/grants; existing applied schema must be checked before loopback API/Web switch. Coordinate current API1064 with Reservations owner; Web3100 is stopped. Preserve root environment, private document storage/keys and PDF runtime. No remote push or main/develop changes.

Combined API53 and Web115 tests, Prisma generation, API build and Web41-route production build passed. Read-only check confirms hotel-rate migration already applied. Reservations owner transferred combined runtime ownership and is developing a separate unmerged follow-up. Web startup explicitly rejected by execution tool policy; no alternate launcher attempted. API1064 was not stopped or replaced;3100 remains down. No new migration, data change or public push. Source integration reservation released; activation remains blocked by execution policy, not user authorization.

## TOUR-DETAILS-0910 — PC-A — CODE_READY / ACTIVATION_PENDING

User requests complete tour definition fields, ordered relative itinerary and image in Ticket Management. Isolated branch codex/pc-a-tour-details-0910 from current integrated local base14ec087; preserve active HOTEL-GROUP-RATES-0910 checkout/schema/runtime. Reserve Ticket Catalog tour API/UI/tests, additive optional packages/contracts/src/travel/tours.ts fields and task docs only. Producer/consumer Ticket Catalog API/Web; old Sales consumers remain compatible. Persist decimal strings and descriptive fields in existing TourPackage.definition, no schema/migration/dependency changes. Images use existing public Documents API and access/scan policy, not inline binary or external image fetch. No live data, IAM grants, runtime replacement, public push or merge without coordination.

Delivered definition, pricing, ordered relative itinerary and public Documents image upload/validation.41 API and99 Web/consumer tests passed; scoped lint/typechecks and API/Web builds passed. No live-data or authenticated browser QA claim. Shared schema/runtime remain owned by HOTEL-GROUP-RATES-0910. Scoped source reservation released for review; activation requires coordinated integration with its newer changes. See docs/tasks/TOUR-DETAILS-0910.md.

## DOCUMENTS-008A-BLUE-BUTTON-CASCADE-FIX — PC-B — READY_FOR_APPROVED_MERGE

- پیگیری گزارش مالک محصول در 2026-09-09: پس از Merge PR #130، متن CTAهای آبی ارتباطات اسناد روی اجرای واقعی ۳۱۰۰ همچنان مشکی بود. `COMPUTER_ID=PC-B`.
- بررسی مستقیم Browser نشان داد کلاس `text-white` روی هر لینک وجود دارد، اما قانون global و unlayered برابر `a { color: inherit }` آن را به `rgb(18, 33, 61)` بازنویسی می‌کند. Branch مستقل `codex/pc-b-documents-button-contrast-followup` از `origin/develop@0f75770` است.
- محدوده رزروشده فقط همان دو CTA در `apps/web/src/modules/documents/components/documents-workspace.tsx`، تست قراردادی Documents و ورودی‌های همین Task در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md` است. رنگ باید در CSS cascade واقعی سفید بماند؛ بدون تغییر global anchor، سایر دکمه‌ها، Schema/Migration/API/Contract/Dependency/Data.
- نتیجه: رنگ متن و آیکن با یک override درون‌خطی و محدود به همان دو CTA تثبیت شد. ۵ تست قراردادی Documents، Web lint/typecheck و Production Build با ۴۰ Route موفق‌اند؛ اجرای واقعی `3100` و Browser مقدار محاسبه‌شده سفید `rgb(255, 255, 255)` روی پس‌زمینه آبی `rgb(21, 87, 184)` را برای همه CTAها تأیید کردند. مالک محصول Push و Merge همین اصلاح با `develop` را قبلاً صریحاً تأیید کرده است؛ CI نسخه نهایی شاخه شرط ادغام است.

## HR-011-EXPENSE-MISSION-LINK — PC-B — READY_FOR_REVIEW

- Owner reports the mission-reference selector in independent expense entry is not connected to recorded missions. Branch `codex/pc-b-hr-expense-mission-link` starts from the clean current HR-010 runtime `40c362e` (PR #125), preserving its operation buttons and develop `0261b91`.
- Reserve HR-local form/model and related tests, plus HR service/tests only if needed to persist permitted expense-parent edits. Scope mission references for travel/advances/claims to existing canonical or legacy HR missions and matching company/employee; retain independent expenses, approval restrictions, permission checks, audit and optimistic versions. No shared contract/schema/migration, IAM grant, dependency or other module change.
- PC-B retains the handed-over local runtime at `C:/Users/admin/Rubi-hr115-integration`, Web3100/API4190 with the existing database and document root. Read-only diagnostics only; do not seed or change business data for QA. Build affected services before coordinated local activation, commit/push and open a stacked review PR without merging.
- Result: current/legacy mission choices identify destination/dates and respect company/employee scope; permitted draft expense references now persist on create/edit/clear and link back to their mission. API validation preserves permissions, optimistic versions, approval/final-state guards and audit. All 99 HR Web tests and 80 HR API tests (21 isolated PostgreSQL) passed after resolving initial environment timeouts by rerunning sequentially. Source reservation is released for review; local activation and runtime handoff are recorded with `docs/tasks/HR-011.md` and the PR. No migration or merge.

## HR-PUBLISH-012 — PC-B — IN_PROGRESS / OWNER_APPROVED_MERGE

- The owner explicitly requests push, merge and availability to PC-A on 2026-09-09. Continue the published HR-010/HR-011 stack (PR125/127); reserve only merge conflict reconciliation and this work item's publication/status/handoff documentation. No new feature, contract, dependency, schema/migration or runtime change.
- Integrate current develop with normal merge commits, preserving both histories and unrelated module code. Existing HR task branches remain intact and are pushed without force. Exact-head GitHub quality, test, build and PostgreSQL gates must pass before each merge; verify the final develop run as well.
- PC-B Uniting confirms no concurrent merge and no direct access to PC-A. Verify repository publication and provide a PC-A fetch/integration handoff; do not claim its checkout or running app was updated without device evidence. Active Web3100/API4190, the B2B worktree, its migration reservation, database and document storage remain with the B2B owner.
- Combined integration preserves the exact tested HR source `13b6f49` and current develop's unrelated module trees; only additive publication documentation conflicts required reconciliation. Implementation reservation is released pending the authorized CI-gated PR merges. PC-A handoff is in `docs/tasks/HR-PUBLISH-012.md`.

## HR-010-OPERATION-BUTTONS — PC-B — READY_FOR_REVIEW

- Owner requests HR record operation buttons to match Master Data. Branch `codex/pc-b-hr-operation-buttons` starts from current runtime and `origin/develop@0261b91`; checkout is `C:/Users/admin/Rubi-hr115-integration`.
- Reserve only the shared HR table controls/styles under `apps/web/src/modules/hr/**` and this task's status/report entries. Reuse the existing public UI Button appearance used by Master Data; keep existing permission checks, edit/detail callbacks, soft-delete confirmation, selection and export behavior. Master Data, app shell, API, IAM, database/schema/migrations and dependencies remain unchanged.
- PC-B Uniting confirmed no active checkout/listener work and handed over Web3100 for this additive change after validation. Preserve API4190, `rubi_hr_current_20260908`, `hr007-documents` and all current develop changes; recheck listener ownership before restarting Web. Commit/push and open a review PR; no merge is requested for this work item.
- HR tables now use direct outlined View/Edit/Delete buttons with Master Data's shared Button sizing/icons, 8px spacing and destructive text color. Existing callbacks, detail visibility, soft-delete confirmation and capability gating remain unchanged; buttons are disabled while the table loads. All 97 existing HR/shared-Button tests, full Web lint and typecheck passed. Browser attachment timed out, so interactive visual QA is not asserted; build/runtime results accompany the review handoff in `docs/tasks/HR-010.md` and PR. Implementation reservation is released; coordinate any later listener replacement.

## DOCUMENTS-008-BLUE-BUTTON-CONTRAST — PC-B — READY_FOR_APPROVED_MERGE

- درخواست مالک محصول در 2026-09-09: متن و آیکن دکمه‌های آبی کارت‌های «ارتباط اسناد با بخش‌های سامانه» سفید باشند، نه مشکی. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-button-contrast` از `origin/develop@7d716af`. محدوده رزروشده فقط `apps/web/src/modules/documents/components/documents-workspace.tsx`، تست قراردادی همان ماژول و ورودی‌های همین Task در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md` است.
- اصلاح صرفاً Presentation و محدود به CTAهای آبی ارتباطات اسناد است؛ رنگ پس‌زمینه، رفتار لینک‌ها و دکمه‌های سایر ماژول‌ها تغییر نمی‌کند. بدون Schema/Migration/Seed، API/Contract، IAM، Dependency/Lockfile، داده یا Runtime.
- نتیجه: متن و آیکن هر دو CTA آبی در کارت‌های نمای کلی و نمای فیلترشده با `text-white` و `hover:text-white` تثبیت شدند. کنتراست سفید روی آبی اصلی `6.80:1` و مطابق WCAG AA است؛ ۵ تست قراردادی Documents، Web lint/typecheck و Production Build با ۴۰ Route موفق‌اند. مالک محصول در 2026-09-09 Push و Merge با `develop` را صریحاً تأیید کرد؛ جایگزینی Runtime جزو این Merge نیست.

## B2B-AGENCIES-001 / approved PR113 integration — PC-B — READY_FOR_APPROVED_MERGE

- Owner explicitly authorizes merge and push. Continue clean published 122945b on the existing task branch; fetch origin/develop@0261b91 and integrate it with a normal merge, preserving both histories.
- Reserve conflict reconciliation only in B2B API, Organizations Web and this task's status/decision/report entries. The B2B/Organizations code in develop is byte-identical to the previously copied source fc573ac; retain this branch's later validated changes and all unrelated develop changes.
- No new domain feature, dependency, schema/migration, IAM grant, operational database or runtime change. Final combined tests, builds and GitHub checks gate the explicitly authorized PR merge; no force push or branch deletion.
- Resolved the copied-baseline conflicts without changing this branch's B2B/Organizations source behavior; all unrelated develop code and both documentation histories are preserved. Combined validation: 97 targeted Web tests, 54 B2B tests (including five disposable PostgreSQL cases), full monorepo lint/typecheck and production build passed (40 Web routes). Exact-head GitHub gates are required before merge. The implementation reservation is released; runtime ownership is not transferred.

## B2B-AGENCIES-001 / organization logo — PC-B — READY_FOR_REVIEW

- Owner requests an appropriate logo-upload location for agencies and corporate customers. Continue clean a53b294 after fetch. Reserve organization Web components/model/tests and scoped status entries only; use the existing Master Data logo workflow and public Documents metadata/preview APIs.
- Add the logo and an explicit upload/change action beside the profile name, with a small preview/save dialog. Preserve owner scan/access checks and organization identity/version/roles. No producer, schema, dependency, permission grant or independent runtime change.
- Delivered PNG/JPEG selection (5 MB), preview, replace/remove and canonical archive link in the shared profile header. Existing owner partial-save warnings stay visible; cancelled/denied/unscanned previews do not expose file bytes. Targeted tests, lint, typecheck and build passed; browser validation uses only synthetic in-memory owner responses. This reservation is released for review; the independent 3100 runtime is not replaced.

## B2B-AGENCIES-001 / agency 360 entry — PC-B — READY_FOR_REVIEW

- Owner requests the Screenshot (524) seven-card 360 view when opening an agency record. Continue the clean published branch at d41d0ee; fetch completed. Reserve the shared organization profile component and this task's status entries only.
- The directory already routes agency and corporate records to the same profile. Make the agency heading explicit and bring the profile start into view on entry/section navigation. Preserve the seven reference cards and existing public-service connections. No schema, API, dependency or other checkout/runtime edit.
- Verified the real shared component renders all seven sections for AGENCY, CORPORATE_CUSTOMER and dual-role records. All 62 existing organization tests, scoped lint, typecheck and final production build passed. Entry/section navigation scrolls to the page start, preserving the sticky header. This UI reservation is released for review; no new runtime handoff is claimed.

## B2B-AGENCIES-001 / PRD coverage follow-up — PC-B — READY_FOR_REVIEW

- Owner requests implementation against the supplied B2B PRD and selects separate credit limits per currency, without automatic FX. Continue the clean published `codex/pc-b-agencies-organizations` branch/PR #113; original checkout and independent 3100/4190 runtime remain untouched.
- Reserve organization Web/model/tests, B2B API/tests, scoped task reports and only this task's entries in WORK_ASSIGNMENTS, PROJECT_STATUS and DECISIONS. Latest fetched develop@0261b91 and published PR states were checked: Sales PR90 is merged; Reservations PR112 remains open and claims no shared lock. Historical central-lock ownership is not treated as permanent; no other task entry is rewritten.
- Consume the public Documents Service/client for organization files and draft attachments. No Documents implementation, Master Data, IAM, HR, shared API contract, schema/migration/seed or dependency/lockfile changes. Full PRD acceptance still requires the documented business decisions, persistent B2B workflows and owner projections; unavailable states are not completion.
- Scope, evidence and remaining acceptance criteria: `docs/tasks/B2B-AGENCIES-001-PRD-COVERAGE.md`. No migration lock or runtime handoff is claimed by this slice.
- Validation: 62 organization Web tests, 49 B2B API tests and 5 isolated PostgreSQL tests passed; affected lint/typechecks and production builds passed. New browser visual QA was unavailable due webview attachment timeout. This slice's implementation reservations are released for review; full PRD acceptance and runtime integration remain incomplete.

## CI-002-MULTI-COMPUTER — PC-B — READY_FOR_REVIEW

- User reports four computers and authorizes checking/fixing CI, normal push and merge. Base origin/develop@679e516; independent branch/worktree codex/pc-b-ci-multi-computer. CI-001 released its workflow reservation; current module owners and other PRs remain untouched.
- Reserve only .github/workflows/ci.yml, .github/tests/ci-policy.test.mjs, contributor-ID wording in AGENTS.md and docs/DEVELOPMENT_WORKFLOW.md, docs/tasks/CI-002-MULTI-COMPUTER.md and this task's central status entries. Cover A/B/C/D and future computer branch prefixes without multiplying jobs or weakening gates. No broad Central Docs lock or module ownership transfer.
- No Migration, Dependency/Lockfile, shared contract, IAM, database, port or runtime lock. Existing 3100/4190 deployment remains unchanged. Final PR CI and post-merge develop CI gate completion.
- Five policy regression tests and Node syntax checks passed locally. Implementation scope is released for review; final CI gates the authorized merge. PC-C/PC-D setup or collaborator access is not asserted without inspecting those computers/accounts.

## HEADER-TODAY-001 / PR115 integration — PC-B — READY_FOR_REVIEW

- Owner explicitly approved merging both the date change and PR #115, and receiving latest develop. Integration worktree codex/pc-b-hr115-integration starts from published PR115@628012a and incorporates develop@130606d without modifying source worktrees.
- Temporary integration-only ownership: conflicting status/plans, IAM permission catalog union and Prisma model union. Preserve HR, Sales, Ticket/Reservations, current company/profile/notifications and both histories; no new domain feature, dependency, migration file or IAM grant.
- HR owner handed over runtime3100/4190. Keep rubi_hr_current_20260908 and hr007-documents as active data/storage; no reset, seed or password changes. Rehearse existing pending migrations on a restored private backup before live cutover. Historical checksum differences remain unchanged and documented.
- Combined production build, full lint/typecheck, 61 Contract tests, 150 targeted Web tests and 1001 API tests passed (107 opt-in API tests skipped). Restored-data rehearsal applied all ten pending existing migrations: 45 applied, preserving 6 employees, 144 HR records, 2 customers, 18 documents and 4 companies. Date PR #118 merged as e12c397; PR #115 receives that date before final CI/merge. Integration implementation reservation is released; operational runtime handoff remains with PC-B until cutover verification.

## LOCAL-HR-AGENCIES-009 — PC-B — READY_FOR_REVIEW

- Owner explicitly requests the current Agencies section alongside HR on the same local port 3100. Branch `codex/pc-b-hr-agencies-local` starts from HR-008 `838c1eb`; source agency implementation is the clean, published `codex/pc-b-agencies-organizations@fc573ac` (PR #113), based on the same develop `30d67ec`.
- Reserve only the already implemented delta under `apps/api/src/b2b/**`, `apps/web/src/modules/organizations/**`, its task report and this local integration handoff. No new feature design, schema/migration, shared contract, IAM grant, dependency/lockfile or other module change. Preserve HR-008, current app shell and the existing independent HR database/document snapshot.
- Apply the source module delta in this checkout, validate both sections, rebuild the owned web3100/API4190 listeners, and push a review branch without merging main/develop. The source agency worktree and its preview remain untouched. Existing B2B approval gates/unavailable producer projections must be retained.
- Imported source modules are unchanged from the published agency branch. Fourteen Web and 28 API tests (including four PostgreSQL cases), full lint/typecheck and API build passed. Local startup and production handoff checks are documented in `docs/tasks/LOCAL-HR-AGENCIES-009.md`; browser/runtime evidence stays outside Git. No migration or merge.

## HR-008-CONNECTED-FORMS — PC-B — READY_FOR_REVIEW

- Owner request: simplify HR forms and populated tables, remove duplicate employee/company inputs, use stored reference data in dropdowns, enable selected-row exports and expense-document upload. Preserve current sections, workflow permissions and the active 3100 runtime's database.
- Branch `codex/pc-b-hr-connected-forms` from HR-007 `54c5ed7`; reserve `apps/web/src/modules/hr/**`, `apps/api/src/hr/**` and the HR-only resource registry/columns slice in `packages/contracts/src/hr/**` if needed for compatible field metadata. Producer/consumer remain HR API/Web; retain stored column positions and current transport contracts for existing records/imports. No shared IAM, Documents, App Shell, dependency, schema or migration changes are planned.
- Runtime remains the HR-007 checkout on web3100/API4190 with database `rubi_hr_current_20260908`; validate before rebuilding the owned listeners. Commit/push this branch and open a review PR without merging main/develop.
- Result: stored-reference dropdowns and applicant/opening FK, deduplicated forms, selectable chart placement, selected-row XLSX/PDF, real expense receipt archiving and simplified tables/detail header. Retired fields retain stored positions for compatibility; no migration or shared IAM/Documents change. Web/API lint/typecheck/build, 94 HR Web tests, 79 HR API tests (20 PostgreSQL), 22 Contract tests and production browser checks passed. Details: `docs/tasks/HR-008.md`.
- Implementation reservations are released for review. Operational ownership of web3100/API4190 and its independent data snapshot remains PC-B/HR-008; do not replace its listener with an older checkout. No merge performed.

## HR-007-LOCAL-CURRENT — PC-B — READY_FOR_REVIEW

- Owner request 2026-09-08: run the current HR experience on port 3100 while retaining the current Rubi application. Branch `codex/pc-b-hr3100-current` starts at `origin/develop@30d67ec`; port 3100 was handed over by Task «PC-B Uniting» after confirming no active work on its listener.
- Scope: carry the already reviewed HR-005/HR-006 implementation from `b9b525d` into this isolated checkout, adapting only additive HR registration, HR permission exports/seed, Prisma HR relations and the local launcher. Preserve current IAM/MFA, Documents, four-company header, Profile, Notifications, Master Data and other modules. No merge to main/develop and no edits to other checkouts.
- Reserve `HR shared-contract/root export`, `IAM HR permission slice`, `AppModule HR registration`, HR proxy/runtime paths and the existing additive HR schema/migrations for this work item. The owner previously transferred the completed PC-A migration lock for HR; no new or destructive migration is planned. Dependency/lockfile and other module contracts remain unchanged.
- Runtime/data: prepare and validate separately before replacing only the handed-over web listener. Preserve API4000, its integrated database copy and the original HR database; prepare a separate database copy if schema reconciliation is needed. Record the exact runtime/commit and complete authentication, HR and current-shell smoke checks before handoff.
- Acceptance: port 3100 serves the current HR UI/API, legacy HR URL redirects correctly, four companies/profile/notifications and document step-up remain available, and no business data is reset or silently downgraded.
- Compatibility reservation: `Central UI Owner = PC-B/HR-007-LOCAL-CURRENT` only for the existing notification-center/change-notifications integration. Consume the public HR notification client in the common bell and remove the legacy HR listener to avoid two popups; all current non-HR feeds/actions stay intact.
- Local runtime reserves `apps/web/src/lib/environment.ts` and its focused tests to keep local API/web hostnames aligned (`localhost` or `127.0.0.1`) and prevent host-scoped login cookies from causing another login loop. Remote API addresses retain their existing behavior.
- Browser compatibility found a 14px overflow in the current shared header at 390px; reserve only the header container layout class in `app-shell.tsx` to arrange the existing controls into two mobile rows. Current desktop layout, company branding, user menu and actions remain present.
- Result: the current HR production build is active on `localhost:3100`, with API4190 and the isolated `rubi_hr_current_20260908` database/document snapshot. Real browser login, all four companies, Profile/MFA, one notification bell, the legacy HR redirect, six employees and reload passed on both `localhost:3100` and `127.0.0.1:3100`. Lint/typecheck/build and targeted Web/API/Contracts/PostgreSQL checks passed; details and restart command are in `docs/tasks/HR-007.md`.
- Implementation reservations are released for review. Operational ownership of web3100/API4190 remains PC-B/HR-007 until an explicit runtime handoff; preserve its database/document snapshot when replacing the listener. No merge to main/develop was performed.

## HEADER-TODAY-001 — PC-B — DONE / MERGED

- Owner requests today's date in the header, normal push/merge and fetching current changes; separately approves merging PR #115. Date slice starts at origin/develop@130606d on codex/pc-b-header-today.
- Reserve only app-shell Header date insertion, header-today component/helper/tests and this task's documentation. Existing navigation, company colors, IAM identity and notifications remain unchanged. HR owner released Header scope and handed off runtime3100/4190; preserve its current HR/Agencies data and Documents storage.
- No schema, migration, seed, dependencies, grants or credential changes in the date slice. PR #115 integration is validated separately; no source branches are deleted or force-pushed.
- Date implementation complete: 12 focused date/session/company tests, Web lint and production build passed. Header-only implementation reservation released for review; final CI and runtime verification gate merge/handoff.
- Desktop authenticated RTL app, responsive to320px; Persian calendar and numerals, Asia/Tehran. Targets (not measured claims): LCP p75<=2500ms, INP<=200ms, CLS<=0.1, route JS<=200KB gzip, incremental date code<=3KB gzip, Lighthouse accessibility>=95/performance>=90. PC-B verifies this slice; reuse existing theme and WCAG AA contrast.

## CONTRACT-OUTPUT-SUMMARY-0908 — PC-A — COMPLETE_LOCAL

User marked confirmed-paid and outstanding cards for removal from the contract PDF. Branch codex/pc-a-contract-output-summary-0908 from36ebb12. Reserve only Sales contract-print template/test and task status entries. Retain agreed total, passenger prices, notices, QR, all application balances and Excel output. No API, database, dependency or permission changes; preserve integrated local runtime. Local-only publication gate unchanged.

Delivered: customer print/PDF now shows only the agreed-total summary card. 199 Sales Web tests, scoped lint, Web typecheck and production build (36 routes) passed. Actual synthetic PDF rendered and visually checked: one page with all remaining sections intact. Web3100 PID14136 and unchanged API4000 respond200; no authenticated real-contract QA claimed. Existing downloaded PDFs require regeneration. Task reservations released; no migration, data changes or remote push.

## SALES-EXCEL-0908 — PC-A — COMPLETE_LOCAL

User requested a clean Excel export beside the Sales contract list. Branch codex/pc-a-sales-excel-0908 from local runtime ac063f5; preserve all integrated tours and Sales features. Reserve Sales API/controller/repository/export renderer/tests, Sales Web client/workspace/tests and this task's docs only. Additive authenticated XLSX download uses existing list permissions, owner/branch/payment-search scope and applied filters; ignores pagination, bounded export with explicit refusal rather than truncation. No schema, migration, grants, dependency/lockfile or other module edits. No public push until the existing destination gate is resolved.

Delivered with existing sales.export permission and per-contract audit; 67 Sales API and 198 Sales Web tests, scoped lint/typechecks and API/Web production builds passed. Independent XLSX readers verified numbers/dates/RTL and synthetic preview inspected. Active Web3100/API4000, health and updated bundle 200; unauthenticated export 401. No business data/keys/migrations changed. This task's reservations released. Details: docs/tasks/SALES-EXCEL-0908.md.

## TOUR-PACKAGES-0908 — PC-A — COMPLETE_LOCAL

Explicit user request: persistent tour packages and dated departures in Ticket Management, repeat next week with editable flight times, and a single ticket inventory shared with standalone sales. Branch codex/pc-a-tour-packages-0908 from verified runtime 8b15b4d. Ticket owner explicitly released ticket-catalog/shared-contract/migration scope on 2026-09-08. Prior pricing migration reservation is released.

Reserve Ticket Catalog Web/API/tests, additive travel public contracts/root export, TourPackage/TourDeparture schema and migration, scoped Sales consumer and task documentation. No dependency, permission grant, producer worktree changes or public publication. Current runtime remains active until verified cutover. No tour-specific capacity ledger: existing TicketOfferCapacityAllocation is authoritative. New dated departures never mutate existing tickets/contracts. Operational migration requires private backup and isolated rehearsal; historical migration checksums remain untouched.

Additive producer boundary scope: MasterTravelDirectory and its module export only, validating public active city/hotel/insurance references for tours. Existing MasterDataService/repository/controllers/forms remain unchanged; no cross-module direct query. Ticket Catalog provides public immutable departure selection validation to Sales. Expanded services keep the existing pricing model; the tour label adds no second charge.

Delivered in fd325c7, 7844907 and 3949878. Tour definitions, dated departures, hotel/insurance selectors, included transfers/visa, repeat-week prefill with editable flight times, real offer publication and Sales selection are active locally. Shared stock/concurrent reservation, idempotency/replay, branch and reference tests passed. Forty-three migrations applied to an empty isolated DB and restored backup; seed twice passed only on isolated DB. Fresh private backup preceded the one additive migration on rubi; existing business counts and historical checksums unchanged. Web3100/API4000 serve the new build. This task's reservations released; no producer branch, grants, operational seed or public push. Details and exact QA limits are in the task document.

## SIDEBAR-LABELS-DOTS-0908 — PC-A — COMPLETE_LOCAL

User requests colored group dots and rename Sales to قرارداد and Tasks to میز کار. Reserve navigation metadata/messages/spec, group-dot class in app-shell and scoped docs. Current integrated branch from2e48ceb; no route/content/API/data/permission/collapse changes. Local-only, preserve PDF env and restart only Web after build.

## SIDEBAR-GROUP-TOGGLE-0908 — PC-A — COMPLETE_LOCAL

Explicit user follow-up: group headings toggle their own links like3200, whole-sidebar collapse unchanged. Branch from integrated f4b033b; Sales owner handed off runtime/build, no further concurrent writes. Reserve app-shell Navigation only and this task's docs. Preserve integrated Sales/Customers/Notifications, API4000, database, PDF config and all original routes. Build then restart only Web3100 from this integration checkout; no old checkout activation. No push due existing destination gate.

## SIDEBAR-REFERENCE-SIZE-0908 — PC-A — COMPLETE_LOCAL

- Follow-up to 93a4c0d: owner requests reference3200 row sizing/icons and only slightly larger group headings. Reserve app-shell Navigation classes, new sidebar-icons.ts and this task's docs. Sales integration owner confirmed separate checkout and no edits to these files; no restart, HMR only. Keep original collapse, widths, mobile behavior and all business pages. Local-only; prior remote gate remains unresolved.

- Delivered sidebar-only reference icon mapping (17px, stroke1.7), 12px semibold row labels with 40px minimum height, 3px row gaps, and 14px group headings. Original sidebar widths, collapse, drawer and non-sidebar icons preserved. Typecheck, scoped lint, 11 navigation tests and authenticated browser menu QA passed. No server restart; production build result recorded in status. No push/merge or data changes.

## GROUPED-SIDEBAR-0908 — PC-A — COMPLETE_LOCAL

- Explicit owner approval to apply the reviewed team grouping to the actual Web3100 sidebar, preserving prior collapse/drawer behavior, styling, routes and all module content; slightly larger navigation labels. COMPUTER_ID=PC-A. Branch codex/pc-a-grouped-sidebar-0908 from active Web3100 f2cc52a; clean checkout before starting. No prototype pricing or sample pages are transferred.
- Reserve app-shell.tsx Navigation rendering and scrolling wrapper, additive navigation group metadata and focused navigation tests, plus this task's status/docs entries. Earlier integrated breadcrumb, branding and notification changes stay unchanged. No globals, API, database, schema, dependency, permission or business-data edits. Prototype3200 remains separate. Authorizes updating the local running application, not an unrelated bulk merge.

- Completed: 7 visual groups, original 17 links/names/icons, 15px expanded labels and 13px group headings; expanded navigation scrolls with footer/collapse reachable. Original compact/tooltips and mobile DrawerClose preserved. 11 navigation tests, scoped lint, Web typecheck and 34-route build passed; real Web3100 browser QA passed. No data or migration. Local commit only: remote push requires destination verification. Scope released; Sales integration is a separate task.

## LEGAL-ENTITY-HEADER-003 — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-09-08: چهار شرکت نیایش سیر سحر، جهان باستان، قسطی رو و جهان آکادمیا در انتخاب‌گر و رنگ مستقل Header؛ هر دو PC-A و PC-B برای اجرا و توسعه مجازند. منظور حساب IAM جدید نیست.
- Branch: `codex/pc-b-company-header-colors` از `origin/develop@8c24ad9`. محدوده فقط CSS هدر در `apps/web/src/app/globals.css`، تست برند، آماده‌سازی محلی مستقل شرکت‌ها در `apps/api/scripts/local-legal-entities*` و اسناد همین Task است.
- رزرو موقت `Central UI Owner = PC-B/LEGAL-ENTITY-HEADER-003` فقط برای CSS یادشده؛ `app-shell.tsx` و تغییرهای HR/Profile در PR #99 و Branchهای سایر Taskها تغییر نمی‌کنند.
- PC-A و PC-B هر دو مجاز به مصرف قرارداد عمومی و توسعه این قابلیت روی Branch مستقل‌اند؛ ویرایش هم‌زمان یک فایل همچنان به رزرو Task نیاز دارد. قفل دائمی یا انحصار ماژولی به یکی از کامپیوترها داده نمی‌شود.
- Schema/Migration، Seed مشترک زیر مالکیت فروش، Dependency/Lockfile و IAM grants تغییر نمی‌کنند. آماده‌سازی محلی فقط شرکت مفقود را در تراکنش ایجاد می‌کند و رکورد موجود را بازنویسی نمی‌کند؛ پیش‌فرض read-only و Apply پس از Backup است.
- نتیجه: چهار رنگ مستقل، ۹ تست Web و ۴ تست ابزار محلی، lint/typecheck و Build API/Web موفق‌اند. Apply روی کپی مستقل PostgreSQL بار اول دو شرکت و بار دوم صفر شرکت ساخت؛ هر چهار شرکت فعال‌اند. Preview روی `127.0.0.1:3101/4001` است و اجرای قدیمی HR روی 3100/4000 تغییر نمی‌کند. `Central UI Owner = RELEASED — LEGAL-ENTITY-HEADER-003 ready for review`؛ جزئیات در `docs/tasks/LEGAL-ENTITY-HEADER-003.md`.

## MASTER-006-PAYMENT-LEFT-ACTIONS — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک محصول در 2026-09-08: فیلد «کانال» فقط از فرم افزودن روش پرداخت حذف شود و گروه‌های دکمه در همه بخش‌های اطلاعات پایه در سمت چپ فیزیکی صفحه قرار بگیرند. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-master-data-left-actions`، بازپایه‌شده روی `origin/develop@1cb96ae`؛ محدوده رزروشده فقط `apps/web/src/modules/master-data/**`، تست‌های هدفمند همان ماژول و همین Work Item است.
- سازگاری: رکوردها و قرارداد موجود روش پرداخت تغییر نمی‌کنند؛ مقدار کانال در مشاهده/ویرایش رکوردهای قبلی حفظ می‌شود و در ایجاد از رفتار سازگار فعلی Backend استفاده خواهد شد. هیچ Schema/Migration/Seed، API/Shared Contract، Dependency/Lockfile، داده محلی یا فایل درگیر PR #105 تغییر نمی‌کند.
- معیار پذیرش: ورودی «کانال» در حالت ایجاد روش پرداخت دیده یا Focus نشود؛ تمام Action groupهای صفحه، فیلتر، فرم و جدول اطلاعات پایه در Desktop و Mobile به سمت چپ فیزیکی هم‌تراز شوند؛ ترتیب تب، نام دسترس‌پذیر و Focus ring دکمه‌ها حفظ شود.
- بودجه غیررگرسیونی Web داخلی: `LCP p75 <= 2500ms`، `INP p75 <= 200ms`، `CLS <= 0.1`، JavaScript اولیه `<= 200KB gzip` و سهم Route `<= 80KB gzip`، Lighthouse Performance `>= 85` و Accessibility `>= 90`. این Slice Dependency یا بارگذاری Route جدید اضافه نمی‌کند.
- نتیجه: فیلد «کانال» در ایجاد روش پرداخت دیده یا Focus نمی‌شود و مقدار سازگار `OTHER` فقط در State داخلی ایجاد نگه داشته می‌شود؛ مشاهده/ویرایش کانال رکوردهای قبلی بدون تغییر است. گروه‌های عملیات در Workspaceهای مالی، جغرافیا، اقامت، سازمان‌ها و تأمین‌کنندگان، مراجع فروش، حمل‌ونقل، بیمه و خدمات سفر در سمت چپ فیزیکی هم‌تراز شدند.
- اعتبارسنجی: Contracts build، تمام ۳۳۸ تست Master Data در ۴۲ فایل، Web lint، Web typecheck، Production Build با ۳۶ Route و `git diff --check` موفق‌اند. Dependency/Route جدیدی اضافه نشده است.
- Lock state: `Master Data Web = RELEASED — MASTER-006-PAYMENT-LEFT-ACTIONS ready for review`. Migration، Shared Contract، API، Central UI و Dependency/Lockfile برابر `RELEASED / UNASSIGNED` می‌مانند.

## MARKETING-001G-REMOVE-HUB-INTRO — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک محصول در 2026-09-08: بلوک نمایشی «بخش‌های مارکتینگ / برای ورود به هر بخش، کارت مربوط را انتخاب کنید.» از Hub مارکتینگ حذف شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-marketing-remove-section-intro` از آخرین Snapshot محلی `origin/develop@54e5102`؛ `git fetch --prune origin` دو بار اجرا شد اما GitHub موقتاً روی پورت ۴۴۳ در دسترس نبود.
- محدوده فقط `apps/web/src/modules/marketing/components/marketing-workspace.tsx`، تست قرارداد همان ماژول و ورودی‌های همین Work Item در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md` است. هیچ Schema/Migration/Seed، API/Contract، Dependency/Lockfile، داده یا فایل مرکزی UI تغییر نمی‌کند.
- نتیجه: عنوان «بخش‌های مارکتینگ» و توضیح «برای ورود به هر بخش، کارت مربوط را انتخاب کنید.» همراه Wrapper فاصله‌ساز حذف شدند؛ Grid کارت‌ها بدون فاصله اضافه از ابتدای Hub نمایش داده می‌شود و Section با نام دسترس‌پذیر غیرنمایشی باقی مانده است.
- اعتبارسنجی: ۱۸ تست هدفمند مارکتینگ، Contracts build، Web typecheck و lint و Production Build با ۳۴ Route موفق‌اند. نسخه همین Branch جای اجرای قدیمی `Rubi-hr-foundation` روی پورت ۳۱۰۰ فعال شد.

## LEGAL-ENTITY-BRAND-HEADER-002 — PC-B — DONE/MERGED

- درخواست صریح مالک محصول در 2026-09-07: با انتخاب شرکت فعال «جهان باستان»، هدر اصلی سامانه سورمه‌ای شود و نام کاربر همراه ساعت ورود در همان هدر نمایش داده شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-jahan-bastan-header-identity` از `origin/develop@8c445ccb21bdef441b051aa34fb93e5c94379fcf`؛ محدوده فقط `apps/web/src/modules/legal-entities/components/legal-entity-context.tsx`، `apps/web/src/app/login/login-form.tsx`، `apps/web/src/lib/header-session.ts`، `apps/web/src/app/globals.css`، تست‌های هدفمند Web و اسناد همین Work Item است.
- `Central UI Owner = PC-B/LEGAL-ENTITY-BRAND-HEADER-002` فقط برای `apps/web/src/app/globals.css`. فایل `apps/web/src/components/layout/app-shell.tsx` به‌علت مالکیت فعال PR #99 تغییر نمی‌کند و تغییر Breadcrumb منابع انسانی دست‌نخورده می‌ماند.
- نام نمایشی کاربر فقط از پاسخ احرازشده عمومی IAM در Login/Refresh گرفته می‌شود و همراه زمان ورود در Session Storage همان Tab ثبت می‌شود؛ شناسه کاربر، نام کاربری، Password، Token، Cookie یا PII اضافی ذخیره یا نمایش داده نمی‌شود.
- هیچ Backend، API/Shared Contract، Schema/Migration/Seed، Dependency/Lockfile، Navigation مرکزی، داده کاربر یا Branch دیگری تغییر نمی‌کند. معیار پذیرش شامل تغییر فوری تم هدر هنگام Switch شرکت، خوانایی کنترل‌ها، نمایش نام/ساعت ورود، RTL/Responsive، تست هدفمند، lint، typecheck و Production Build Web است.
- پیاده‌سازی تکمیل شد: Header با Context `JAHAN_BASTAN` سورمه‌ای می‌شود، نام نمایشی کاربر و ساعت ورود همان Tab را نشان می‌دهد و Login موفق Cache نمایشی را مقداردهی می‌کند. ۱۳ تست هدفمند، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند؛ Preview ایزوله روی پورت ۳۱۰۱ بدون توقف سرویس‌های فعال ۳۱۰۰/۴۰۰۰ بالا آمد و تا صفحه Login سالم پاسخ داد.
- `Central UI Owner = RELEASED — PC-B/LEGAL-ENTITY-BRAND-HEADER-002 ready for review`. هیچ قفل Migration، Contract، Dependency/Lockfile، Database، Permission یا Branch دیگری گرفته نشد.
- Follow-up صریح مالک در 2026-09-07: «جهان آکادمیا» و «قسطی رو» به انتخاب‌گر شرکت فعال افزوده شوند. کدهای canonical برابر `JAHAN_ACADEMIA` و `GHESATI_RO` هستند و Context تجمیعی از «هر دو شرکت» به «همه شرکت‌ها» اصلاح می‌شود.
- محدوده Follow-up: قرارداد عمومی نسخه‌دار Legal Entities، اعتبارسنجی Switch در API، مدل/تست انتخاب‌گر Web، Asset خنثی برای شرکت‌های بدون لوگوی تحویلی، مستندات همین Task و Upsert اتمیک دو رکورد در دیتابیس محلی PC-B پس از Backup. `Legal Entities shared-contract Owner = PC-B/LEGAL-ENTITY-BRAND-HEADER-002` تا پایان Review.
- `packages/database/prisma/seed.ts` به‌علت تغییر فعال PR #90 نزد PC-A دست‌نخورده می‌ماند؛ هیچ Schema/Migration، Dependency/Lockfile، App Shell، داده کاربر یا Branch دیگری تغییر نمی‌کند. Seed مشترک پس از پایان مالکیت PR #90 یک Handoff مستقل می‌خواهد و این Task قفل Migration یا Seed آن را بازپس نمی‌گیرد.
- نتیجه Follow-up: قرارداد `legal-entities.v3` چهار کد واقعی را منتشر می‌کند، DTO سوییچ مستقیماً همان قرارداد را اعتبارسنجی می‌کند، انتخاب‌گر «جهان آکادمیا» و «قسطی رو» را نشان می‌دهد و عنوان تجمیعی به «همه شرکت‌ها» اصلاح شد. تا دریافت لوگوی اختصاصی، دو شرکت جدید نشان خنثی و نام صحیح خود را دارند و لوگوی نیایش سیر به آن‌ها نسبت داده نمی‌شود.
- دیتابیس مشترک Task فعال ۳۱۰۰/۴۰۰۰ پس از تشخیص ناسازگاری نسخه قدیمی دقیقاً به دو شرکت قبلی بازگردانده شد. Preview ایزوله از Backup تأییدشده روی PostgreSQL پورت ۵۵۴۳۳ شامل هر چهار شرکت فعال است و API/Web جدید روی `127.0.0.1:4001` و `127.0.0.1:3101` اجرا می‌شوند؛ Cookieهای `localhost` Task دیگر نیز به‌علت Host ایزوله دست‌نخورده می‌مانند.
- کنترل کیفیت Follow-up: ۲۷ تست هدفمند Contract/API/Web، lint و typecheck بسته‌های متاثر، Build تولیدی API/Web با ۳۴ Route و `git diff --check` موفق‌اند؛ Health و Login هر دو سرویس ایزوله HTTP 200 و CORS احرازشده صحیح است.
- PR #106 با Merge Commit `10fc98b1dd0f6df7ed006dfc65e952cac1d421dd` وارد `develop` شد و همه ۸ Gate ثبت‌شده CI موفق‌اند. نسخه Merge‌شده روی `localhost:3100` و API روی `localhost:4000` با چهار شرکت فعال در دیتابیس ایزوله محلی PC-B پاسخ سالم دارند.
- `Legal Entities shared-contract Owner = RELEASED / STABLE`. `Central UI Owner = RELEASED` است؛ Migration، Seed مشترک، Dependency/Lockfile و Database مشترک رزرو نشده‌اند.

## NOTIFICATIONS-001-ACTIVITY-BELL — PC-B — DONE/MERGED

- درخواست صریح مالک محصول در 2026-09-07: هر تغییر موفقی که در سامانه انجام می‌شود در بخش زنگوله به‌صورت Notification نمایش داده شود. `COMPUTER_ID=PC-B` بر مبنای مالکیت فعلی این Workspace و ماژول‌های افقی رابط.
- Branch مستقل `codex/pc-b-global-change-notifications` از `origin/develop@9b9d7a4`. محدوده رزروشده: یک Notification Center مستقل در `apps/web/src/components/layout/**`، اتصال محدود زنگوله موجود در `app-shell.tsx`، تست‌های همان Slice و ورودی‌های همین Task در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`.
- نسخه اول بدون Schema/Migration/Seed و بدون تغییر API/Shared Contract/Dependency/Lockfile است: Mutationهای موفق `POST/PUT/PATCH/DELETE` که از Web احراز‌شده Rubi به API تنظیم‌شده ارسال می‌شوند در مرورگر ثبت می‌شوند. Auth/refresh/logout و عملیات غیرتغییردهنده Preview/Search/Export از Feed تغییر حذف‌اند.
- اعلان‌ها فاقد PII و Payload درخواست‌اند و فقط نوع عملیات، نام بخش، زمان و مسیر داخلی را نگه می‌دارند. نگهداری محدود، خوانده/خوانده‌نشده، پاک‌سازی اعلان‌های خوانده‌شده، Sync بین Tabها و fallback امن برای LocalStorage الزامی است.
- این Slice تغییرات عمومی را از همان Browser Profile پوشش می‌دهد. پیگیری DOCUMENTS-007 اعلان تغییرات اسناد را با قرارداد و Persistence مستقل Backend به همین مرکز متصل کرده است؛ بنابراین مسیرهای `documents/**` از رهگیری مرورگری حذف‌اند تا اعلان تکراری ساخته نشود. سایر ماژول‌ها تا پیگیری Backend خود، مرورگرمحور باقی می‌مانند.
- نتیجه: زنگوله موجود به Notification Center واقعی تبدیل شد؛ Mutation موفق پس از دریافت Response به اعلان فارسیِ بخش و عملیات تبدیل می‌شود. Badge تعداد خوانده‌نشده، Empty State، زمان، Deep Link، خواندن تکی/همه، پاک‌کردن خوانده‌شده‌ها، سقف ۶۰ رکورد و همگام‌سازی Tabها فعال است؛ خطای Storage هرگز نتیجه درخواست اصلی را تغییر نمی‌دهد.
- اعتبارسنجی: Web lint و typecheck، ۲۲ تست هدفمند و Production Build با ۳۴ Route موفق‌اند؛ Web/API روی ۳۱۰۰/۴۰۰۰ پاسخ ۲۰۰ دارند. Full Web برابر ۶۴۱ تست موفق از ۶۴۲ است و فقط assertion قدیمی و تغییرنیافته Customers درباره LF/CRLF روی Windows شکست دارد؛ فایل Customers خارج Scope دست‌نخورده ماند.

## MARKETING-001F-OFFER-AUDIENCE-TARGETS — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک محصول در 2026-09-07: در فرم‌های «پیشنهاد ویژه» و «کد تخفیف» یک انتخاب اختیاری مخاطب هدف اضافه شود که بتواند به مشتریان یا آژانس‌ها متصل شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-marketing-offer-targets` از `origin/develop@7b84040`؛ محدوده فقط `apps/web/src/modules/marketing/**`، تست‌های همان ماژول و ثبت همین Work Item در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md` است.
- اتصال فقط خواندنی از Client عمومی Customers و Master Data Organizations انجام می‌شود: مشتریان فعال دارای رضایت جاری مارکتینگ و Organizationهای فعال با نقش canonical `AGENCY`. هیچ جدول، Repository یا زیرساخت داخلی ماژول دیگر مستقیماً مصرف نمی‌شود.
- این Task هیچ Schema/Migration/Seed، API/Shared Contract، Dependency/Lockfile، فایل مرکزی UI یا داده واقعی را تغییر نمی‌دهد. قفل‌های فعال `AGENCY-B2B-INTEGRATIONS-001` و مالکیت Customers نزد PC-A دست‌نخورده‌اند.
- معیار پذیرش: فیلد «مخاطب هدف (اختیاری)» در هر دو فرم وجود داشته باشد؛ حالت عمومی، مشتری و آژانس را پشتیبانی کند؛ جست‌وجو و انتخاب رکورد از API واقعی با stateهای loading/empty/error کار کند؛ انتخاب نوع بدون انتخاب رکورد ذخیره نشود و مرجع انتخاب‌شده در نتیجه عملیات دیده شود.
- نتیجه: Selector مشترک هر دو فرم به `customersApi` و `masterDataApi` متصل شد؛ فقط مشتری فعال دارای رضایت جاری و Organization فعال با نقش `AGENCY` قابل انتخاب است. جست‌وجوی debounce، Retry، پیام خطای نشست/مجوز و Deep Link به بخش مالک نیز تکمیل شد.
- اعتبارسنجی: Web lint بدون هشدار، Web typecheck، ۲۱ تست هدفمند مارکتینگ و Production Build با ۳۴ Route موفق‌اند. Build اجرایی با `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1` ساخته و جای نسخه قدیمی پورت ۳۱۰۰ اجرا شد؛ Health API پاسخ ۲۰۰ و Endpointهای محافظت‌شده مشتری/آژانس بدون نشست پاسخ صحیح ۴۰۱ دارند.

## DOCUMENTS-007-STEP-UP-SECURITY — PC-B — DONE/MERGED

- درخواست و واگذاری صریح مالک محصول در 2026-09-07: PC-B در کنار PC-A به مرز عمومی IAM دسترسی داشته باشد تا برای سندهایی که هنگام بارگذاری علامت «نیازمند اعتبارسنجی دومرحله‌ای» می‌خورند، مشاهده و دانلود فقط پس از Step-up واقعی انجام شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-step-up-security` از `origin/develop@7b84040` در Worktree `C:\Users\admin\Rubi-documents-step-up-security`؛ Branch و تغییرات PC-A/PR #90 حفظ و بازنویسی نمی‌شوند.
- محدوده رزروشده: قابلیت عمومی و نسخه‌دار Step-up در IAM، Schema/Migration افزایشی و غیرمخرب همان قابلیت، Policy و Access Grant یک‌بارمصرف Documents، Upload/Preview/Download، قراردادهای عمومی IAM/Documents، رابط کاربری و تست‌ها و مستندات همین واحد کار.
- انتقال محدود قفل پس از Merge PR #98: `Migration Owner = PC-B/DOCUMENTS-007-STEP-UP-SECURITY`، `IAM shared-contract Owner = PC-B/DOCUMENTS-007-STEP-UP-SECURITY`، `Documents shared-contract Owner = PC-B/DOCUMENTS-007-STEP-UP-SECURITY` و `Central Docs Owner = PC-B/DOCUMENTS-007-STEP-UP-SECURITY`. قفل Dependency/Lockfile فقط در صورت ضرورت و ثبت فایل دقیق گرفته می‌شود.
- مرز تداخل: فایل‌ها و Migrationهای فروش در PR #90 تغییر نمی‌کنند؛ Documents فقط از Public Step-up Contract/Port IAM استفاده می‌کند و به Repository یا جدول داخلی IAM Query مستقیم نمی‌زند. PC-A همچنان مالک Sales است و این واگذاری دسترسی آن را حذف نمی‌کند.
- فرض ظرفیت و امنیت: نسبت خواندن به نوشتن `20:1`، اوج کمتر از `50 QPS`، سامانه ورودمحور با Branch Scope و داده در سطح PII/Restricted؛ هدف `p50<150ms`، `p95<300ms`، `p99<600ms`، SLO برابر `99.9%`، `RPO<=24h` و `RTO<=4h` است.
- معیار پذیرش: Checkbox از Upload تا DB حفظ شود؛ کد ثابت، کد نمایشی در UI یا Secret داخل Git ممنوع است؛ کد Authenticator با Rate Limit و جلوگیری از Replay اعتبارسنجی شود؛ Grant کوتاه‌عمر و یک‌بارمصرف به همان کاربر/سند/عملیات محدود باشد؛ Preview/Download بدون Grant به‌صورت fail-closed رد و همه موفقیت/ردها Audit شوند.
- نتیجه: فعال‌سازی Authenticator با رمز جاری و TOTP واقعی، Secret رمز‌شده، Replay Guard و Rate Limit تکمیل شد. سند علامت‌خورده فقط با Grant هش‌شده دو دقیقه‌ای و یک‌بارمصرفِ وابسته به User/Session/Document/Purpose نمایش یا دانلود می‌شود؛ Scan، Permission و Audit نیز سمت Backend fail-closed باقی می‌مانند.
- رابط: Checkbox در Upload اصلی و Customer وجود دارد؛ فرم فعال‌سازی/ورود کد فارسی است و پیش‌نمایش تصویری مجاز در Browser به PNG کم‌حجم دارای واترمارک سامانه، کد آرشیو و زمان تبدیل می‌شود. جلوگیری مطلق از Screenshot ادعا نمی‌شود.
- اعتبارسنجی: Prisma format/validate/generate، lint کامل API/Web/Database، typecheck API/Web، Production Build کامل و ۳۴ Route، `812` تست API، `633` تست Web سالم و تست‌های هدفمند Migration موفق‌اند. زنجیره Migrationها روی PostgreSQL 18 خالی و ارتقای دیتابیس دارای User/Document آزمایشی پاس شد؛ تنها شکست Full Web همان Assertion قدیمی Customer وابسته به LF/CRLF و خارج از Scope است.
- مرجع طراحی و Handoff: `docs/tasks/DOCUMENTS-007-STEP-UP-SECURITY.md`.
- پیگیری صریح مالک محصول در 2026-09-07: همه تغییرات عملیاتی سند در زنگوله سامانه به‌صورت اعلان پایدار دیده شوند. محدوده افزوده شامل قرارداد عمومی نسخه‌دار Notifications، Persistence و API ماژول مستقل Notifications، Service عمومی ثبت اعلان برای Documents، Bell مرکزی App Shell و تست/مستندات همین قابلیت است. گیرنده امن هر تغییر، Actor و مالک سند است و در صورت یکی‌بودن فقط یک اعلان ساخته می‌شود؛ دسترسی کاربران یا شعب دیگر گسترش نمی‌یابد.
- انتقال محدود قفل پیگیری: `Notifications shared-contract/root export Owner = PC-B/DOCUMENTS-007-STEP-UP-SECURITY` و فایل مرکزی `apps/web/src/components/layout/app-shell.tsx` فقط برای Bell همین Task نزد PC-B رزرو است. Migration و Central Docs همان قفل موجود Task باقی می‌مانند و Dependency/Lockfile همچنان آزاد است.
- نتیجه پیگیری: Persistence و API گیرنده‌محور `notifications.v1`، وضعیت خواندن/پاک‌کردن خوانده‌شده‌ها و ثبت اتمیک اعلان برای Upload، ویرایش، آرشیو، بازیابی، کامل/ناقص، عملیات گروهی و حذف دائمی تکمیل شد. Feed پایدار اسناد با Notification Center سراسری ادغام شد؛ Documents فقط Service عمومی Notifications را مصرف می‌کند و دسترسی مستقیم جدول بین ماژول‌ها ایجاد نشد.
- اعتبارسنجی پیگیری: Prisma format/validate/generate، lint و typecheck API/Web، ۲۷ تست هدفمند API، ۸ تست هدفمند Web و اجرای ۴ تست PostgreSQL زنجیره Migrationها پاس شد. Full API برابر ۸۱۲ تست پاس و ۷۰ skip است؛ Full Web فقط Assertion قدیمی Customer وابسته به LF/CRLF خارج از Scope را قرمز دارد.

## MASTER-005-EXCEL-IMPORT-PERSISTENCE — PC-B — DONE/MERGED

- درخواست صریح مالک محصول در 2026-09-06: مسیر خواندن Excel در اطلاعات پایه بررسی شود و رکوردهای معتبر پس از خواندن، در بخش مالک خود ثبت و بلافاصله قابل مشاهده باشند. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-master-data-excel-import` از `origin/develop@bf6b387` در Worktree `C:\Users\admin\Rubi-master-data-excel-import`؛ محدوده فقط جریان Import اقامت، تست‌های هدفمند و اسناد همین واحد کار است.
- معیار پذیرش: فایل فقط پس از Preview و اعتبارسنجی Backend به‌صورت اتمیک Commit شود؛ نتیجه ثبت شامل تعداد ایجاد/ویرایش/رد نمایش داده شود؛ پس از Commit کاربر به فهرست هتل‌های کشور/شهر انتخاب‌شده هدایت شود و فیلتر وضعیت مانع مشاهده رکورد تازه نشود.
- این Task هیچ Schema/Migration/Seed، Shared Contract، Dependency/Lockfile، Customer Excel Import یا فایل‌های تحت مالکیت PC-A را تغییر نمی‌دهد.
- نتیجه: callback ثبت نهایی اکنون Scope کشور/شهر و شمارنده‌های Commit را به Workspace می‌دهد؛ Workspace فیلترهای پنهان‌کننده را پاک می‌کند، وضعیت را روی «همه» می‌گذارد، فهرست هتل‌های همان Scope را باز می‌کند و پیام نتیجه را بعد از خروج از تب Import نگه می‌دارد.
- اعتبارسنجی: تست سرویس با Workbook معتبر، ایجاد هتل و Auditهای create/commit را داخل تراکنش تأیید می‌کند؛ ۴۰۵ تست Master Data در API، ۳۳۶ تست Master Data در Web، ۶۶ تست PostgreSQL واقعی، lint و typecheck هر دو بسته و Production Build API/Web با ۳۴ Route موفق‌اند.
- پیگیری صریح مالک محصول در 2026-09-06: الزامی‌بودن فیلدها در همه فرم‌های اطلاعات پایه با ستاره و semantics کنترل مشخص شود، وعده/سرویس/نوع اتاق/امکانات هتل اختیاری بمانند، مسیرهای ثبت دوباره تست شوند و نتیجه برای استفاده PC-A روی `develop` ادغام شود.
- نتیجه پیگیری: requiredهای Catalog هم در UI ستاره دارند و هم به کنترل‌ها منتقل می‌شوند؛ Backend همان requiredها را پیش از ثبت بررسی می‌کند. هتل فقط «نام» و «شهر» را اجباری نگه می‌دارد و روابط وعده/سرویس، نوع اتاق و امکانات با انتخاب خالی نیز با موفقیت ثبت می‌شوند. Fixtureهای محلی با قرارداد فعلی هم‌راستا و کدهای خودکار خدمات در وابستگی‌های تأمین‌کننده/کارگزار استفاده شدند؛ شرکت اتوبوس بدون «تأمین‌کننده» و با FK الزامی سازمان مالک ثبت می‌شود.

## TICKET-CATALOG-004 — PC-A — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-06: فضای خالی میان کارت‌های بلیت در چیدمان فهرست حذف شود و گروه رفت‌وبرگشت همچنان کنار هم بماند. `COMPUTER_ID=PC-A`.
- Branch مستقل `codex/pc-a-ticket-card-dense-layout` از `origin/develop@733a24d`؛ محدوده فقط چیدمان Workspace و تست رندر Ticket Catalog و ثبت همین Work Item است.
- راهکار باید ترتیب منطقی کارت‌ها و گروه‌بندی رفت/برگشت را حفظ کند و هیچ Schema/Migration/Seed، API، Contract، Dependency/Lockfile یا ماژول دیگری را تغییر ندهد.
- نتیجه: Grid فهرست به جای‌گذاری Dense مجهز شد؛ خانه تک‌ستونه خالی کنار گروه‌های دوکارته با کارت بعدی پر می‌شود و Wrapper دو ستونه رفت/برگشت دست‌نخورده باقی می‌ماند.
- اعتبارسنجی: ۹۵/۹۵ تست Ticket Catalog Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند؛ build قانون `.grid-flow-row-dense{grid-auto-flow:dense}` را تولید می‌کند و سرویس پورت ۳۱۰۰ پاسخ ۲۰۰ دارد. بازبینی خودکار پنجره به‌علت خطای ACL ابزار Windows ممکن نشد.

## SALES-RUNTIME-INTEGRATION-0908 — PC-A — COMPLETE_LOCAL

- Activated combined Sales5380719/current-CRM f2cc52a with both released sidebar93a4c0d/0f9ff4e changes through normal local merges bd4fb50/a9223e0. API/Web production builds and source lint/typechecks pass; API934 and Contracts60 tests pass, final Sales/navigation/foundation209 and output7 pass. Web3100/API4000 healthy, protected routes401; previous checkout preserved. All42 migrations already present; no DB/seed/key/permission change. Historical migration checksum/name/default drift recorded, not rewritten. Integration lock released; runtime is local-integration-0906, not pc-b-sync-0908. No public push. See docs/tasks/SALES-RUNTIME-INTEGRATION-0908.md.

- User explicitly approved local integration of latest Sales with current Web3100, preserving Customers and grouped navigation. Branch codex/pc-a-sales-runtime-integration-0908 starts at Sales 5380719, isolated from the active pc-b-sync-0908 checkout. Integrate released grouped-sidebar 93a4c0d (baseline f2cc52a). Reserve integration conflict resolution in AppModule, public root exports, additive combined Prisma schema and status/assignment docs; no new domain design, permission grants, seed data, dependency changes or public push. Existing source branches and uncommitted work remain untouched.
- Runtime changes only after owner handoff, combined tests/build and database compatibility checks. Preserve local data, document encryption keys and storage; any additive migration requires a verified private backup first. No reset, destructive migration, main/develop change or remote merge.

## SALES-FIRST-PASSENGER-ACQUAINTANCE-0908 — PC-A — COMPLETE_CODE / LOCAL_ACTIVATION_PENDING

- Delivered first-passenger natural-person contract identity and per-passenger registered acquaintance selection through public Customers APIs. 194 Sales tests, scoped lint/typecheck, synthetic browser QA and 36-route production build pass. Web3100 currently belongs to customer-direct-contact-0908 and was left running unchanged; coordinate activation with its owner. No schema, real-data, IAM or public push. Scoped code reservation released; see docs/tasks/SALES-FIRST-PASSENGER-ACQUAINTANCE-0908.md.

- Reserve Sales people-entry model/UI/form/targeted tests and scoped docs from 8274131. New natural-person contracts always use passenger 1 as customer without a separate payer row/toggle; organizations remain separate. Add per-person registered Master Data acquaintance-method selection through existing Customers public mutations. Preserve old draft entries, customer permissions/optimistic updates, passenger counts and identity recovery. No producer/schema/API/IAM/real-data edits, merge or public push.

## SALES-PAYMENT-SEARCH-UPLOAD-0908 — PC-A — COMPLETE_LOCAL

- Replaced current-payment filtering with main server-backed all-authorized-contract tracking search, clearing stale filters/page. Added visible saved-payment selector and expanded receipt upload/list/download area, with row shortcuts and newly saved payment selection. 188 Web Sales tests, 5 backend reference tests, scoped lint/typecheck, synthetic browser QA and 36-route build pass. Web3100 updated; Web/API health 200. No API/schema/IAM/real-data/public-push changes. Scoped reservation released; see docs/tasks/SALES-PAYMENT-SEARCH-UPLOAD-0908.md.

- Reserve Sales workspace/payment/document presentation and tests plus scoped docs from 54c4e6a. Replace misleading current-contract tracking filter with a global authorized-contract search action and provide a prominent payment-receipt attachment area using existing public Documents APIs. Preserve permissions, branch/ownership, Finance state, idempotency and scan gates. No API/schema/IAM/real-data changes, merge or public push.

## SALES-INSURANCE-SELECTION-0908 — PC-A — COMPLETE_LOCAL / ISSUANCE_DEFERRED

- Delivered active registered-plan dropdown without description, reference/versioned selection metadata and passenger service assignments; existing reservation snapshot preserves the selection, not an issued policy. 185 Sales tests, scoped lint/typecheck, synthetic actual-component browser checks and 36-route production build pass. Updated Web3100/API4000 health 200. No schema/API/producer/IAM/real-data/public-push changes. User deferred insurer connection to later Reservations work. Scoped reservation released; see docs/tasks/SALES-INSURANCE-SELECTION-0908.md.

- Reserve Sales insurance picker/model/payload/form tests and scoped task/central docs from 3b82a72 on the current local Sales branch. Select an active registered Master Data insurance plan, no free-text description; persist its reference and versioned selection metadata in the existing Sales service/reservation snapshot. User explicitly defers insurer API issuance to Reservations later. No schema, provider integration, producer edits, credentials, permissions, real-data mutation, merge or public push.

## SALES-CONTRACT-ROOM-LOCATION-0908 — PC-A — COMPLETE_LOCAL

- Purchased room totals now sit below the Hotel Information table (section 4), not Other Services. 34 focused tests, scoped lint/typecheck and 36-route production build pass; all four synthetic PDF pages visually inspected. Web3100 updated; Web/API 200. No data/API/schema/public-push change. Scoped reservation released; see docs/tasks/SALES-CONTRACT-ROOM-LOCATION-0908.md.

- Reserve Sales print template/room-summary regression tests and scoped docs from f86c42d. Move purchased room quantities from Other Services into Hotel Information as explicitly corrected by user. No calculations, inputs, schema, API, ownership, real-data or public-push changes.

## SALES-CONTRACT-ROOM-SUMMARY-0908 — PC-A — COMPLETE_LOCAL

- Removed passenger room column and added saved contract-level room/extra-bed quantities to Other Services. Master Data hotel product, prices and prior terms/QR unchanged; no passenger-based room inference. 181 Sales tests, scoped lint/typecheck and 36-route Web build pass; all four pages of synthetic six/agency-six/42 passenger PDFs reviewed. Web3100 updated, Web/API health 200. No schema/API/IAM/real-data/public-push change. Scoped reservation released; see docs/tasks/SALES-CONTRACT-ROOM-SUMMARY-0908.md.

- Reserve Sales print/PDF template and tests plus task/central docs from 05c5945 on current local Sales branch. Remove passenger room column; show purchased contract-level single/double room and extra-bed counts in Other Services from saved hotel selection only, without passenger allocation inference. Preserve hotel Master Data product type, pricing, QR, terms and pagination. No API/schema/dependency/producer/IAM/real-data edits, merge or public push.

## SALES-CONTRACT-ONLY-FLIGHT-0907 — PC-A — COMPLETE_LOCAL

- Completed contract-only outbound/return editor and additive versioned Sales snapshot with route/time/source validation, no Ticket Management publish/allocation, reservation reopening and print/PDF support. 59 public-contract, 54 API Sales and 181 Web Sales/Reservations tests pass, with scoped lint/typechecks and API/36-route Web production builds. Synthetic browser and both six-passenger one-page PDFs verified. Web3100/API4000 updated; database SELECT 1 passed after restoring existing Docker runtime September 8. No migration/dependency/IAM/real-data/public-push change. Scoped reservation released; see docs/tasks/SALES-CONTRACT-ONLY-FLIGHT-0907.md.

- Reserve Sales form/model/print/ticket presentation, Sales validation/confirmation tests, Reservations ticket snapshot consumer, additive Sales public metadata helpers/tests and central/task docs from e1e8532 on the current local Sales branch. Persist versioned contract-only flight details in the existing Sales service metadata snapshot, not catalog selections; no fake offer ID, catalog publish or capacity allocation. Validate mutually exclusive published/manual sources and route/timing on the server, retain pending-reservation state, ownership, audit and idempotency. Published-ticket behavior unchanged. No migration, dependency, producer Master Data edits, IAM grants, real business mutations or public push.

## SALES-CONTRACT-QR-PLACEHOLDER-0907 — PC-A — COMPLETE_LOCAL

- Added explicitly pending, offline vector QR to bottom-right print/PDF footer; contacts/notices preserved. 166 Sales tests, scoped lint/typecheck, 36-route production build and all five synthetic PDF pages pass (2/6/agency-6: one page; 42: two). Web3100 updated; Web/API health 200. Placeholder is non-sensitive plain text, not an online viewer; future secure server links require regenerated output. No API/schema/dependency/IAM/data/public-push change. Scoped reservation released; see docs/tasks/SALES-CONTRACT-QR-PLACEHOLDER-0907.md.

- Reserve Sales print/PDF footer helper and tests plus task/central docs from 5e305c6 on the current local Sales branch. User explicitly requests a currently non-working QR at the bottom right. Embed an offline-generated, non-sensitive pending-status QR with a visible activation notice; no localhost URL, public viewer, guessed domain, access token or verification claim. Preserve contacts, notices, six-passenger pagination and pricing. Server-phase activation requires a secure viewer/public origin and regenerated outputs. No dependency, schema, API, IAM, producer or real-data edits; no public push.

## SALES-PAYMENT-EVIDENCE-0907 — PC-A — COMPLETE_LOCAL

- Delivered payment tracking inputs/search and per-saved-payment receipt attachments through public Documents APIs; Finance status remains independent. 164 Web Sales tests, 62 API Sales/Documents tests, scoped lint/typechecks and API/Web production builds pass. Synthetic actual-component browser upload/list/download/search and uncertain-response checks pass; Web3100/API4000 updated and healthy. No migration, IAM grant, real receipt/payment mutation or public push. Scoped reservation released. See docs/tasks/SALES-PAYMENT-EVIDENCE-0907.md.

- Reserve Sales payment UI/model/tests, payment-reference validation and scoped repository search, task/central docs from 54774eb. Existing paymentReference column/public type only; no migration. Attach files through existing Documents public upload/list/download with canonical sales/SalesContractPaymentEntry/payment-id reference, permissions/branch/scan gates unchanged. Upload after payment persistence; never imply upload or tracking search confirms Finance/bank settlement. No Documents producer edits, grants, dependencies, real data mutation or public push.

## SALES-CONTRACT-THEME-ROOM-0907 — PC-A — COMPLETE_LOCAL

- Delivered Master Data room-type output, reference-aligned Persian header/section badges/financial cards and issuer-scoped contact footer; previous rules/amounts and deferred QR preserved. 161 Sales tests, scoped lint/typecheck, 36-route production build and all five final synthetic PDF pages pass. 6/agency-6 fit one A4, 42 use two. Web3100 updated; Web/API health 200. No data/schema/API/IAM changes or public push. Scoped reservations released; see docs/tasks/SALES-CONTRACT-THEME-ROOM-0907.md.

- Include the PDF renderer's font-face weight descriptor: B Nazanin is a static regular face, not a variable 100–900 font; allow matching browser/PDF synthetic bold headings. Renderer isolation, paths and data flow unchanged.

- Reserve Sales print/PDF template and tests plus task/central docs from 5daa1a4. Resolve hotel-section room type through the already loaded public Master Data reference instead of passenger accommodation labels. Match the supplied header/section/financial/footer appearance more closely, including user-requested sample contact details only for the matching issuer. Preserve passenger categories, amounts, existing notices, pagination and deferred online QR. No producer/API/schema/dependency/IAM/data changes or public push.

## SALES-CONTRACT-REFERENCE-THEME-0907 — PC-A — THEME_COMPLETE_LOCAL / QR_DEFERRED_TO_SERVER

- Reference navy/soft-gray theme applied to the shared print/PDF template; existing fields, order, B Nazanin, English monetary digits and calculations preserved. 159 Sales tests plus final 17 print tests, scoped lint/typecheck and 36-route build pass. All five pages of four synthetic PDFs visually verified; six passengers fit one page and 42 use two. Web3100 updated; Web/API health 200. User deferred per-contract online viewing/verification QR until server deployment; no localhost, website-substitute or fabricated verification QR added. No API/schema/dependency/IAM/data/producer changes or public push. Scoped template/central-doc reservations released; see docs/tasks/SALES-CONTRACT-REFERENCE-THEME-0907.md.

## SALES-PAYMENT-CURRENCY-0907 — PC-A — COMPLETE_LOCAL

- Dashboard payment currency is now a registered-active, button-only themed dropdown with paginated loading, retry and submission validation. 158 Sales tests, scoped lint/typecheck and 36-route production build pass; actual-component synthetic browser selection/error/retry checks pass. Web3100 updated. No payment/data/API/IAM/migration changes or public push. Scoped reservations released.

- Reserve ContractPayments UI, local currency loader/validation tests and task/central docs from 106ca1b. Replace the remaining free-text dashboard payment currency with the existing themed registered-currency selector; load active reference pages, block missing/invalid selections and support retry. Other Sales currency editors already use registered selections. No API/schema/IAM/dependency/producer changes or public push.

## RESERVATIONS-TICKET-ACCESS-0907 — PC-A — COMPLETE_LOCAL

- Delivered saved per-passenger ticket reopening and individual/all-passenger print/browser PDF, with contract reference, assigned flights/transfers and no fabricated issuance. History search/pagination preserves reservations.read and branch scope. 162 Web tests, 15 API tests (5 unrelated DB-dependent tests skipped), scoped lint/typechecks and API/Web production builds pass. Synthetic browser reopening/selection/printing/cleanup and both A4 PDF pages verified; live PostgreSQL empty-scope read check passed. Web3100/API4000 updated; no migration/data/IAM changes or public push. Scoped presentation and task-doc reservations released.

- Reserve Reservations inbox/list API/tests, Sales public ticket presentation entry and template refactor/tests, task and central docs from e0159f8. Reopen saved per-passenger ticket snapshots, print/save through browser PDF, and search/page older requests under existing reservations.read + branch scope. No issuance claims, fabricated live inventory, migration, IAM, dependency, producer-worktree edits or public push. Public presentation boundary only; persisted contracts unchanged.

## SALES-TICKET-THEME-0907 — PC-A — COMPLETE_LOCAL

- Contract-blue ticket preview/print, larger eager-loaded agency logo, test airline Plane mark and explicit demo-only 7143/DEMO01 delivered; payment section removed. 153 Sales Web tests plus final seven template/visual checks, lint/typecheck/build pass. Actual CSS/component screenshot reviewed, 3100 restarted, Web/API 200. No issuance/data/API/IAM changes or public push; scoped locks released.

- Reserve flight-ticket-preview TSX/CSS/tests and task/central docs from 3046b0b. Professional contract-blue theme, larger agency logo, code-native test airline mark, no payment section. Sample 4-digit e-ticket and RLOC only for recognized TEST-AYT demo offers, prominently labelled sample/not-issued; no real issuance values or data mutations. No schema/API/dependency/IAM/producer changes or public push.

## SALES-OUTPUT-PAGINATION-0907 — PC-A — COMPLETE_LOCAL

- Delivered compact print/PDF with complete passenger rows, repeated table headings, unsplit summary and LTR page counters. Actual 5/6-person and 6-person agency fixtures fit one A4; 42/100-person fixtures paginate to 2/3 pages. All eight PDF pages visually checked, exact row/page counts verified, 150 Sales Web tests/scoped lint/typecheck/build pass. Web3100 updated, Web/API health 200. No data/schema/API/IAM change or public push. Scoped central-doc/template locks released.

- Reserve Sales contract-print template/tests, synthetic PDF QA and task/central docs from 5f4e7bf on the current local Sales branch. Compact six-passenger A4 output, preserve every row and naturally paginate larger contracts with readable repeated table headings. No pricing, API, schema, passenger-count validation, dependency, IAM or producer changes. Central-doc scope only; previous scoped locks released. Local-only, no public push.

## SALES-PEOPLE-CORRECTION-0907 — PC-A — COMPLETE_LOCAL

- Current-ID recovery and same-confirmation duplicate reuse/update implemented with existing permissions, branch scope, sensitive-read audit and optimistic locking. Previous-ID record retained; no blind merge/deletion. 249 Web + final 25 focused, 93 Customers API, 48 Contracts tests, scoped lint/typechecks and API/Web builds pass. Local 3100/4000 healthy. No migration, IAM, real-customer mutation or public push. Task-specific public-contract and central-doc reservations released.

- Reserve Sales recovery model/UI/tests, additive Customers lookup opt-in type/DTO/service/tests and task docs from 0cc22a0. User authorizes current national-ID matching and updating entered details of an existing customer instead of blocking on previous identity/name. Preserve branch/sensitive-read audit and optimistic update permission; inspect but never mutate a superseded prior-ID registration. No migration/dependency/IAM/public push; previous task locks released.

## SALES-PEOPLE-RECOVERY-0907 — PC-A — COMPLETE_LOCAL

- Removed permanent review locks after definitive 4xx rejection; unknown/duplicate creates recover on the next confirmation through exact identity lookup, known people refresh saved contact/version state, and successful contact checkpoints persist between retries. National-ID uniqueness, sensitive-read permission/audit and branch scoping remain. 243 combined Web tests plus final eight client tests, 91 Customers API tests plus final sixteen permission tests, 48 Contracts tests, scoped lint/typechecks and production API/Web builds passed. Local Web3100/API4000 updated; no migration, real data edits, IAM change or public push. Task-specific contracts/docs reservations released.

- Reserve Sales people-sheet model/UI/tests, Customers producer registration-lookup API/repository/DTO/tests and public browser entry/client, additive Customers public request type and task docs from b69511c. Distinguish rejected mutations from unknown outcomes; recover exact identities via branch-scoped Customers public API and refresh confirmed contacts/versions without blind duplicate creation. PC-A owns both producer/consumer; optional endpoint preserves old clients. No migration, dependencies, IAM grants, producer worktree edits or public push. Reserve only these shared-contract/Central Docs paths; prior scoped locks released.

## SALES-OUTPUT-TERMS-0907 — PC-A — COMPLETE_LOCAL

- Added the user's three notices in readable 8.5pt B Nazanin below signatures and above the site in shared print/PDF output. Compact whitespace and wider hotel-name column keep the two-passenger sample on one A4 page. Fourteen print/PDF-route tests, scoped lint, production TypeScript/build and all four rendered QA pages pass. Presentation only; API/database and receipt/consent logic unchanged. Local-only; task-specific docs/template reservations released.

- Reserve Sales print template/tests and task/central status docs from 148fdf8 on the current Sales branch. User-supplied three notices below signatures, above Nystkt.ir, in small readable B Nazanin. Presentation only: no legal validation, consent workflow, API, database, payment/release or producer changes. Prior scoped reservations released. No public push.

## SALES-OUTPUT-HOTEL-CURRENCY-0907 — PC-A — COMPLETE_LOCAL

- Delivered on the current local Sales branch: explicit age-compatible hotel accommodation per guest, Latin hotel/site public references, Nystkt.ir footer, IRR/foreign passenger cells and exact per-currency passenger totals. Empty PostgreSQL migration/seed-twice, restored-data rehearsal, DB CHECK/roundtrip, 132 Web Sales + 45 API Sales + 48 Contracts tests, scoped lint/typechecks/API-Web production builds passed. Local additive migration activated with fresh backup and historical rows/counts unchanged; Web3100/API4000 healthy. No public push. Task-specific Migration/Sales public contract/Central Docs reservations released. See docs/tasks/SALES-OUTPUT-HOTEL-CURRENCY-0907.md.

- Reserve Sales passenger accommodation field/additive migration, public types, validation/persistence/UI, print/reference loading/tests and task docs from 1c1acd2 on the current Sales branch. Prior local scoped locks are released; Migration/Sales contract/Central Docs owner is PC-A for this change only. No producer, IAM, dependency, remote or historical-migration rewrite. User asks Nystkt.ir footer, Latin hotel/site, explicit passenger room/child-bed designation, separate IRR/foreign columns and passenger-summed agreement total. No age/bed or FX guessing.

## SALES-OUTPUT-CLEANUP-0907 — PC-A — COMPLETE_LOCAL

- Delivered marked-note/footer cleanup in print/PDF with operator guidance outside the document. Eleven focused tests, scoped lint, production TypeScript/build and four-page rendered QA passed. Web3100 restarted; no API/database change. Reservations released; local-only. Browser header/footer preference remains explicit; see task document.

- Reserve Sales print template/tests and output-dialog guidance plus task docs on the current Sales branch from 8bb1fdf. Remove the user-marked internal notes and template/time metadata from the customer document, retaining operator disclosures in the dialog. No API, pricing, schema, IAM, dependency, producer or remote changes. Browser-added headers/footers remain a print preference; direct PDF already suppresses them.

## SALES-CUSTOMER-PRICING-0907 — PC-A — COMPLETE_LOCAL

- Final clarification and delivery supersede the pending-decision notes below. Whole-package agreed amounts are entered and persisted per passenger/currency, reconciled exactly with service-agreed totals. Added direct saved-data PDF download next to Print, English monetary glyphs, and legacy unrecorded-price disclosure. 129 Sales Web, 44 Sales API, 47 Contracts tests passed; scoped lint, affected typechecks, API/Web production builds passed. Empty PostgreSQL migrations + seed twice (86 permissions), restored-backup upgrade and exact-money/FK/unique/check guards passed. Only the additive Sales migration activated; all historical checksums and checked business counts unchanged. Web3100/API4000 healthy; no authenticated real-contract walkthrough. Migration, Sales shared contract and task docs reservations released. Local commits only; no public push. See task doc for runtime configuration and retained backups.

- 2026-09-07 clarification: individual passenger totals cover all selected services, per currency, reconciled to the saved agreed contract total; no age-based or equal allocation. Reserve Sales passenger money schema/additive migration, Sales public types/validation/persistence/UI, direct PDF Web route and task/central docs for this local follow-up. Prior scoped local migration reservations are released; no producer worktree, dependency lockfile or public push changes. Existing contract service pricing and Finance settlement remain authoritative. Legacy passenger amounts are not backfilled.

- Reserve Sales people-sheet UI/model/tests, print template/tests and task docs on codex/pc-a-sales-customer-pricing-0907 from 206635c. Use existing Customers public API with its permissions, branch scope, sensitive-read audit and optimistic version; no producer worktree changes, grants or public push.
- User requests dark-blue print styling, actual passenger/age fare amounts and editing selected existing customers. Passenger fare entry granularity is awaiting clarification; no invented division or age discount. Persisted pricing changes will be separately scoped after inspection; no migration lock is taken by this entry.
- Customer/print slices implemented: existing person selection loads authorized detail, focuses the editable row, preserves linked passenger identity, and saves changed fields through versioned Customers APIs. Untouched masks are omitted; contact revisions use the existing per-type primary-contact action without deleting history. Print uses dark professional blue. Fare amounts remain unchanged pending the age-category-versus-individual entry decision; this task is not wholly complete.

## SALES-OUTPUT-LAYOUT-0907 — PC-A — COMPLETE_LOCAL

- Reserve Sales Web/API output and tests, additive Sales public output type, navigation alias/tests and task docs on codex/pc-a-sales-output-layout-0907 from c63318a. User requests breadcrumb, overflow and customer-shareable contract output. Existing producer public APIs only; no schema/migration, grants, dependencies, producer changes or public push.
- Provide a permission-scoped saved-data print/PDF view after confirmation and in dashboard. No official issuance-policy bypass, tax invoice or payment receipt; the browser Save as PDF flow is explicit. Agreed amounts only; no fabricated per-passenger allocation or commission deduction. No automatic sending.
- Delivered breadcrumb alias, min-content grid containment and saved-output preview buttons. 233 Sales/Customers/navigation Web tests, 44 Sales API tests and 41 Contracts tests passed; scoped lint, all affected typechecks and API/Web production builds (36 routes) passed. Synthetic Chromium verified B Nazanin in the sandboxed iframe, print action and desktop/mobile containment with final CSS. PDF QA: two passengers/two currencies fit one A4 page; 42 passengers span three pages with repeating headers. No authenticated real-contract walkthrough. Web3100/API4000 active; login/bundle/health 200, protected Sales 307, unauthenticated output 401 and CORS 204. Prior Web retained under tmp/sales-output-web-before-0907. Local-only; task-specific reservations released. See docs/tasks/SALES-OUTPUT-LAYOUT-0907.md for issuance and commission limits.

## CUSTOMER-INLINE-CALENDAR-0906 — PC-A — COMPLETE_LOCAL

- Reserve Customers entry-sheet/date-field UI and focused tests plus task status docs on codex/pc-a-customer-inline-calendar-0906 from fc9177b. Remove the intermediate date Dialog and open the existing themed calendar directly at each table date field, including the shared Sales consumer. Preserve ISO values, calendar modes, read-only rules and entered rows. No API, schema, dependencies, shared UI edits, producer branch changes or public push.
- Fetch completed; HR remote advanced to 6f9bb14 and is outside scope. Previous passport task reservations are released. PDF pricing clarification remains separate and unresolved for commission treatment; no PDF or financial changes here.
- Delivered direct themed birthday/passport-expiry calendars without the intermediate Dialog. 222 focused Web tests, scoped lint, Web typecheck and 36-route production build passed. Synthetic interactive Chromium checks passed with the final CSS, including Escape retaining the form, row/field isolation, clipping, mobile bounds and focus return. Web3100 is active; login/API health 200 and protected Customers 307. Prior build retained at tmp/inline-calendar-web-before-0906. No authenticated data walkthrough, API restart or public push. Task-specific reservations released.

## SALES-PASSPORT-EXPIRY-0906 — PC-A — COMPLETE_LOCAL

- User explicitly approved persistent passport expiry and transfer of the Migration lock to this task. Reserve Customer nullable passportExpiryDate, additive migration, Customers public contract/API/presentation, Sales people-sheet linking and tests, and central task docs on codex/pc-a-sales-passport-expiry-0906. Producer Customers and consumer Sales are both PC-A; optional field preserves old requests and omitted updates. No other producer worktree, dependencies, IAM grants or public push.
- Customer checkbox copies the entered/selected payer into passenger slot one without increasing count; preserve displaced row until unlinking and confirm replacement. Passport number stays encrypted in Customers; expiry is a date-only Customer field, not raw Sales localStorage or a fabricated Documents file. Fresh migration tests and backup precede local rollout.
- Delivered and activated on Web3100/API4000. 211 combined Web tests plus 11 final people-model tests, 88 Customers API, 41 Contracts and 71 Database tests passed; scoped lint/typecheck and API/Web production builds (36 routes) passed. All 38 migrations and seed twice passed on an empty database; restored-copy upgrade and repository persistence/version/scope checks passed. A new operational backup preceded the single additive migration; counts and historical checksums unchanged. HTTP login/bundle/API 200, protected page 307 and unauthenticated Customers 401. No new grants, operational seed, public push or authenticated visual QA. Task-specific Migration/contract/docs reservations released.

## SALES-PEOPLE-SHEET-0906 — PC-A — COMPLETE_LOCAL

- User requested the same Customers/Passengers entry sheet inside Sales and exactly the passenger count chosen earlier, with infant-only extra rows. Reserve Sales people-entry UI/model/tests and form, a narrow public Customers presentation export plus backward-compatible per-field editing on its existing sheet, and task docs on codex/pc-a-sales-people-sheet-0906 from f984cdc. Preserve existing Customers public API, branch/identity protections, organization payer, Finance and capacity rules. No migration, IAM, dependencies, producer edits or public push.
- Reuse the existing Customers entry sheet through a public Web export. Unsaved identity/contact/passport values stay in component memory, not Sales localStorage. Validate all rows before creation; retain successful row identities on partial failure, never blindly retry an uncertain creation. Fixed count slots replace the sequential pending-row queue.
- Delivered the actual Customers table with all target passenger rows open, infant-only additions, individual existing-record selection and one confirmation action. Organization payer and first-passenger-as-customer remain supported. 208 combined Sales/Customers tests and 7 final shared-table tests, scoped lint, Web typecheck and 36-route production build passed. Web3100 serves the new bundle (200); login 200, unauthenticated contract redirect 307 and API health 200. API unchanged; prior Web retained at ignored tmp/people-sheet-web-before-0906. No real test records, authenticated visual QA or public push. Task reservations released; see docs/tasks/SALES-PEOPLE-SHEET-0906.md.

## SALES-DASHBOARD-THEME-0906 — PC-A — COMPLETE_LOCAL

- User requested app-themed open dropdowns and Sales KPI styling matching Customers/Passengers. Reserve Sales Web selectors/workspace/payment drawer/ticket preview and tests plus status docs on codex/pc-a-sales-dashboard-theme-0906 from 24f7cbb. Reuse existing UI select primitives and customer gradient tokens; no metric definition, API, database, IAM, dependency or producer changes. Local-only delivery.
- Delivered d7cf782: app Select primitives for settlement filter, payment method, check bank and ticket-preview passenger. Empty/all selection, RTL, required and disabled semantics retained. Four KPI cards reuse Customers gradient/typography tokens without changing sources/calculations or implying list-filter-scoped statistics. 99 Sales tests, scoped lint, Web typecheck and 36-route production build passed. Web3100 restarted; login/bundle 200, Sales auth redirect 307, API health 200. Prior Web retained at ignored tmp/dashboard-theme-web-before-0906. No authenticated visual QA or public push; task reservations released.

## SALES-PAYMENT-LAYOUT-0906 — PC-A — COMPLETE_LOCAL

- User requested a professional redesign of contract payment entry. Reserve Sales payment-plan UI/form/tests and task status docs on codex/pc-a-sales-payment-layout-0906 from 4646ad4. Compact numbered rows, explicit labels and distinct check details; preserve currency lookup, payment payload, Finance confirmation rules and local drafts. No API, database, permissions, dependencies, producer changes or public publication.
- Delivered numbered responsive payment cards, count/check summary, labeled fields, isolated check details, controlled draft inputs and confirmable removal. Switching away from CHECK removes inactive check metadata, with visible guidance, to keep the existing API payload valid. 96 Sales tests, scoped lint, final Web typecheck and 36-route production build passed; five payment tests repeated after the optional-property correction. Web3100 restarted; login and served payment bundle 200. API remained unchanged/healthy. Prior Web retained in ignored tmp/payment-layout-web-before-0906. No authenticated visual QA or public publication; task reservation released.

## SALES-CURRENCY-INCLUDED-TRANSFER-0906 — PC-A — COMPLETE_LOCAL

- User requested registered-currency selection, themed Sales dropdowns, and included outbound/return transfers with no additional charge. Reserve Sales Web/model/tests, Sales public pricing helper and API validation tests, and central task documentation on codex/pc-a-sales-currency-included-transfer-0906 from 0ded773. No migration, IAM, dependencies, producer branch edits or public publication.
- Compatibility: new Sales payloads mark included TRANSFER through existing metadata; public pricing calculation excludes these and rejects attached charges. Historical unmarked transfer prices remain unchanged. Master Data currencies are consumed only through its public API; transfer directions remain in ticket output and reservation snapshot.
- Delivered locally in 13baaf6 and aed55fc. 41 Contracts, 91 Sales Web, 44 Sales/Reservations API tests passed (5 optional integration tests skipped); all 11 affected lint/typecheck/dependency gates, API build and 36-route Web production build passed. Web3100/API4000 restarted; health/login/bundle 200, unauthenticated redirect 307/API denial 401 and credentialed origin checks passed. Prior Web is retained at ignored tmp/currency-transfer-web-before-0906. No migration, operational seed, permission changes, public push or authenticated visual QA. Task-specific reservations released; producer ownership unchanged.

## SALES-PASSENGER-NUMBER-INPUT-0906 — PC-A — COMPLETE_LOCAL

- User requested directly typed integer fields for adults/children/infants in the new contract. Reserve Sales Web count component/form/tests and task status docs on codex/pc-a-sales-passenger-number-input-0906 from integrated 0fd6311. Replace the 0–30 dropdown without changing capacity, age composition, API, schema, IAM or other modules. Local delivery only; preserve producer branches and previous builds.
- Delivered in 5e7e60c: three typed number inputs (min 0, step 1), select-on-focus, clear/retype support and rejection of negative/fractional/unsafe values. The prior 30-person menu limit is gone; existing seat/age checks remain. 85 Sales tests, scoped lint, Web typecheck and 36-route production build passed. Web3100 restarted and Web/API HTTP checks passed. No API restart, migration, grant, public push or authenticated visual QA. Prior Web retained in ignored tmp/passenger-number-web-before-0906; task-specific reservation released.

## HOTEL-SALES-PRICING-0906 — PC-A — COMPLETE_LOCAL

- Final approved integration: normal merge e31b8d1 retains parents 43111fd and 3d3095e. Both handoffs and all capacity/arrangement work preserved. Purchase and arrangement versions coexist in the public presenter; nullable legacy room composition is omitted, not fabricated. Producer branch/worktree remains clean at 3d3095e.
- Combined gates: 15 lint/typecheck tasks, 733 Web tests, 883 API tests (81 optional skipped in the full run), 38 Contracts and 71 Database tests passed. Fresh 37 migrations, seed twice (86 permission definitions), and 46 focused PostgreSQL/domain tests passed, including oversell, independent purchase/arrangement revisions and immutable snapshots. API and 36-route Web production builds passed.
- Restored-backup upgrade passed, then a fresh backup preceded the single pending additive pricing migration on local rubi. Existing business counts and all historical migration checksums were preserved. Local Web 3100/API 4000 now run the combined build; health, login redirect, served pricing bundle, credentialed CORS and unauthorized-write denial passed. Existing Documents key/storage and Ramtin-only grant preserved; no operational seed or extra grant.
- This task's integration/Migration/shared-contract/central-doc/UI reservations are released on local completion; producer review responsibilities remain unchanged. Public publication is still unapproved. No authenticated browser walkthrough or real-contract creation is claimed. The older rollout blocker below is historical and superseded by this successful integration.

- Follow-up user approval: reconcile the three committed Sales/Reservations changes through 3d3095e into this pricing branch with a normal local merge, retaining both histories. Reserve overlapping Sales/Reservations/Ticket public contracts, schema, UI/API and central documentation for reconciliation; preserve both producer handoffs. No producer worktree edits, main/develop changes, public push, additional grants or dependency changes. Validate combined migrations, restore-copy upgrade, tests/build and activate locally on 3100/4000 only after a fresh backup.

- Shared UI reservation: additive money-input used by Sales and Reservations. User explicitly approved granting only reservations.hotel_purchase.write to Ramtin; shared role memberships and other users must remain unchanged.

- User explicitly approved transferring the Migration lock for persistent hotel purchase entry in Reservations. Migration Owner = PC-A/HOTEL-SALES-PRICING-0906 for this additive change; existing PC-B producer branches are untouched. Reserve Sales/Reservations pricing contracts, Web/API, additive schema/migration, necessary permission seed and task docs on codex/pc-a-hotel-sales-pricing-0906. No dependency change or public publication.
- Day-sale and agreed totals are distinct from purchase cost. Hotel nightly/total entry preserves the explicitly entered source, UTC calendar nights and exact totals. Reservations owns append-only purchase revisions with branch permissions, optimistic version, actor audit and idempotency. Never alter intake snapshots or derive a fabricated supplier discount. Ticket purchase requires an authoritative offer-to-catalog link; no route/name matching.
- Code gates passed: all 15 lint/typecheck tasks, 727 Web tests plus final three pricing-panel tests, 882 API tests (78 optional skipped), 38 Contracts tests, 71 Database tests, API build and 36-route Web production build. All 35 migrations on a fresh isolated database and seed twice passed; 37 focused domain/PostgreSQL tests passed.
- Operational preflight detected already-applied migrations 20260906095000_ticket_offer_capacity_allocations and 20260906113000_reservation_arrangements from codex/pc-a-sales-contracts (6f827d1, da2e5fe; latest reviewed tip 3d3095e), absent from this integration base. No pricing migration or API replacement performed; do not bypass this gate. Their overlapping Sales/Reservations/schema work must be reconciled with owner authorization. Migration handoff is pending this coordination, not silently reassigned.
- Independently completed the explicitly approved Ramtin-only permission grant through dedicated role ramtin_hotel_purchase_local, with backup and audit. Other users and shared-role permissions verified unchanged. Prior Web build restored on 3100; existing API 4000 left running; both HTTP checks passed. New pricing build retained in ignored tmp/hotel-pricing-web-built-0906. No public push or authenticated visual QA.

## CUSTOMER-ENTRY-SHEET-0906 — PC-A — COMPLETE_LOCAL

- User requested spreadsheet-like Customer 360 entry. Reserve Customers Web entry UI, its tests and this local task documentation on codex/pc-a-customer-entry-sheet-0906, based on the verified local integration. Producer branches remain untouched; no merge, publication, schema, API, IAM or dependency changes.
- Preserve required identity validation, public Customers/Documents APIs and encrypted/masked persistence. Simplify core person entry into rows and show optional details only for the selected row.
- Delivered editable table, confirmable row removal/source changes, unclipped calendar and preflight duplicate/name checks. 100 Customers tests / all 725 Web tests, scoped lint, typecheck and 36-route production build passed. Web 3100 restarted; Web/API HTTP checks passed (unauthenticated Customers redirects to login). No authenticated visual QA or real-record creation claimed. No public push.

## LOCAL-INTEGRATION-0906 — PC-A — COMPLETE_LOCAL

- User explicitly authorized isolated local integration of latest module work and preserved passport changes. Branch codex/pc-a-local-integration-0906 starts at local Sales 2cc7a9c, retaining all six local commits. No source branch, main/develop, public push or PR mutation authorized.
- Reserve integration conflict resolution and additive compatibility fixes in this worktree only, including central docs/contracts/schema consistency. Existing producer locks remain held; no concurrent producer worktree is edited. Merge current develop first; assess current module tips and preservation snapshot separately. No blanket merge of obsolete/demo/recovery branches.
- Runtime replacement and operational migrations are gated by schema/security review, empty-database migrations, tests and builds. Existing local data and keys must remain intact. Recovery snapshot is not assumed production-ready.
- Integrated current module tips and recovery with compatibility resolution; full lint/typecheck/tests/build and 34 empty-DB migrations plus seed twice passed. Existing rubi has two unexplained historical migration checksums; operational migration and runtime replacement stopped before mutation. Local backup retained. Details: docs/tasks/LOCAL-INTEGRATION-0906.md.
- Follow-up authorized: restored-copy upgrade passed, fresh backup retained, only pending additive B2B migration applied without rewriting history. Integrated Web/API activated on 3100/4000; HTTP smoke passed. Historical provenance concern retained; no new IAM grants or public push.

## RESERVATION-ARRANGEMENT-0906 — PC-A — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-06: کنترل‌های تعداد بلیت/هتل مانند نمونه جمع‌وجور شوند و رزرواسیون پس از ثبت قرارداد، دسترسی مجاز به اصلاح چیدمان داشته باشد. پیگیری مالک: شمارنده هتل ورودی عددی مستقیم، واحد اتاق «باب» و خلاصه هتل نمایش‌دهنده ترکیب سنی مسافران باشد. ادامه همان Branch/PR فروش؛ `COMPUTER_ID=PC-A`.
- محدوده: Sales room composition UI/persistence، Reservations public API/UI، قراردادهای IAM/Sales/Travel، Permission seed، Migration افزایشی و اسناد معماری/وضعیت. قفل Migration/Central Docs/Shared Contracts از Task فعال نزد PC-A است؛ Dependency/Lockfile و داده واقعی تغییر نمی‌کند.
- مرز: Reservations فقط نسخه اجرایی تعداد اتاق، یک‌تخته، دوتخته، تخت اضافه و اعضای هتل را از میان passengerهای Snapshot ثبت می‌کند. ایجاد/تعویض مسافر و افزایش صندلی همچنان اصلاح قرارداد Sales و کنترل دوباره Ticket Catalog است؛ Snapshot ورودی حذف یا بازنویسی نمی‌شود.
- Validation: 680 Web tests, 823 API tests (76 optional skipped), 18 Contracts tests, Web/API lint and typecheck, and Web/API production builds passed. All 34 migrations passed on fresh PostgreSQL 18; the focused reservation arrangement integration test passed on the backed-up operational local database. Migration applied locally after pg_dump backup. Permission definition is implemented, but assigning it to roles remains pending explicit security approval. No authenticated browser QA claim.

## SALES-PASSENGER-CAPACITY-HOTEL-0906 — PC-A — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-06: ترکیب تعداد مسافران پیش از انتخاب بلیت ثبت شود، نوزاد در ظرفیت صندلی محاسبه نشود، انتخاب بلیت بیش از مانده ظرفیت هم در UI و هم هنگام تأیید اتمیک رد شود و هتل با تعداد اتاق و اعضای مهمان انتخاب شود. `COMPUTER_ID=PC-A`.
- ادامه همان Branch/PR فعال `codex/pc-a-sales-contracts` / PR #90؛ محدوده Sales Web/API، قرارداد عمومی Travel/Sales، Ticket Catalog Public Service، Migration افزایشی ظرفیت، تست‌ها و اسناد همین Task است. قفل‌های Migration، Central Docs و Sales/Travel Contract از قبل نزد `PC-A/SALES-CONTRACTS-001` هستند.
- Ticket Catalog مالک ظرفیت بلیت می‌ماند و Sales فقط Public Service آن را مصرف می‌کند؛ تخصیص ظرفیت با کلید قرارداد/جهت اتمیک و تکرارپذیر است. اطلاعات مسافر از Customers و ارسال نهایی از Reservations عبور می‌کند؛ Query مستقیم جدول ماژول دیگر در Sales ممنوع است.
- هتل در این مرحله تعداد اتاق، نوع اتاق، تعداد مهمان و اعضای انتخاب‌شده را در Snapshot قرارداد نگه می‌دارد؛ موجودی قطعی هتل همچنان هنگام Reservation Confirmation بررسی می‌شود و موجودی ساختگی تولید نمی‌شود.
- بدون Dependency/Lockfile، تغییر IAM، حذف Migration قبلی، داده واقعی یا دست‌کاری Branchهای دیگر.
- Validation: 678 Web tests and 823 API tests passed (75 optional API tests skipped); 46 focused Web tests and 31 focused API tests also passed independently; Web/API lint, typecheck and production builds passed. Prisma format/generate/validate and all 33 migrations on fresh PostgreSQL 18 passed; the dedicated concurrent oversell test passed independently. Existing Reservations concurrent-upsert race remains outside this unit. Operational local migration applied after an in-container pg_dump backup; Web 3100, API 4000 and CORS returned 200/200/204. No authenticated browser QA claim.

## SALES-DASHBOARD-REDESIGN-0905 — PC-A — COMPLETE_LOCAL

- Reserve Sales workspace, presentation/tests and task status docs only. Redesign summary, server-backed search/settlement filters, pagination and empty state. Preserve API authorization and Finance-confirmed balances; no schema, shared UI, IAM or dependency changes. Local delivery only; public publication remains unapproved.
- Validation: 72 Sales Web tests, scoped lint, Web typecheck and production build (35 routes) passed. Existing public list filters/pagination and independent summary errors preserved; Persian labels and precision-safe decimal display. No authenticated browser QA claimed.

## SALES-PEOPLE-REDESIGN-0905 — PC-A — COMPLETE_LOCAL

- Reserve Sales people-step UI/search/person form/model/tests and Sales adapter/domain/service tests. Separate contract buyer from passenger selection, mutually exclusive search/create, compact results and clear selected state. Align national ID requiredness with Customers producer; validate passenger references via its public masked API on Sales writes/confirmation. No Customers internals, schema or shared contract changes; public push remains unapproved.
- Validation: 69 Web Sales and 35 API Sales tests passed; scoped Web/API lint, both typechecks and both production builds passed. Web 3100 and API 4000 restarted. No real person creation, authenticated visual QA or migration claimed; locks remain held.

## SALES-TICKET-DATE-SIZE-0905 — PC-A — COMPLETE_LOCAL

- Reserve Sales ticket-offer-card and its tests/docs only: increase departure/arrival date typography from 11px muted to 14–16px bold, full contrast and wrapping. No date logic, shared UI, API or schema changes. Local delivery; public push still awaiting approval.
- 66 Sales tests, scoped lint, Web typecheck and production build passed. Updated Web 3100; no authenticated visual QA claimed.

## SALES-ORGANIZATION-CUSTOMER-0905 — PC-A — COMPLETE_LOCAL

- Reserve Sales Web organization selector/form/model/tests and task docs. Consume existing Customers organization kind and stable MasterOrganization references through their public APIs only. Reuse accessible existing legal customers or explicitly register a customer profile linked to an existing organization; never create another organization. Passengers remain separate; no schema/API/permission/root-export changes. Public push remains awaiting explicit approval.
- Validation: 64 Sales Web tests, scoped lint, Web typecheck and production build (35 routes) passed; Web restarted on 3100. No real profiles created for QA and no authenticated visual test claimed. Same Sales branch; no PR, Merge or lock release.

## SALES-PASSENGER-ROWS-0905 — PC-A — SALES_COMPLETE

- Reserve Sales Web form/person-entry/model/tests and task documentation only: add/remove independent passenger rows, required ten-digit national ID for new passengers, optional first passenger as contract customer. Raw national IDs stay only in transient entry state and are sent to the Customers public API, not the Sales draft/payload. No Customers internals, shared contracts, schema, migration or permissions changed.
- Validation: 58 Sales Web tests, scoped lint, Web typecheck and production build (35 routes) passed; rebuilt Web restarted on port 3100. Same Draft PR #90; locks remain held. No real person creation or authenticated UI QA claimed.

## SALES-FOREIGN-ISOLATION-0905 — PC-A — COMPLETE_LOCAL

- User authorized separation of all 27 pre-existing foreign changes. Preserved as local commit 75afc50751b3d5db16003c3e551bc3778e047eda on codex/pc-a-customer-passport-preservation-0905, plus raw backup at ../.worktrees/sales-foreign-backup-20260905. Three-way SHA256 equality checked before cleaning Sales; 20 tracked paths restored and 7 duplicate untracked files removed only from Sales.
- This is recovery-only, not feature approval or reconciliation into the active Customers branch. Twelve files match customer-connections-0905; fifteen require owner reconciliation. Existing owner branches/worktrees remain untouched. Publishing the unreviewed preservation payload was blocked by safety review; no remote preservation branch or new PR was created.
- Sales worktree is clean at 8dbc5f4 after isolation. Prisma foreign-file blocker is resolved; Reservations amendment API and Agency public contracts are still unfinished. Migration/Central Docs/Sales Contract locks remain held; PR #90 is not promoted or merged.

## CUSTOMERS-PRESERVATION-0905 — PC-A — RECOVERY_ONLY

- Authorized isolation of 27 foreign Sales-worktree files onto codex/pc-a-customer-passport-preservation-0905; exact snapshot, not feature completion. See docs/tasks/CUSTOMERS-PRESERVATION-0905.md and byte manifest. No schema redesign, migration application, lock transfer, new PR or modification of active owner branches.

## SALES-CONTRACTS-001-HOTEL-DETAILS — PC-A — SALES_COMPLETE / RESERVATIONS_BLOCKED

- Reserve Sales Web form/model/tests and this task's documentation on codex/pc-a-sales-contracts / PR #90: combined flight/hotel details, destination hotel search, editable flight-derived hotel dates. No shared UI, API, schema, migration or unrelated local changes.
- Reservations hotel amendment remains blocked pending an owned versioned execution-update API and resolution of the pre-existing dirty Prisma ownership; never mutate the immutable Sales intake snapshot or fake a saved amendment.
- Sales validation: 50 Web Sales tests, scoped lint, Web typecheck and production build (35 routes) passed. Foreign dirty changes excluded; PR #90 remains Draft and locks remain held.

## CUSTOMER-CONNECTIONS-0905 — PC-A — READY_FOR_REVIEW

- Completed integration validation: 163 targeted tests and all affected lint/typecheck/build passed. Local Web 3101 and API 4101 launched independently. Existing localhost:5432 database had 28/31 migrations; the three existing additive migrations were deployed successfully to resolve missing Master Data/Documents columns. No new migration or seed was authored. New persistent DPAPI-protected Documents key and local storage are in ignored tmp; previous configured database had zero Documents records.

- Integration work is isolated from active Sales. Existing headings below are retained as historical context; they do not reserve Ticket Catalog work in this task. Only Customer Documents integration and master-data retry are being validated here.

## CUSTOMER-MASTERDATA-RETRY — PC-A — READY_FOR_REVIEW

- درخواست مالک در 2026-09-02: کامل‌ترین نسخه قبلی Customers روی پورت ۳۱۰۰ حفظ شود و پیام نادرست «اطلاعات پایه در دسترس نیست» پس از تمدید نشست رفع گردد. `COMPUTER_ID=PC-A`.
- Branch مستقل و Stacked: `codex/pc-a-customer-masterdata-retry` روی نسخه تحویلی Ticket/Customers؛ محدوده فقط اتصال Public Master Data در Web Customers، تست مستقیم و سند همین اصلاح است.
- هیچ Schema/Migration/Seed، Passport/Visa persistence، API/Contract، Dependency/Lockfile یا داده‌ای تغییر نمی‌کند. `DEC-OPEN-006` همچنان باز است و قابلیت مدرک ساختگی فعال نمی‌شود.
- نتیجه: پاسخ 401 فهرست‌های اطلاعات پایه فقط یک بار با Refresh مشترک نشست بازیابی و همان درخواست تکرار می‌شود؛ 403، Network و 5xx پنهان یا بی‌نهایت تکرار نمی‌شوند. تمام Commitهای قبلی CUSTOMER-002B و اتصال Documents در مبنای فعال حفظ شده‌اند.
- Validation: تست هدفمند ۴۷/۴۷، همه ۵۶۵ تست Web، lint، typecheck و Production Build موفق‌اند. Final lock state: `RELEASED — PC-A/CUSTOMER-MASTERDATA-RETRY ready for review`؛ هیچ قفل مشترکی تغییر نکرد.

## TICKET-CATALOG-EDIT-COMPLETENESS — PC-A — READY_FOR_REVIEW

- User approved integrating PR #85 Documents/Customer 360 and the existing master-data session retry on 2026-09-05. Isolated branch `codex/pc-a-customer-connections-0905`, based on committed Sales `5ea2b32`; active Sales worktree is untouched. Scope: integration of existing Customers/Documents public API changes, customer reference retry, tests and these task entries. No schema, migration, dependency or permission changes.

## SALES-CONTRACTS-001 — PC-A — READY_FOR_REVIEW

- PC-A route/calendar-language follow-up READY_FOR_REVIEW: origin/destination each have vertically paired country/city fields. Sales calendar wrapper opts into English Gregorian month/day names, labels, digits and LTR; default shared behavior and ISO values unchanged. Shared Calendar Owner = PC-A/SALES-CONTRACTS-001 for the additive option pending review. 48 Sales/shared-calendar tests, scoped lint/typecheck and Web production build passed; no schema/dependency/API changes.

- PC-A calendar/ticket presentation follow-up READY_FOR_REVIEW: Sales-local range calendar matches shared palette/trigger/month-year grids and chooses above/below with scroll-bounded height. Ticket cards show named route, separate Tehran departure/arrival dates and minute-only times, duration, cabin, total capacity and blue selected state. 39 Web Sales tests and scoped lint/typecheck pass; shared UI, range semantics and return query unchanged.

- PC-A people-step follow-up READY_FOR_REVIEW: customer and passenger selection/birthdates share one step; inline customer/passenger creation uses existing Customers public API, preserving existing passengers and deduplicating selections. 35 Sales Web tests, scoped lint/typecheck and production build passed. No edits to concurrent Customers/Contracts/Prisma work or IAM permissions; authenticated UI creation not claimed.

- PC-A compact-form/dashboard follow-up READY_FOR_REVIEW: bounded compact form, compact service choices, independent dashboard/list loading and explicit network/session errors. Production build lacked NEXT_PUBLIC_API_BASE_URL; configured the public localhost API in ignored apps/web/.env.local. 27 Sales Web tests, scoped lint and production typecheck/build passed; no IAM, shared UI, schema or other task edits.

- Latest follow-up verified: 20 Web Sales tests, 28 API Sales tests, scoped lint, Web/API typecheck and production builds passed; updated Web running on port 3100. No migration/dependency changes; same branch and Draft PR #90.

- Current PC-A follow-up reserves Sales form/model/tests, local date-range filter and Sales domain tests/validation: FLIGHT excludes BUS/TRAIN, transfer is a direction flag without detail requirements, first step has no travel date, available flights are ascending future offers with an optional single-calendar date-range filter. Contract travel date still derives from selected travel/service dates for passenger age and validation. No shared calendar/schema/dependency changes.

- Flight UX/output follow-up: PC-A reserves Sales form/model/print-template/tests and docs. Combine flight directions in one detail step; business is output-only service metadata, not an inventory/cabin override. Add four explicitly synthetic Tehran/Antalya offers through Ticket public service on existing HQ branch, without IAM mutations. Printable output is a clearly labelled draft until Reservations supplies real issuance identifiers; no fabricated PNR/e-ticket or Finance release.

- Current follow-up: PC-A reserves Ticket Catalog workspace mount/test and task docs to remove only the scheduled-offer publication panel while retaining Repeat Ticket. Existing published offers/API remain intact. Authorized Turkey/Antalya local reference maintenance runs through the owner service with explicit offline audit attribution; no IAM grants/sessions or direct private-table writes.

- Current follow-up (PC-A): reserve Sales form/model/tests and task docs for parent service selection (both directions initially selected, then expandable independent choices) and a persistent dashboard return link. Turkey/Antalya reference creation is authorized through the existing Master Data public interface only; no private table writes or Master Data code ownership transfer.

- Follow-up route/directional services: PC-A reserves Sales Web/model/tests, Sales domain validation/tests and task docs on the same branch/PR #90. Searchable country/city inputs with reference-backed Tehran/Antalya defaults; independent flight/transfer directions use existing `SalesServiceInput.metadata.direction` (OUTBOUND/RETURN), produced by Sales and preserved in the Reservations v1 snapshot. Legacy services without direction retain their prior trip-type behavior. No schema, migration, dependency or other module changes.

- Route/directional follow-up delivered: country-filtered searchable city menus, reference-backed Iran/Tehran and Turkey/Antalya defaults, independent direction checkboxes, selected-service substeps and transfer date/pickup/dropoff details. Web Sales 9 tests and API Sales 26 tests (all 15 flight/transfer combinations), Web/API typecheck, Sales lint and Web/API production builds passed. Earlier operational role approval gate resolved by explicit user approval and four audited local grants, without changing branch memberships. Authenticated browser QA is not claimed; unrelated local Customers/Documents changes remain excluded.

- Follow-up 2026-09-05 approved by owner: Ticket Catalog persistence/public API, Reservations intake and route-first Sales UX. PC-A/SALES-CONTRACTS-001 reserves Ticket Catalog/Reservations runtime, versioned contracts/root exports, additive Migration, permission seed and AppModule wiring; existing Migration/Central Docs locks remain assigned. No dependency changes. Compatibility/producer-consumer plan: docs/tasks/SALES-CONTRACTS-001.md.

- درخواست مالک در 2026-09-03: Vertical Slice واقعی قراردادها، فروش و تخصیص خدمات روی Branch مستقل `codex/pc-a-sales-contracts` و Draft PR #90 ادامه یابد. `COMPUTER_ID=PC-A`.
- Base جاری `origin/develop@85204a4` شامل Merge PR #89، Handoff رسمی PR #91 و PR #92 است؛ Mergeهای معمولی `8d3b89d` و `dbaf450` وارد Branch فروش شدند، تعارض اسناد با حفظ هر دو Handoff حل شد و Rebase/Force Push انجام نشد.
- محدوده رزروشده: Prisma Schema و Migration افزایشی Sales، Permission Seed، قرارداد عمومی versioned و root export فروش، `apps/api/src/sales/**`، `apps/web/src/modules/sales/**`، Routeهای `/sales` و `/sales/contracts/new`، تست‌ها و اسناد همین Task.
- Lock state: `Migration Owner = PC-A/SALES-CONTRACTS-001`، `Central Docs Owner = PC-A/SALES-CONTRACTS-001` و `Sales shared-contract/root export Owner = PC-A/SALES-CONTRACTS-001`. Dependency/Lockfile برابر `RELEASED` می‌ماند و تغییر نمی‌کند.
- مرز بین‌ماژولی: Customers، Ticket Catalog، Master Data، Finance، Reservations، Documents و Legal Entity فقط از Public Contract/Port مصرف می‌شوند؛ Query مستقیم جدول یا Import Repository/Infrastructure خصوصی ممنوع است.
- PR #85، کد PC-B، `main` و `develop` دست‌نخورده می‌مانند؛ Merge، Cherry-pick، Rebase و Force Push مجاز نیست.
- نتیجه: قرارداد عمومی v1، Prisma/Migration افزایشی، Permission Seed، Repository/API واقعی، Audit/Scope/Lock/Idempotency، محاسبه مانده فقط از تأیید Finance، صف پایدار ReservationRequest و فرم تمام‌صفحه هفت‌مرحله‌ای تکمیل شد.
- Gate پس از آخرین Merge: ۳۱ Migration روی PostgreSQL 18 خالی، Seed دوباره‌پذیر، Full lint/typecheck، ۱٬۴۸۵ تست و Full Production Build موفق‌اند. Ticket offer در زمان تأیید تا انتشار Runtime Public API ماژول مالک به‌صورت fail-closed رد می‌شود و داده ساختگی وجود ندارد.
- Commits: `7eba1b2` (contract/database)، `d1ecb63` (backend/API)، `fc61a4e` (full-page web) به‌همراه Commit نهایی hardening/docs. انتشار فقط روی همان Draft PR #90 انجام می‌شود.

## AGENCY-B2B-INTEGRATIONS-001 — PC-B — READY_FOR_REVIEW

- درخواست و واگذاری صریح مالک محصول در 2026-09-05: مانع قبلی PR #90 رفع‌شده تلقی شود و اتصال عملیاتی آژانس‌ها شامل آدرس پایه، پروفایل شعبه‌ای، قرارداد B2B، سیاست اعتبار و نرخ توافقی پیاده‌سازی شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-agency-b2b-integrations` از `origin/develop@092109d`؛ Branch و تغییرات PC-A/PR #90 دست‌نخورده و فقط از قراردادهای عمومی مصرف می‌شوند.
- محدوده رزروشده: `MasterOrganizationAddress` در مالکیت Master Data؛ مدل‌ها، API و UI ماژول B2B/Agencies برای پروفایل شعبه‌ای، قرارداد، سیاست اعتبار و نرخ توافقی؛ قراردادهای عمومی نسخه‌دار؛ Migration افزایشی؛ تست و اسناد همین واحد کار.
- انتقال قفل محدود: `Migration Owner = PC-B/AGENCY-B2B-INTEGRATIONS-001`، `B2B shared-contract/root export Owner = PC-B/AGENCY-B2B-INTEGRATIONS-001` و `Central Docs Owner = PC-B/AGENCY-B2B-INTEGRATIONS-001`. قفل Dependency/Lockfile رزرو نمی‌شود. هماهنگی انتقال در PR #90 ثبت شده است.
- مرز ممنوع: Query یا FK مستقیم به جدول‌های Sales/Finance، تغییر Migrationهای PR #90، تغییر Branchهای PC-A، داده ساختگی مالی یا PII واقعی. B2B مالک قرارداد/سیاست اعتبار/نرخ توافقی است و exposure مالی فقط از Port عمومی Finance خوانده می‌شود.
- فرض ظرفیت: نسبت خواندن به نوشتن حدود `20:1` و اوج کمتر از `50 QPS`؛ هدف پیشنهادی `p50<150ms`، `p95<300ms`، `p99<600ms`، SLO برابر `99.9%`، `RPO<=24h` و `RTO<=4h`. هویت سازمان مشترک است و پروفایل عملیاتی با Branch scope و deny-by-default کنترل می‌شود.
- نتیجه: آدرس پایه سازمان، پروفایل عملیاتی شعبه‌ای، قرارداد B2B، سیاست اعتبار و نرخ توافقی با Migration افزایشی، قرارداد عمومی نسخه‌دار، API مجوزمحور و Popup آژانس پیاده‌سازی شدند. تماس‌ها ماسک‌شده می‌مانند، تاریخ‌ها از DatePicker مشترک‌اند و exposure مالی تا انتشار Adapter مالک Finance صریحاً `UNAVAILABLE` است و صفر ساختگی نمایش داده نمی‌شود.
- اعتبارسنجی: تمام Migrationها روی PostgreSQL موقت خالی اعمال شدند و ۶ جدول، قیود و ۲۲ Index جدید تأیید شدند؛ Prisma format/validate/generate، lint، typecheck، ۲۱ تست هدفمند و Production Build وب با ۳۴ Route موفق‌اند. Full Test همه بسته‌های تغییریافته را عبور داد؛ تنها شکست باقی‌مانده assertion متنی قدیمی Customer روی CRLF ویندوز است و هیچ فایل Customer در این Task تغییر نکرده است.
- تحویل: PR [#98](https://github.com/nirvanamahlou/Rubi/pull/98) به `develop` برای Review آماده است و قفل‌های Migration، B2B shared-contract/root export و Central Docs تا تعیین تکلیف PR نزد `PC-B/AGENCY-B2B-INTEGRATIONS-001` باقی می‌مانند؛ Dependency/Lockfile آزاد است. Merge خودکار انجام نمی‌شود.

## MARKETING-001E-COMMUNICATIONS-RESTORE — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-05: بخش «ارتباطات» به فضای کاری مارکتینگ بازگردد و مسیر، محتوای آزمایشی و عملیات اختصاصی آن قابل استفاده بماند. `COMPUTER_ID=PC-B`.
- Follow-up صریح مالک در 2026-09-05: فرم واقعی «سناریو جدید»، ویرایش اتوماسیون و ایجاد مرحله عملیاتی شود؛ Actionهای مخاطب کمپین، منابع ورود، کد تخفیف و پیشنهاد ویژه با خروجی Excel هم‌راستا شوند؛ و فرم محتوا نوع‌های بیشتر و دو شعبه نیایش سیر سحر/جهان باستان داشته باشد. این گسترش همچنان فقط در `apps/web/src/modules/marketing/**` و تست/ثبت همین Work Item است.
- Branch مستقل `codex/pc-b-marketing-communications-restore` از `origin/develop@092109d`؛ محدوده فقط `apps/web/src/modules/marketing/**`، تست‌های همان ماژول و ثبت محدود همین Work Item در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md` است.
- این Task هیچ Schema/Migration/Seed، API/Shared Contract، Dependency/Lockfile، فایل Navigation مرکزی یا داده واقعی مشتری را تغییر نمی‌دهد. ارتباطات فقط State آزمایشی محلی دارد و ارسال واقعی پیام انجام نمی‌شود.
- معیار پذیرش: کارت و سکشن «ارتباطات» در Hub و URL مستقیم باز شود، Breadcrumb عنوان صحیح نشان دهد، دکمه «ارسال پیام» فقط در بخش ارسال پیام و دکمه «قالب جدید» در بخش قالب‌ها فعال باشد، RTL و تست‌های قرارداد مارکتینگ حفظ شوند.
- نتیجه: کارت «ارتباطات» با چهار تب ارسال پیام، ارسال‌های زمان‌بندی‌شده، تاریخچه و قالب‌ها بازگشت. تب حذف‌شده «عملکرد کانال‌ها» بازگردانده نشد؛ داده هر تب مستقل است و فهرست‌ها جست‌وجو، وضعیت، بازه تاریخ، Excel، مشاهده، ویرایش و پاور فعال/غیرفعال دارند.
- فرم ارسال، کمپین، مخاطب، قالب، روش ارسال، DatePicker و چهار کانال دارد و حداقل یک کانال، متن و تاریخ زمان‌بندی را اعتبارسنجی می‌کند. دکمه «ارسال پیام» فقط همان فرم را Submit می‌کند و «قالب جدید» فقط در تب قالب‌ها فرم مرتبط را باز می‌کند.
- Follow-up تکمیل شد: «سناریو جدید» فرم عملیاتی رویداد، مخاطب، کانال، هدف، اقدام، تأخیر، مالک، وضعیت و بازه تاریخ دارد و رکورد ساخته‌شده را همان‌جا نمایش می‌دهد. در سازنده اتوماسیون، ویرایش مشخصات و افزودن مرحله با فرم معتبر و نمایش فوری مرحله جدید فعال است.
- Actionهای افزودن مخاطبان کمپین، منابع ورود، کد تخفیف و پیشنهاد ویژه کنار خروجی Excel هم‌راستا شدند. فرم‌های محتوای جدید و بارگذاری فایل، ده نوع محتوای مرتبط و شعبه‌های «نیایش سیر سحر» و «جهان باستان» را ارائه می‌کنند و Upload همچنان فقط قرارداد عمومی Documents را مصرف می‌کند.
- اعتبارسنجی: ۱۸/۱۸ تست هدفمند مارکتینگ، Web lint، Web typecheck پس از Build قراردادهای workspace و Production Build با ۳۴ Route پاس شدند. Smoke مستقیم Hub و `/marketing?section=communications` پاسخ ۲۰۰، همه چهار عنوان و نبود «عملکرد کانال‌ها» را تأیید کرد. اجرای کامل محلی Web به‌جز یک تست قدیمی Customer وابسته به LF روی Checkout ویندوز (`625/626`) پاس شد؛ فایل Customer خارج از Scope و دست‌نخورده ماند.

## CUSTOMER-DOCUMENTS-AGENCIES-INTEGRATION-001 — PC-B — READY_FOR_REVIEW

- واگذاری صریح مالک محصول در 2026-09-05: نجات و سازگارکردن قابلیت‌های سالم PR #85 با آخرین Documents، اتصال واقعی Customer 360 به اسناد، اتصال عملیاتی آژانس‌ها به Organizationهای اطلاعات پایه و حذف شناسه موقت از جریان Logo. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-customer-documents-agencies-integration` از `origin/develop@a56b62e`؛ این Branch جایگزین فنی و به‌روز PR #85 است و Branch اصلی PR #85 بازنویسی، Merge یا Force Push نمی‌شود.
- محدوده رزروشده: reconciliation اتصال Customer/Documents، مصرف Public Contract اسناد در Customer 360، اتصال Agency UI/API به Master Organization از مسیر عمومی، جریان امن Logo Reference، Adapterها و تست‌ها و سند اختصاصی همین Task.
- محدوده ممنوع: Prisma Schema/Migration/Seed، فایل‌ها و Branch فروش، Sales shared contract، Finance، Reservations، Ticket Catalog، Query مستقیم جدول ماژول دیگر، تغییر مستقیم `main`/`develop`، Force Push و داده واقعی مشتری/مسافر/سند.
- قفل‌های `Migration Owner`، `Central Docs Owner` و `Sales shared-contract/root export Owner` همچنان نزد `PC-A/SALES-CONTRACTS-001` باقی می‌مانند. Dependency/Lockfile آزاد است و در این Task تغییر نمی‌کند.
- قراردادهای بین‌ماژولی فقط versioned و عمومی مصرف می‌شوند؛ تغییر افزایشی احتمالی باید backward-compatible، دارای Contract Test و محدود به Documents/Master Data مرتبط باشد.
- نتیجه: فیلتر canonical اسناد و پنل واقعی Customer 360 بازیابی و با Documents فعلی سازگار شد؛ مراجع غیرفعال قدیمی مشتری بدون ورود به انتخاب‌های جدید حفظ می‌شوند؛ صفحه آژانس‌ها Organizationهای نقش `AGENCY` و تماس ماسک‌شده را از API عمومی اطلاعات پایه مصرف می‌کند؛ جریان Logo فقط پس از ایجاد شناسه پایدار Upload و با Optimistic Lock متصل می‌شود و retry فایل تکراری نمی‌سازد.
- موارد فاقد مدل مالک: آدرس پایه سازمان و پروفایل عملیاتی آژانس شامل قرارداد/اعتبار/نرخ توافقی فقط در سند اختصاصی با وضعیت `BLOCKED_FOR_MIGRATION` ثبت شدند و هیچ Schema یا داده ساختگی ساخته نشد.
- اعتبارسنجی: Prisma format/validate/generate بدون تغییر Schema، lint، typecheck، تست کامل Monorepo و تست رفتاری Adapter آژانس (`1,500` تست موفق و `70` تست اختیاری PostgreSQL skip) و Production Build با `34` Route موفق‌اند. `package.json` و Lockfile تغییری ندارند.

## DOCUMENTS-006-CROSS-MODULE-CONNECTIONS — PC-B — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-05: تمام ارتباط‌های داخلی و خارجی «اسناد و فایل‌ها» کامل و قابل استفاده شوند. `COMPUTER_ID=PC-B`؛ پیام پیگیری مالک مجوز تحویل‌گرفتن اتصال‌های Documents از کارهای باز PC-A است، اما Branchهای PC-A حفظ و فقط‌خواندنی می‌مانند.
- Branch مستقل `codex/pc-b-documents-connections` از `origin/develop@a56b62e` در Worktree `C:\Users\admin\Rubi-documents-connections`؛ توسعه مستقیم روی `develop` یا `main` ممنوع است.
- Pull Request: [#95](https://github.com/nirvanamahlou/Rubi/pull/95) به `develop`؛ Merge خودکار انجام نمی‌شود و انتشار نهایی منوط به Review و CI است.
- Phase A رزروشده فقط `apps/web/src/modules/documents/**`، تست‌های همان ماژول و `docs/tasks/DOCUMENTS-006-CROSS-MODULE-CONNECTIONS.md` است: ارتباط هر دامنه با مقصد داخلی، کارت ارتباط قابل‌کلیک، نام‌های فارسی، بازگشت امن و حالت روشن برای مقصدهای هنوز منتشرنشده.
- PRهای فعال PC-A یعنی #85 اتصال Customer Documents و #90 Sales Contracts در این Phase دست‌نخورده‌اند. پس از انتشار قراردادهای آن‌ها، Phase B فقط Public Contract/Port نسخه‌دار را مصرف می‌کند؛ Query مستقیم جدول/Repository ماژول دیگر ممنوع است.
- این Phase هیچ Schema/Migration/Seed، Documents shared contract، API، Dependency/Lockfile، Shared Calendar یا فایل ماژول Customer/Sales/Reservations/Finance را تغییر نمی‌دهد. `Migration Owner` و `Central Docs Owner` فعال PC-A بازپس‌گیری نمی‌شوند؛ تغییر این entry و سند Task تنها ثبت محدوده Documents است.
- پذیرش Phase A: تمام دامنه‌های CUSTOMER_IDENTITY، SALES، TRAVEL، PROCUREMENT، FINANCE، HUMAN_RESOURCES، ORGANIZATION، REPORTING، BRAND و GENERAL مقصد فارسی مشخص دارند؛ کاربر از سکشن یا تب ارتباطات با کنترل کیبورد به بخش مرتبط می‌رود؛ مقصد ناموجود هرگز به‌عنوان اتصال واقعی نمایش داده نمی‌شود؛ تست، lint، typecheck، build و Browser QA موفق‌اند.
- نتیجه Phase A: نمای کلی اکنون ۱۰ کارت رنگی برای مسیرهای آرشیو دارد؛ هر کارت آرشیو داخلی Domain را باز می‌کند و ۹ Domain دارای دکمه رفتن به Route واقعی ماژول‌اند. `GENERAL` صریحاً «داخل آرشیو» است و اتصال خارجی جعلی ندارد. تب ارتباطات جزئیات سند، نام فارسی ماژول و نوع Relation، حالت بدون پرونده و لینک احراز‌شده مقصد را نمایش می‌دهد؛ source فنی `documents-demo` به کاربر نشان داده نمی‌شود.
- اعتبارسنجی: هر ۶۰۶ تست Web (شامل ۷ تست هدفمند ارتباطات)، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. Browser QA روی `http://localhost:3100/documents` نمایش ۱۵ سند آزمایشی، هر ۱۰ کارت، بازشدن آرشیو مشتری، الزام فیلتر، رفتن واقعی به `/customers` و نمایش/لینک تب ارتباطات یک سند را تأیید کرد.
- Handoff: لینک مقصد فقط `Document`/`Relation` opaque را حمل می‌کند و هیچ `sourceEntityId` را افشا نمی‌کند؛ مقصد مجوز خودش را دوباره کنترل می‌کند. اتصال exact-record و case picker بین‌ماژولی در Phase B تنها پس از انتشار Public Reference Port ماژول مالک افزوده می‌شود و PRهای فعال PC-A #85/#90 دست‌نخورده‌اند.

## DOCUMENTS-005-ARCHIVE-ACTIONS-FIX — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-09-03: ابزارهای مدیریت آرشیو باید داخل همان بخش، فهرست اختصاصی و واقعی خود را باز کنند و فرم‌های عملیات رکورد پس از تکمیل فیلدها بازخورد روشن و ارسال قابل اتکا داشته باشند. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-archive-actions-fix` از `origin/develop@85204a4`؛ محدوده فقط `apps/web/src/modules/documents/**`، تست‌های همان ماژول و `docs/tasks/DOCUMENTS-005-ARCHIVE-ACTIONS-FIX.md` است.
- این Task هیچ Schema/Migration/Seed، Contract، API، Dependency/Lockfile، Shared Calendar یا فایل مرکزی وضعیت را تغییر نمی‌دهد و قفل‌های فعال `PC-A/SALES-CONTRACTS-001` را دریافت نمی‌کند.
- پذیرش: هر چهار ابزار آرشیو با عنوان و فیلتر مخصوص داخل «مدیریت آرشیو» باقی می‌مانند؛ بازگشت به ابزارها روشن است؛ فرم‌های عملیات با Submit استاندارد، پیام اعتبارسنجی فارسی و خطای Backend قابل مشاهده کار می‌کنند.
- نتیجه: هر چهار ابزار داخل مدیریت آرشیو فهرست اختصاصی خود را باز می‌کنند و پاک‌سازی، فیلتر پایه ابزار را نگه می‌دارد. فرم‌های عملیات و حذف Submit استاندارد و پیام خطای روشن دارند و مقادیر خالی فرم ویرایش نیز صریح ارسال می‌شوند.
- اعتبارسنجی: `603/603` تست Web، lint، typecheck و Production Build با ۳۴ Route موفق‌اند. Browser QA روی لوکال، فعال‌ماندن منوی مدیریت برای هر چهار ابزار، فهرست ۱۵ سند تحت مسئولیت، پیام دلیل کوتاه، ذخیره Dropdown، آرشیو واقعی و بازیابی همان سند از ابزار اختصاصی را تأیید کرد؛ تغییرات موقت داده بازگردانده شدند.

## MARKETING-001D — PC-B — READY_FOR_REVIEW

- ادامه درخواست صریح مالک در 2026-09-05: اصلاح ناوبری Breadcrumb سکشن‌های مارکتینگ، حذف ارتباطات و دکمه بازگشت، تکمیل فرم‌های «مخاطبان کمپین» و «منابع ورود»، حذف منوی سه‌نقطه عملیات، ادغام قواعد استفاده در فرم‌های پیشنهاد/کد تخفیف و اتصال بارگذاری دارایی مارکتینگ به API عمومی موجود «اسناد و فایل‌ها». محدوده افزوده فقط مصرف `apps/web/src/modules/documents/api/client.ts` و Dialog عمومی موجود Documents از Web مارکتینگ است؛ هیچ Query مستقیم Repository، تغییر API، Shared Contract، Schema/Migration/Seed، Dependency/Lockfile یا فایل مرکزی تحت قفل PC-A انجام نمی‌شود.
- ادامه درخواست صریح مالک در 2026-09-05: تکمیل تجربه عملیاتی همه صفحات مارکتینگ شامل حذف گزارش‌ها/عضویت تبلیغاتی/عملکرد کانال و Actionهای نابجا، اصلاح RTL کمپین‌ها و Breadcrumb پویا، تکمیل فرم‌ها و قانون‌های سگمنت/امتیازدهی، فیلتر بازه تاریخ مشترک، داده‌های آزمایشی متناسب، دکمه غیرفعال‌سازی و خروجی Excel محلی. `COMPUTER_ID=PC-B`.
- Branch ادامه مستقل `codex/pc-b-marketing-workspace-completion` از `origin/develop@85204a4`؛ محدوده `apps/web/src/modules/marketing/**`، تست‌های همان ماژول و فقط برای Breadcrumb پارامتری مارکتینگ فایل‌های `apps/web/src/components/layout/app-shell.tsx`، `apps/web/src/lib/navigation.ts` و `apps/web/src/lib/navigation.spec.ts` به‌همراه ورودی‌های محدود همین Task در اسناد وضعیت است.
- `Central UI Owner = PC-B/MARKETING-001D` فقط برای سه فایل Breadcrumb بالا؛ `DatePicker` و سایر اجزای مشترک Rubi فقط مصرف می‌شوند. پیاده‌سازی API/Persistence مارکتینگ، Schema/Migration/Seed، Shared Contract، Dependency/Lockfile یا داده واقعی تغییر نمی‌کند؛ تنها بارگذاری صریح فایل کاربر از Client عمومی موجود Documents عبور می‌کند. فایل‌های تصویری پیوست صرفاً مرجع بصری‌اند و دستور اجرایی محسوب نمی‌شوند.
- نتیجه Follow-up: گزارش‌ها، عضویت‌های تبلیغاتی و عملکرد کانال‌ها حتی از شاخه‌های مرده Navigation حذف شدند؛ خروجی داشبورد وجود ندارد، کمپین‌ها RTL هستند و Breadcrumb با سکشن انتخاب‌شده تکمیل می‌شود. فرم سگمنت فقط در تب سگمنت، قانون‌های سگمنت و امتیازدهی، قالب/محتوا/پیشنهاد/سفر، سناریوهای آماده، بازخورد دکمه‌ها و داده‌های متمایز هر تب عملیاتی شدند.
- تمام فهرست‌های مرتبط فیلتر «از تاریخ/تا تاریخ» با `DatePicker` مشترک و انتخاب Grid ماه/سال دارند؛ رکوردها کنترل پاور قرمز برای غیرفعال‌سازی و خروجی واقعی Excel محلی با خنثی‌سازی Formula Injection دارند. به‌جز بارگذاری صریح دارایی محتوایی که در Documents ذخیره می‌شود، این رفتارها State محلی Preview هستند و هیچ ارسال یا اثر مالی ایجاد نمی‌کنند.
- اعتبارسنجی: Web typecheck، Web lint، همه `603/603` تست Web و Production Build با ۳۴ Route موفق‌اند. نسخه همین Branch روی `http://localhost:3100` فعال است و مسیر محافظت‌شده مارکتینگ طبق انتظار به Login پاسخ می‌دهد. نشست مرورگر آزمایشی جدا از نشست Chrome بود؛ برای جلوگیری از تغییر حساب یا رمز، ورود خودکار انجام نشد.
- Follow-up تصویر 486: ناوبری سکشن‌ها از History خام به Router رسمی Next منتقل شد و مسیر مستقیم کمپین اکنون Breadcrumb کامل «فضای کاری CRM / مارکتینگ / کمپین‌ها» می‌سازد. فیلد دیداری نسخه مورد انتظار، عبارت انگلیسی کنار ویرایش، کل تب A/B و دکمه تکراری «ایجاد کمپین» حذف شدند؛ فقط «افزودن کمپین جدید» باقی است و Dialog ساخت را باز می‌کند.
- اعتبارسنجی Follow-up: مسیر مستقیم، پارامتر `section` را در Server Page دریافت می‌کند؛ بنابراین محتوای کمپین و Breadcrumb «فضای کاری CRM / مارکتینگ / کمپین‌ها» از همان پاسخ اولیه هماهنگ‌اند و Back همچنان با `popstate` همگام می‌شود. `603/603` تست Web، lint، typecheck و Production Build ۳۴ Route موفق‌اند. کل زنجیره پردازش قدیمی `Rubi-documents-connections` از پورت ۳۱۰۰ کنار گذاشته و کش ساخت قدیمی ایزوله شد؛ Web/API همین Worktree به‌ترتیب روی ۳۱۰۰/۴۰۰۰ با پاسخ `200` فعال‌اند.

- درخواست صریح مالک در 2026-09-03: حذف اعلان‌ها و برچسب‌های Preview از صفحات مارکتینگ، هم‌ترازی Hub با رنگ و حرکت اطلاعات پایه، اصلاح RTL و History مرورگر، تکمیل دو سری نمودار داشبورد و ساده‌سازی فرم ساخت کمپین. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-marketing-navigation-polish` از `origin/develop@1e5c55e`؛ فایل `marketing.html` فقط مرجع بصری/داده‌ای است و دستور اجرایی محسوب نمی‌شود.
- محدوده رزروشده: `apps/web/src/modules/marketing/**`، تست‌های همان ماژول، `docs/tasks/MARKETING-001.md` و ورودی محدود همین Task در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`. هیچ فایل UI مرکزی، Navigation مرکزی، API، Persistence، Schema/Migration/Seed، Shared Contract، Dependency/Lockfile یا داده واقعی تغییر نمی‌کند.
- این Slice فقط تجربه Preview موجود را اصلاح می‌کند؛ همه دکمه‌ها همچنان بازخورد محلی دارند و هیچ پیام، ذخیره‌سازی، Analytics یا اثر مالی واقعی ایجاد نمی‌شود.
- نتیجه: اعلان‌ها، Badgeهای فنی و نوارهای توضیحی Preview حذف شدند؛ Hub با رنگ، Glow و حرکت کارت‌های اطلاعات پایه هم‌تراز شد؛ داشبورد دو سری واضح سرنخ/فروش دارد و دکمه ایجاد کمپین از آن حذف شد. سکشن‌ها و Dialog کمپین RTL هستند و انتخاب سکشن در History مرورگر ثبت می‌شود.
- فرم ساخت کمپین از ۹ به ۸ مرحله رسید؛ مرحله پیشنهاد، متن‌های حریم خصوصی/Preview، توضیحات زیر فیلدها و عبارت UTC حذف شدند و زمان شروع/پایان با DatePicker مشترک حفظ شد.
- اعتبارسنجی: `602/602` تست Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. Browser QA روی Desktop و Mobile `390×844`، برگشت واقعی مرورگر، دو سری نمودار، نبود متن‌های حذف‌شده و فرم هشت‌مرحله‌ای را تأیید کرد.
- قفل‌ها: `Marketing Web = PC-B/MARKETING-001D` تا تعیین تکلیف PR. Migration، Dependency/Lockfile، Shared Contract و Central UI برابر `RELEASED / UNASSIGNED` باقی می‌مانند. PR #89 اسناد در مبنای همین Branch ادغام شده و تغییر اسناد این Slice فقط به ورودی‌های Marketing محدود است.

## DOCUMENTS-004-HANDOFF — PC-B — READY_FOR_REVIEW

- درخواست مالک در 2026-09-03: پس از Merge موفق PR #89، پایان رسمی `DOCUMENTS-004-OPERATIONS` و انتقال اتمیک قفل‌های بعدی به `PC-A/SALES-CONTRACTS-001` فقط در اسناد ثبت شود. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-004-handoff` از `origin/develop@1e5c55e3b2d9dcc58c407d0ca205abed86b4c605`؛ محدوده فقط `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md`، `docs/tasks/DOCUMENTS-004-OPERATIONS.md` و `docs/tasks/DOCUMENTS-004-HANDOFF.md` است.
- Merge مرجع: PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شده و `DOCUMENTS-004-OPERATIONS` برابر `DONE/MERGED` است.
- آزادسازی قطعی Documents: `Documents shared-contract Owner = RELEASED / STABLE`، `Shared Calendar Owner = RELEASED / STABLE` و `Dependency/Lockfile Owner = RELEASED`.
- انتقال اتمیک بعدی: `Migration Owner = PC-A/SALES-CONTRACTS-001`، `Central Docs Owner = PC-A/SALES-CONTRACTS-001` و `Sales shared-contract/root export Owner = PC-A/SALES-CONTRACTS-001`.
- `Dependency/Lockfile Owner` برای Sales رزرو نمی‌شود و `RELEASED` می‌ماند؛ هر نیاز واقعی آینده باید با دلیل، فایل دقیق و Work Item جداگانه رزرو شود.
- مرز بین‌ماژولی: Documents فقط مالک نگهداری، نسخه‌بندی و دسترسی فایل است. Sales فقط قرارداد عمومی Documents را مصرف می‌کند و Query مستقیم جدول‌ها، Repository یا زیرساخت داخلی Documents ممنوع است.
- این Handoff هیچ کد، Prisma Schema، Migration، Seed، Dependency، Lockfile، فایل ماژولی، داده محلی یا Branch دیگری را تغییر نمی‌دهد. PR #90، Branch فروش، `main` و Source Branchهای Documents دست‌نخورده می‌مانند.

## DOCUMENTS-004-OPERATIONS — PC-B — DONE/MERGED

- درخواست مالک در 2026-09-03: ساده‌سازی جزئیات سند، فارسی‌سازی فعالیت/نگهداری، فیلترمحورشدن فهرست‌ها و اشتراک‌گذاری، فعال‌کردن پیگیری و عملیات گروهی، ویرایش و حذف دائمی امن همه رکوردها، برچسب «ناقص» و تکمیل Backend ابزارهای باقی‌مانده مدیریت آرشیو. `COMPUTER_ID=PC-B`.
- Branch مستقل `codex/pc-b-documents-workflows` از `origin/develop@9608607` در Worktree تمیز `C:\Users\admin\Rubi-documents-workflows` ساخته و سپس با `origin/develop@6ac2dfc` همگام شد؛ PR #89 با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` آن را وارد `develop` کرد و `main` دست‌نخورده ماند.
- محدوده رزروشده: `apps/web/src/modules/documents/**`، `apps/api/src/documents/**`، قرارداد افزایشی Documents در `packages/contracts/src/documents/**`، مدل و Migration افزایشی Documents در `packages/database/prisma/**`، تقویم مشترک `apps/web/src/components/ui/date-picker*`، تست‌های همین Slice و اسناد همین Work Item.
- هماهنگی قفل: Task `MASTER-004-FORM-FOLLOWUP` با Commit `34066f6` قفل Central Docs را صریحاً آزاد کرد و هیچ فایل Documents را تغییر نداد. قفل‌های Migration، Documents shared-contract و Central Docs تا Merge PR #89 نزد `PC-B/DOCUMENTS-004-OPERATIONS` بودند؛ اکنون مالکیت Documents contract برابر `RELEASED / STABLE` و Dependency/Lockfile برابر `RELEASED` است و Migration/Central Docs طبق Handoff بالا به `PC-A/SALES-CONTRACTS-001` منتقل می‌شوند.
- حذف دائمی فقط با مجوز مدیریت نگهداری، تأیید صریح کاربر، کنترل Branch/Domain، رد Legal Hold و پاک‌سازی رکوردهای وابسته و Object ذخیره‌شده مجاز است. حذف منطقی جدید ساخته نمی‌شود؛ بازیابی فقط برای اسناد `ARCHIVED` باقی می‌ماند.
- فهرست‌های عملیاتی تا انتخاب حداقل یک فیلتر داده نشان نمی‌دهند؛ نمای کلی KPI/کارهای من مستثنا است. خروجی از UI حذف می‌شود و اشتراک‌گذاری همچنان لینک داخلی احراز‌شده و Permission-aware است، نه لینک عمومی.
- نتیجه: جزئیات سند ساده و فارسی شد؛ نوع فایل به‌صورت پسوند نمایش داده می‌شود و متن‌های SHA/MIME/منبع فنی و مسیر پیشنهادی حذف شدند. ویرایش، حذف دائمی، آرشیو/بازیابی، برچسب ناقص و عملیات گروهی به API و دیتابیس واقعی متصل‌اند. اشتراک‌گذاری فیلتر و جست‌وجو دارد و ابزارهای باقی‌مانده آرشیو به فهرست‌های واقعی متصل شدند.
- اعتبارسنجی: ۱٬۴۷۰ تست موفق و ۷۰ تست اختیاری PostgreSQL رد شدند؛ lint، typecheck و Production Build کامل Monorepo موفق است. هر ۳۰ Migration روی PostgreSQL خالی و Migration جدید روی دیتابیس محلی اعمال شد. بسته آزمایشی ۷ سند `readyForViewing=true` است و Smoke مرورگر فیلترمحوربودن، ۱۳ نتیجه جست‌وجو، عملیات گروهی، Dropdown ویرایش، `.PNG` و حذف متن‌های فنی را تأیید کرد.
- وضعیت انتشار: PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شد؛ Task برابر `DONE/MERGED` و قفل‌های اجرایی آن پایان‌یافته‌اند.
- Follow-up مالک در 2026-09-03: انتخاب ماه و سال در تقویم فرم‌های اسناد نباید Dropdown باشد و باید با Grid هم‌تم Rubi انجام شود. `Shared Calendar Owner` تا Merge PR #89 برابر `PC-B/DOCUMENTS-004-OPERATIONS` بود و اکنون `RELEASED / STABLE` است؛ API عمومی DatePicker، مقدار ISO Gregorian، Dependency و Lockfile بدون تغییر ماندند.
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

## CUSTOMER-DOCUMENTS-001 — PC-A — READY_FOR_REVIEW

- درخواست صریح مالک در 2026-09-03: جایگزینی وضعیت «در انتظار زیرساخت مدارک» در پرونده ۳۶۰ مشتری با اتصال واقعی به ماژول ادغام‌شده Documents. `COMPUTER_ID=PC-A`.
- Branch مستقل `codex/pc-a-customer-documents-integration` از `origin/develop@9608607`؛ کار مستقیم روی `develop` یا `main`، Merge خودکار، Force Push و حذف Branch ممنوع است.
- محدوده رزروشده: رابط و Client ماژول Customers، فیلتر افزایشی و backward-compatible قرارداد عمومی Documents، DTO/Service/Repository و تست‌های محدود Documents برای فهرست منبع، سند Task و ورودی‌های همین Work Item در اسناد مرکزی.
- مرز دامنه: Customers فقط مصرف‌کننده قرارداد عمومی Documents است؛ Binary، metadata، version، confidentiality، scan و archive نزد Documents می‌ماند. Query مستقیم جدول Documents از Customers و import کد داخلی Web ماژول Documents ممنوع است.
- امنیت: فهرست و بارگذاری فقط با Session، Permission، Domain و Branch scope موجود Documents انجام می‌شود؛ فایل تا نتیجه اسکن معتبر قابل دریافت نیست. شماره پاسپورت و داده semantic هویتی در Customers ذخیره نمی‌شود و `DEC-OPEN-006` همچنان Gate آن داده‌هاست.
- قفل‌ها: `Documents public list-filter contract = PC-A/CUSTOMER-DOCUMENTS-001` و `Central Docs Owner = PC-A/CUSTOMER-DOCUMENTS-001`. قفل‌های Migration، Schema، Seed و Dependency/Lockfile رزرو نمی‌شوند. قفل‌های `MASTER-004-FORM-ALIGNMENT` با Merge PR #83 / Commit `9608607` پایان یافته‌اند.
- نتیجه: فهرست exact-source، کنترل all-or-none، پنل Customer 360، بارگذاری امن و Stateهای Loading/Empty/Unauthorized/Forbidden/Error تکمیل شد. Full lint/typecheck/build و ۱۴۷۰ تست پاس؛ ۷۰ تست PostgreSQL اختیاری skip شد. قفل‌های این Work Item تا Merge/Handoff فعال می‌مانند.

## MASTER-004-FORM-ALIGNMENT — PC-B — READY_FOR_REVIEW

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

## LOCAL-UNIFIED-3100-0909 — PC-A — IN_PROGRESS

User-authorized local composition on codex/pc-a-local-unified-3100-0909. Base 385efaa (latest local Sales); consume sidebar handoff efe6287 and Reservations 0946bdd. Scope: isolated Web shell, reservation routes/projections and task status. Preserve source worktrees, shared contracts, schema and dependencies. No merge or database mutation.

LOCAL-UNIFIED-3100-0909: READY_FOR_REVIEW. Independent branch; local Web 3100/API 4000 bind loopback. Verification recorded in PROJECT_STATUS.

## RESERVATIONS-ACTION-PANEL-003 — PC-A — IN_PROGRESS

User selected preview option 3. Scope: foundation Web action panel, selected-contract dialogs, workspace layout and tests on current isolated branch. No API, database, Sales or shared UI changes. Unknown forms remain explicit placeholders.

RESERVATIONS-ACTION-PANEL-003: READY_FOR_REVIEW; 34 tests, targeted lint, TypeScript and Web production build passed. Port 3100 restarted with option 3; primary API/database unchanged.

## PUBLISH-LATEST-0909 — PC-A — IN_PROGRESS

User explicitly authorized merging the complete latest local version, including global changes, into develop. Integration preserves grouped sidebar, Sales/Customers/Tour stack and Reservations option 3, plus develop UserMenu/profile, HR route alias and portal calendar fixes. No live database change. Final PR checks gate merge.

## NAV-FINANCE-TICKET-LABELS-0909 — PC-A — IN_PROGRESS

User requested moving Purchases into the Finance navigation group and using بلیط in visible Web copy. Scope: navigation grouping, Persian Web strings and corresponding existing test expectations. No domain/API/schema changes.

NAV-FINANCE-TICKET-LABELS-0909: READY_FOR_REVIEW. 57 targeted tests, Web lint, TypeScript and build passed; local port 3100 refreshed.

## NEUTRAL-DARK-MODE-0909 — PC-A — READY_FOR_REVIEW

User requests neutral dark surfaces with legible text and controls. Scope: shared theme tokens, shell backgrounds and Reservations theme-aware surfaces/status colors. Preserve current Finance grouping and ticket labels. No API/data changes.

Validation: 66 targeted tests passed, including seven contrast assertions; Web lint, TypeScript and production build (40 routes) passed. Local Web 3100 refreshed. Browser visual QA unavailable because the browser tool failed to start. Branch codex/pc-a-neutral-dark-mode builds on Finance/ticket-labels PR #117. No migration or API/database changes.

## HR-DARK-NAVIGATION-0909 — PC-A — READY_FOR_REVIEW

User follow-up to neutral dark mode. Reserve HR workspace/Frappe CSS, Navigation collapse state and scoped tests on codex/pc-a-hr-dark-navigation-fix from 3d08f07. Preserve existing light design and local latest stack. No domain/API/data changes; header date work stays outside scope.

Validation: 87 scoped tests, Web lint, TypeScript and production build (40 routes) passed; Web 3100 refreshed. No API/database restart or changes. Scoped reservations released.

## PUBLISH-DARK-HR-0909 — PC-A — READY_FOR_REVIEW

User explicitly authorized merging the latest Finance labels, dark theme and HR/navigation corrections into develop. Integrate current develop 679e516, retaining PC-B HR/agencies and header date; resolve shared shell conflict with both responsive header and neutral dark border. Synchronize three ticket validation strings in API with the mirrored Web proposal to satisfy the existing parity test. No local database migration or runtime switch. Final combined CI gates must pass before merge.

## RESERVATIONS-THEMED-FILTERS-0909 — PC-A — READY_FOR_REVIEW

User requests themed dropdown menus for the four Reservations queue filters. Reserve foundation workspace only; use existing shared Radix Select with RTL, labels and unchanged query values. Branch codex/pc-a-reservation-themed-filters from develop 0261b91. No shared component/API/data change.

Validation: 34 foundation tests, Web lint, production TypeScript and build (40 routes) passed. Local Web 3100 refreshed. Scope released; no API/database changes.

## CONTRACT-TERMS-SELECTION-0909 — PC-A — READY_FOR_REVIEW

User supplied a shared one-page terms PDF; preserve its exact bytes and download through the selected contract's مفاد action. Extend the existing accessible selection button hit area across the full reservation card. Scope: foundation panel/workspace CSS/tests, shared static PDF and task docs. Builds on themed filters branch to preserve the current local version. No PDF editing, API, database or migration changes.

Validation: foundation tests, Web lint, TypeScript and production build passed; source/asset SHA256 equal. Web3100 refreshed. Scoped reservation released.

## RESERVATIONS-PAGE-CLEANUP-0909 — PC-A — READY_FOR_REVIEW

User marked top processing link, refresh button, polling explanation and five section tabs for removal (tickets, hotels, vouchers, insurance, costs). Scope only reservation landing page and foundation navigation chrome. Keep polling, remaining tabs, action panel and processing route. Ticket approval workflow remains pending the user's financial-release clarification; no approval/backend changes here.

Validation: 34 tests, scoped lint, production TypeScript/build passed; Web3100 refreshed. Scope released.

## TRAVEL-DOCUMENT-HANDOFF-0909 — PC-A — READY_FOR_REVIEW

User explicitly requests execution of the agreed workflow: Reservations owns ticket preview/branding, supplier request/confirmation/cancellation and voucher issue; missing insurance is an acknowledged warning, not a block. Sales cannot view/render/download passenger documents before Finance delivery authorization. Reserve Reservations API/Web, Sales public consumption/pricing, Finance document-delivery runtime, additive Prisma schema/migration, IAM permission catalog/seed slice, public travel contracts and task docs. Producer/consumer: Reservations snapshots -> Sales/Finance through public services; B2B/Master Data/Documents existing public interfaces only. No third-party module edits, destructive migration, live IAM grants, merge or external sends. Preserve current branch stack and local data. Migration owner PC-A/TRAVEL-DOCUMENT-HANDOFF-0909; dependency lock unused.

TRAVEL-DOCUMENT-HANDOFF-0909 validation and local rollout completed; role grants pending explicit response, scope released for review. See docs/tasks/TRAVEL-DOCUMENT-HANDOFF-0909.md.

## RESERVATION-REFERENCE-FORM-0909 — PC-A — READY_FOR_REVIEW

User supplies reservation-form-contract-theme (1).pdf as the Reservation form layout. Base current local workflow branch 16dae5f to retain the authorized existing runtime; fetched develop 7d716af has unrelated agency changes. Reserve only Reservations Web document renderer/model/CSS/tests and scoped task docs. Reproduce the six-section English A4 navy/teal layout with actual selected-contract values, operational ordering/age and existing company/agency logo. Preserve voucher rendering, financial gate and existing workflow. Missing source fields remain unfilled; no sample passenger/provider data copied from the PDF. No API, schema/migration, dependencies, IAM grants or unrelated module edits. Validate print layout with synthetic data and update owned Web3100 after build.

RESERVATION-REFERENCE-FORM-0909: 49 tests, scoped lint/typecheck/build and rendered 1-/3-page A4 QA passed. Web3100 refreshed; API/data unchanged. Scope released; see docs/tasks/RESERVATION-REFERENCE-FORM-0909.md.

## PAYMENT-DIALOGS-0909 — PC-A — READY_FOR_REVIEW

Reserve Sales Web contract-payments component/tests and task docs only. Base 2a747c5 preserves current local stack. Show contract history in a dialog and separate add-payment dialog with receipt attachment below reference after successful save. Consume existing Documents public component; no API, schema, grants or other module edits.

PAYMENT-DIALOGS-0909: 10 targeted tests, scoped lint, typecheck, production build and isolated browser interaction passed. Scope released. No API, data or permission changes.

## CONFIRM-VOUCHER-0909 — PC-A — LOCAL_COMPLETE_PENDING_PUBLICATION

Reserve Reservations workflow transition/service/tests, Web workflow form/foundation styling/model/tests and docs. New request first column #FFC0C0; confirmation atomically issues voucher with existing insurance acknowledgement and Sales notification; financial release remains mandatory. Retain legacy confirmed-only voucher issue. No migration or live permission grants. Base 8297341 preserves local feature stack.

CONFIRM-VOUCHER-0909: 12 API/34 Web tests, scoped lint, typechecks/builds and both-theme color checks passed; local API4000/Web3100 health 200. Scope released. Push blocked by automatic approval review; GitHub reports origin Rubi is public, contrary to earlier private-repository description. Publication awaits explicit approval.

## RESERVATION-COMPACT-ENGLISH-0909 — PC-A — LOCAL_COMPLETE_PENDING_PUBLICATION

Reserve Reservations Web hotel-name display, queue styles and default calendar option in shared DatePicker (existing callers stay Persian), tests/docs. No backend/migration/grants. Publication remains pending approval for public origin.

RESERVATION-COMPACT-ENGLISH-0909: 60 Reservations/calendar tests plus default-calendar rendering and updated workspace tests passed; scoped lint/typecheck passed. Web 40-route build passed; Web3100 refreshed. Scope released. No public push while earlier approval remains pending.

## SEARCH-SHORTCUT-CONTRAST-0909 — PC-A — LOCAL_COMPLETE_PENDING_PUBLICATION

Reserve only AppShell global search shortcut styling and task docs. Explicit text/background contrast in light/dark header; retain keyboard behavior. No shared theme, API or permission changes. Local only; public publication remains unapproved.

SEARCH-SHORTCUT-CONTRAST-0909: 25 layout tests, scoped lint/typecheck and 40-route build passed. Web3100 refreshed; scope released. Local commit only.

## SYNC-DEVELOP-0909 — PC-A — LOCAL_COMPLETE_PENDING_PUBLICATION

User requests bringing colleagues Git fixes locally. Integrate reviewed origin/develop e07c0c6 into local d68a65f on independent branch, preserving all local Reservations/Sales/header changes. Scope integration/docs and resolution of actual conflicts only. Draft PR132 and other unmerged branches excluded. No incoming migration or dependency changes; no data/permission edits, remote merges or public push.

SYNC-DEVELOP-0909: local integration of develop e07c0c6 complete. 270 Web tests passed including isolated timeout retry; 120 API passed and 26 PostgreSQL tests skipped. Web/API lint/typechecks/builds passed; API4000/Web3100 refreshed and health verified. Scope released; no public push or remote merge.

## RESERVATION-TABLE-EXPORT-0909 — PC-A — LOCAL_COMPLETE_PENDING_PUBLICATION

Reserve Reservations Web queue table/projection/reference lookup/XLSX export/tests and docs. Real scoped API records; export all matching loaded pages with active filters/sort, no formulas or fabricated flags. No data mutation or permission grants; local only while public push approval is pending.

RESERVATION-TABLE-EXPORT-0909: 39 tests, scoped lint/typecheck/build and synthetic browser XLSX/selection QA passed; independent workbook read verified. Scope released after Web3100 refresh. No public push.

## HOTEL-GROUP-RATES-0910 — PC-A — IN_PROGRESS

User requests group hotel purchase rates from supplied HTML and explicitly authorizes local HR initialization plus all seven HR permissions for the dedicated Ramtin role. Reserve new Reservations rates UI/API and navigation entry, scoped task documentation. Preserve other work and public-origin publication hold. Existing canonical HR migrations only; no HR source changes or broad role seed. New rate persistence migration reservation must be checked before schema changes.

Migration reservation checked against fetched PC-B/B2B-CONTRACT-CREDIT-001: implementation/shared-code/migration reservations explicitly released in final handoff. Reserve Migration Owner = PC-A/HOTEL-GROUP-RATES-0910 for two additive Reservations-owned rate tables and FK reverse relations only; MasterTravelDirectory additive public rate reference lookup, navigation messages/icon/group entries and local API module wiring. No dependencies or B2B implementation edits.

HOTEL-GROUP-RATES-0910 final handoff: local implementation validated; Migration/shared-reference/navigation implementation locks RELEASED. API4000 running from this worktree, Web3100 stopped after update and blocked by execution policy despite user reconfirmation. See task report before runtime integration; separate tour-details work not merged. No public push.

## RESERVATION-PASSENGER-DOCUMENTS-0910 — PC-A — LOCAL_COMPLETE_PENDING_ACTIVATION

Base5b1d287; branch codex/pc-a-reservation-passenger-documents-0910. Reservations action-panel, passenger/document consumer API/Web, tests and runtime wiring completed. CustomerService canonical names are editable with existing permissions and version checks; issued snapshots stay immutable. Documents use canonical contract+passenger case references (general files reuse sales/SalesContract), existing archive/scan/access policies and one asset. No producer/schema/dependency edits. Eight API and 39 Web tests, scoped lint/typechecks, API/Web builds and synthetic browser QA passed. Read-only target verification found one linked passenger with an available name and existing edit permission. Implementation scope RELEASED. Tour integration retains runtime ownership; no listeners changed or tour merge performed. Local activation and public publication remain pending; see task report.

## FINANCE-DELIVERY-CONFIRM-0910 — PC-A — LOCAL_COMPLETE_PENDING_RESTART

Base92e99cf; reserve only FinanceDeliveryPanel Web UX and scoped validation/docs. Replace hidden global reason prerequisite with per-contract confirmation dialog. Existing finance read/approve permissions verified read-only. No API/schema/permission/data mutations or actual financial approvals. Local publication hold retained.

FINANCE-DELIVERY-CONFIRM-0910: scoped lint/typecheck, 9 Finance tests, 41-route production build and synthetic browser approval/revocation/cancel/required-reason checks passed. No actual approvals or permission changes. Implementation lock RELEASED. Web restart rejected by execution policy; existing user-started listener24460 retained. User must restart the existing PowerShell command. No public push.

## RESERVATION-EXTRA-COLUMNS-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Basea8160d7; reserve Reservations queue projection/runtime consumer wiring, Web model/feed/names/table/styles/tests and docs. Add services/seller/contract party/meal service/hotel arrangement notes from existing records and public Customer/IAM read services under existing permissions. No producer, schema, migration, grants or data edits. Public publication hold retained.
Additional scope: Reservations XLSX filter range must cover all current columns, replacing the old fixed15-column bound.
13 API and41 Web tests, scoped lint/typechecks and API/Web builds passed. API4000 refreshed; Web3100 retains user-started runtime and requires manual restart because tool startup remains blocked. Implementation scope RELEASED; local commit only.

## RESERVATION-TABLE-ACTIONS-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Base88c7c6b; reserve Web Reservations table checkbox actions/component, feed/status projection, scoped tests/docs. Existing workflow dialog/commands for request and voucher remain authoritative; no backend changes, financial gate bypass, actual sends or real issuance. Checked hotel confirmation means voucherIssued only. Local-only publication hold retained.
46 Web tests,7 existing workflow API tests, scoped lint/typecheck and41-route build passed. Synthetic browser verified dialog opening, insurance acknowledgement and conflict without false checkmark. No real mutations. Scope RELEASED; user-started Web awaits manual restart; no public push.

## CONTRACT-HOTEL-MEAL-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Based7d9e13. User clarified the source is the hotel master record. Scope narrowed to Reservations queue-name/meal projection and tests/docs only; Sales form scope released with own draft edits removed. Read-only verification: ROYAL WINGS has UALL; existing five contract snapshots omit a separate meal selection. Read hotel meal codes from existing Master Data response, preserve explicit contract selection precedence; no data/API/schema/grants. Public hold retained.
49 Reservations tests, scoped lint/typecheck and41-route Web build passed. Hotel UALL fallback and explicit contract precedence tested; no live writes. Scope RELEASED; Web awaits manual restart; public hold retained.

## RESERVATION-FORM-PREVIEW-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Base5fab2eb; reserve Reservations document preview/print consumer component and scoped tests/docs. Fix A4 clipping in modal; preserve reference template and print-size. Validate synthetic PDF with existing browser output. No API/schema/permissions or operational writes. Public hold retained.
7 tests, scoped lint/typecheck/build, desktop/mobile browser containment and3-page synthetic PDF visual QA passed. Scope RELEASED; Web restart pending. No real data/operational changes or public push.

## RESERVATION-DIRECT-PDF-0910 — PC-A — IN_PROGRESS

Base7ab38a2; reserve Reservations Web PDF route/server rendering and workflow error consumer/tests/docs. Preserve dev-generated next-env.d.ts. Direct PDF reads authenticated scoped workflow and public references, no client HTML or operational mutation. Fix normalized API error messages/client prerequisites. No schema/grants or Finance gate changes. Public hold retained.
Additional scope: next.config.ts output tracing for the server PDF's fixed template CSS/brand assets; no dependency changes. Existing Sales PDF renderer pattern reused in Reservations-owned renderer, without modifying Sales.

Validation:13 targeted tests, scoped lint and build/typecheck passed. Actual isolated Chrome generated synthetic3-page A4 PDF; all pages visually checked. Live unauthenticated route redirects to login. No real workflow/financial writes. Scope RELEASED, LOCAL_COMPLETE; user-started Next dev retained, no manual restart required for these source changes. Public publication hold retained.

## RESERVATION-PANEL-TRIM-0910 — PC-A — IN_PROGRESS

Base d9150a0. Reserve only Reservations foundation action-panel.tsx, its existing spec and task status entries. Remove six owner-marked panel buttons: Confirmation, attachment, add note, email, SMS and contract party. Keep hotel confirmation workflow reachable through table action, and retain Documents. No API/data/schema changes. Preserve local next-env.d.ts; existing public publication hold retained.
Completed:8 tests, scoped lint, TypeScript and Web build passed. Scope RELEASED; local-only commit, no public push or merge.

## SUPPLIER-SUBMIT-FEEDBACK-0910 — PC-A — IN_PROGRESS

Base d55c98d. Reserve travel-workflow-form.tsx and targeted tests/docs. Empty note currently blocks request submission with error above long PDF preview. Provide explicit action audit note for REQUEST_SUPPLIER when optional detail omitted and local visible pending/success/error feedback. Preserve backend authorization/version/branding/financial rules; no real send or workflow mutations during QA. Preserve next-env.d.ts and public publication hold.
Completed:6 targeted tests, scoped lint, TypeScript and Web build passed. Scope RELEASED; no real operational writes. Local-only publication.

## RESERVATION-ROOM-LAYOUT-0910 — PC-A — IN_PROGRESS

Base9780a38. Reserve reservation-form-sheet.tsx/module.css and reservation-pdf-html.ts, existing checks and task status. Separate hotel stay dates and room quantities in preview/print/direct PDF without changing source values. No API/data/schema. Preserve next-env and public publication hold.
Completed:12 tests, scoped lint, TypeScript and Web build passed. Three A4 PDF pages visually verified. Scope RELEASED, local-only commit.

## RESERVATION-PENDING-GRAY-0910 — PC-A — IN_PROGRESS

Based df96107. Reserve only workspace.module.css light-theme pending-supplier background and task status. Increase gray visibility while preserving dark-issued and dark-mode palettes, text, status and permissions. No data/API changes; preserve next-env and public publication hold.
Completed: formatting/diff checks, TypeScript and Web build passed. CSS-only; scope RELEASED. Local commit only.

## RESERVATION-CONTRACT-HEADER-0910 — PC-A — IN_PROGRESS

Base4b52abb. Reserve reservation-form-sheet.tsx/module.css and reservation-pdf-html.ts, task docs. Match current Sales contract navy/teal header and grouped white logo/brand, preserving reservation title and selected agency branding. Sales source read-only. No data/API/schema. Preserve next-env and public publication hold.
Additional scope: Reservations PDF route fixed OWN logo asset matches contract niyayesh.png; preview substitutes the same bundled asset only in reservation sheet, preserving voucher and uploaded agency logos.
Completed:12 tests, lint, TypeScript/build and3-page visual PDF QA passed using Playwright Edge. CLI PDF renderer did not produce output in this run; documented limitation, no runtime changes. Scope RELEASED; local commit only. Existing branding spec updated for contract logo asset.

## RESERVATION-COMPACT-HEADER-0910 — PC-A — IN_PROGRESS

Base434aef4. Reserve reservation-form-sheet.tsx/module.css and reservation-pdf-html.ts. Remove text under header logo and compact header height in both preview and PDF. Preserve logo alt text and footer identity, next-env, existing publication hold. No data/API/runtime changes.
Completed:8 tests, lint, TypeScript/build and3-page visual PDF QA passed. Scope RELEASED; local-only commit.

## HOTEL-VOUCHER-THEME-0910 — PC-A — IN_PROGRESS

Base22d9c12. Reserve reservation-form-sheet.tsx/module.css voucher variant, travel-document.tsx consumer and focused tests/docs. Reference user PDF only for layout; never copy passenger data. Shared compact header, flight/hotel/stay/room counts, transfer/leader, passengers and notice/stamp in issued voucher. Preserve issuance/financial gates. No API/schema/runtime changes; next-env and public publication hold preserved.
Completed:8 targeted tests, scoped lint, TypeScript/build and3-page synthetic visual PDF QA passed. Scope RELEASED; local-only commit, no data or actual issuance.

## SALES-RESERVATION-NOTES-0910 — PC-A — IN_PROGRESS

Base03fb3a2. Reserve Sales form/model payload + Reservations notes dialog/feed/action styles, travel workflow transition/tests and additive travel shared type, status/domain docs. Sales uses explicit reservationNote key on existing persisted service metadata; public outbox preserves it. Reservation note append uses existing versioned JSON workflow revisions with NOTE command and optional reservationNotes, no migration. Existing states default empty; deploy API before Web, old clients remain compatible. Permission/branch/audit/version guards retained. No external sends or actual customer writes in QA. Preserve next-env and public publication hold.
Completed:45 Web/8 API tests, scoped lint, Contracts/API/Web builds/typechecks and synthetic browser notes flow passed. Scope RELEASED. API4000 refreshed with original env; local-only commit/public hold. Domain handoff recorded in MODULE_BOUNDARIES.md.

## VOUCHER-SETTINGS-0910 — PC-A — IN_PROGRESS

Base2f5d30b. Reserve Reservations voucher workflow UI, settings component/model, workflow transition/validation and additive travel types, tests/docs. Fix REQUESTED->confirm+issue in voucher dialog; keep NEW blocked and insurance/Finance rules. Persist display settings in versioned workflow JSON, validate selected passenger IDs and typed fields, freeze issued output. Clarification pending for multiple independent vouchers vs one revision history; common settings proceed. No schema/grants/data writes during QA; preserve next-env/public publication hold.
User clarified: one logical voucher per contract with immutable workflow revision history, not independent vouchers. Additional docs scope: PROJECT_STATUS.md and MODULE_BOUNDARIES.md handoff. Implementation stores validated output settings on workflow JSON revisions; no migration.
Completed: user chose one voucher with revision history.10 API/9 Web tests, scoped lint/typecheck/build, synthetic browser workflow and four-page PDF visual QA passed. API4000 refreshed, health200; Web3100 login200. Scope RELEASED, local-only commit/public publication hold.

## SUPPLIER-FORM-ISOLATION-0910 — PC-A — IN_PROGRESS

Base cf09e1b; COMPUTER_ID=PC-A. User requests independently editable supplier reservation form; do not propagate to customer contract/voucher without explicit destination. Reserve Reservations settings UI/model/print/PDF, workflow JSON/types/tests and hotel purchase context within Reservations; no Procurement table changes. Add optional supplierFormSettings and sentSupplierFormSettings, immutable sent revision as purchase basis. Contract propagation selection is pending user clarification; Sales source read-only until destination semantics settled. Preserve next-env and public publication hold.
Additional scope: Sales-owned operational amendment public service/module and Sales contract print reader; nonfinancial display amendment in existing service metadata plus Sales audit/version. Canonical master/customer references and monetary values stay intact; current output consumes explicitly recorded amendment. Apply-both executes in same transaction as Reservations workflow; Sales update scope required. No destructive schema work. Domain decision: preserve base commercial terms and publish operational amendment with before/after audit instead of rewriting a confirmed draft.
Additional scope: purchase-context read endpoint and Reservations purchase dialog wiring, operational amendment output test, ADR. Explicit re-send captures a new immutable supplier copy for purchases before voucher issuance.
Final lint/typechecks and Contracts/API/Web builds passed. API4000 refreshed with original environment; health200 and Web3100 login200. Scope RELEASED; local-only commit with existing public-publication hold.

## VOUCHER-STATUS-CONTRAST-0910 — PC-A — IN_PROGRESS

Base ac2db91. Reserve only Reservations workspace.module.css status palette and status docs. Darken issued voucher and increase pending/issued separation in both themes, retaining readable text/selection. No business/API/data changes. Preserve next-env and public-publication hold.
Completed: palette visual QA and all four text contrasts above4.5:1, formatting and Web TypeScript/build passed. Scope RELEASED. No API/data changes; local-only commit.

## RESERVATION-GENERAL-DETAILS-0912 — PC-A — LOCAL_COMPLETE

Base 1b0e995; COMPUTER_ID=PC-A. Reserve Reservations selected-contract general-details component/action-panel styles/tests and task status. Show only recorded intake/workflow/customer/master-reference values: contract, customer masked phone when permitted, seller/branch, dates, hotel/service/room/passenger/flight/financial summary and notes. Missing fields remain explicitly unavailable; no inferred debt, buyer or operational writes. Preserve next-env and public-publication hold.
Completed: selected-contract «مشخصات کلی» now loads the canonical workflow snapshot and groups contract/customer, route/services, hotel/rooms, flight, recorded price and operational-note/status fields. Customer phone remains masked and permission-dependent. Debt/FX fields explicitly report that Reservations did not receive them. 11 targeted tests, scoped lint, TypeScript and Web production build passed. Local3100 responds 200 and hot reloads the change; scope released for local review. Public-publication hold remains.

## RESERVATION-CONTRACT-PDF-0912 — PC-A — LOCAL_COMPLETE

Base e7cb696; COMPUTER_ID=PC-A. Reserve Reservations selected-contract «مشاهده» action, feed contractId mapping, PDF preview component/styles/tests and task status. Load the existing authenticated Sales contract PDF for the selected contract inside the Reservations dialog, with download and retry controls. Preserve Sales output/permissions, next-env and public-publication hold; no API/schema/data changes.
Completed: «مشاهده» now passes the canonical Sales contractId from the Reservations intake and loads the existing authenticated saved-contract PDF inside a wide preview dialog. The loaded PDF can be downloaded and failed loads can be retried with the server's safe error message. 32 focused tests, scoped lint, TypeScript and Web production build passed; Local3100 responds 200 and hot reload is active. Scope released for local review; no API/schema/grant/data changes and public-publication hold remains.

## RESERVATION-PASSENGER-IDENTITY-0912 — PC-A — LOCAL_COMPLETE

Base 61df3bd; COMPUTER_ID=PC-A. Reserve Reservations passenger list projection/UI/tests and task status. Show contract age category plus available customer birth date, national ID, passport number and expiry in the existing passenger dialog. Full sensitive values require existing customers.sensitive.read and are audited with customer-verification; otherwise return masked values/status. Gender and passport issue place remain explicitly unavailable because the Customer schema does not own them. Preserve editable canonical names, next-env and public-publication hold; no schema/migration/grant or operational data changes.
Completed: passenger names dialog now uses a compact horizontally scrollable table with editable first/last names, contract age category, gender, birth date, national ID, passport number, expiry and issue-place columns. Existing customer and contract sources populate recorded values. Full protected identity is returned only with customers.sensitive.read and an audited customer-verification reason; other users receive masked values and a protected birth-date indicator. Missing gender/issue place display «ثبت نشده». Nine focused API tests, scoped API/Web lint, both typechecks and production builds passed. API4000 refreshed and health200; Web3100 hot reload and HTTP200. Scope released, no migration/grant/data write and public-publication hold retained.

## RESERVATION-RECEIPTS-0912 — PC-A — IN_PROGRESS

Base d369bf1. Reserve the Reservations receipts dialog, Sales payment read projection, additive shared payment output fields, focused tests and status docs. Show recorded payment method, status, amount/currency, transfer/registration dates, bank/reference and registering user for the selected contract. Read existing Sales-owned payment records only; do not invent missing bank data, change settlement state, grant permissions or create financial records. Preserve the local dev runtimes and the existing public-publication hold.
Completed: «دریافت‌ها» now opens a wide payment-history table for the selected canonical Sales contract. It shows method/status, amount/currency, Finance transfer confirmation, due/registration dates, registering user's display name, historical bank lookup, tracking reference and description. Missing values remain explicit. Twelve focused tests, scoped lint, Contracts/API/Web typechecks and builds passed. API4000 refreshed; API and Web3100 return 200. Scope RELEASED; no schema/migration/grant/payment mutation and no public push.

## SUPPLIER-PURCHASE-FINANCE-0912 — PC-A — LOCAL_COMPLETE

Base ee589f5; COMPUTER_ID=PC-A. User requires one supplier purchase cost per contract service, potentially different brokers/currencies, submitted to Finance before document delivery. Reserve Reservations purchase contracts/API/Web, Finance supplier-payment queue and delivery gate, MasterTravelDirectory public broker validation, additive Prisma schema/migration, focused tests and status/domain docs. Migration Owner = PC-A/SUPPLIER-PURCHASE-FINANCE-0912; shared Travel contract and central docs reserved for this task. Keep legacy hotel purchase history readable. Finance owns payment revisions; Reservations owns immutable service-purchase revisions. Delivery approval requires every contract service to have a latest purchase paid by Finance. No live payment or document-delivery mutations during QA; no permission grant/dependency change; public-publication hold retained.
Completed: per-service immutable purchases with active broker FK and Decimal/currency feed the Finance queue. Finance records versioned supplier payments with bank/date/reference/reason; delivery approval is gated on paid latest purchases for every contract service. Legacy hotel costs remain readable. Additive migration applied locally; validation/full API tests/typechecks/build checks recorded in final handoff. No live payment/delivery/grant and no public push.

## SPARTA-ANTALYA-MANIFEST-0912 — PC-A — LOCAL_COMPLETE

Base 2f9c833; COMPUTER_ID=PC-A. Reserve the Reservations MANIFEST action/API, Iran Airtour Antalya XLSX template integration, nullable Customer airline-identity fields, Sales international-passenger validation, additive migration, focused tests and task/domain status docs. Generate one airline-ready workbook from the selected reservation using canonical Sales travel data and Customer-owned protected identity values; require existing read/export permissions and audit access. Never retain sample passenger PII from the supplied workbook. Preserve local live runtimes and the public-publication hold.
Implementation: sanitized the supplied workbook to a PII-free template while preserving Pax List and six airline reference sheets. Added nullable Customer airline identity fields with ISO/gender constraints and made them required in Sales only for international passenger rows. Reservations validates Antalya + Iran Airtour, reads protected passport data with the existing sensitive-read audit, maps age/class codes and downloads the exact 12-column workbook. Additive migration applied locally; no operational record, permission grant or external airline send was performed.
Validation: 44 focused API tests and 40 focused Web tests passed; scoped API/Web lint, Contracts/Database/API/Web typechecks, Prisma validation and API/Web production builds passed. The template asset is copied into the API build. API4000 and Web3100 run from this worktree and return HTTP 200; the protected endpoint returns 401 without a session. Scope RELEASED for local review; public-publication hold remains.

## HOTEL-RATE-CALENDAR-0912 — PC-A — LOCAL_COMPLETE

Base 61df3bd; COMPUTER_ID=PC-A. Isolated worktree to avoid overlap with active Reservations tasks. Reserve only hotel-rates workspace/styles/focused test and task status. Replace native browser date inputs with the shared project DatePicker, retaining Gregorian default, ISO values and existing stay-range validation. No API/schema/data changes; preserve next-env and public-publication hold.
Completed: both stay dates now use the shared dual Persian/Gregorian DatePicker with Gregorian-English default, consistent trigger styling and ISO values. Existing positive-night validation and calculation remain unchanged. Twelve focused date/rate tests, scoped lint, Web TypeScript and production build passed. Isolated local commit for handoff; public-publication hold retained.

## RESERVATION-PARTY-DETAILS-0912 — PC-A — LOCAL_COMPLETE

Base e7cb696; COMPUTER_ID=PC-A. Isolated worktree to avoid overlap with the active Reservations contract-PDF task. Reserve only reservation-general-details component/styles/tests and task status. Add a distinct contract-party group and obtain full contacts through the existing Customers sensitive-detail public API with fixed `support-request` reason, preserving permission, branch and Audit controls. Fall back to masked data when sensitive access is unavailable. No API/schema/grant/data changes; preserve next-env and public-publication hold.
Completed: «طرف قرارداد» is now a distinct accented group with name, type/status, primary and additional phones, email and recorded address. Opening general details requests authorized full contact data through Customers with `support-request`; Backend remains responsible for permission/branch checks and Audit. Unauthorized/decryption failures fall back to masked detail without blocking the rest of the dialog. Eight targeted tests, scoped lint, Web TypeScript and production build passed. Isolated local commit for handoff; public-publication hold retained.
