# نیازمندی‌های محصول Rubi Airline CRM

وضعیت: Baseline مرحله Bootstrap — 2026-08-19

مالک کسب‌وکار: نیازمند تعیین

دامنه: CRM و عملیات فروش خدمات سفر برای حداقل ۳۰ کارمند و دو وب‌سایت

## 1. چشم‌انداز و اهداف

Rubi یک پلتفرم وب یکپارچه، ماژولار، امن، تست‌پذیر و قابل استقرار است که چرخه
آشنایی مشتری تا فروش، رزرو، خرید، صدور، تسویه، پشتیبانی و گزارش را پوشش می‌دهد.
رکوردهای مشتری، سفارش، رزرو، خرید، کارگزار، مالی و اسناد باید با کلید خارجی واقعی
قابل ردیابی باشند.

اهداف:

- یک منبع عملیاتی معتبر برای دو سایت، فروش دستی و فروش API
- Customer 360 و Lead-to-Contract قابل سنجش
- جلوگیری از گم‌شدن پرداخت و ایجاد workflow جبرانی برای شکست صدور
- تفکیک روشن فروش، خرید و Sub-ledger با محاسبه معتبر سود و مانده
- Provider abstraction قابل توسعه بدون آلوده‌کردن دامنه به مدل هر کارگزار
- گزارش Permission-aware و بدون تکثیر مبلغ به‌علت grain اشتباه

## 2. فناوری و محدودیت فنی

- الگو: Modular Monolith در Monorepo
- Frontend: Next.js App Router، React، TypeScript، Tailwind CSS، shadcn/ui،
  TanStack Query/Table، React Hook Form، Zod، next-intl و Recharts
- Backend: NestJS، TypeScript، REST، Swagger/OpenAPI، JWT/Refresh Token، RBAC،
  BullMQ، Redis و structured logging
- Data: PostgreSQL، Prisma ORM/migrations؛ MinIO یا S3-compatible برای فایل
- Infra: Docker Compose، Nginx، GitHub Actions، Sentry، health checks و Ubuntu LTS
- فقط نسخه‌های Stable/LTS سازگار و pin شده در lockfile مجازند.

ساختار هدف شامل `apps/web`، `apps/api`، `apps/worker`، packages مشترک، `prisma`،
`infrastructure`، `docs` و `tests` است. ایجاد آن متعلق به مرحله Foundation است.

## 3. نقش‌ها و مجوزها

حداقل personaها: فروش، رزرو، پشتیبانی، خرید، مالی/خزانه، مارکتینگ، منابع انسانی،
مدیر شعبه، مدیر سیستم، مدیر گزارش‌گیر و کاربران سازمانی/API client. مجوزها عملیاتی
و deny-by-default هستند؛ نمونه:

`reservation.read`, `reservation.create`, `reservation.cancel`,
`reservation.issue`, `finance.read`, `finance.payment.create`,
`finance.refund.approve`, `finance.export`, `customer.export_sensitive`,
`hr.employee.read`, `hr.employee.read_sensitive`, `hr.attendance.manage`,
`hr.leave.approve`, `hr.payroll_input.export`, `master_data.manage`, `user.manage`.

## 4. ناوبری قطعی

منوی اصلی دقیقاً این ۱۷ بخش را دارد:

1. داشبورد
2. مشتریان و مسافران
3. امور مشتریان، سرنخ‌ها و پشتیبانی
4. رزرواسیون و عملیات سفر
5. مدیریت و تعریف بلیت‌ها
6. قراردادها، فروش و تخصیص خدمات
7. خرید و تأمین
8. مالی و خزانه‌داری
9. مارکتینگ
10. آژانس‌ها و مشتریان سازمانی
11. منابع انسانی
12. وظایف و اتوماسیون
13. اسناد و فایل‌ها
14. گزارش‌ها
15. یکپارچه‌سازی‌ها
16. مدیریت سیستم
17. اطلاعات پایه

