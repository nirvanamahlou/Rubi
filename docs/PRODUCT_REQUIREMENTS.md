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
- Customer 360 و Lead-to-Order قابل سنجش
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

حداقل personaها: فروش، رزرو، پشتیبانی، خرید، مالی/خزانه، مارکتینگ، مدیر شعبه، مدیر
سیستم، مدیر گزارش‌گیر و کاربران سازمانی/API client. مجوزها عملیاتی و deny-by-default
هستند؛ نمونه:

`reservation.read`, `reservation.create`, `reservation.cancel`,
`reservation.issue`, `finance.read`, `finance.payment.create`,
`finance.refund.approve`, `finance.export`, `customer.export_sensitive`,
`master_data.manage`, `user.manage`.

## 4. ناوبری قطعی

منوی اصلی دقیقاً این ۱۶ بخش را دارد:

1. داشبورد
2. مشتریان
3. فروش و سرنخ‌ها
4. سفارش‌ها و رزرواسیون
5. خدمات مشتریان
6. خرید و تأمین
7. مالی و خزانه‌داری
8. مارکتینگ
9. آژانس‌ها و مشتریان سازمانی
10. وظایف و اتوماسیون
11. اسناد و فایل‌ها
12. گزارش‌ها
13. یکپارچه‌سازی‌ها
14. مدیریت کاربران
15. اطلاعات پایه
16. تنظیمات سیستم

«جست‌وجو و فروش آنلاین» و «صدور اسناد» منوی مستقل نیستند. جست‌وجو/خرید آنلاین
در سفارش و Backend سایت‌ها، و صدور در ماژول مربوط انجام می‌شود. لیدر و کارگزار
منوی اصلی مستقل ندارند و در اطلاعات پایه تعریف می‌شوند.

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

## 7. فروش و سرنخ

ثبت lead، نحوه آشنایی، lead source، سایت/کانال ورودی، تخصیص، pipeline/stage،
opportunity، مبلغ احتمالی، quotation، follow-up، علت عدم خرید، conversion و اهداف
فردی/تیمی لازم است.

جریان قطعی: `Lead Source → Lead → Customer → Opportunity → Quotation → Travel Order`.
خروجی: PDF پیشنهاد، Excel lead، pipeline، conversion، عملکرد کارشناس، lost reasons و
forecast. Lead Source، Sales Channel و Campaign سه مفهوم مستقل هستند.

## 8. سفارش و رزرواسیون

Aggregate اصلی `TravelOrder` با یک یا چند `OrderItem` است. انواع خدمت:
`FLIGHT`, `BUS`, `HOTEL`, `TOUR`, `INSURANCE`, `TRANSFER`, `VISA`, `CIP`,
`CAR_RENTAL`, `OTHER`.

سفارش باید customer، passengerها، site/channel، agent، agency، Provider هر item،
currency، purchase/sale price، discount، tax، commission، profit و وضعیت‌های payment،
booking و issue با تاریخچه داشته باشد. زیرنماها: همه، جدید، جست‌وجوی پرواز/اتوبوس/
هتل/تور، استعلام بیمه، آنلاین/دستی، انتظار پرداخت/صدور، صادرشده، لغو و refund.

صدور در همان رزرو انجام می‌شود: بلیت پرواز/اتوبوس، واچر هتل/تور/ترانسفر و سند
بیمه. قالب فارسی/انگلیسی، QR، شماره یکتا داخلی، version، void و send history لازم
است. شماره رسمی e-ticket فقط از Airline/GDS/Provider معتبر دریافت می‌شود و Rubi آن
را جعل یا داخلی تولید نمی‌کند.

## 9. فروش آنلاین و Provider Adapter

دو سایت فقط Booking API مرکزی را مصرف می‌کنند:

`Website → Booking API → Provider Adapters → Search → Price Recheck → Passenger →`
`Payment → Provider Booking → Issue → CRM Order → Finance → Customer Document`.

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

## 10. خدمات مشتریان

