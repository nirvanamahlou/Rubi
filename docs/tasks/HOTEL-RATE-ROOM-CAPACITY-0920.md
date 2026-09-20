# HOTEL-RATE-ROOM-CAPACITY-0920

- مالک: `PC-A`
- وضعیت: `READY_FOR_REVIEW`
- Branch: `codex/pc-a-hotel-rate-room-capacity-0920`
- Base: `origin/develop@7e52d309`

## قواعد قطعی

- هر هتل می‌تواند چند نوع اتاق فعال داشته باشد.
- هر نرخ نوع اتاق دارای ضریب مثبت، حداکثر بزرگسال و حداکثر کودک است.
- نمایش `2+1` یعنی حداکثر دو بزرگسال و یک کودک؛ `2+3` یعنی دو بزرگسال و سه کودک.
- نبود ضریب/ردیف نرخ برای یک نوع اتاق یعنی آن اتاق در آن بازه قابل فروش نیست.
- ظرفیت قرارداد برابر ظرفیت هر اتاق ضرب‌در تعداد اتاق‌هاست؛ نوزاد در این کنترل ظرفیت کودک محاسبه نمی‌شود.
- نوع اتاق جدید از صفحه نرخ فقط با `master_data.create` و اتصال آن به هتل فقط با `master_data.update` مجاز است.
- تغییر نسخه‌ای است؛ نرخ‌های قبلی بازنویسی نمی‌شوند.
## خروجی

- مدل و Migration افزایشی `ReservationHotelRoomRate` با FK واقعی به نرخ گروهی و نوع اتاق.
- انتخاب چند نوع اتاق برای هر هتل همراه ضریب، `maxAdults` و `maxChildren`.
- اتاق بدون ضریب از Payload حذف و در قرارداد فروش نمایش داده نمی‌شود.
- Public Projection نسخه‌دار رزرو تنها نرخ‌های فعال بازه را به Sales می‌دهد.
- کنترل ظرفیت در ایجاد، ویرایش و تأیید قرارداد؛ نوزاد ظرفیت کودک را مصرف نمی‌کند.
- دسترسی مستقیم از صفحه نرخ به مدیریت افزودن نوع اتاق و اتصال آن به هتل.

## کنترل‌ها

- Frozen install، Prisma format/validate/generate: پاس.
- تمام ۸۷ Migration روی PostgreSQL 18.1 خالی و Migration status: پاس.
- Constraintهای factor و ظرفیت و هر دو FK: تأیید مستقیم.
- Contracts: ۷۸ تست پاس؛ API هدفمند: ۲۳ تست پاس.
- lint و typecheck قراردادها/API/Web: پاس.
- Production Build API و Web با ۵۰ Route: پاس.
- `git diff --check`: پاس.

## Handoff

قفل‌های Migration، قرارداد افزایشی Reservations/Sales و Central Docs تا Merge این PR در اختیار همین Task باقی می‌مانند و پس از Merge باید در Handoff مستقل آزاد شوند.