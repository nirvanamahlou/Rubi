# ارسال PDF فرم رزرواسیون به کارگزار — ۲۰۲۶-۱۱-۰۸

Owner: PC-A. Branch: `codex/pc-a-reservation-broker-email-1108`.

## رفتار نهایی تأییدشده

ظاهر، چیدمان، رنگ‌ها، یادداشت و دکمه فرم حفظ می‌شوند. متن NOTICE فقط در محل
موجود انتهای PDF قرار می‌گیرد. ایمیل فقط یک PDF پیوست دارد؛ بدنه text/HTML خالی
است. موضوع ایمیل شماره قرارداد را دارد. هیچ متن مستقل یا PDF واچر ارسال نمی‌شود.
یادداشت می‌تواند خالی باشد و محدودیت فعلی ۵۰۰ نویسه حفظ می‌شود.

دکمه فرم را از مسیر موجود ذخیره می‌کند، سپس POST هم‌مبدأ به مسیر PDF موجود
می‌فرستد. Web، PDF آخرین نسخه ذخیره‌شده همان هتل را با همان renderer، سربرگ،
فونت، داده‌های مرجع و قالب فعلی تولید می‌کند؛ قالب یا محل NOTICE تغییر نمی‌کند.
GET دانلود PDF رفتار فعلی خود را حفظ می‌کند. در مسیر ارسال، نسخه قدیمی sent
جایگزین تنظیمات جدید نمی‌شود. شکست render یا تغییر نسخه مانع ثبت ارسال است.

## قرارداد Web و API

Producer: Web PDF route. Consumer: API Reservations supplier-email endpoint.
قرارداد خصوصی افزایشی v1: فایل multipart با نام pdf، expectedVersion و hotelStayKey
اختیاری، هدر x-reservation-pdf-signature. حداکثر PDF ده مگابایت و تنها یک فایل.
HMAC-SHA256 با کلید خصوصی مشترک روی JSON آرایه زیر محاسبه می‌شود:

`["reservation-pdf-v1", intakeId, expectedVersion, hotelStayKey || "", sha256(pdf)]`

API مجوز documents.manage، شعبه، وضعیت و نسخه را مستقل کنترل می‌کند و امضا،
اندازه و نشان PDF را پیش از ثبت بررسی می‌کند. فایل یا HTML دلخواه مرورگر پذیرفته
نمی‌شود. بدنه JSON درخواست Web به ۲۰۴۸ بایت محدود است و Origin باید هم‌مبدأ باشد.
Endpointهای قبلی فرم از لحاظ شکل قرارداد تغییر نمی‌کنند، اما REQUEST_SUPPLIER
برای ارسال واقعی به PDF امضاشده نیاز دارد. انتشار Web و API با هم لازم است.

ایمیل گیرنده از تماس صریح PARTNER_EMAIL در پرونده سازمان مرتبط با کارگزار، فقط
از public service اطلاعات پایه و مسیر خواندن حساس حسابرسی‌شده دریافت می‌شود.
هیچ مخاطب دلخواهی از میان اشخاص حدس زده نمی‌شود. شرکت فرستنده با شرکت منتخب
کاربر تطبیق داده می‌شود. در این برش، یک PDF فرم هتل انتخاب‌شده به همان کارگزار
ارسال می‌شود؛ ارسال جداگانه خودکار PDFهای ترانسفر به کارگزاران دیگر اضافه نشده است.

## صف و نتیجه

فایل و snapshot فرستنده/گیرنده در پاکت AES-256-GCM متصل به UUID ذخیره می‌شوند؛
Credential SMTP در صف، مرورگر، Git و لاگ نیست. صف و revision در یک تراکنش‌اند.
FK به revision و مخاطب واقعی وجود دارد. پردازشگر سمت API از SKIP LOCKED استفاده
می‌کند تا چند replica یک رکورد را دوباره claim نکنند.

QUEUED/SENDING/RETRY/ACCEPTED/FAILED/UNKNOWN وضعیت ایمیل‌اند؛ حداکثر پنج تلاش و
فقط برای رد موقت صریح SMTP یا خطای مشخص پیش از DATA. قطع نامعلوم پس از DATA و
claim رهاشده پس از پنج دقیقه UNKNOWN می‌شود و خودکار دوباره فرستاده نمی‌شود.
ACCEPTED یعنی پذیرش سرویس SMTP؛ دریافت Inbox، خواندن یا تأیید رزرو نیست. نتیجه
نهایی همراه شماره قرارداد در اعلان داخلی اقدام‌کننده نمایش داده می‌شود. ابطال
ثبت‌شده پیش از شروع ارسال و تغییر هویت فرستنده، ارسال صف را متوقف می‌کنند.

