# DOCUMENTS-007 — اعتبارسنجی دومرحله‌ای نمایش اسناد

وضعیت: `IN_PROGRESS`  
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
