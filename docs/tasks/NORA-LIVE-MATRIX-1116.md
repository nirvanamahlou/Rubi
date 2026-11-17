# Nora actual model matrix — 2026-11-16 — PC-C

Owner requests the actual30-case matrix, root-cause repairs and a result report. Isolated branch codex/pc-c-nora-live-matrix-1116 from6204acc28; no production mutation or deployment. Actual Groq calls use the existing authenticated Germany-proxy transport; fixtures use unique disposable local PostgreSQL databases and restricted per-case reader logins. No real customer records are sent to the model.

## Evidence-led repairs

1. The previous harness routed the newly introduced count-breakdown endpoint into the SQL path with undefined sql. This produced QUERY_REJECTED loops and consumed provider quota. The harness now calls the real native readContractCountBreakdown with a real fixture Prisma client; its two Reservations lifecycle tables are explicitly present, the client is disconnected before cleanup, and four native scopes are checked against raw fixture SQL. Receipts distinguish native count reads from model SQL. The runner fingerprints both native source files.
2. Seven cases passed on the intermediate source; customer-name ambiguity failed because the model returned ANSWER listing three matches without asking which contract to inspect. Clarified the final response instruction: listing candidates is not a resolution of a single-contract inspection; require CLARIFY, current evidence and explicit selection. Existing oracles and access rules remain unchanged.
3. A subsequent real response invoked an unadvertised json function twice, producing Groq tool_use_failed even after the bounded protocol repair. The adapter now advertises an existing-schema json final transport alias only after planning and canonicalizes successful calls into finish_answer. Returned tool names must belong to this request's stage. Failed generations remain unparsed/unexecuted, tool validation stays enabled, plain JSON content remains compatible, and no turn/token/query/access budget is increased. Three new transport regressions cover legitimate final calls, planning bypass and unoffered-tool rejection. Official tool contract: [Groq local tool calling](https://console.groq.com/docs/tool-use/local-tool-calling).

## Validation protocol

All120 service tests, six pacing regressions, API scoped lint and Node syntax checks pass. The independent native-count PostgreSQL preflight passes. A local-only uncommitted Vitest config resolves manifest-matching pg/parser/Prisma dependencies from the existing installed acceptance workspace; shared dependency links and lockfile are not modified. Initial setup failure before any model call is retained separately.

Every matrix attempt has a private receipt, independently derived numeric/scope references and a source fingerprint. Provider429 failures are retried only using actual provider feedback; they are not passes. Completed cases may be resumed only with exactly the same fingerprint and verified original receipts. Any source change invalidates prior passes for final certification. The final model matrix is in progress; earlier7/30 and other intermediate passes are not a final-source result. Native IAM/browser end-to-end acceptance is distinct from this real-Groq + real isolated SQL harness.

The observed quota-blocked results and cleanup/CI handoff follow below. No secret, private configuration or raw model receipt is committed.

## نتیجه واقعی اجرا — هنوز پذیرش۳۰تایی کامل نیست

روی سورس آزموده‌شده با اثرانگشت `c01a3be96403a1a08bf84050c69b9c36c2dffbdfc5d6985822efdb7d0979e95f` و سرِ PR `efc470567a5777b59593e9782416d8565339c0d1`، چهار سناریوی مدل (۱ تا۴) پاس شدند: تعداد مرجع به‌ترتیب۵،۴،۳،۱ بود. کنترل منفی۲۹ نیز با خطای موردانتظار AGENT_SOURCE_UNAVAILABLE و صفر فراخوانی مدل پاس شد. این مجموع۵ مورد از۳۰ است، شامل۴ پاسخ واقعی Groq و یک کنترل تزریق خطا؛۲۵ مورد هنوز تأیید نشده‌اند. سناریوی۵ با429/TPD متوقف شد و۲۴ سناریو روی این سورس هنوز اجرا نشده‌اند. هفت پاسِ سورس میانی و خطای ابهامِ سناریوی۸ در رسیدهای قبلی محفوظ‌اند و به سورس نهایی نسبت داده نمی‌شوند.