Ticket، complaint، change، cancellation، refund، issue follow-up، category، priority،
SLA، assignment، message، internal note، attachment، referral، escalation و satisfaction
لازم است. Ticket می‌تواند به customer، order، reservation، ticket/voucher، invoice،
payment و Provider متصل شود. PDF پرونده، Excel، SLA/agent/satisfaction reports لازم است.

## 11. خرید و تأمین

تعریف Provider در Master Data و خرید واقعی در Procurement است. دو جریان: خرید خدمات
سفر و خرید عمومی شرکت. جریان مرجع:
`Purchase Request → Approval → Purchase Order → Service Receipt → Purchase Invoice`
`→ Payable → Payment/Check → Settlement`.

خرید Provider پس از رزرو API به‌صورت خودکار و خرید دستی نیز قابل ثبت است. داده‌ها:
Provider، service type، Order/Item، purchase price، currency، FX snapshot، tax، discount،
commission، due date، invoice، receipt/payment status و documents.

فروش و خرید تفکیک می‌شوند:
`Travel Order Item → Sales Invoice Item` و
`Travel Order Item → Purchase Order Item → Purchase Invoice Item`.
گزارش خرید Provider/service/manual/API، unpaid invoices، payable، margin و PDF/Excel
لازم است.

## 12. مالی و خزانه‌داری

این ماژول Sub-ledger عملیاتی است، نه حسابداری قانونی/مالیات/حقوق. شامل sales/purchase
invoice، receipt، payment، refund، commission، settlement، حساب customer/agency/
Provider، چند bank/cash account، IRR/foreign currency، transfer، bank reconciliation،
received/paid check و due reminders است.

مانده حساب دستی ذخیره/ویرایش نمی‌شود و از تراکنش‌های posted محاسبه می‌شود. ثبت قابل
اتکا دوطرفه با `journal_entries` و `journal_entry_lines` الزامی است و entry نامتوازن
قابل Post نیست.

Check: direction، check/Sayad number، bank/branch، amount/currency، issue/due date،
counterparty، account، invoice/order، image، status/history/reminder. وضعیت‌های نمونه:
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

## 15. وظایف و اتوماسیون

Task، assignee، due date، priority، recurrence، checklist، approval workflow، notification،
Automation Rule/Run و history لازم است. رویداد پرداخت موفق/صدور ناموفق باید task فوری،
reservation alert، retry و manager warning تولید کند.

## 16. اسناد و فایل‌ها

این ماژول archive مرکزی است، نه صدور مستقل. فایل‌های customer/identity، ticket، voucher،
invoice، receipt، contract، Provider/leader، check با version، confidentiality، expiry،
download permission و view/send history مدیریت می‌شوند. binary در MinIO/S3 و metadata
در PostgreSQL ذخیره می‌شود؛ دسترسی با signed URL کوتاه و audit است.

## 17. گزارش و خروجی

هر ماژول خروجی محلی دارد؛ موتور مشترک Backend از PDF، Excel، CSV و API پشتیبانی
می‌کند. خروجی Permission-aware است، filter snapshot، creator/time و audit دارد، داده
حساس را پیش‌فرض حذف می‌کند و فایل بزرگ Background Job است. برای دو سایت قالب جداست.

گزارش رسمی فقط reporting view تاییدشده را مصرف می‌کند. grainها جدا هستند: Reservation،
Passenger، Segment، Ticket و Payment؛ join نباید مبلغ را با تعداد passenger/segment
تکرار کند.

گزارش‌ها: فروش site/service/agent، خرید Provider، سود order/service، balance، due check،
receivable/payable، manual/API، failed reservation، paid-not-issued، cancellation/refund،
marketing و customer service.

## 18. یکپارچه‌سازی

اتصال به دو سایت، flight/bus/hotel/tour/insurance API، SMS، email، payment gateway،
accounting و webhook لازم است. برای هر اتصال: credential امن، sandbox/production جدا،
external mapping، idempotency، retry، timeout، rate limit، health، request/error log،
webhook history و sync job. Credential/API key نه plain text در Git و نه plain text در DB.

