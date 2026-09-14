# PACKAGE-PRICING-001 — مدیریت قیمت و پکیج‌ها

Branch: `codex/pc-a-package-pricing` · Draft PR: `#278` به `develop` (merge نشده)

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

Prisma format/validate/generate موفق است. پس از follow-up همه ۶۴ Migration روی PostgreSQL 16
خالی اعمال شدند؛ `migrate status` به‌روز بود، سه جدول نرخ هتل و دو trigger immutable
جدید نصب شدند و seed دو بار پیاپی موفق بود. ۲۳ تست هدفمند follow-up و قرارداد بصری نیز
موفق‌اند. تست تحویل اولیه: ۲۰ تست هدفمند API، ۱۷ تست UI/navigation و ۷۵ تست database موفق. typecheck چهار package
Contracts/Database/API/Web، lint کامل API/Web/Contracts/Database و Production Build API/Web
(۴۷ صفحه، شامل `/sales/pricing`) موفق‌اند. `git diff --check` و Secret/PII scan پیش از commit اجرا شد.