| # | سناریو | نتیجه روی اثرانگشت آزموده‌شده |
|---:|---|---|
| 1 | همه قراردادهای مجاز | موفق با Groq واقعی |
| 2 | قراردادهای شعبه | موفق با Groq واقعی |
| 3 | قراردادهای خود کاربر | موفق با Groq واقعی |
| 4 | شرکت انتخاب‌شده | موفق با Groq واقعی |
| 5 | رکورد مخفی | تلاش شد؛ متوقف با سهمیه TPD |
| 6 | شماره کامل قرارداد | هنوز روی این سورس اجرا نشده |
| 7 | شماره با ارقام فارسی | هنوز روی این سورس اجرا نشده |
| 8 | نام مشتری با چند قرارداد | هنوز روی این سورس اجرا نشده |
| 9 | قرارداد ناموجود | هنوز روی این سورس اجرا نشده |
| 10 | قرارداد خارج از دسترسی | هنوز روی این سورس اجرا نشده |
| 11 | مبلغ USD، تمام وضعیت‌ها | هنوز روی این سورس اجرا نشده |
| 12 | مبلغ دقیق IRR | هنوز روی این سورس اجرا نشده |
| 13 | تخفیف قراردادی | هنوز روی این سورس اجرا نشده |
| 14 | حذف لغو از فروش استاندارد | هنوز روی این سورس اجرا نشده |
| 15 | حذف پیش‌نویس از تعداد استاندارد | هنوز روی این سورس اجرا نشده |
| 16 | مرز نیمه‌شب تهران | هنوز روی این سورس اجرا نشده |
| 17 | بازه میلادی | هنوز روی این سورس اجرا نشده |
| 18 | تاریخ شمسی | هنوز روی این سورس اجرا نشده |
| 19 | ابهام فروش این ماه | هنوز روی این سورس اجرا نشده |
| 20 | مقایسه دو روز | هنوز روی این سورس اجرا نشده |
| 21 | تعداد مسافر | هنوز روی این سورس اجرا نشده |
| 22 | گروه سنی | هنوز روی این سورس اجرا نشده |
| 23 | تفکیک خدمات | هنوز روی این سورس اجرا نشده |
| 24 | جلوگیری از چندبرابرشدن مبلغ با join | هنوز روی این سورس اجرا نشده |
| 25 | بیشترین مبلغ با پیش‌نویس | هنوز روی این سورس اجرا نشده |
| 26 | وضعیت‌های پرداخت | هنوز روی این سورس اجرا نشده |
| 27 | نبود مجوز پرداخت | هنوز روی این سورس اجرا نشده |
| 28 | مانده حسابداری پشتیبانی‌نشده | هنوز روی این سورس اجرا نشده |
| 29 | قطع منبع (کنترل منفی) | موفق؛ تزریق خطا، بدون فراخوانی مدل |
| 30 | ابطال نشست در میانه درخواست | هنوز روی این سورس اجرا نشده |

## علت توقف و مصرف حساب