«جست‌وجو و فروش آنلاین» و «صدور اسناد» منوی مستقل نیستند. جست‌وجو/خرید آنلاین
در سفارش و Backend سایت‌ها، و صدور در ماژول مربوط انجام می‌شود. لیدر و کارگزار
منوی اصلی مستقل ندارند و در اطلاعات پایه تعریف می‌شوند.

شرح قطعی مسئولیت‌ها و جریان‌های فروش، صدور، خرید و تحویل در
[TRAVEL_WORKFLOW_ARCHITECTURE.md](TRAVEL_WORKFLOW_ARCHITECTURE.md) ثبت شده است.

## 5. داشبورد

Dashboard منبع داده مستقل نیست و باید viewهای گزارش‌دهی تاییدشده را مصرف کند.
کارت‌ها: فروش روز/هفته/ماه/سال، وصول، استرداد، مطالبات، بدهی Provider، موجودی
حساب، چک نزدیک سررسید، سفارش جدید، انتظار پرداخت/صدور، پرداخت موفق بدون صدور،
اسناد صادرشده، لغو، سود ناخالص، عملکرد سایت/کارشناس، ticket باز/خارج SLA، task
عقب‌افتاده و campaign performance.

فیلتر مشترک: تاریخ، سایت، شعبه، کارشناس، کانال، خدمت، آژانس، Provider، ارز و وضعیت.
هر کارت drill-down دارد. خروجی PDF مدیریتی، Excel جزئیات، نمودار و گزارش زمان‌بندی‌شده
لازم است.

## 6. مشتریان

Customer 360 شامل مشخصات فردی، تماس، آدرس، همراه/خانواده، مدارک هویتی ضروری،
ترجیحات، زبان، tag، marketing consent، سفارش/سفر، پرداخت/استرداد، ticket، task، note
و file است. تشخیص و merge کنترل‌شده مشتری تکراری با audit لازم است.

خروجی‌ها: PDF پرونده، Excel مشتریان و سوابق خرید، PDF صورت‌حساب و audience مجاز
مارکتینگ. داده حساس فقط با permission جدا export می‌شود.

## 7. امور مشتریان، قراردادها و فروش

امور مشتریان مالک request/lead، منبع و کانال، qualification، follow-up، lost reason،
پشتیبانی قبل/بعد فروش، Ticket، SLA و satisfaction است. درخواست واجد شرایط به فروش
تحویل می‌شود.

فروش مالک پرونده فروش، quotation، قرارداد، مشتری/پرداخت‌کننده قرارداد، اتصال مسافران
به قرارداد و تخصیص هر مسافر به بلیت، هتل/اتاق، بیمه، تور و خدمات جانبی است. رزرواسیون
اجازه ایجاد یا تغییر این ارتباط‌ها را ندارد و فقط snapshot تاییدشده قرارداد را اجرا
می‌کند.

جریان قطعی:
`Customer Request → Qualified Lead → Sales Case → Availability/Hold → Quotation →`
`Sales Contract → Finance Case + Reservation Execution`.

خروجی محلی شامل PDF پیشنهاد/قرارداد/الحاقیه، Excel pipeline و گزارش conversion،
عملکرد و lost reason است.

## 8. رزرواسیون، تعریف بلیت و عملیات سفر

مدیریت بلیت مالک تعریف محصول قابل فروش است: ایرلاین، پرواز، مسیر، برنامه، کلاس، قواعد،
قیمت versioned و ظرفیت کل/Hold/قطعی/فروش‌رفته/باقی‌مانده. این بخش برای مسافر بلیت صادر
نمی‌کند.

رزرواسیون مالک availability check، Hold، پرونده اجرایی، صدور بلیت، PNR، واچر هتل،
بیمه سامان، Manifest و عملیات change/reissue/void/cancel/refund است. انواع خدمت:
`FLIGHT`, `BUS`, `HOTEL`, `TOUR`, `INSURANCE`, `TRANSFER`, `VISA`, `CIP`,
`CAR_RENTAL`, `OTHER`.

