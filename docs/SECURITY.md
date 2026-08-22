# مدل امنیت و حریم خصوصی

## اهداف و تهدیدهای اصلی

محافظت از PII/مدارک مسافر، جلوگیری از دسترسی مالی غیرمجاز، جعل webhook/payment، سرقت
credential Provider، صدور/استرداد تکراری، export انبوه و دستکاری audit. اعتماد صفر بین
browser/site/provider boundary و deny-by-default در authorization.

## طبقه‌بندی داده

| سطح          | نمونه                                                                                | کنترل حداقل                                                         |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Public       | محتوای عمومی service                                                                 | integrity، تغییر فقط مجاز                                           |
| Internal     | تنظیمات غیرحساس، master data                                                         | auth، role و audit تغییر                                            |
| Confidential | قیمت خرید، قرارداد، گزارش مالی                                                       | scoped permission، encryption at rest، export audit                 |
| Restricted   | passport/national ID، پرونده/قرارداد/ارزیابی پرسنلی، تماس اضطراری، credential، token | field encryption/secret manager، masking، دسترسی حداقلی و retention |

اطلاعات کارت کامل و CVV تحت هیچ شرایط ذخیره یا log نمی‌شود؛ gateway token/reference کافی است.

## Identity و Session

پیاده‌سازی baseline و قرارداد عملیاتی IAM در [IAM.md](IAM.md) ثبت شده است.

- password با Argon2id یا الگوریتم تاییدشده و پارامتر versioned؛ policy و breached-password
  check متناسب با محیط
- access token کوتاه‌عمر، refresh token یک‌بارمصرف/rotation، token hash در DB، family revoke
  و reuse detection
- 2FA برای نقش مالی/مدیر و قابلیت توسعه به همه کاربران
- session list/revoke، login history، lockout/rate limit و optional IP restriction
- جانشینی کارمند با بازه، approver و audit؛ اشتراک account ممنوع

## Authorization

RBAC با permission عملیاتی و scope `company/branch/team/self/organization`. route guard فقط
لایه اول است؛ application use case resource-level check می‌کند. export sensitive، refund
approval، payment creation، issue/cancel و master data/user management مجوز جدا دارند.
جداسازی وظایف برای create/approve/post/refund قابل تنظیم است.

منابع انسانی permissionهای جدا برای مشاهده پرونده، داده حساس، قرارداد، ارزیابی،
حضور/مرخصی، تایید و export دارد. مدیر سازمانی فقط scope مصوب زیرمجموعه خود را می‌بیند؛
دسترسی کلی Finance یا مدیر سیستم به محتوای حساس HR به‌صورت پیش‌فرض مجاز نیست. ارسال
ورودی پرداخت حقوق به Finance نیازمند approval و audit مستقل است.

## رمزنگاری و Secret

- TLS در transit؛ disk/database/object backup encryption at rest
- envelope encryption برای fieldهای Restricted با key version و rotation
- credential فقط به شکل reference به secret manager یا encrypted vault؛ plaintext در Git/DB/log ممنوع
- `.env.example` فقط نام متغیر و مقدار جعلی؛ secret scanning در CI
- signed object URL کوتاه، storage key غیرقابل حدس و authorization قبل از صدور URL

## API، webhook و Provider

- validation و output encoding؛ ORM parameterization؛ CORS/CSRF strategy متناسب با auth
- client credential/audience/rate limit جدا برای دو سایت
- webhook signature، timestamp/replay window، idempotent inbox و payload size/content limit
- timeout، circuit breaker و SSRF-safe allowlist برای outbound endpoints
- raw payload حساس encrypted/redacted و retention محدود

## Audit و Logging

عملیات auth، permission/role، customer merge/PII view-export، price override، booking/issue/
cancel/refund، payment/journal/check، approval، credential/settings و file download audit می‌شود.
مشاهده، تغییر و خروجی پرونده پرسنلی، قرارداد، ارزیابی، تماس اضطراری، حضور و payroll input
نیز audit می‌شود.
Audit actor/impersonator، action، entity، before/after redacted، reason، IP/user-agent، trace و
UTC time دارد. لاگ عملیاتی secret/token/document number کامل یا PII غیرضروری ندارد.

## Data lifecycle

retention و legal hold نیازمند تصمیم مالک محصول/حقوقی است. حذف مشتری نباید اسناد مالی لازم را
از بین ببرد؛ pseudonymization/limited processing با ارتباط مالی حفظ‌شده ترجیح دارد. inactive
reference data حذف نمی‌شود. backup رمزنگاری و خارج سرور است و restore drill دارد.

## Secure SDLC

- dependency/secret/SAST scan، lockfile، review و branch protection
- permission test و abuse cases برای هر قابلیت حساس
- migration و seed بدون داده واقعی؛ Production test ممنوع
- vulnerability response شامل triage، credential rotation، fix، audit و postmortem

## کنترل‌های پیش از Production

threat model تاییدشده، key/secret management، MFA مدیران، least privilege DB/storage، backup/
restore، log redaction test، penetration test، rate-limit/load test، incident runbook و privacy/
retention approval.
