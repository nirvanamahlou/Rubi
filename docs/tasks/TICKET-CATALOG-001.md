# TICKET-CATALOG-001 — مدیریت و تعریف بلیت‌ها، مرحله A

- Computer: `PC-A`.
- Status: `READY_FOR_REVIEW` **within the reserved module scope**; integration test handoff below remains open.
- Branch: `codex/pc-a-ticket-catalog-foundation`.
- Base: `origin/develop@5f9cb723de39e29cff95f26b047138699bd36392` (fetch 2026-08-31).
- Draft PR: https://github.com/nirvanamahlou/Rubi/pull/46 → develop. No merge/deploy/force push.
- Worktree: `.worktrees/ticket-catalog-001`. Git metadata has a task-only local exclude for this directory, preventing accidental staging in the main checkout.
- Existing customer checkout remains on `codex/pc-a-customer-002b-main-preview`, with its pre-existing modified `apps/web/next-env.d.ts` unchanged. `56a4a09` is not an ancestor of this task.
- Initial reservation published in commit `d56121b` before implementation.

## رزرو موقت محدوده مستقل

طبق اجازه صریح کاربر، رزرو این مرحله در همین سند ثبت و با Commit/Push و Draft PR منتشر شد. PR باز PC-B شماره 45 و زنجیره والدهای 28 تا 44 قفل‌های Migration/Contract/Docs فعال نزد PC-B را گزارش می‌کنند. آزادشدن قفل مشتریان روی develop آن کار جدیدتر را لغو نمی‌کند. این Task هیچ قفل مشترکی تصاحب یا منتقل نکرد.

فقط این مسیرها تغییر می‌کنند:

- `apps/api/src/ticket-catalog/**`: مدل دامنه و Port پیشنهادی، بدون Controller، AppModule، repository یا persistence.
- `apps/web/src/modules/ticket-catalog/**`: رابط، مدل Preview، Adapter خواندنی و تست‌های بلیت.
- `apps/web/src/app/(crm)/ticket-management/page.tsx`: اتصال رابط همین بخش.
- همین سند.

Schema، Migration، Seed، تنظیم Database، dependency/lockfile/workspace، shared contract/root export، IAM، Customers، Master Data، Legal Entities، Finance، Sales، Reservations، Navigation، DatePicker و UI مشترک دست‌نخورده‌اند. هیچ کد PC-B کپی/cherry-pick/merge نشده است.

## مبنای قراردادهای قابل مصرف

Master Data v4 در develop، `MasterDataRecord` و `masterDataEndpoints` را برای airlines/currencies/countries/cities منتشر کرده است. مصرف فقط از `@rubi/contracts` و HTTP GET با `credentials: include` است؛ permission موجود `master_data.read` را Backend مالک بررسی می‌کند. Adapter هیچ mutation، تغییر شعبه یا پارامتر Legal Entity ندارد.

فرودگاه، هواپیما، کلاس پروازی و بار در این develop عمومی نیستند. UI آن‌ها را غیرفعال و «منتظر API» نمایش می‌دهد، کشور/شهر را جای فرودگاه نمی‌نشاند و شناسه ساختگی تولید نمی‌کند.

هسته خالص دامنه در Backend و نسخه module-local متناظر آن در Web نگهداری شده است؛ آزمون تطبیق byte-for-byte پس از نرمال‌سازی newline از انحراف جلوگیری می‌کند. این تکرار موقت، جایگزین انتشار غیرمجاز package مشترک یا import داخلی cross-app است. انتقال به قرارداد/کتابخانه عمومی فقط با رزرو آینده انجام شود.

## ماتریس قابلیت‌ها

به‌روزرسانی مصوب مالک: قیمت فروش نهایی در Sales تعیین می‌شود. انتخاب یک‌طرفه/رفت‌وبرگشت از بلیت‌های مستقل و جست‌وجوی کشور/شهر در فرم به Preview اضافه شد؛ جزئیات و محدودیت‌ها در Follow-up پایانی آمده است.