برای ظرفیت شرکت، تاییدیه سفر داخلی صادر و passenger در صف Manifest قرار می‌گیرد؛
Excel طبق قالب/زمان‌بندی هر ایرلاین ساخته، بازبینی، ارسال و versioned می‌شود. شماره رسمی
e-ticket فقط از Airline/GDS/Provider معتبر ذخیره می‌شود و Rubi آن را جعل نمی‌کند.

در هتل، فروش مسافر/اتاق را تخصیص می‌دهد؛ رزرواسیون فرم کارگزار را می‌سازد، پاسخ و
Confirmation Number را ثبت و پس از تایید واچر versioned صادر می‌کند. در بیمه، طرح و
مسافر از قرارداد می‌آید و صدور/cancel/refund از Adapter بیمه سامان idempotent است.

## 9. فروش آنلاین و Provider Adapter

دو سایت فقط Booking API مرکزی را مصرف می‌کنند:

`Website → Booking API → Provider Adapters → Search → Price Recheck → Passenger →`
`Payment → Provider Booking → Issue → CRM Sales Contract/Service → Finance → Customer Document`.

هر adapter قرارداد `search`, `checkPrice`, `checkAvailability`, `createReservation`,
`confirmReservation`, `issue`, `cancel`, `refund`, `getStatus` را مطابق capability
خود پیاده می‌کند و نتیجه به مدل داخلی normalize می‌شود.

هر سایت یک Sales Channel مستقل با Provider/service فعال، markup/pricing، gateway،
currency، PDF template، logo، campaign و discount دارد. Redis برای cache کوتاه،
lock و داده موقت؛ BullMQ برای retry، issue، webhook و کار طولانی استفاده می‌شود.
Idempotency، timeout، retry محدود، circuit breaker، rate limit و audit اجباری است.

پرداخت موفق و صدور ناموفق:

- سفارش/رزرو `ISSUE_PENDING` یا `ISSUE_FAILED` می‌شود؛ payment تاییدشده حفظ می‌شود.
- retry کنترل‌شده و idempotent انجام می‌شود.
- task فوری و alert برای کارشناس/مدیر ساخته می‌شود.
- refund یا پیگیری دستی با permission و audit ممکن است.

## 10. خدمات مشتریان و تحویل مدارک

Ticket، complaint، change، cancellation، refund، issue follow-up، category، priority،
SLA، assignment، message، internal note، attachment، referral، escalation و satisfaction
لازم است. Ticket می‌تواند به customer، sales contract، reservation execution، بلیت/واچر،
invoice، payment و Provider متصل شود.

صدور عملیاتی و تحویل سند جدا هستند. رزرواسیون می‌تواند مطابق policy سند را صادر کند،
اما تا `financial_release` فایل برای فروش یا مسافر قابل مشاهده/دانلود نیست. پس از release،
فروش سند را با send history برای مسافر ارسال می‌کند.

## 11. خرید و تأمین

تعریف Provider در Master Data و خرید واقعی در Procurement است. دو جریان: خرید خدمات
سفر و خرید عمومی شرکت. جریان مرجع:
`Purchase Request → Approval → Purchase Order → Service Receipt → Purchase Invoice`
`→ Payable → Payment/Check → Settlement`.

رزرواسیون از قرارداد عمومی Procurement درخواست خرید را با FK واقعی به قرارداد، service
item، passengerها، supplier و reservation operation ایجاد می‌کند و قیمت اولیه، تخفیف
مذاکره‌شده، ارز، fee/tax، قیمت نهایی و مدرک تایید را می‌فرستد. Procurement مالک approval،
Purchase Order/Invoice، تغییر قیمت versioned و payable است.

خرید Provider پس از رزرو API می‌تواند خودکار و خرید دستی نیز قابل ثبت باشد. قیمت خالص
خرید از قیمت اولیه منهای تخفیف کارگزار به‌علاوه fee/هزینه محاسبه می‌شود؛ سود دستی نیست
و از قیمت فروش snapshot منهای خرید خالص approved محاسبه می‌شود.

