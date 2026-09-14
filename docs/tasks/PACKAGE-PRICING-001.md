# PACKAGE-PRICING-001 — مدیریت قیمت و پکیج‌ها

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

## Blocker و handoff

در develop فعلی Public Contract نرخ پایه هتل Master Data و نرخ پایه/ظرفیت Ticket Management وجود
ندارد. adapter با کد پایدار fail-closed می‌ماند؛ بنابراین UI ساخت/محاسبه/انتشار را به‌جای جعل نرخ
قفل و علت را نمایش می‌دهد. همچنین Renderer هنوز متصل نیست و درخواست در `AWAITING_RENDERER` ثبت
می‌شود. تکمیل producerها، اتصال adapter، export Excel/PDF و تست end-to-end renderer کار handoff است.

## Validation

Prisma format/validate/generate موفق است. همه ۶۳ Migration روی PostgreSQL 16 خالی اعمال شدند؛
`migrate status` به‌روز بود، ۱۳ جدول و دو trigger immutable نصب شدند و seed دو بار پیاپی موفق بود.
تست‌ها: ۲۰ تست هدفمند API، ۱۷ تست UI/navigation و ۷۵ تست database موفق. typecheck چهار package
Contracts/Database/API/Web، lint کامل API/Web/Contracts/Database و Production Build API/Web
(۴۷ صفحه، شامل `/sales/pricing`) موفق‌اند. `git diff --check` و Secret/PII scan پیش از commit اجرا شد.