## 19. کاربران و امنیت دسترسی

User، role، permission، team، branch، manager، 2FA، session، login history، optional IP
restriction، disablement، employee substitution و audit لازم است. refresh token rotation
و revoke، rate limit و separate API access برای Provider/site اجباری است.

## 20. اطلاعات پایه

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

## 21. تنظیمات

company، branch، domain دو سایت، locale/timezone، نمایش شمسی با ذخیره UTC/Gregorian،
numbering، markup/pricing، PDF/message template، notification، security/API، log retention،
finance/refund approval، auto issue، calendar/holiday و SLA قابل تنظیم است. تغییر حساس
setting versioned و audited است.

## 22. قواعد داده

PostgreSQL سیستم ثبت؛ Redis فقط cache/queue/lock/temp؛ S3/MinIO فایل. PK، FK، Unique،
Index، Decimal+currency، FX snapshot، UTC، status history، audit fields، soft-delete/inactive،
transaction، idempotency، optimistic lock و versioned migration الزامی است. Local/Test/
Staging/Production دیتابیس جدا دارند و تست Production ممنوع است.

## 23. امنیت و حریم خصوصی

اطلاعات کارت و CVV ذخیره نمی‌شود. PII حساس passenger رمزگذاری، password با الگوریتم
معتبر hash، secrets خارج Git، RBAC و export permission، input validation، audit، rate
limit، جداسازی staging/production و backup رمزنگاری‌شده خارج سرور الزامی است.

## 24. تجربه کاربری

UI فارسی، RTL، responsive، desktop-first و tablet-usable است؛ table حرفه‌ای، advanced
filter، quick search، saved view، column choice، server pagination و Loading/Empty/Error/
Permission states دارد. Order form چندمرحله‌ای، عملیات حساس confirm، تاریخ شمسی با
نمایش میلادی، ارز خوانا و accessibility پایه لازم است. داده مالی بدون permission نمایش
داده نمی‌شود.

## 25. تست و کنترل کیفیت

بسته به قابلیت: unit، integration، API contract، migration، permission، E2E، adapter
mock، payment/issue failure، refund و export test. بعد از تغییر lint، typecheck، targeted
tests، affected build و smoke test اجرا می‌شود. Provider بدون credential واقعی فقط mock/
sandbox است و هیچ تستی روی Production اجرا نمی‌شود.

## 26. معیار پذیرش قابلیت

نیازمندی و مدل داده مشخص، Migration و API/validation کامل، permission و audit اعمال، UI
و stateها پوشش داده، تست‌ها پاس، PDF/Excel لازم کارا، مستندات/status به‌روز و هیچ Secret
در Git نیست. این معیار با Definition of Done در `PLANS.md` الزام‌آور است.

## 27. فرض‌های کم‌ریسک Bootstrap

- زبان canonical داده و enumها انگلیسی و ترجمه فقط در presentation است.
- تاریخ در DB به UTC و تقویم شمسی فقط نمایش/ورودی تبدیل‌شده است.
- Monolith یک PostgreSQL مشترک دارد ولی هر ماژول مالک table و service خود است.
- UUID برای شناسه‌های عمومی پیشنهاد می‌شود؛ تصمیم نهایی در Foundation ثبت می‌شود.
- پول با Decimal و minor-unit hardcode نشده مدل می‌شود تا ارزهای مختلف پشتیبانی شوند.

## 28. تصمیم‌های بازِ معماری/مالی

پرسش‌های نیازمند پاسخ در `DECISIONS.md` ثبت شده‌اند: accounting boundary، Providerهای
موج اول، gateway و webhook guarantees، دو برند/دامنه و pricing، currency/rounding/tax،
approval matrix، data residency/retention، RPO/RTO، identity documents و B2B credit.
تا حل تصمیم P0، schema مالی یا adapter واقعی پیاده‌سازی نمی‌شود.
