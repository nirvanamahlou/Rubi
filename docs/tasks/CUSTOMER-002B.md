# CUSTOMER-002B — Secure National ID

- **Computer:** PC-A
- **Owner:** PC-A
- **Branch:** `codex/pc-a-customer-002b-national-id`
- **Stacked Base:** `codex/pc-a-customer-next` / PR #27
- **Status:** READY_FOR_REVIEW
- **Migration Lock:** `PC-A/CUSTOMER-002B` از 2026-08-29 با انتقال صریح مالک

## هدف این Slice

- هر شخص حقیقی Customer یک کد ملی ده‌رقمی با checksum معتبر دارد.
- هر مسافر مستقل یک Customer Person مستقل و کد ملی مستقل دارد.
- انتخاب مشتری به‌عنوان مسافر شماره ۱ همان رکورد و همان کد ملی را استفاده می‌کند.
- هیچ کد ملی خام در Database، Response، URL، Log یا Audit ذخیره یا نمایش داده نمی‌شود.
- Persistence شامل AES-256-GCM، fingerprint یکتا و مقدار Masked است.
- Import کد ملی را اجباری و Export فقط مقدار Masked را ارائه می‌کند.

## مرز

- این Slice فقط کد ملی را از `BLOCKED_FOR_CUSTOMER_002B` آزاد می‌کند.
- پاسپورت، ویزا، جنسیت، نام لاتین، یادداشت، Merge و Timeline بین‌ماژولی همچنان خارج از Scope هستند.
- Dependency و Lockfile تغییر نمی‌کنند.

## Verification

- هر ۸ Migration روی PostgreSQL 18 خالی اعمال و وضعیت Migration همگام تأیید شد.
- Seed دو بار با موفقیت اجرا شد.
- تست واقعی با دو Customer Person و دو کد ملی مصنوعی مستقل انجام شد؛ رابطه مشتری/مسافر نیز ثبت شد.
- API فقط مقدار Masked را برگرداند و هیچ ciphertext، fingerprint، IV یا auth tag به Client نداد.
- مقدار کامل کد ملی فقط با مجوز `customers.sensitive.read`، دلیل مجاز، Audit و Auto-remask نمایش داده می‌شود.
- lint، typecheck، تمام ۳۳۴ تست Monorepo و Production Build پاس شدند.
- Smoke احراز‌شده `/customers` روی Web و API ایزوله پاس شد.
