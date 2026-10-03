# PACKAGE-PRICING-001 — مدیریت قیمت و پکیج‌ها

Branch: `codex/pc-a-package-pricing` · Draft PR: `#278` به `develop` (merge نشده)

## تحویل جدید — 2026-09-15، فقط پیش‌نمایش ایزوله ۳۲۰۰

مالک اجازه داد `origin/develop` فقط در شاخه همین کار ادغام شود. پس از آن، بلیت
واقعیِ قابل فروش در Ticket Catalog یک درخواست خرید بدون مبلغ با FK به آفر و
نسخه آن در Procurement می‌سازد. پیش‌نویس محلی بلیت درخواست موازی نمی‌فرستد.
مالی قیمت خرید واحد بزرگسال/کودک، مبلغ فاکتور و ارز را به‌صورت revision غیرقابل
ویرایش ثبت می‌کند و پرداخت مستقیمِ ثبت‌شده را با حساب، روش، زمان UTC، نرخ تسعیر
و شماره پیگیری نگه می‌دارد. این ثبت، اجرای حواله بانکی یا سند حسابداری خودکار
نیست. پرداخت جزئی نرخ را برای فروش آزاد نمی‌کند؛ فقط تسویه کامل، درخواست را
اتمی PAID می‌کند و نرخ خرید از قرارداد عمومی مالی به جدول فروش می‌رسد.

در `/sales/pricing` برای هر نوبت تور و هر batch خرید هتل، پیش‌نویس نسخه‌دار
قابل ذخیره/بازگشایی/ویرایش است. هر ردیف هتل افزایش/کاهش درصدی یا ثابت خودش
را دارد؛ قیمت‌های هتل‌های جایگزین جمع نمی‌شوند. قیمت فروش پرواز بزرگسال/کودک،
افزایش نرخ بیزینس و درصد کمیسیون جدا وارد می‌شوند. انتشار با تأییدکننده‌ای
غیر از آخرین ویرایشگر و پس از بازبینی شعبه/هتل/تاریخ/ظرفیت/ارز/نسخه خرید مالی
انجام می‌شود. نسخه منتشرشده و ردیف‌های قیمت اتاق immutable هستند. پنج ترکیب
مسافر معلوم، قیمت نهایی پکیج و سود پس از کسر کمیسیون دارند؛ family فعلاً فقط
قیمت اقامت دارد، چون تعداد مسافر در منبع مشخص نیست. ارز متفاوت بدون قرارداد
تسعیر تأییدشده قابل انتشار نیست.

API جدید: `POST /api/v1/finance/ticket-purchases/:requestId/costs|payments`،
`GET/POST /api/v1/sales/pricing/tour-drafts`،
`GET /api/v1/sales/pricing/tour-drafts/publications` و
`POST /api/v1/sales/pricing/tour-drafts/:draftId/publish`.
دو Migration افزایشی Finance Ticket Cost و Sales Tour Draft/Publication اضافه
شدند. ۶۷ Migration از صفر روی PG ایزوله موفق بودند و فقط همان‌ها در دیتابیس
synthetic پیش‌نمایش ۳۲۰۰ اجرا شدند. live API: NEW بدون مبلغ هنگام انتشار آفر،
ثبت خرید، پرداخت کامل PAID، آزاد شدن نرخ برای Sales، ذخیره و ویرایش نسخه ۱→۲،
رد maker/checker با ۴۰۳ و انتشار با بازبین دوم: ۱۸ ردیف اتاق برای ۳ هتل.
برای یک گزینه دوتخته، قیمت پکیج ۸۵۶ EUR و سود خالص ۱۷۰٫۴ EUR شد. HTTP وب
۳۲۰۰ و API ۴۲۰۰ پاسخ ۲۰۰ دارند؛ ۳۱۰۰ و داده عملیاتی دست‌نخورده‌اند. تست‌های
هدفمند API (۱۱ تست مالی/تور و ۲ تست retry آفر) و Web (۱۵ تست متاثر)، lint چهار
package و build/typecheck API/Web موفق شدند. retry آفرِ یکسان با ترتیب متفاوت
فیلدهای JSON پس از اصلاح، همان ID را برگرداند. کنترل بصری مرورگر به علت خطای
Windows sandbox ACL ممکن نشد و ادعای QA بصری نداریم. مصرف مستقیم نسخه جدید
در quote قرارداد فروش، FX تأییدشده و occupancy خانوادگی handoff باز هستند.