| قابلیت                                                                | پیاده‌شده در A            | داده / محدودیت                                                                                            |
| --------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| فهرست، جست‌وجو، فیلتر وضعیت/تأمین/ایرلاین/تاریخ، مرتب‌سازی، صفحه‌بندی | بله                       | فقط مجموعه Preview همین صفحه؛ فیلتر تاریخ بر پایه روز UTC و نمایش شمسی                                    |
| ایجاد، مشاهده، ویرایش، کپی                                            | بله                       | فقط حافظه mount جاری؛ reload/unmount همه محصولات را پاک می‌کند؛ هیچ localStorage یا ذخیره سرور نیست       |
| برنامه یک‌طرفه، تقویم مشترک، منطقه زمانی                              | بله                       | مدل تا 8 Segment پیوسته؛ رابط ویرایش اولیه یک Segment                                                     |
| رسیدن پس از حرکت و عبور از نیمه‌شب                                    | بله                       | ISO UTC سخت‌گیرانه؛ IANA + offset صریح، رد DST gap و offset ناسازگار                                      |
| نوع تأمین و گزینه ظرفیت شرکت                                          | بله                       | company/allotment/charter/supplier مستقل از manual/api؛ ورود دستی مالکیت نمی‌سازد                         |
| نرخ خرید، ارز، کارمزد، کمیسیون و اعتبار                          | بله                       | Decimal string حداکثر 18+6 رقم، BigInt برای جمع خالص ریاضی؛ بدون FX، سود یا سیاست مالی ساختگی             |
| نسخه نرخ، شرایط و تعریف برنامه                                        | بله                       | Snapshotهای قبلی append-only در مدل؛ ویرایش مستقل از انتقال وضعیت، تاریخچه فقط کاربر و زمان واقعی Preview |
| موجودی، Hold/Confirm/Release invariant                                | بله در مدل و تست          | reducer خالص پیشنهادی؛ هیچ command عملیاتی یا شمارنده دستی در UI                                          |
| مراجع airline/currency/country/city                                   | Adapter واقعی GET         | داده API از داده نمایشی جدا؛ loading/empty/401/403/409/error؛ فعال‌سازی سرور در B باید مجدداً resolve کند |
| فرودگاه/هواپیما/کلاس/بار                                              | منتظر API                 | فیلد خالی در draft مجاز؛ شناسه نامعتبر یا inactive رد؛ فعال‌سازی بدون همه مراجع رد                        |
| IAM اختصاصی بلیت                                                      | منتظر قرارداد             | fail-closed حتی برای IAM administrator؛ هیچ allow-all یا auth bypass                                      |
| Persistence، Audit سرور، REST API بلیت                                | منتظر Migration/Handoff B | هیچ پیاده‌سازی یا ادعای ذخیره واقعی                                                                       |
| هم‌زمانی اتمیک، idempotency پایدار                                    | منتظر Transaction B       | expectedVersion در مدل فقط invariant؛ آزمایش DB انجام نشده                                                |
| خروجی فهرست                                                           | Port پیشنهادی، UI غیرفعال | snapshot فیلتر/مرتب‌سازی و actor/branch؛ مجوز در اجرا و دانلود دوباره بررسی شود                           |
| Import/Export گروهی، تکرار برنامه، چندقطعه پیشرفته            | نقشه توسعه                | بدون دکمه موفقیت یا فایل ساختگی                                                                           |
| بلیت مسافر، PNR، Manifest، خرید و پرداخت                              | خارج از محدوده            | مالک‌های Reservations/Procurement/Finance/Sales                                                           |

۸ برنامه نمونه فقط با اقدام صریح کاربر بارگذاری می‌شوند؛ عنوان‌ها و شماره پرواز DEMO هستند، هیچ reference ID واقعی/جعلی Master Data و هیچ شمارنده رزرو ندارند. ظرفیت تعریف‌شده و نرخ، «نمایشی» برچسب دارند. UI برای Hold/قطعی/باقی‌مانده واقعی «— / منتظر رزرواسیون» نشان می‌دهد.

## قواعد دامنه و تصمیم‌های باز

- `draft → active/cancelled`، `active → paused`، `paused → active/cancelled`؛ cancelled نهایی است و کپی آن draft جدید می‌سازد.
- ویرایش فقط draft/paused؛ فعال‌سازی نیازمند همه مراجع فعال، ظرفیت مثبت و نرخ دارای اعتبار در زمان جاری است.
- توقف فروش تخصیص‌ها را آزاد نمی‌کند. لغو برنامه تخصیص‌یافته و تغییر برنامه/قواعد تخصیص‌یافته تا قرارداد هماهنگی Reservations مسدود است.
- موجودی: `remaining = total - held - confirmed`. confirmed شامل ظرفیت مصرف‌شده است؛ «فروش‌رفته» محور شمارشی اضافه نیست.
- Confirm همان allocation held را تبدیل می‌کند؛ ID تکراری و confirm/release تکراری رد می‌شود. Release فعلی فقط held است؛ برگشت قطعی و expiry نیازمند سیاست Reservations است.
- کاهش ظرفیت زیر held+confirmed و استفاده از Snapshot ظرفیت ناسازگار رد می‌شود.
- تغییر نرخ نسخه جدید می‌افزاید؛ مقادیر نسخه قبلی بازنویسی نمی‌شوند. تعریف برنامه/قوانین نیز Snapshot نسخه‌دار دارد.
- Snapshotهای module-local تضمین immutable DB نیستند؛ FK، unique/check constraints و transaction در B الزامی‌اند.
- مبلغ/کارمزد/کمیسیون فیلدهای مستقل‌اند. ترتیب اعمال، discount/markup، صفر بودن قیمت قابل فروش، قواعد rounding هر ارز و Approval فروش تصمیم‌های باز محصول/Finance هستند؛ به‌عنوان سیاست تأییدشده اجرا نشده‌اند.
- انتخاب سربرگ هیچ محصولی را تکثیر یا branch scope را تغییر نمی‌دهد؛ هیچ فیلد issuer روی inventory ساخته نشده است.

## Handoff دقیق به PC-B و سایر producerها

| Producer                  | نیاز consumer بلیت                          | قرارداد و رفتار موردنیاز                                                                                                                              |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC-B Master Data: Airport | origin/destination                          | stable ID، name/code، cityId/countryId، IANA timezone، active، version، pagination/search و lookup by ID؛ missing/inactive/unavailable/401/403 متمایز |
| PC-B: Aircraft            | aircraft selection                          | stable ID، name/model/code، active، version؛ رابطه airline اگر مالک منتشر می‌کند؛ ظرفیت فنی نباید خودکار ظرفیت شرکت شود                               |
| PC-B: Flight class        | class selection                             | stable ID، name/code، active، version، optional airline relation و روش lookup معتبر                                                                   |
| PC-B: Baggage             | baggage reference                           | stable ID، name/code، active، version و مشخصات مقدار/واحد/کابین در schema عمومی؛ بدون تغییر قوانین مادر                                               |
| PC-B: Currency            | currency validation                         | currency ID، ISO code معتبر، active/version و precision منتشرشده؛ نرخ Draft هیچ‌گاه authoritative مالی نیست                                           |
| IAM                       | operations read/create/update/status/export | codeهای اختصاصی منتشرشده + seed/guard/actor/branch/audit intent؛ قبل از آن همه عملیات واقعی مسدود                                                     |
| Reservations              | کنترل ظرفیت                                 | product/inventory ID، reservationOperationId، allocationId، quantity، expectedVersion، idempotencyKey، actor/branch/trace؛ expiry و compensation صریح |
| Finance / Settings        | pricing decisions                           | policy/version/source برای کارمزد/کمیسیون/تخفیف/rounding؛ FX authoritative تنها با قرارداد عمومی                                                      |
| Documents/Worker          | list export                                 | filter snapshot + scope، format، lifecycle/error، مجوز زمان اجرا و دانلود؛ بدون passenger/Manifest                                                    |

