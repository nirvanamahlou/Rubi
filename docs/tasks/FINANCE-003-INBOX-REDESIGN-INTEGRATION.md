# FINANCE-003 — بازطراحی و اتصال کارتابل مالی

- **Computer:** PC-A
- **Branch:** `codex/pc-a-finance-inbox-redesign-integration`
- **Base:** `origin/develop@d65d8acc`
- **Status:** READY_FOR_REVIEW
- **Ports:** Web 3200 / API 4200

## هدف

بازطراحی `/finance/requests` به‌عنوان صف عملیاتی واحد و نمایش درخواست‌هایی که واقعاً در
ماژول مبدأ ذخیره شده‌اند، بدون جایگزینی داده Preview یا دورزدن مرزهای ماژول.

## Producerهای موجود

- Sales: ردیف‌های پرداخت `PENDING_FINANCE_CONFIRMATION` در پایگاه داده موجودند؛ یک
  projection عمومی، فقط‌خواندنی و branch-scoped برای Finance اضافه می‌شود.
- HR: سرویس عمومی `HrConnectionsService` و رکوردهای persisted مقصد `finance` موجودند و
  با permission موجود مصرف می‌شوند.
- Reservations / Purchases: producer استاندارد درخواست پرداخت هنوز موجود نیست؛ وضعیت
  اتصال در UI نشان داده می‌شود و هیچ رکورد synthetic به‌عنوان درخواست عملیاتی ساخته نمی‌شود.

## مرز

- Finance فقط public application serviceهای Sales و HR را مصرف می‌کند.
- API تجمیعی فقط خواندنی است؛ تأیید دریافت، پرداخت، Journal، Audit مالی و پاسخ به producer
  تا Persistence مستقل Finance فعال نمی‌شوند.
- بدون Schema/Migration/Dependency و بدون تغییر داده واقعی یا runtime مشترک.

## نتیجه پیاده‌سازی

- endpoint فقط‌خواندنی `GET /api/v1/finance/inbox` با مجوز `finance.read` اضافه شد؛
  تجمیع‌کننده فقط public application serviceهای Sales و HR را فراخوانی می‌کند و خرابی
  هر producer را به‌صورت مستقل گزارش می‌دهد.
- Sales فقط ردیف‌های persisted با وضعیت `PENDING_FINANCE_CONFIRMATION` و شعب مجاز actor
  را projection می‌کند. HR نیز فقط ارجاع‌های persisted با مقصد `finance` را بازمی‌گرداند.
- رابط کارتابل با hero، KPI، وضعیت اتصال واحدها، جست‌وجو، فیلتر منبع/وضعیت و نمای
  master-detail بازطراحی شد. Preview قدیمی پشت بخش جمع‌شونده و با برچسب غیرعملیاتی باقی
  مانده و هرگز وارد صف زنده نمی‌شود.
- `finance.read` به قرارداد IAM، permission seed و نقش `finance_staff` افزوده شد؛ اجرای
  seed روی دیتابیس عملیاتی جزو این Task نبود.

## کنترل کیفیت

- ۸۲ تست هدفمند Contracts/Database/API/Web موفق.
- lint تمام فایل‌های متاثر، typecheck چهار package و build تولیدی API/Web موفق.
- QA مرورگر ایزوله روی Web3201، چیدمان RTL، hero، KPIها، وضعیت اتصال، فیلترها و تفکیک
  Preview را تأیید کرد. runtime مشترک Web3200/API4200 دست‌نخورده باقی ماند.

## محدودیت باقی‌مانده

تا زمانی که Reservations و Purchases producer استاندارد درخواست مالی منتشر نکنند، وضعیت
آن‌ها در کارتابل `NOT_CONNECTED` است. تأیید دریافت، ثبت پرداخت و Posting نیز تا ایجاد
Persistence مستقل Finance عمداً غیرفعال است.