فروش و خرید تفکیک می‌شوند:
`Contract Service Item → Sales Invoice Item` و
`Contract Service Item → Purchase Request → Purchase Order Item → Purchase Invoice Item`.
گزارش خرید Provider/service/manual/API، unpaid invoices، payable، margin و PDF/Excel
لازم است.

## 12. مالی و خزانه‌داری

این ماژول Sub-ledger عملیاتی است، نه حسابداری قانونی/مالیات/حقوق و دستمزد کامل. شامل sales/purchase
invoice، receipt، payment، refund، commission، settlement، حساب customer/agency/
Provider، چند bank/cash account، IRR/foreign currency، transfer، bank reconciliation،
received/paid check و due reminders است.

مالی فقط ورودی پرداخت حقوق تاییدشده و حداقلی را از قرارداد عمومی منابع انسانی دریافت
می‌کند. جزئیات حساس پرونده، ارزیابی، حضور یا قرارداد کاری در Finance کپی یا ویرایش
نمی‌شود.

مانده حساب دستی ذخیره/ویرایش نمی‌شود و از تراکنش‌های posted محاسبه می‌شود. ثبت قابل
اتکا دوطرفه با `journal_entries` و `journal_entry_lines` الزامی است و entry نامتوازن
قابل Post نیست.

Check: direction، check/Sayad number، bank/branch، amount/currency، issue/due date،
counterparty، account، invoice/contract، image، status/history/reminder. وضعیت‌های نمونه:
`RECEIVED`, `DEPOSITED`, `CLEARED`, `BOUNCED`, `RETURNED`, `ENDORSED`, `ISSUED`,
`DELIVERED`, `DUE`, `PAID`, `CANCELLED`. یادآوری قابل تنظیم مانند ۷، ۳ و ۱ روز.

خروجی PDF invoice/receipt و statement customer/agency/Provider؛ Excel ledger، balances،
due checks، refunds، commissions و settlements.

## 13. مارکتینگ

Campaign، budget، customer segment، SMS/email، template، discount code، UTM،
attribution، unsubscribe و metrics ارسال/تحویل/open/click/conversion لازم است.
Lead Source می‌گوید مشتری چگونه آشنا شد؛ Sales Channel محل خرید است؛ Campaign تبلیغ
موثر را نشان می‌دهد. Marketing consent در همه audienceها enforce می‌شود.

## 14. آژانس و مشتری سازمانی

Agency/corporate، representative، organization user، contract، credit limit، agreed
rate، discount، commission، reservation، invoice، payment، check، settlement، document
و account manager پشتیبانی می‌شود. Organization مدل مشترک با چند Role است.

## 15. منابع انسانی

منابع انسانی ماژول مستقل با موجودیت اصلی Employee/Personnel Record است. کارمند نباید
با Customer، Passenger یا Organization Contact در یک موجودیت تجاری ادغام شود. ارتباط
اختیاری کارمند با `User` فقط برای حساب ورود است و lifecycle استخدام را IAM مالک نمی‌شود.

دامنه نسخه اولیه شامل موارد زیر است:

- پرونده پرسنلی و اطلاعات تماس و اضطراری
- شعبه، واحد، سمت، مدیر و چارت سازمانی
- قراردادهای کاری و تاریخچه وضعیت اشتغال
- حضور و غیاب، شیفت‌ها، مرخصی، مأموریت و اضافه‌کاری
- ارزیابی عملکرد، آموزش و گواهینامه‌ها
- تجهیزات تحویلی و اسناد پرسنلی
- یادآوری پایان قرارداد، گواهینامه و مدارک
- گزارش‌های منابع انسانی با سطح دسترسی و masking مناسب
- ارتباط کنترل‌شده با مالی برای ارسال اطلاعات لازم و تاییدشده پرداخت حقوق
- دسترسی محدود، Audit مشاهده/تغییر/خروجی و retention داده حساس