قراردادهای `ticket-catalog.v1-proposal` فقط ماژول‌محلی‌اند. producer انتشار مشترک: Ticket Catalog؛ consumers آینده: Sales برای محصول/نسخه نرخ و Reservations برای inventory. برنامه سازگاری: انتشار additive v1 با review مشترک، مصرف‌کننده‌های قدیمی بدون تغییر؛ هیچ root export یا endpoint به‌صورت ضمنی منتشر نشده است.

## کیفیت و شواهد

- Frozen install در Worktree مستقل؛ هیچ تغییر package/lockfile.
- `@rubi/contracts`، `@rubi/config` و `@rubi/database` محلی build شدند. Prisma Client فقط برای compile با URL غیرمتصل `postgresql://localhost:1/ticket_catalog_compile_only` تولید شد؛ هیچ اتصال، Migration، Seed یا کلید جدید وجود ندارد.
- Web و API: lint، typecheck و production build پاس.
- Dedicated Web: **58 tests passed** (domain, preview/query, public adapter, real React SSR form/workspace/state rendering).
- Dedicated API: **38 tests passed** (domain + fail-closed permission/branch port).
- Full API regression: **268 passed / 41 files**.
- Full Web with rendering config: **211 passed, 1 failed / 31 files**. Failure is **not hidden or skipped**: shared `src/modules/module-foundation/model/route-foundation.spec.ts:60` still requires ticket-management to import the generic ModuleFoundationWorkspace. The authorized new route instead imports TicketWorkspace. The shared test is outside this reservation and unchanged.
- Owner handoff for that test: remove only ticket-management from `foundationRoutes` (keep it in the 17 `approvedRoutes`) and add a dedicated TicketWorkspace route assertion. Do not change navigation count/order. This integration gate must be green before merge.
- Rendering tests validate real components, empty initial state, disabled operational export/save, read-only form and all UI failure states. They do **not** establish browser event/visual QA.
- Browser plugin failed twice before browser discovery because Windows sandbox could not apply deny-read ACLs. No cookies, profiles or sessions inspected and no auth bypass attempted.
- HTTP smoke: preview ticket route without auth **307 → /login?next=%2Fticket-management**; preview login **200**; existing API health **200**; unauthenticated Master Data **401**. These are not authenticated UI or visual tests.
- Initial delivery only (superseded by the connection follow-up below): existing API did not return CORS allow-origin for `http://localhost:3211`; configuration was not modified. The adapter truthfully reports unavailable/error from this preview origin until the service owner allows the origin. A successful authenticated Master Data integration from this port is **not claimed**.

Commands (Node 24 on PATH):

```powershell
pnpm --filter @rubi/web exec vitest run --config src/modules/ticket-catalog/vitest.config.mts src/modules/ticket-catalog
pnpm --filter @rubi/api exec vitest run src/ticket-catalog
pnpm --filter @rubi/web exec vitest run --config src/modules/ticket-catalog/vitest.config.mts
pnpm --filter @rubi/api test
pnpm --filter @rubi/web lint
pnpm --filter @rubi/api lint
pnpm --filter @rubi/web typecheck
pnpm --filter @rubi/api typecheck
pnpm --filter @rubi/web build
pnpm --filter @rubi/api build
```

## لوکال و تحویل

- Preview: http://localhost:3211/ticket-management. Initial task process PID 15220 was replaced by the task-local same-origin proxy described below.
- Initial build API base was `http://localhost:4000/api/v1` (follow-up changes this to `/api/v1`); only GET reference consumption is implemented. Existing auth/proxy is unchanged. Sign in through the existing authorized app/session; this task creates no user/session/credential.
- Original listeners at 3100 (PID 3340) and 4000 (PID 15952) were retained, with no stop/restart or database changes.
- Only this task's new Preview process may be stopped when no longer needed.
- No screenshots or successful visual smoke are claimed.

مالک اسناد مرکزی پس از review، فقط ردیف TICKET-CATALOG-001 و همین ماتریس واقعی A را به WORK_ASSIGNMENTS / PROJECT_STATUS / PLANS اضافه کند؛ هیچ قفل مشترکی منتقل نشود. تست مشترک route و CORS مبدأ Preview نیز نیازهای مشخص هماهنگی‌اند.

**Phase B خودکار آغاز نشد.** شرط شروع B: Handoff صریح + رزرو تازه Schema/Migration/Contract/IAM wiring/central files، مدل FK نهایی، optimistic locking اتمیک، idempotency/fingerprint پایدار، audit/outbox و آزمون واقعی transaction/round-trip.

## Follow-up: اتصال Preview به سرور — 2026-08-31

