# DOCUMENTS-007 — اعتبارسنجی دومرحله‌ای نمایش اسناد

وضعیت: `READY_FOR_REVIEW`
مالک: `PC-B`
شاخه: `codex/pc-b-documents-step-up-security`

## هدف

هنگام بارگذاری سند، کاربر می‌تواند گزینه «نیازمند اعتبارسنجی دومرحله‌ای» را فعال کند.
برای چنین سندی، داشتن مجوز عادی کافی نیست و Preview یا Download تنها پس از ورود کد معتبر
Authenticator و دریافت مجوز کوتاه‌عمر و یک‌بارمصرف انجام می‌شود.

## مرز مالکیت

- IAM مالک Secret رمز‌شده TOTP، فعال‌سازی Authenticator، Rate Limit و اعتبارسنجی کد است.
- Documents فقط Boolean سیاست سند و Access Grant محدود به کاربر/سند/عملیات را مالک است.
- ارتباط دو ماژول از Port عمومی نسخه‌دار است؛ Documents به جدول یا Repository داخلی IAM
  دسترسی مستقیم ندارد.
- فایل‌ها و Migrationهای Sales در PR #90 دست‌نخورده می‌مانند.

## قواعد امنیتی

- هیچ کد ثابت، Secret یا Recovery Code در Git، پاسخ عمومی یا Log نوشته نمی‌شود.
- Secret TOTP با کلید محیطی نسخه‌دار و AES-256-GCM رمز می‌شود.
- کد مصرف‌شده در همان بازه زمانی دوباره پذیرفته نمی‌شود.
- تلاش ناموفق محدود و Lock کوتاه‌مدت همراه Audit است.
- Access Grant به Actor، Document، Purpose و انقضای کوتاه محدود و پس از یک مصرف باطل است.
- Preview و Download پیش از Scan پاک، مجوز فایل و Step-up لازم fail-closed هستند.

## فرض‌ها و اهداف قابل سنجش

- سامانه داخلی و Auth-walled، دستگاه اصلی Desktop و شبکه سازمانی است.
- داده سند در سطح PII/Restricted و Scope دسترسی بر اساس Branch است.
- نسبت Read/Write حدود `20:1` و اوج یک‌ساله کمتر از `50 QPS` فرض می‌شود.
- Backend: `p50<150ms`، `p95<300ms`، `p99<600ms`، SLO `99.9%`، `RPO<=24h` و
  `RTO<=4h`.
- Frontend: `LCP<=2.5s`، `INP<=200ms`، `CLS<=0.1` در p75، بودجه مسیر
  `200KB gzip`، Lighthouse Accessibility حداقل ۹۰ و WCAG 2.2 AA.

## معیار پذیرش

1. گزینه Step-up در همه Uploadهای متصل Documents دیده و در API/DB ذخیره شود.
2. کاربر بتواند Authenticator را با تایید رمز جاری و سپس کد TOTP فعال کند.
3. Preview/Download سند علامت‌خورده بدون Grant معتبر با پاسخ روشن رد شود.
4. Grant فقط یک بار و حداکثر طی دو دقیقه قابل استفاده باشد.
5. موفقیت و شکست فعال‌سازی، اعتبارسنجی، صدور و مصرف Grant بدون Secret/کد خام Audit شود.
6. Migration افزایشی روی دیتابیس خالی و دیتابیس دارای داده تست و Roll-forward آن بررسی شود.
7. Contract، Unit/HTTP/DB Test، lint، typecheck و build بخش‌های متاثر پاس شوند.

## نتیجه پیاده‌سازی

- Checkbox در فرم اصلی Documents و فرم متصل Customer اضافه و تا Contract، DTO، Service،
  Repository و ستون افزایشی دیتابیس حفظ شد.
- فعال‌سازی واقعی Authenticator با تأیید رمز جاری، Secret رمز‌شده AES-256-GCM، کد TOTP
  شش‌رقمی، جلوگیری از Replay و قفل پنج‌دقیقه‌ای پس از پنج خطا پیاده‌سازی شد.
- Preview و Download سند علامت‌خورده فقط با Grant تصادفی، هش‌شده، وابسته به کاربر، Session،
  سند و Purpose انجام می‌شود؛ Grant دو دقیقه اعتبار دارد و اتمیک فقط یک بار مصرف می‌شود.
- نمایش تصویر پس از Scan پاک و کنترل مجوز انجام می‌شود و مرورگر نسخه کم‌حجم PNG با واترمارک
  نام سامانه، کد آرشیو و زمان مشاهده می‌سازد. فایل اصلی همچنان فقط از Endpoint محافظت‌شده و
  پس از Step-up به Browser مجاز تحویل می‌شود؛ جلوگیری مطلق از Screenshot ممکن نیست.
- Headerهای سخت‌سازی مرورگر، پیام‌های فارسی، Audit موفق/ناموفق و خطاهای قابل تشخیص فرم اضافه شد.

## اعتبارسنجی و تحویل

- Prisma format/validate/generate، lint کامل API/Web/Database، typecheck API/Web و Production
  Build همه بسته‌ها و ۳۴ Route وب موفق‌اند.
- `808` تست API، `592` تست Web با کنارگذاشتن فقط Assertion قدیمی Customer وابسته به LF/CRLF،
  و تست‌های هدفمند Contract/Service/HTTP/Migration موفق‌اند. Full Web فقط همان تست قدیمی و
  تغییرنیافته Customer را روی Checkout ویندوز قرمز گزارش می‌کند.
- زنجیره تمام Migrationها روی PostgreSQL 18 موقت خالی اجرا شد؛ ارتقای دیتابیس دارای User و
  Document آزمایشی نیز مقدارهای پیش‌فرض `false` و `0` را حفظ و جدول Grant و هفت ستون MFA را
  ایجاد کرد. Container آزمایشی پس از بررسی حذف شد.
- کلید واقعی `IAM_TOTP_ENCRYPTION_KEY_BASE64` باید در production یک Base64 مستقل ۳۲ بایتی باشد؛
  هیچ Secret واقعی در Git ثبت نشده است.