حقوق و دستمزد قانونی و کامل، مالیات حقوق و ارسال لیست‌های قانونی در نسخه اولیه خارج
از محدوده است. مدل و قرارداد باید بدون ذخیره محاسبات قانونی فرضی، امکان توسعه ورودی
پرداخت و اتصال آینده به Finance/Payroll system را حفظ کند.

## 16. وظایف و اتوماسیون

Task، assignee، due date، priority، recurrence، checklist، approval workflow، notification،
Automation Rule/Run و history لازم است. رویداد پرداخت موفق/صدور ناموفق باید task فوری،
reservation alert، retry و manager warning تولید کند.

## 17. اسناد و فایل‌ها

این ماژول archive مرکزی است، نه صدور مستقل. فایل‌های customer/identity، ticket، voucher،
invoice، receipt، contract، Provider/leader، employee/personnel و check با version،
confidentiality، expiry، download permission و view/send history مدیریت می‌شوند. binary
در MinIO/S3 و metadata در PostgreSQL ذخیره می‌شود؛ دسترسی با signed URL کوتاه و audit است.

## 18. گزارش و خروجی

هر ماژول خروجی محلی دارد؛ موتور مشترک Backend از PDF، Excel، CSV و API پشتیبانی
می‌کند. خروجی Permission-aware است، filter snapshot، creator/time و audit دارد، داده
حساس را پیش‌فرض حذف می‌کند و فایل بزرگ Background Job است. برای دو سایت قالب جداست.

گزارش رسمی فقط reporting view تاییدشده را مصرف می‌کند. grainها جدا هستند: Reservation،
Passenger، Segment، Ticket و Payment؛ join نباید مبلغ را با تعداد passenger/segment
تکرار کند.

گزارش‌ها: فروش site/service/agent، خرید Provider، سود contract/service، balance، due check،
receivable/payable، manual/API، failed reservation، paid-not-issued، cancellation/refund،
marketing، customer service و منابع انسانی.

## 19. یکپارچه‌سازی

اتصال به دو سایت، flight/bus/hotel/tour/insurance API، SMS، email، payment gateway،
accounting و webhook لازم است. برای هر اتصال: credential امن، sandbox/production جدا،
external mapping، idempotency، retry، timeout، rate limit، health، request/error log،
webhook history و sync job. Credential/API key نه plain text در Git و نه plain text در DB.

## 20. مدیریت سیستم — کاربران و امنیت دسترسی

User، role، permission، team، branch access scope، 2FA، session، login history، optional
IP restriction، disablement، employee substitution و audit لازم است. سمت، مدیر و assignment
استخدامی در Human Resources مالکیت می‌شود و IAM فقط scope دسترسی را نگه می‌دارد. refresh
token rotation و revoke، rate limit و separate API access برای Provider/site اجباری است.

## 21. اطلاعات پایه

- جغرافیا: country، province، city، airport، terminal
- مالی: currency، buy/sell/accounting FX، bank/branch، payment/account/check/commission
  type و tax
- خدمات: airline/class/baggage، bus company/type، hotel/chain/room/meal/facility،
  insurer/plan/coverage، tour/transfer type
- فروش: acquaintance method، lead source، sales channel، lost reason، customer type،
  tag و campaign type
- Provider: profile/contact/service/contract/purchase rate/commission/cancel rule/bank/API IDs
- Leader: profile/contact/language/expertise/destination/document/license/bank/wage/status

مدل مشترک `organizations` و `organization_roles` با Roleهای `AGENCY`,
`CORPORATE_CUSTOMER`, `SUPPLIER`, `AIRLINE`, `HOTEL_PROVIDER`, `INSURANCE_PROVIDER`,
`BUS_PROVIDER`, `TOUR_OPERATOR` است و هر organization چند Role دارد. External Mapping
شناسه‌های متفاوت یک رکورد داخلی در چند API را نگه می‌دارد. Reference data استفاده‌شده
حذف نمی‌شود و فقط inactive می‌شود.