بخش بعدی سند، تاریخچهٔ مرحله قبلی پیش‌نمایشِ بدون انتشار است.

## مرحله قبلی درخواست مالک — 2026-09-15 (در آن زمان انتشار تکمیل نشده بود)

زیرگروه واقعی «مدیریت قیمت و پکیج‌ها» زیر «فروش» در sidebar اضافه شد و CTA موقت
داشبورد قراردادها حذف شد. صفحهٔ /sales/pricing دیگر workspace هشت‌برگهٔ عمدتاً
خالی نیست: نوبت تور موجود را می‌گیرد، نرخ خرید همان هتل‌ها/بازه را از projection
عمومی Reservations نمایش می‌دهد و برای هر هتل و شش نوع اتاق، خرید و پیش‌نمایش
فروش کل اقامت را با افزایش/کاهش درصدی یا مبلغ ثابت محاسبه می‌کند. گزینه‌های هتل
مستقل‌اند. نرخ خرید و ضرایب فقط‌خواندنی‌اند. درصد کمیسیون از سود کم می‌شود و
قیمت فروش را بالا نمی‌برد؛ فیلدهای پرواز در Sales قیمت فروش‌اند.

این پیش‌نمایش هنوز draft ماندگار و قیمت منتشرشده نیست. کاربر روشن کرد نرخ خرید
پرواز از درخواست تعریف بلیت به مالی می‌رود و مالی آن را ثبت و پرداخت می‌کند.
TicketPublishedOffer فعلی هیچ نرخ خریدی ندارد و Finance Inbox هیچ درخواست
خرید بلیت پیش از قرارداد را مصرف نمی‌کند؛ Purchases نیز NOT_CONNECTED است.
تا قرارداد عمومی نسخه‌دار قیمت خرید/پرداخت پرواز، تأیید خرید طبق معماری و محاسبه
قیمت جداگانهٔ قابل ذخیره/انتشار اضافه نشوند، انتشار بسته است. سود کل ساختگی
و وضعیت پرداخت ساختگی نمایش داده نمی‌شود. ADR-PACKAGE-FLIGHT-FINANCE-COST-0915
مرز این ادامه را ثبت می‌کند.

QA زندهٔ پایگاه کاملاً جداگانهٔ ۳۲۰۰/۴۲۰۰: login نمونه، GET نوبت تور و جدول
هتل‌ها هر سه ۲۰۰؛ تور پنج‌شبه با ظرفیت ۲۴، سه هتل و یک batch خرید (سه ردیف،
بدون هتل جاافتاده) بازخوانی شد. قیمت‌های جدول صرفاً دادهٔ synthetic پیش‌نمایش
هستند؛ هیچ دادهٔ مشترک/عملیاتی تغییر نکرد. ابزار مرورگر با خطای sandbox
فعال نشد و ادعای QA بصری نداریم.

## محدوده تحویل

- Route داخلی Sales: `/sales/pricing`؛ مسیر legacy به آن redirect می‌شود و آیتم مستقل منو حذف شده است.
- قرارداد v1 در `@nora/contracts`، ۱۵ permission deny-by-default، controller/service مستقل و ۱۳ مدل داخلی.
- Migration فقط شامل CREATE TYPE/TABLE/INDEX/FK/CHECK/TRIGGER است و update/delete قیمت منتشرشده را رد می‌کند.
- موتور Decimal برای fixed/percent/multiply/divide/fee/commission/tax/profit/round/minimums، ترتیب rule و قیمت رده مسافر.
- create/list/detail package، replace rule، create/publish price version، stop/archive، quote، template list/create، render request و audit.
- UI فارسی/RTL/responsive با هشت برگه، branch filter، permission gating و loading/empty/error/unauthorized/forbidden/conflict؛ بدون sample price یا موفقیت جعلی.

## API

Prefix: `/api/v1/sales/pricing`. Endpointهای اصلی: `GET/POST /packages`، `GET /packages/:id`،
`PATCH /packages/:id/stop|archive`، `POST /packages/:id/periods/:periodId/rules`،
`POST /packages/:id/departures/:departureId/price-versions`، publish همان نسخه، `POST /quotes`،
`GET/POST /banner-templates`، `POST /render-requests` و `GET /packages/:id/audit`.

## امنیت و یکپارچگی