REQUEST_SUPPLIER/sent-form همچنان قرارداد عملیاتی موجود خرید و رزرواسیون است؛
هیچ سابقه قبلی به ایمیل واقعی تبدیل نمی‌شود. ایمیل وضعیت مستقل دارد. در حالت
خاموش، فرمان ارسال خطای روشن می‌دهد؛ پیش‌نویس ذخیره‌شده مرحله قبل باقی می‌ماند.

## اطلاعات لازم از IT

- ایمیل رزرواسیون، نام نمایشی، Reply-To و شرکت صاحب صندوق.
- سرویس‌دهنده، SMTP host، port و TLS ضمنی یا STARTTLS اجباری.
- نام کاربری و روش احراز هویت؛ رمز/توکن در چت یا Git قرار نگیرد.
- مجوز Send As، محدودیت نرخ/روز، اندازه پیوست و IP خروجی مجاز ERP.
- وضعیت SPF/DKIM/DMARC و مسئول رسیدگی به Bounce و ارسال نامعلوم.
- گیرنده آزمایشی مجاز برای کنترل PDF، NOTICE، فرستنده و پاسخ ایمیل.

Adapter فعلی نام کاربری/رمز اختصاصی برنامه دارد؛ اگر OAuth2/API اجباری باشد،
adapter پیش از فعال‌سازی با سیاست IT تکمیل می‌شود، نه با تضعیف سیاست سرویس‌دهنده.

## تنظیمات خصوصی

در API: RESERVATION_MAIL_ENABLED=false به‌صورت پیش‌فرض؛ سپس
RESERVATION_MAIL_LEGAL_ENTITY_ID، RESERVATION_SMTP_HOST، RESERVATION_SMTP_PORT،
RESERVATION_SMTP_TLS با مقدار implicit یا starttls، RESERVATION_SMTP_USER،
RESERVATION_SMTP_PASSWORD، RESERVATION_MAIL_FROM، RESERVATION_MAIL_FROM_NAME،
RESERVATION_MAIL_REPLY_TO و RESERVATION_MAIL_KEY_BASE64 تنظیم شوند.
کلید AES، Base64 استاندارد ۳۲ بایت تصادفی مستقل است و backup امن نیاز دارد.
تا زمان بازرمزگذاری کنترل‌شده، کلید سوابق نگهداری‌شده عوض نشود.

در هر دو API و Web، RESERVATION_PDF_MAIL_SECRET مشترک، خصوصی و تصادفی با حداقل
۳۲ نویسه تنظیم شود. این مقدار فقط سمت سرور است و NEXT_PUBLIC نیست.

## انتشار و پذیرش

Migration افزایشی پیش از API جدید؛ rollout هماهنگ API و Web. اتصال تا تحویل IT
و آزمون صندوق کنترل‌شده خاموش است. این شاخه مجوز merge، deploy یا ارسال بیرونی
ندارد. تست‌ها فقط داده مصنوعی و PostgreSQL مستقل دارند. PDF واقعی باید از لحاظ
وجود NOTICE در انتها و نبود نشت اطلاعات کارگزار دیگر تأیید شود. سرویس SMTP باید
پیوست را سالم دریافت کند و بدنه ایمیل خالی باشد. پاسخ خودکار، Bounce webhook و
مدیریت UI صف در این برش نیستند؛ موارد UNKNOWN به مسئول IT ارجاع می‌شوند.

نتایج نهایی آزمون در ادامه ثبت می‌شوند.
## اعتبارسنجی محلی

- ۳۳ تست اختصاصی API برای SMTP، نبود بدنه ایمیل، امضای PDF، گیرنده و تراکنش.
- ۸ تست PostgreSQL واقعی برای rollback، FK/unique، claim بین دو replica، پذیرش
  همراه اعلان، پنج تلاش، DATA نامعلوم، claim رهاشده، ابطال و تغییر فرستنده.
- ۹۲ تست Web برای ارسال PDF، رگرسیون GET/PDF، انتخاب نسخه و کامل‌بودن ترجمه‌ها.
- تست واقعی Chrome: فرم A4 یک‌صفحه‌ای و خروجی چندصفحه‌ای؛ تصویر صفحه یک بررسی
  شد و NOTICE در انتهای فرم، پیش از footer موجود، دیده می‌شود.
