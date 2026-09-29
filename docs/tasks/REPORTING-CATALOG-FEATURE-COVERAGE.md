# توسعه کاتالوگ گزارش‌ها بر مبنای فیچرهای موجود

## هدف و محدوده

در این واحد کار ساختار فعلی Prisma، مرز ماژول‌ها و قابلیت‌های موجود Web/API بررسی
شدند و کاتالوگ Reports از ۱۹ به ۳۲ گزارش گسترش یافت. این تغییر فقط تعریف قابل مشاهده
کارت‌های گزارش در Web و آزمون‌های آن را شامل می‌شود؛ Schema، Migration، Seed، داده
عملیاتی، API و مجوزها تغییر نکرده‌اند.

## گزارش‌های افزوده‌شده و پشتوانه داده

| کد | پرسش مدیریتی | مالک داده و مدل‌های مبنا | Grain پیشنهادی |
|---|---|---|---|
| RPT-020 | قراردادهای فروش در هر مرحله چه تعداد و چه مبلغی دارند؟ | Sales: `SalesContract`، `SalesContractStatusHistory` | هر قرارداد فروش |
| RPT-021 | کدام قراردادها، تضامین یا سقف‌های اعتباری آژانس نیازمند اقدام هستند؟ | B2B: `AgencyOperationalProfile`، `B2bAgencyAgreement`، `B2bAgencyCreditPolicy`، `B2bAgreementGuarantee` | هر قرارداد آژانس و ارز |
| RPT-022 | ظرفیت کدام پروازها رو به تکمیل است؟ | Ticket Catalog: `TicketPublishedOffer`، `TicketOfferCapacityAllocation` | هر پیشنهاد پرواز |
| RPT-023 | کدام خریدها در انتظار پرداخت به تأمین‌کننده هستند؟ | Reservations/Finance: `ReservationServicePurchase`، `FinanceSupplierPaymentRevision` | آخرین نسخه خرید خدمت |
| RPT-024 | کدام رزروها برای تحویل آماده نیستند؟ | Reservations/Finance: `ReservationIntake`، `ReservationWorkflowRevision`، `FinanceDeliveryRevision` | هر ورودی رزرو |
| RPT-025 | لیدهای سفر در چه مراحلی هستند و کدام پیگیری‌ها عقب افتاده‌اند؟ | Customer Affairs: `CustomerAffairsLead` | هر لید |
| RPT-026 | رضایت مشتریان از رسیدگی به درخواست‌ها چگونه است؟ | Customer Affairs: `CustomerAffairsTicket`، `CustomerAffairsSatisfaction`، `CustomerAffairsCorrectiveAction` | هر پاسخ رضایت |
| RPT-027 | برای ارتباط با مشتریان چه میزان رضایت معتبر داریم؟ | Customers: `Customer`، `CustomerConsent` | هر مشتری، هدف و کانال |
| RPT-028 | کدام اسناد ناقص، منقضی یا در انتظار پردازش هستند؟ | Documents: `Document`، `DocumentVersion`، `DocumentProcessingJob` | هر سند |
| RPT-029 | کدام سوابق کارکنان به‌زودی منقضی می‌شوند؟ | HR: `HrEmployee`، `HrRecord`، `Document` | هر سابقه منابع انسانی |
| RPT-030 | کدام کارهای میزکار سررسید شده یا عقب افتاده‌اند؟ | Workbench: `WorkbenchCalendarEvent` | هر رویداد میزکار |
| RPT-031 | نرخ خرید هتل‌ها نزد تأمین‌کنندگان چگونه مقایسه می‌شود؟ | Reservations/Master Data: `ReservationHotelRateBatch`، `ReservationHotelGroupRate` | هر نرخ هتل و تأمین‌کننده |
| RPT-032 | کدام نرخ‌های ارز در انتظار تأیید، اصلاح یا انقضا هستند؟ | Master Data: `MasterDraftExchangeRate` | هر مشاهده نرخ ارز |

## قواعد طراحی گزارش

- هر کارت دارای کد عمومی پایدار، عنوان پرسشی، خروجی رسمی، Dimensions، Measures،
  Filterها، Drill-down، Permission و نام Projection نسخه‌دار است.
- گزارش‌هایی که هنوز Endpoint و Approved Projection اجرایی ندارند عمداً با وضعیت
  `PENDING_CONNECTION` نمایش داده می‌شوند و به‌عنوان گزارش متصل معرفی نمی‌شوند.
- مبلغ‌ها در Grain مالک خود تجمیع می‌شوند؛ ارتباط با مسافر، تخصیص ظرفیت یا تاریخچه
  نسخه‌ها نباید موجب چندبرابرشدن مبلغ شود.
- Scope شرکت/شعبه و Permission باید در Producer یا Projection مالک داده اعمال شود؛
  Reports مجاز به Query مستقیم جدول خصوصی ماژول‌ها نیست.
- گزارش‌های دارای داده حساس فقط اطلاعات تجمیعی یا محدودشده را نمایش می‌دهند و
  Drill-down تابع مجوز همان دامنه است.

## مسیر ادامه برای اجرایی‌کردن

برای تغییر هر کارت از «در انتظار منبع داده» به «متصل»، مالک ماژول باید Public
Projection نام‌گذاری‌شده در کارت را با قرارداد نسخه‌دار، تست تطبیق مبلغ/تعداد، Scope
سرور و کنترل Permission ارائه کند. سپس Endpoint پیش‌نمایش و خروجی Reports به همان
Projection متصل و وضعیت کارت پس از آزمون مرجع به `READY` تغییر می‌کند.

## کنترل کیفیت

- جست‌وجو با عنوان، کلیدواژه و کدهای `RPT-020` تا `RPT-032` پوشش داده شد.
- یکتایی و ترتیب کدهای عمومی، تخصیص داخلی اولویت و کامل‌بودن metadata آزمون شد.
- ۲۲ تست هدفمند Reports، lint محدوده، typecheck وب، build قراردادها و build تولیدی
  Web با ۴۶ مسیر موفق شدند.
- هیچ داده نمونه یا اطلاعات شخصی به Repository افزوده نشد.
