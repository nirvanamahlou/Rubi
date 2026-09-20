# FINANCE-CUSTOMER-DOCUMENT-DELIVERY-0920

- مالک: `PC-A`
- شاخه: `codex/pc-a-finance-operational-cartable-0919`
- والد: `FINANCE-OPERATIONAL-CARTABLE-0919`
- وضعیت: `DONE / MERGED`
- تاریخ: `2026-09-20`

## تصمیم کسب‌وکار

تحویل مدارک مسافر یک تصمیم مالی بین شرکت و مشتری است و به خرید کارگزار،
پرداخت تأمین‌کننده یا اجرای رزرواسیون وابسته نیست. مالی می‌تواند مجوز را با یکی
از سه مبنا صادر کند:

1. پس از تأیید حداقل یک پرداخت مشتری؛
2. فقط پس از تسویه کامل قرارداد؛
3. پس از تسویه کامل یا با استثنای معتبر مدیر.

مبنای انتخاب‌شده، دلیل Audit، نسخه، عامل تغییر و در استثنای مدیر شناسه
تأییدکننده دوم و تاریخ انقضا ثبت می‌شوند. استثنای مدیر فقط با Permission موجود
`finance.financial_release.override`، تأییدکننده دوم متفاوت و انقضای معتبر
آینده پذیرفته می‌شود.

## پیاده‌سازی

- aggregate افزایشی و append-only مالی در
  `FinanceCustomerDocumentDeliveryRevision` با optimistic locking؛
- Migration افزایشی
  `20260920130000_finance_customer_document_delivery` بدون حذف یا بازنویسی داده؛
- قرارداد عمومی نسخه‌دار Finance برای سه مبنا و وضعیت مجوز؛
- projection عمومی Sales برای جست‌وجوی جزئی/کامل شماره قرارداد، وضعیت تسویه و
  وجود پرداخت تأییدشده، بدون query مستقیم Finance به جدول Sales؛
- API و رابط کارتابل مالی برای جست‌وجو، صدور و لغو مجوز؛
- امکان صدور هم‌زمان مجوز در تأیید دریافت مشتری؛
- مصرف مجوز جدید در تحویل مدارک Sales و خروجی‌های Manifest رزرواسیون.

## مرزها و امنیت

- Finance جدول خصوصی Sales یا Reservations را مستقیم نمی‌خواند؛
- Branch scope در producer یعنی Sales کنترل می‌شود؛
- همه mutationها Permission، دلیل Audit و expectedVersion می‌خواهند؛
- خرید/پرداخت کارگزار همچنان جریان مستقل مالی خود را دارد و Gate مدارک مشتری نیست؛
- هیچ پرداخت بیرونی، داده واقعی، Dependency یا Lockfile جدید ایجاد نشده است.

## پذیرش

- جست‌وجو با بخشی از شماره قرارداد یا شماره کامل؛
- رد مبنای «پس از دریافت» پیش از وجود پرداخت تأییدشده؛
- رد مبنای «تسویه کامل» پیش از تسویه؛
- رد استثنای ناقص، منقضی یا بدون Permission؛
- جلوگیری از تغییر هم‌زمان با `409 CONCURRENT_MODIFICATION`؛
- دسترسی Sales و Manifest فقط پس از مجوز contract-level مالی.
## کنترل کیفیت

- Prisma format/validate/generate: موفق؛
- ۸۶ Migration از صفر روی PostgreSQL 18 موقت: موفق و schema به‌روز؛
- Database: ۷۸ تست پاس و ۱۴ تست محیطی skip؛
- تست هدفمند API: ۳۰ تست در ۴ فایل پاس؛
- تست قرارداد UI مالی: ۸ تست پاس؛
- lint و typecheck بخش‌های Contracts، Database، API و Web: پاس؛
- Production Build قرارداد، دیتابیس، API و Web با ۵۰ route: پاس؛
- PostgreSQL موقت بدون Volume متوقف و حذف شد.
## Handoff نهایی

PR #322 با Source HEAD `ef13aa9e49b618d244fe42fb52bf9caacfbb6460` و
Merge Commit `9c5362333f2a30cd81e0fe63faca16d7a3c0ad47` وارد `develop` شد.
قفل‌های Migration، Finance/Sales shared-contract و Central Docs این Task
`RELEASED / STABLE` هستند. Dependency/Lockfile در تمام Task آزاد باقی ماند.