# MASTER-003M — Currency form and buy/sell quotes

## مالکیت و محدوده

- مالک: `PC-B`؛ Branch: `codex/pc-b-master-data-currency-form`.
- والد: `codex/pc-b-master-data-section-cleanup` / Draft PR #39.
- Base commit: `02f88e908a9fcf879de72ed0f5bc5ec30da4e4af`.
- یک واحد مستقل Master Data Web/API/Contract/Test/Docs زیر قفل‌های `PC-B/MASTER-003`.
- بدون تغییر Schema، Migration، Seed، Finance، Customers، Dependency یا Lockfile.

## فرم ارز

- نام فارسی، نام انگلیسی مستقل، ISO سه‌حرفی، نماد، تعداد اعشار و وضعیت فعال/غیرفعال.
- «سیاست نمایش» ورودی فرم نیست و در پروفایل نیز نمایش داده نمی‌شود. ویرایش ارز مقدار
  قبلی را بازنویسی نمی‌کند؛ ایجاد ارز از پیش‌فرض موجود Database استفاده می‌کند.
- ارز پایه در اختیار Finance و وابسته به شرکت است. قرارداد اجرایی خواندن آن هنوز
  متصل نیست؛ فیلد فقط‌خواندنی «نامشخص — در انتظار اتصال مالی» است. هیچ ارز پایه فرضی
  یا گزینه عمومی `isBase` ایجاد نشده و جدول ماژول دیگر مستقیماً خوانده نمی‌شود.
- وضعیت با endpoint و permission موجود تغییر می‌کند. اگر مشخصات ذخیره شوند ولی تغییر
  وضعیت شکست بخورد، شناسه/نسخه ذخیره‌شده حفظ می‌شود؛ تلاش مجدد ارز تکراری نمی‌سازد.
- دکمه ثبت نرخ جدید در پروفایل، همین Popup ارز را باز می‌کند؛ سکشن جدا ساخته نشده است.

## ثبت نرخ و قرارداد افزایشی

- POST `/api/v1/master-data/currency-rates/quotes`؛ افزوده سازگار با Contract v12.
- Producer: Master Data API؛ Consumer: Master Data currency form؛ هر دو تحت مالکیت PC-B.
- ورودی: `fromCurrencyCode`، `toCurrencyCode`، حداقل یکی از `buyRate`/`sellRate`، `source`،
  `observedAt`؛ اختیاری: `validFrom`، `validTo`، `correctionReason`.
- خروجی: آرایه رکوردهای `MasterCurrencyRateRecord` در `data`؛ APIهای قدیمی حفظ شده‌اند.
- نرخ خرید و فروش اختیاری مستقل هستند، اما حداقل یکی لازم است؛ سمت واردنشده جعل نمی‌شود.
  هر نرخ رشته Decimal مثبت با حداکثر ۱۴ رقم صحیح و ۱۰ اعشار است؛ از Number عبور نمی‌کند.
- تاریخ/ساعت فرم محلی است و قبل از ارسال به UTC تبدیل می‌شود؛ API زمان بدون timezone و
  بازه نامعتبر را رد می‌کند. دو ارز باید متفاوت، موجود و فعال باشند.
- نرخ‌ها و Audit مربوط در یک تراکنش Prisma جدید ثبت می‌شوند؛ تاریخچه قبلی تغییر نمی‌کند.
- مجوزهای `master_data.create` و `master_data.currency_rate.create` هر دو لازم‌اند.
  Branch صرفاً برای کنترل دسترسی Actor و Audit است؛ نرخ‌ها و ارزها فیلتر شرکتی نمی‌شوند.
- ثبت‌کننده از Actor احراز‌شده، وضعیت `DRAFT` و `isAuthoritative=false` تعیین می‌شوند؛
  ورودی اضافی ثبت‌کننده/وضعیت/authoritative توسط ValidationPipe رد می‌شود.
- گردش Maker/Checker قبلی حفظ شده است. مشخصات ارز و ثبت نرخ دکمه ذخیره مستقل دارند.
- ثبت‌کننده و وضعیت نرخ فقط‌خواندنی‌اند. بعد از ثبت، شناسه واقعی کاربر نمایش داده می‌شود؛
  نام نمایشی تا اتصال قرارداد عمومی هویت در دسترس نیست و نامی از ماکاپ جعل نشده است.
- هیچ نرخ نمونه، نام واقعی تصویر یا داده مالی در Seed یا کد عملیاتی اضافه نشده است.

## کنترل کیفیت

- اجرای کامل `pnpm test`: موفق، ۴۵۸ تست (API: ۲۴۱، Web: ۱۴۹، Database: ۵۱،
  Contracts: ۱۴، Config/Worker: ۳؛ بخشی از بسته‌های بدون تغییر از cache).
- آزمون مدل فرم: فیلدهای مجاز، نبود سیاست نمایش، اعشار، UTC، خرید/فروش و بازیابی بعد از
  شکست تغییر وضعیت؛ آزمون اتصال Popup به پروفایل و endpoint واقعی.
- آزمون سرویس: Decimal، ارز فعال، مجوز، زمان، Audit، DRAFT و انتشار خطای تراکنش؛
  آزمون HTTP با Controller، DTO runtime و PermissionGuard واقعی (Service/Session آزمایشی).
- این آزمون‌ها جایگزین اجرای تراکنش روی PostgreSQL واقعی یا Smoke احراز‌شده نیستند.
- Production Build وب و API موفق؛ Web typecheck، API typecheck و lint فایل‌های تغییرکرده موفق.
- Full Web lint همان خطا/هشدار قبلی `date-picker.tsx`، خطوط ۶۷ و ۹۹، را گزارش می‌کند؛
  فایل مشترک خارج از Scope و تغییر نکرده است.
- مرورگر ابزار به Login هدایت شد؛ بدون Session، Smoke تعاملی احراز‌شده ادعا نمی‌شود.
- API Health پاسخ ۲۰۰ و endpoint جدید بدون ورود پاسخ ۴۰۱ می‌دهد؛ مسیر مالی و پولی
  به Login سالم با پاسخ ۲۰۰ هدایت می‌شود. سرورهای ۳۱۰۰ و ۴۰۰۰ روشن باقی ماندند.
- `git diff --check` و بررسی Scope/الگوهای Secret و PII خطوط افزوده‌شده موفق؛
  هیچ فایل Customers، Finance یا کامپیوتر دیگر در تغییرات نیست.
- Migration/Seed در این اصلاح لازم نیست و اجرا نشده است. تولید Prisma Client برای تست
  با URL آزمایشی محلی انجام می‌شود و به Database واقعی متصل نمی‌شود.

## تحویل و ادغام

- Draft PR با Base مستقیم `codex/pc-b-master-data-section-cleanup` وابسته به #39 و والدهای آن است.
- پیش از Merge والد ادغام نشود؛ پس از Merge والد، Base طبق ترتیب پشته به‌روز شود.
- Parent، PC-A، main و develop تغییر نمی‌کنند؛ بدون Force Push و حذف Source Branch.
- قفل‌های Migration، Master Data shared-contract و Central docs نزد `PC-B/MASTER-003`
  باقی‌اند؛ Dependency/Lockfile آزاد است.