User explicitly requested fixing the Preview/server connection. Reserved addition within the existing module scope: apps/web/src/modules/ticket-catalog/preview/** for a loopback-only proxy and transport checks. No shared configuration lock is acquired. Preview will call /api/v1 on its own origin (3211); a local proxy forwards to the unchanged API at 4000 and the task-only Next server at 3212. Original Origin, authentication status and Set-Cookie are preserved; no credential, permissive CORS or authentication bypass is introduced. Only the task-owned Preview process may be restarted. Validation results follow below.

Connection follow-up outcome: RESOLVED. The current build uses NEXT_PUBLIC_API_BASE_URL=/api/v1. Local process 2072 listens on 3211 (proxy), and task-only Next process 24392 listens on 3212. Existing 3100/4000 processes remain 3340/15952, unchanged.

Validation: five node:test transport checks passed (routing/query, method/body/Origin, status/Set-Cookie fidelity, foreign-origin/DNS-rebinding rejection, unavailable upstream). Full Web lint, typecheck and production build passed. Live smoke through 3211: health 200, login page 200, protected Master Data 401, protected ticket route 307, empty login body 400 from existing server validation, foreign origin rejected 403. Served login JavaScript contains the relative /api/v1 base and no old direct localhost:4000 API URL. No real credential or synthetic authentication token was submitted to Rubi. Successful account login still requires the user's existing credentials; this is connection verification, not an authenticated visual test.

Reproduction (Node 24 on PATH, run in apps/web):

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
pnpm build
# Separate background processes; both loopback only, do not stop 3100 or 4000:
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3212
node src/modules/ticket-catalog/preview/server.mjs
# Isolated transport fixture tests (no connection to Rubi DB or API):
node --test src/modules/ticket-catalog/preview/server.check.mjs
```

The prior request for server-owner CORS changes is superseded: no CORS/server/IAM configuration change is now necessary. The unrelated shared route-foundation test handoff remains unchanged; Phase B remains unstarted.


## Follow-up: approved IAM password policy and administrator provisioning — 2026-08-31

COMPUTER_ID=PC-A. The user explicitly approved lowering the global minimum from 12 to 10 characters after being told this affects all users, and requested a full-access administrator account. This is a narrow, explicit extension of the original no-IAM scope; Phase B remains unstarted. PC-A owns IAM, and the current competing work is in Master Data, not IAM.

Reserved task-local files: apps/api/src/iam/password-policy.ts, apps/api/src/iam/password-policy.spec.ts, apps/api/src/iam/dto/create-user.dto.ts, apps/api/src/iam/dto/create-user-password-policy.spec.ts, apps/web/src/app/(crm)/users/user-management.tsx. No shared schema, dependency, central-file or migration lock is acquired. Central assignment/status files remain reserved to their existing owner; this addendum is the task-local reservation and handoff.

Keep all four character-class checks and the existing maximum length. Provision only the requested new user via the documented IAM bootstrap service with the existing protected local runtime configuration, then verify through normal HTTP authentication. Check for an existing username first; do not overwrite an existing account, alter other users/roles, run seed, replace keys, or store credentials in tracked files/logs. Original services on 3100/4000 must remain running. Policy changes in this branch do not hot-update the original API process.


IAM follow-up outcome: the requested new account was created through the public IAM bootstrap service, with a preflight confirming no existing username. Normal login through 3211 returned 200; all 25 currently published permissions, the administrator role and the one active branch were verified. Authenticated Master Data airline GET and /ticket-management returned 200, and the existing API at 4000 accepted the issued session. The verification session was logged out (204). No credentials, cookies, tokens, key values or other user records were saved in tracked files.

The full task AppModule initially refused startup because the older running server configuration has no Master Data import-token key. No key was generated or replaced. The one-shot provisioning context loaded only the public IamModule and DatabaseModule, with the exact existing validators for NODE_ENV, DATABASE_URL and IAM_ACCESS_TOKEN_SECRET; unrelated Master Data/customer modules were not loaded. Normal password hashing, role assignment and audit were retained.

Validation: 25 IAM tests in four files passed, including 9/10/11/12-character boundaries, preserved character classes, DTO maximum 200 and rejection at 201. API and Web lint, typecheck and production builds passed. Post-build connection smoke passed all seven checks, including foreign-origin rejection and real unauthenticated responses. No browser visual QA is claimed. The previously documented unrelated shared route-foundation test remains a merge gate.

Runtime distinction: the account is usable now against the existing local database/API, including from the main application when it uses that API. The new global 10-character creation policy is prepared in this branch and the rebuilt Preview UI; it is not hot-loaded into the original running API or the main application. Their existing creation validator remains 12 until an authorized integration/restart. Existing login accepts the new account normally. No merge/deploy or original-service restart was performed. Final listeners: 3100 PID 3340, 4000 PID 15952, 3211 proxy PID 2072; only task Next 3212 was rebuilt/restarted (PID 3488).

Central-document owner handoff: record the explicit user approval and this narrow IAM exception/status in WORK_ASSIGNMENTS and PROJECT_STATUS alongside the existing task entry; no central lock is transferred. Global policy rollout must coordinate the frontend and API. Passwords and provisioning environment values must remain outside Git.


## Follow-up: ticket form containment — 2026-08-31

PC-A, existing task branch. User reports the ticket definition form overflows its frame. Reserve only ticket-catalog/components/ticket-form.tsx, ticket-workspace.tsx and new ticket-form.module.css, plus this task handoff. Shared Dialog/FormField/DatePicker, other modules, central locks, API, database and dependencies remain unchanged. Fix intrinsic fieldset/field minimum widths, use form-container-based columns, and bound the dialog to the viewport. Verify against the existing authenticated Preview with a fresh isolated headless browser; the in-app browser failed initialization with the known Windows ACL error.


Form containment outcome: fixed in the task Preview. Before the change, a real isolated headless Edge UI run reproduced 320px overflow (dialog clientWidth 286, scrollWidth 295; fieldset 271px with multiple controls outside the frame) and a 390px calendar extending to x=-3 while the dialog begins at x=16.

After the change, normal-login browser checks passed at 1440x900, 768x700, 640x700, 390x844 and 320x700. Dialogs remain fully within the viewport, scrollWidth equals clientWidth at every size, all closed-form controls are horizontally contained, and opened calendars remain within the dialog horizontally. At 320px the fieldset is now 254px and dialog client/scroll widths are both 286px. Calendar scrolling and the form close button were exercised; narrow-form and calendar screenshots were visually inspected. The browser used a fresh isolated context, not the user's browser/profile; test sessions were logged out. The failed in-app browser check is not claimed as successful.

The module-local stylesheet removes intrinsic fieldset/control minimums, switches columns according to the actual form width, bounds the dialog to the dynamic viewport, and contains the shared calendar without editing shared UI. Web lint/typecheck/build and all 58 existing ticket tests passed. No new test that merely mirrors CSS class names was added. Original 3100/4000 and proxy 3211 remained running unchanged; only task Next 3212 was rebuilt/restarted (PID 11096). Preview-only in-memory entries reset on reload as already documented.

Central owner handoff: include this resolved ticket-form follow-up with TICKET-CATALOG-001 in the existing assignment/status entry. No central, migration or dependency lock changes. The earlier unrelated route-foundation merge gate remains outstanding.


## Follow-up: dynamic sales pricing, searchable geography and independent trip legs — 2026-08-31

PC-A reservation: existing ticket-catalog domain/model, adapters, components and their tests in Web/API, plus this task document. No Sales internals, Master Data implementation/open PR, shared contract, central document, database, migration or dependency change. Central owners must reflect this reservation/status and the following approved decision in WORK_ASSIGNMENTS, PROJECT_STATUS and DECISIONS.

Task ADR TICKET-PRICING-002 — ACCEPTED by the product owner's latest instruction: the final sale price is dynamic and belongs to Sales quotation/contract service snapshots, not to Ticket Catalog. This explicit clarification supersedes the older broad “purchase/sale price” wording in travel architecture for this slice. Catalog retains purchase/cost reference versions, currency and validity; it must not require/store a fixed sale amount. Sales owns negotiated price/discount/approval and currency snapshot; no Sales persistence is claimed here. This resolves the product interpretation before implementation; central ADR propagation remains with its locked-file owner.

A ticket remains an independently sellable directional product. One-way selection references one product; round-trip selection references two distinct existing product IDs/versions, with reversed endpoints and a later return departure. Combining them must not clone products, inventory, prices or reservations. This iteration provides an explicitly labelled module-local Preview composition and proposed consumer snapshot, not a Sales contract mutation or operational availability/hold. Switching outbound or trip type clears an obsolete return.

Country/city are separate Master Data IDs alongside airport IDs, not airport substitutes. All available references are searched through published v4 read-only API; city selection verifies countryId, and changing a parent clears dependent selections. Airports remain unavailable until the producer publishes the contract (PC-B #35/#47 are still open); no fake IDs, branch copying or unsupported endpoint are allowed.


Pricing/geography/journey outcome: implemented in the isolated Preview. Removed fixed sale amounts from FareInput, validators, sample data, form and history/list displays; legacy runtime inputs carrying a sale field are explicitly rejected. Purchase versions remain immutable. Added active country/city references and parent-country validation (including drafts); selecting a new country/city clears downstream IDs. Airline, currency, country and city selectors search the published read-only API inside the form, with abort/stale-response protection, retry/error/empty states and pagination. Cities are filtered by published attributes.countryId within each API page; page counts truthfully describe the general city search because v4 has no server-side country filter.

Added module-local one-way/round-trip selection: searchable existing product choices, return route/time compatibility, distinct product IDs, version checks, no stale hidden return after changing type/outbound, and independent one-way choice of either leg. The resulting proposal contains only existing IDs/versions, pricingOwner=sales and previewOnly=true. No new product, inventory, reservation, contract or price is generated by composition. Draft selection is permitted only because this is labelled Preview; operational Sales must resolve active sellable products, authorize, and snapshot dynamic final prices through a future published contract. Sales internals and original API behavior are unchanged.

Validation: Web ticket suite **72 passed**, API ticket suite **41 passed**, API/Web lint and typecheck passed, both production builds passed. Exact final-build isolated Edge test used normal IAM login; actual country/city GETs returned 200 (one active country, zero active cities currently). Separate explicitly synthetic browser-only reference responses verified search queries, parent filtering/reset, absence of a sale input, edits to two existing Preview programs, matching return-only candidates, valid round-trip selection and selecting that same return as an independent one-way ticket. No fixture was inserted into the database. No browser page errors occurred, and verification sessions were logged out.

Visual QA: trip panel and expanded 320px selector screenshots inspected. Form/calendar containment passed at 320/390/640/768/1440px; all measured dialog scroll widths equal client widths and controls/calendars stay inside the frame. Only task Next 3212 restarted (PID 16832). Original web 3100 PID 3340, API 4000 PID 15952 and proxy 3211 PID 2072 unchanged. No schema, migration, seed, real-data write, key, IAM, shared UI or dependency change.

Remaining producer/consumer handoff: populate real city references in Master Data through its authorized workflow; publish airport/aircraft/class/baggage APIs from the PC-B work before enabling those fields. Central ADR/status owners must propagate TICKET-PRICING-002. Sales must implement/version the dynamic-price quotation/contract snapshot and consume independently resolved legs when its scope is activated; Reservations must hold each underlying inventory atomically. These operational integrations are not implemented or claimed by this Preview follow-up. Original shared route-foundation test remains an integration merge gate; no merge/deploy was performed.

## Clarification: mixed-currency prices belong to Sales

PC-A, existing task branch; documentation-only reservation for this task handoff. The product owner clarified that the usually mixed-currency rate refers to the **sale price in Sales**, not the purchase rate in Ticket Catalog. Extend TICKET-PRICING-002 accordingly: Sales pricing must support multiple amount/currency components on the same ticket sale instead of forcing one currency for the entire sale. Preserve each component's Decimal amount and currency identity; do not add unlike currencies into an unlabeled total or invent an exchange rate. Any converted reporting/settlement total requires the existing approved Finance/FX policy and an explicit rate snapshot; this clarification does not decide a new FX policy.

Ticket purchase pricing is unchanged by this clarification. This is a recorded Sales requirement and handoff, **not an implemented Sales pricing screen, API or persistence feature**. Carry it into the future Sales quotation/contract scope and central decision/status documents through their owners. No application code, database, dependency or runtime change; verification is documentation diff review only.


## Follow-up: direct month/year selection in Ticket calendars — 2026-09-01

PC-A reservation on the existing task branch: ticket-catalog/components/ticket-date-picker.tsx, ticket form/workspace imports, ticket-local tests and this document only. The product owner requested every calendar in Ticket Management to retain the passenger-calendar appearance while allowing direct month and year changes. Shared DatePicker/utility files remain unchanged because CALENDAR/shared UI belongs to another active ownership line; no other module is affected.

The ticket-local calendar must preserve the shared Persian/Gregorian switch, Gregorian ISO storage, optional time, keyboard/outside close, month arrows and visual language. Add labelled native month/year controls to every Ticket calendar: departure, arrival, purchase-rate validity start/end and list date filters. Year choices cover 20 years around the displayed anchor and recenter after selection; navigation outside that window remains possible through arrows or successive direct choices. Changing displayed month/year must not silently change the selected date until the user selects a day.


Ticket calendar outcome: implemented as a ticket-local component using the unchanged shared calendar conversion utilities. All six Ticket calendars now expose native, labelled `انتخاب ماه` and `انتخاب سال` controls while retaining month arrows and the Persian/Gregorian switch. The header uses two rows so both selected month and year remain readable at 320px; no shared UI or passenger/customer file changed.

Validation: all **76 Ticket Web tests** pass, including four direct-navigation utility tests; targeted ESLint and complete Web typecheck pass; final production build passes. A fresh isolated Edge context with normal IAM login verified the exact final 3211 build: both list filters and all four form calendars expose the controls; jumping to Persian 1406/1 and Gregorian 2030/12 works; changing only month/year leaves the hidden selected value untouched; selecting Persian 1406/1/10 stores Gregorian ISO 2027-03-30 with time preserved; selecting Gregorian 2030/12/15 stores its ISO date. At 320px the popup stays within the form and the month/year labels were visually inspected. The verification session was logged out.

Runtime: only task Preview Next was rebuilt/restarted (final PID 21932) and the previously stopped task proxy 3211 was restored (PID 23076). Original current listeners 3100 PID 17112 and API 4000 PID 24160 were not stopped or changed. No database, data, schema, dependency, key, API or other module change. Preview session data still resets on page refresh.

## Follow-up: customer-style calendars and Master Data v12 — 2026-09-01

PC-A, existing Ticket Catalog task. The product owner requested Ticket calendars to match the Customers calendar and asked why newly published Master Data was absent. The task branch was six develop commits behind and still compiled against Master Data contract v4. The latest `origin/develop` was fetched and merged cleanly into this task branch; no change was made directly on develop/main and no producer-owned Master Data source was edited.

All six Ticket calendars now follow the Customers interaction and visual structure: the blue trigger and Persian/Gregorian switch, clickable month/year header, day/month/year views, previous/next ranges, today/clear actions, outside/Escape close and Gregorian ISO storage. Ticket-only time selection remains available. On narrow screens the switch stacks below the trigger and the 19rem popup is aligned inside the ticket dialog; measured at 320px, calendar and form both start at x=16, the popup width is 288px and scrollWidth equals clientWidth (286px).

The Ticket consumer now uses published Master Data v12 for airlines, airports, aircraft-types, cabin-classes, baggage-rules, currencies, countries and cities. Country/city filters are sent to the public API; airport search is disabled until a city is selected and sends both countryId/cityId. Changing a geographic parent still clears dependent IDs. No direct Master Data table or internal module access was added.

The missing values were a local data issue rather than an API connection issue: before this follow-up the authenticated API returned zero airlines/cities/airports and only two currencies plus one country. The repository's bulk fixture CLI refused this runtime by design because it accepts only the isolated port 55432 and requires the existing contact-encryption key; its guard was not bypassed. After a validated PostgreSQL custom-format backup, ten explicitly synthetic records from the approved demo definitions were created through the normal authenticated Master Data API, retaining service validation and ordinary audit: country, currency, region, city, airport, organization, airline, aircraft type, cabin class and baggage rule. No account, FX rate, contract, inventory, passenger, contact, phone, payment or real-world reference was created. Final authenticated counts used by Ticket are airline 1, airport 1, aircraft type 1, cabin class 1, baggage rule 1, currencies 3, countries 2 and cities 1.

Validation: Ticket Web suite 77 passed, targeted Ticket ESLint passed, Contracts build and complete Web typecheck passed, and final production Web build passed. Isolated Edge QA on `http://localhost:3100` used a normal administrator login and exercised all six calendars, Persian 1406/1 and Gregorian 2030/12 selection with preserved ISO/time, all eight searchable Ticket references, geographic dependency order, and 320px containment with no page errors. The QA session was logged out. Port 3100 continues through the loopback same-origin proxy to the final task Web build on 3212 and existing API on 4000.

## Follow-up: independent outbound/return creation and ticket naming — 2026-09-01

PC-A, existing Ticket Catalog task and branch. The product owner requested an explicit one-way/round-trip choice inside ticket definition, a separate return-ticket form when round-trip is selected, independent saleability of both directions, and replacement of the misleading user-facing “program title” terminology. Reserved scope remains the existing ticket-catalog Web/API mirrored model, ticket-local tests and this task document; no schema, migration, persistence, Sales, Reservations, Master Data producer, shared UI, dependency or lockfile change.

The create dialog now starts with `نوع بلیت: یک‌طرفه / رفت‌وبرگشت`. Round-trip mode collects a separate return ticket name, airline, flight number, aircraft, cabin class, baggage, country/city/airport endpoints, local departure/arrival times, IANA zones and explicit UTC offsets. The return route is initially reversed from the current outbound route and remains editable. Initial supply type, company ownership, entry method, capacity, purchase fare/version validity and rules are copied from the outbound definition at save time. The UI clearly states this behavior.

Saving a round-trip definition validates and creates two distinct Preview Product records with separate product IDs. It does not create a two-segment inseparable product and stores no forced bundle: either directional ticket remains independently editable/copyable and can be selected as a one-way product, while the existing journey composer can select both together. Editing an existing ticket remains a single-ticket operation because no persistent pairing contract exists in Phase A. User-facing create/view/edit/list labels now use “بلیت” and `نام بلیت`; the mirrored Web/API validation message was updated byte-for-byte.

Validation: all 517 Web tests passed across 67 files, including two new tests for reversed return geography/timezones and non-shared mutable fare/segment objects; targeted API Ticket Catalog tests passed 41/41; complete Web ESLint, TypeScript check and production build passed. Web `http://127.0.0.1:3100/login?next=%2Fticket-management` and API health on 4000 both returned 200. The final task Web build is listening directly on loopback port 3100 and the local API is listening on 4000. In-app browser automation could not initialize because its Windows sandbox returned the known deny-read ACL error, so no interactive browser claim or screenshot is made for this follow-up.

A concurrent full API test run completed 665 tests and skipped 66, with two unrelated 10-second setup-hook timeouts in Customers HTTP and Master Data XLSX tests while the Web build was consuming resources. The isolated Ticket API suite then passed completely. A fresh worktree API production build is currently blocked by stale generated Prisma client types for later Master Data models (160 pre-existing cross-module errors); this follow-up changes no Prisma source or generated client. The already-built local API checkout was started with ephemeral in-memory development keys and the existing local database; no key, credential or secret was written to Git.

## Follow-up: themed Ticket Catalog select menus — 2026-09-01

PC-A, existing Ticket Catalog branch and component-only reservation. The product owner supplied a screenshot showing native browser option panels and requested lists that follow the application theme. All nine remaining native `select` controls in Ticket Catalog were replaced with the existing shared Radix-based themed Select primitives already used by Customers and Master Data: catalog status/supply/airline/sort filters, preview-state selector, ticket definition mode, form supply and entry method, and the reference-browser resource selector. No shared UI component, dependency, API, database or other module changed.

The new menus use the application surface/popover colors, rounded borders, focus styling, highlighted rows, selected-item checkmark, RTL direction and themed disabled state. The airline “all” option uses a non-empty internal sentinel because Radix reserves the empty value; the public filter state still receives the original empty string, preserving query behavior. All native `select` and `option` elements are now absent from Ticket Catalog components.

Validation: all 517 Web tests passed, complete Web ESLint and TypeScript checks passed, and the production build with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1` passed. The final build is active directly on loopback port 3100 (PID 5320), and the login route returns 200. Interactive browser automation remains unavailable because of the previously documented Windows ACL failure, so this follow-up makes no screenshot or interactive-visual claim.

## Follow-up: clarify Ticket Catalog ownership and definition fields — 2026-09-01

PC-A, existing Ticket Catalog component and task-document scope. The product owner requested replacing the technical Phase-A header copy because it implied tickets might be defined elsewhere. The page header now identifies Ticket Management as the authoritative product surface for defining and managing sellable ticket origin/destination, departure/arrival date and time, flight details, cabin class, baggage, supply type and capacity. It separately states that passenger issuance and reservation operations belong to Reservations.

The prominent warning was changed to an informational message: definition occurs here, while Preview entries in the current build remain temporary and clear on reload. No persistence or operational capability is claimed. Validation: 517 Web tests and complete Web ESLint passed; production build and TypeScript compilation passed. The final API-configured build is active on loopback port 3100 (PID 17372), and login returns 200.

## Follow-up: automatic ticket identity and airport time zones — 2026-09-01

PC-A, existing Ticket Catalog branch and ticket-local scope. At the product owner's request, the visible ticket-name fields and the origin/destination IANA time-zone and UTC-offset fields were removed from both one-way and round-trip creation. These are technical metadata and are no longer entered by the operator.

Each ticket name is generated at save time from its flight number and selected airport/city route. The Ticket consumer now reads the published airport `ianaTimezone` attribute; selecting an airport assigns its zone internally, and changing or clearing its parent country/city clears that hidden zone to avoid stale metadata. The UTC offset is inferred and validated for the selected local departure/arrival date, including daylight-saving transitions. If Master Data lacks a usable airport zone or the local time falls in an invalid clock-transition gap, the form reports a user-facing error instead of exposing technical inputs. Empty drafts use UTC only as a neutral preselection fallback.

### TICKET-CATALOG-002 — Optional schedule handoff

The product owner removed movement date/time and purchase-fare validity dates from the ticket-definition form. New ticket definitions therefore persist no fabricated timestamp: `departureAt`, `arrivalAt`, `validFrom`, and `validTo` remain empty until a later scheduling flow supplies real values. Web and API validation accept the fully empty pairs, preserve existing scheduled values during edits, and still reject partial or inconsistent pairs. Existing scheduled products, filters, details and repeated definitions remain backward compatible; empty schedules display as `بدون زمان‌بندی`.

Validation: all 520 Web tests passed across 67 files, targeted Ticket API tests passed 41/41, complete Web ESLint and TypeScript checks passed, and the API-configured production Web build passed. The final build is active on `127.0.0.1:3100` (PID 15376), and the login route returns 200. API port 4000 was not restarted. Browser automation remains unavailable because of the known Windows ACL failure, so no interactive visual claim is made. No database, schema, migration, dependency, Master Data producer, Sales, Reservations or shared UI change was made.

## Follow-up: complete browser-managed catalog, recurring copies and land transport — 2026-09-01

PC-A, existing Ticket Catalog branch and module-local scope. The product owner requested removing the Preview/state-simulator surface, completing add/edit/delete/duplicate operations, supporting date-adjusted weekly/monthly copies, adding train and bus definitions, and supplying synthetic one-way and round-trip examples. No Master Data producer, Sales, Reservations, shared UI, dependency, schema or migration file was changed.

The Ticket page now opens directly as a management workspace. The start/end Preview controls, simulated HTTP-state selector, Journey Preview composition panel, reference-debug browser, disabled export control and development-status matrix are no longer rendered. Products and selected Master Data snapshots persist in versioned browser local storage and survive reload on that browser. The UI states this storage boundary in the page description; it does not claim shared server/database persistence. A malformed stored snapshot fails closed and reloads safe synthetic samples.

Create, view, edit, delete, lifecycle transitions and duplicate-as-new are available. “Copy and change date” opens a new editable definition without reusing identity/history. The recurring action creates 1..24 independent weekly or monthly drafts, shifts departure/arrival and purchase-fare validity dates together, clamps month-end dates safely, resets forced trip pairing and does not copy reservation allocations. Round-trip creation still produces two independently editable/sellable products and records their outbound/return roles under a local group; one-way products remain independent.

Transport is now an explicit type: flight, train or bus. Flight consumes airlines, aircraft types, airports, cabin classes and baggage rules. Train consumes published `rail-companies` and `train-types`; bus consumes published `bus-companies` and `bus-types`. All three consume country/city and currency references through Master Data v12. Train/bus collect station/terminal names and use the same UTC schedule validation, capacity, supply, purchase-fare version and rules. The mirrored Web/API domain validates transport-specific reference kinds; flight-only references are not required for land tickets.

Nine synthetic examples load automatically when this browser has no saved catalog: three flights, three trains and three buses, comprising three one-way tickets and three outbound/return pairs. They have explicit “نمونه ساختگی” badges, display snapshots only and no fabricated Master Data IDs, PNR, passenger, Hold or confirmed counters. The samples can be restored without deleting user-created entries.

Validation: complete Web suite 521/521 passed; targeted Ticket Web 83/83 and Ticket API 44/44 passed; complete Web ESLint and TypeScript checks passed; the API-configured production Web build passed. Browser-client setup failed before discovery because the known Windows deny-read ACL terminated its sandbox, so no interactive visual claim is made. The exact build is active at `http://127.0.0.1:3212` (PID 2872), login returns 200 and API 4000 remained unchanged. Port 3100 had been reacquired by the main-checkout Next development service (parent PID 3188/listener PID 16696); the safety reviewer rejected force-stopping it because the original task contract protects existing 3100 services. Switching 3100 therefore remains a final explicit runtime approval/action, not an unreported replacement.

Server persistence remains a separate Stage-B handoff: Prisma/Migration ownership, Ticket API/controller wiring, dedicated permission and transactional inventory/Audit must be reserved before replacing browser storage. Current CRUD is functional and persistent on this browser but is not shared among users or devices. Central status owners should carry this boundary and the transport/repeat capability forward when Stage B is authorized.

## Follow-up: route operations and issued-ticket reporting — 2026-09-02

At the product owner's request, every active catalog card now exposes a visible labelled `توقف فروش` action rather than an icon-only control. The existing guarded `active → paused` domain transition remains the only behavior; no inventory, reservation or passenger state is mutated by this action.

Catalog filters now include independent origin and destination city selectors. A route summary counts every defined flight/train/bus product exactly once and exposes each route as a quick filter. Counts describe catalog products, not seats sold or passenger issuance.

The same page has a separate `بلیت‌های صادرشده مسافران` tab with prepared read-only filters for contract number, passenger display name, ticket number/PNR, origin, destination, airline, lifecycle status and issue-date range. It also defines total and per-route issued-ticket summaries. Runtime rows intentionally remain empty until Reservations publishes a public versioned read contract. Ticket Catalog does not query Reservations tables, persist passenger data, or own issuance/refund operations; no synthetic production row is shown.

Validation: 92 targeted Ticket Web tests, full lint and typecheck, 1,392 Monorepo tests and the complete production build with 34 routes passed. No Prisma schema, Migration, Seed, dependency/lockfile, public contract, permission or application database changed.
## Follow-up: reactivation and universal editing — 2026-09-02

At the product owner's request, every catalog card now shows an icon-only power control: red stops active sales, green activates paused or draft tickets, and cancelled tickets show a disabled gray power icon. Visible button text is removed while title and aria-label preserve the action meaning. Every catalog ticket can be opened for editing regardless of lifecycle status; editing preserves that status. The existing optimistic-version, reference, capacity and allocated-inventory guards remain enforced, and cancelled tickets still cannot transition back to active.

Activation no longer depends on the purchase-fare validity window because sale pricing belongs to Sales; positive capacity and the ticket definition/reference validation remain enforced. Regression coverage confirms that a ticket with an expired purchase-fare window can be activated. Validation: 93 Ticket Web tests and 47 Ticket API tests passed, along with targeted Web/API ESLint, both TypeScript checks, and production builds for Web and API. The exact Web build is active on localhost:3100 with API health on localhost:4000. No Prisma schema, migration, seed, dependency, lockfile, permission, public contract or reservation data changed.
