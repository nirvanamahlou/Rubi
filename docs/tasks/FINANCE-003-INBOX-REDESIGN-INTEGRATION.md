# FINANCE-003 — بازطراحی و اتصال کارتابل مالی

- **Computer:** PC-A
- **Branch:** `codex/pc-a-finance-inbox-redesign-integration`
- **Base:** `origin/develop@d65d8acc`
- **Status:** IN_PROGRESS
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