Groq ابتدا TPM و سپس TPD اعلام کرد. حتی پس از رعایت Retry-After اعلام‌شده، سه تلاش ادامه دوباره با TPD و انتظارهای۱۱۲،۱۰۲ و۴۰۹ ثانیه متوقف شدند. حلقه ادامه فقط هنگام انتظار، بدون فرایند فرزند/دیتابیس فعال متوقف شد؛ درخواست خودکار بی‌پایان یا دورزدن سهمیه انجام نمی‌شود. پاسخ به سؤال صاحب محصول درباره «۱۰۰۰ درخواست»: تصویر۲۴۷ API Calls را نشان می‌دهد؛ این شمارنده توکن نیست. بررسی حداقلی مستقل در `2026-11-16T13:01:35.921Z` برای همان مدل، سقف درخواست۱۰۰۰ و باقی‌مانده۸۵۹ را نشان داد؛ سقف هدر توکن۸۰۰۰ مربوط به **دقیقه** است و با سهمیه توکن روزانه اشتباه گرفته نمی‌شود. آن بررسی کوچک۷۳ توکن گزارش کرد و جزو سناریوهای۳۰تایی محسوب نمی‌شود. [تعریف رسمی محدودیت‌های Groq](https://console.groq.com/docs/rate-limits).

برای تکمیل مدل، ظرفیت توکن واقعی لازم است؛ افزایش سهمیه/طرح یا صبر تا تأمین ظرفیت تصمیم صاحب حساب است. کلید جایگزین هم‌سازمان راه‌حل سهمیه مشترک نیست. با تغییر سورس، تمام۳۰ سناریو باید از نو روی اثرانگشت جدید تأیید شوند؛ صرفاً تغییر runner یا نادیده گرفتن429، پذیرش محسوب نمی‌شود.

## اصلاح استناد و شواهد مستقل

پس از ثبت یک resultId ساختگی/کوتاه‌شده، اعتبارسنجی موجود آن را به‌درستی رد کرد. schema ابزار نهایی اکنون فقط شناسه‌های واقعی evidence همان درخواست را به‌صورت enum می‌پذیرد (و پیش از evidence آرایه خالی). schema برای هر درخواست جدا ساخته می‌شود؛ history یا شناسه درخواست دیگر منبع اعتماد نیست، و شناسه اشتباه خودکار جایگزین نمی‌شود. تست جداسازی دو درخواست و evidence خالی اضافه شد.

هر۱۲۰ تست سرویس،۶ تست pacing، preflight واقعی native count برای چهار scope و syntax/API lint موفق‌اند. هر۱۰ بررسی CI روی `efc470567a5777b59593e9782416d8565339c0d1` موفق‌اند: build، کیفیت، کل تست‌ها، PostgreSQL و read boundary در Push و PR. این‌ها جایگزین مدل۳۰تایی یا آزمون مرورگر/IAM زنده نیستند.

ممیزی رسیدها62 دیتابیس موقت را شناسایی کرد؛ هیچ‌یک و هیچ حساب موقت متناظر باقی نمانده‌اند. ممیزی چیزی حذف نکرد؛ afterAll خود تست‌ها پاک‌سازی کرده است. محیط پیکربندی محلی فقط برای resolve وابستگی‌های نصب‌شده استفاده و پس از توقف به tmp منتقل شد؛ هیچ lockfile/dependency یا داده عملیاتی تغییر نکرد.

## تحویل

[PR1761](https://github.com/nirvanamahlou/Rubi/pull/1761) عمداً Draft و مرج/منتشر نشده است؛ مدل۳۰تایی هنوز gate باز دارد. پس از آخرین CI، develop با PR1759 در فایل‌های مرکزی وضعیت/تخصیص جلو رفت؛ PR نیازمند حفظ هر دو دسته یادداشت هنگام یکپارچه‌سازی است. تغییرات مرتبط provider/query آزموده‌شده با اثرانگشت بالا ثابت‌اند، ولی هر ادغام که اثرانگشت runtime را عوض کند به اجرای کامل جدید نیاز دارد.

این گزارش روی شاخه مستقل codex/pc-c-nora-live-matrix-report-1116 ثبت می‌شود تا سرِ دارای۱۰ CI موفقِ اصلاحات بدون تغییر بماند. رسیدهای کامل، خطاهای Groq و تنظیمات خصوصی خارج Git نگه داشته می‌شوند؛ این واحد هیچ تغییری روی سرویس یا داده Production منتشر نکرد.

## PR1761 integration — 2026-11-17

Owner explicitly authorizes conflict repair and develop merge. Integrated develop59d750dfe without dropping its native-count/token-efficiency route. Combined currentResultIds with nativeStep selection; regression captures each provider option and proves final citations receive only current evidence IDs. All136 integrated service tests pass. Existing four live model passes and one source-down control are historical pinned-source evidence, not a new30-case certification. Final-head hosted checks gate merge; no deployment.