همه عملیات به actor و شعب مجاز محدودند. create/quote/render idempotency دارند؛ mutationهای نسخه‌دار
با 409 تعارض را رد می‌کنند؛ ناشر Price Version نمی‌تواند checker همان نسخه باشد. مبالغ فقط
Prisma.Decimal و currency code هستند. Legal Entity `ALL` برای render رد می‌شود. published price
هرگز update/delete نمی‌شود و قرارداد/quote snapshot قبلی ثابت می‌ماند.

## Follow-up مدیریت قیمت هتل

مسیر `/master-data/accommodation/hotel-rates` یک workspace فارسی/RTL برای ساخت و
بازکردن بازه‌ها دارد. شهر، شعبه، check-in/check-out، تعداد شب و ارز ثبت می‌شوند؛ سپس تمام
هتل‌های فعال و فروش‌پذیر همان شهر در جدول sticky و قابل‌ویرایش با جست‌وجو، انتخاب گروهی،
تیک حضور در تور، قیمت پایه هر اتاق/شب و ضرایب دوتخته، یک‌تخته، سه‌تخته، کودک با/بدون تخت
و نوزاد نمایش داده می‌شوند. محاسبه مبلغ مشتق‌شده با عدد صحیح مقیاس‌دار انجام می‌شود، نه float.

سه مدل افزایشی period/version/row، FKهای واقعی Master Data، idempotency، optimistic locking،
Audit و triggerهای immutable اضافه شدند. Public service فقط ردیف انتخاب‌شده نسخه جاری با
branch/currency معتبر را به Package Pricing resolve و recheck می‌کند؛ جدول نرخ خرید
Reservations دست‌نخورده است.

## Blocker و handoff

Public Contract نرخ پایه هتل Master Data اکنون وجود دارد و adapter آن را مصرف می‌کند. هر
reference غیرهتلی همچنان با کد پایدار fail-closed می‌ماند؛ بنابراین پکیج ترکیبی تا نرخ پایه/
ظرفیت Ticket Catalog قفل است. Renderer نیز هنوز متصل نیست و درخواست در
`AWAITING_RENDERER` ثبت می‌شود. تکمیل Ticket/FX/Renderer، export Excel/PDF و تست
end-to-end renderer کار handoff است.

## Validation

### QA پیش‌نمایش مستقل 3200 در 2026-09-15

پس از گزارش کاربر، ورودی نمایان «مدیریت قیمت و پکیج‌ها» در سرصفحه
داشبورد قراردادها اضافه شد؛ route داخلی /sales/pricing و منوی اصلی ۱۷‌بخشی
بدون تغییر باقی ماندند. تست رگرسیون Sales وجود متن و href را بررسی می‌کند.
۹ تست Sales/Pricing، lint، Web typecheck و Production Build ۴۸ صفحه موفق بودند.
Web3200 دوباره بالا آمد و با session واقعی آزمایشی، /sales و /sales/pricing
پاسخ ۲۰۰ و href دکمه در HTML زنده داشتند.

API آزمایشی روی 4200 و PostgreSQL synthetic مستقل از محیط مشترک فعال شد. تداخل
route اختصاصی بازه هتل با route عمومی Master Data رفع شد. Login آزمایشی، گزینه
شهر تهران و سه هتل، POST بازه پنج‌شبه با دو هتل منتخب، PATCH نسخه ۱ به ۲ و GET
جزئیات/فهرست با نرخ اصلاح‌شده ۱۳۰ موفق‌اند. Web3200 login و صفحه نرخ هتل و
API4200 health پاسخ ۲۰۰ می‌دهند. کنترل بصری مرورگر به علت reset ابزار انجام نشد.
Web3100/API مشترک و داده عملیاتی تغییر نکردند؛ هیچ migration جدیدی ایجاد نشد.

Prisma format/validate/generate موفق است. پس از follow-up همه ۶۴ Migration روی PostgreSQL 16
خالی اعمال شدند؛ `migrate status` به‌روز بود، سه جدول نرخ هتل و دو trigger immutable
جدید نصب شدند و seed دو بار پیاپی موفق بود. ۲۳ تست هدفمند follow-up و قرارداد بصری نیز
موفق‌اند. تست تحویل اولیه: ۲۰ تست هدفمند API، ۱۷ تست UI/navigation و ۷۵ تست database موفق. typecheck چهار package
Contracts/Database/API/Web، lint کامل API/Web/Contracts/Database و Production Build API/Web
(۴۷ صفحه، شامل `/sales/pricing`) موفق‌اند. `git diff --check` و Secret/PII scan پیش از commit اجرا شد.