- تمام ۲۲۶ فایل migration SQL روی PostgreSQL18 مستقل بدون خطا اعمال شدند؛
  schema/client generation و ساخت بسته‌های Contracts/Database/Config موفق‌اند.
- lint هدفمند و typecheck کامل API/Web موفق؛ build نهایی در وضعیت پروژه ثبت می‌شود.
- پیش از اصلاح دامنه به PDF نیز ۴۶۲ تست رزرواسیون/اعلان/مرجع کارگزار موفق بودند؛
  معیار نهایی این تحویل، تست‌های PDF اختصاصی بالا است.
- هیچ ایمیل خارجی ارسال نشده و هیچ schema، تنظیم یا داده عملیاتی تغییر نکرده است.

Build نهایی API و Web موفق شد؛ Web تمام ۶۷ مسیر را ساخت. هیچ تغییر CSS یا قالب PDF وجود ندارد.

## تحویل

کد `fc9713987` روی origin منتشر شد؛
[PR پیش‌نویس 1498 به develop](https://github.com/nirvanamahlou/Rubi/pull/1498)
با حساب تأییدشده Amin-tech11 ساخته شد. تست‌های محلی و build کامل API/Web موفق‌اند؛
بررسی‌های میزبانی‌شده PR و پذیرش واقعی صندوق ایمیل پس از دریافت تنظیمات IT باقی‌اند.
Migration/Dependency lock این واحد پس از انتشار آزاد است و سورس منجمد است.
Container اختصاصی تست پس از اعتبارسنجی متوقف شد. هیچ merge یا deploy انجام نشده است.

## PR1498 CI repair — 2026-11-08

Reviewed exact head c45e0cd3a: hosted quality, production build and PostgreSQL18
migration/seed checks passed; full suite failed only reservation-price-save.spec.tsx
(4714 Web tests passed). The test expected the old second workflow request. More
importantly, the price Save action could call the new SMTP dispatch path for an
already sent form. Price Save now persists only SUPPLIER_FORM_SETTINGS; explicit
Send to broker remains the only email command. Immutable sent snapshots are kept.
Three status regressions assert no fetch/email and unchanged sent prices. A new
API regression proves disabled mail starts no background dispatcher and claims no
queue rows. No live configuration, credentials or delivery state was changed.

Validation:11 targeted Web tests,34 mail API tests, scoped lint, Web typecheck and
production build (67 routes), and actual Chrome A4/multipage PDF smoke all passed.
GitHub also reports five merge conflicts limited to shared work/status docs and
translation catalogues, including a generated binary-marked catalogue. No merge
has been performed; resolving these requires the AGENTS.md merge authorization.

Owner explicitly approved develop-to-PR-branch integration only. Shared docs were
combined without dropping peer records; the authoritative Web overrides retain
all upstream values plus20 email labels. Regenerated API catalogue retains every
upstream key/value plus21 additions. No peer domain implementation was edited.
PR-to-develop merge, deployment and mail activation remain unauthorized.

Integrated follow-up validation:717 Reservations/i18n Web tests passed (4 existing
skips),34 mail API tests passed, and the real Chrome PDF smoke passed. GitHub
reports no merge conflicts after task-branch synchronization. The integrated
quality job exposed two missing blank lines at merged ledger section boundaries;
formatting is corrected without changing peer records or relaxing any CI gate.
All final-head hosted checks must finish before any future release. Mail stays off.

## IT-independent acceptance — 2026-11-08

PR1498 is already integrated into develop. The owner now explicitly authorizes a
follow-up PR and merge to develop after all final-head checks pass. Deployment and
live delivery remain outside this authorization; mail stays disabled by default.

Added acceptance coverage for invalid/multiple recipient addresses, incomplete
contact pagination, sensitive-contact audit failure, missing SMTP/encryption
configuration, branch-scoped rejection and Web authentication/disabled-mail error
propagation. No production contact or IAM changes are performed. Recipient
completeness and employee access on operational records require their authorized
owners; tests validate the enforcement using synthetic data, not a production audit.

The [staff and operations guide](RESERVATION-MAIL-STAFF-GUIDE-1108.md) documents
save/download/send, PDF-only content, final notifications, ambiguous results,
recipient/access preparation, controlled activation and safe suspension. Local
validation:40 API mail tests,15 focused Web tests, scoped ESLint and real Chrome
A4/multipage smoke pass; the rendered single-page NOTICE remains in its existing
final section. Form source, styles and PDF template are unchanged.