## 22. مدیریت سیستم — تنظیمات

company، branch، domain دو سایت، locale/timezone، نمایش شمسی با ذخیره UTC/Gregorian،
numbering، markup/pricing، PDF/message template، notification، security/API، log retention،
finance/refund approval، auto issue، calendar/holiday و SLA قابل تنظیم است. تغییر حساس
setting versioned و audited است.

کاربران/امنیت و تنظیمات در منوی واحد «مدیریت سیستم» نمایش داده می‌شوند، اما IAM و
Settings در Backend مالکیت داده و مرز فنی جدا دارند.

## 23. قواعد داده

PostgreSQL سیستم ثبت؛ Redis فقط cache/queue/lock/temp؛ S3/MinIO فایل. PK، FK، Unique،
Index، Decimal+currency، FX snapshot، UTC، status history، audit fields، soft-delete/inactive،
transaction، idempotency، optimistic lock و versioned migration الزامی است. Local/Test/
Staging/Production دیتابیس جدا دارند و تست Production ممنوع است.

## 24. امنیت و حریم خصوصی

اطلاعات کارت و CVV ذخیره نمی‌شود. PII حساس passenger و employee رمزگذاری، password با
الگوریتم معتبر hash، secrets خارج Git، RBAC و export permission، input validation، audit،
rate limit، جداسازی staging/production و backup رمزنگاری‌شده خارج سرور الزامی است.

## 25. تجربه کاربری

UI فارسی، RTL، responsive، desktop-first و tablet-usable است؛ table حرفه‌ای، advanced
filter، quick search، saved view، column choice، server pagination و Loading/Empty/Error/
Permission states دارد. Contract form چندمرحله‌ای، عملیات حساس confirm، تاریخ شمسی با
نمایش میلادی، ارز خوانا و accessibility پایه لازم است. داده مالی بدون permission نمایش
داده نمی‌شود.

## 26. تست و کنترل کیفیت

بسته به قابلیت: unit، integration، API contract، migration، permission، E2E، adapter
mock، payment/issue failure، refund و export test. بعد از تغییر lint، typecheck، targeted
tests، affected build و smoke test اجرا می‌شود. Provider بدون credential واقعی فقط mock/
sandbox است و هیچ تستی روی Production اجرا نمی‌شود.

## 27. معیار پذیرش قابلیت

نیازمندی و مدل داده مشخص، Migration و API/validation کامل، permission و audit اعمال، UI
و stateها پوشش داده، تست‌ها پاس، PDF/Excel لازم کارا، مستندات/status به‌روز و هیچ Secret
در Git نیست. این معیار با Definition of Done در `PLANS.md` الزام‌آور است.

## 28. فرض‌های کم‌ریسک Bootstrap

- زبان canonical داده و enumها انگلیسی و ترجمه فقط در presentation است.
- تاریخ در DB به UTC و تقویم شمسی فقط نمایش/ورودی تبدیل‌شده است.
- Monolith یک PostgreSQL مشترک دارد ولی هر ماژول مالک table و service خود است.
- UUID برای شناسه‌های عمومی پیشنهاد می‌شود؛ تصمیم نهایی در Foundation ثبت می‌شود.
- پول با Decimal و minor-unit hardcode نشده مدل می‌شود تا ارزهای مختلف پشتیبانی شوند.

## 29. تصمیم‌های بازِ معماری/مالی

پرسش‌های نیازمند پاسخ در `DECISIONS.md` ثبت شده‌اند: accounting boundary، Providerهای
موج اول، gateway و webhook guarantees، دو برند/دامنه و pricing، currency/rounding/tax،
approval matrix، data residency/retention، RPO/RTO، identity documents و B2B credit.
تا حل تصمیم P0، schema مالی یا adapter واقعی پیاده‌سازی نمی‌شود.
