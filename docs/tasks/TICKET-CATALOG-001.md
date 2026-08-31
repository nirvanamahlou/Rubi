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

| قابلیت                                                                | پیاده‌شده در A            | داده / محدودیت                                                                                            |
| --------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| فهرست، جست‌وجو، فیلتر وضعیت/تأمین/ایرلاین/تاریخ، مرتب‌سازی، صفحه‌بندی | بله                       | فقط مجموعه Preview همین صفحه؛ فیلتر تاریخ بر پایه روز UTC و نمایش شمسی                                    |
| ایجاد، مشاهده، ویرایش، کپی                                            | بله                       | فقط حافظه mount جاری؛ reload/unmount همه محصولات را پاک می‌کند؛ هیچ localStorage یا ذخیره سرور نیست       |
| برنامه یک‌طرفه، تقویم مشترک، منطقه زمانی                              | بله                       | مدل تا 8 Segment پیوسته؛ رابط ویرایش اولیه یک Segment                                                     |
| رسیدن پس از حرکت و عبور از نیمه‌شب                                    | بله                       | ISO UTC سخت‌گیرانه؛ IANA + offset صریح، رد DST gap و offset ناسازگار                                      |
| نوع تأمین و گزینه ظرفیت شرکت                                          | بله                       | company/allotment/charter/supplier مستقل از manual/api؛ ورود دستی مالکیت نمی‌سازد                         |
| نرخ خرید/فروش، ارز، کارمزد، کمیسیون و اعتبار                          | بله                       | Decimal string حداکثر 18+6 رقم، BigInt برای جمع خالص ریاضی؛ بدون FX، سود یا سیاست مالی ساختگی             |
| نسخه نرخ، شرایط و تعریف برنامه                                        | بله                       | Snapshotهای قبلی append-only در مدل؛ ویرایش مستقل از انتقال وضعیت، تاریخچه فقط کاربر و زمان واقعی Preview |
| موجودی، Hold/Confirm/Release invariant                                | بله در مدل و تست          | reducer خالص پیشنهادی؛ هیچ command عملیاتی یا شمارنده دستی در UI                                          |
| مراجع airline/currency/country/city                                   | Adapter واقعی GET         | داده API از داده نمایشی جدا؛ loading/empty/401/403/409/error؛ فعال‌سازی سرور در B باید مجدداً resolve کند |
| فرودگاه/هواپیما/کلاس/بار                                              | منتظر API                 | فیلد خالی در draft مجاز؛ شناسه نامعتبر یا inactive رد؛ فعال‌سازی بدون همه مراجع رد                        |
| IAM اختصاصی بلیت                                                      | منتظر قرارداد             | fail-closed حتی برای IAM administrator؛ هیچ allow-all یا auth bypass                                      |
| Persistence، Audit سرور، REST API بلیت                                | منتظر Migration/Handoff B | هیچ پیاده‌سازی یا ادعای ذخیره واقعی                                                                       |
| هم‌زمانی اتمیک، idempotency پایدار                                    | منتظر Transaction B       | expectedVersion در مدل فقط invariant؛ آزمایش DB انجام نشده                                                |
| خروجی فهرست                                                           | Port پیشنهادی، UI غیرفعال | snapshot فیلتر/مرتب‌سازی و actor/branch؛ مجوز در اجرا و دانلود دوباره بررسی شود                           |
| Import/Export گروهی، تکرار برنامه، رابط رفت‌وبرگشت/چندقطعه            | نقشه توسعه                | بدون دکمه موفقیت یا فایل ساختگی                                                                           |
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
- Existing API did not return CORS allow-origin for `http://localhost:3211`; configuration was not modified. The adapter truthfully reports unavailable/error from this preview origin until the service owner allows the origin. A successful authenticated Master Data integration from this port is **not claimed**.

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

- Preview: http://localhost:3211/ticket-management (production build, loopback listener, task process PID 15220 at start).
- API base compiled as `http://localhost:4000/api/v1`; only GET reference consumption is implemented. Existing auth/proxy is unchanged. Sign in through the existing authorized app/session; this task creates no user/session/credential.
- Original listeners at 3100 (PID 3340) and 4000 (PID 15952) were retained, with no stop/restart or database changes.
- Only this task's new Preview process may be stopped when no longer needed.
- No screenshots or successful visual smoke are claimed.

مالک اسناد مرکزی پس از review، فقط ردیف TICKET-CATALOG-001 و همین ماتریس واقعی A را به WORK_ASSIGNMENTS / PROJECT_STATUS / PLANS اضافه کند؛ هیچ قفل مشترکی منتقل نشود. تست مشترک route و CORS مبدأ Preview نیز نیازهای مشخص هماهنگی‌اند.

**Phase B خودکار آغاز نشد.** شرط شروع B: Handoff صریح + رزرو تازه Schema/Migration/Contract/IAM wiring/central files، مدل FK نهایی، optimistic locking اتمیک، idempotency/fingerprint پایدار، audit/outbox و آزمون واقعی transaction/round-trip.
