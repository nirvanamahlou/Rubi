# CUSTOMER-002B — Secure National ID

## Sequential integration review — 2026-08-31

- Parent #27 merged `eb2fe1e`; #34 now targets develop. The customer-only handoff is activated in WORK_ASSIGNMENTS after #25/#26/#27, per the product owner's explicit chain authorization.
- Reconciled only customer/status/assignment conflicts, preserving all merged Master Data and shared DatePicker files. XLSX security from parent #27 is retained; national-ID template version is now `customers-person-v2`.
- Reproduced an actual PostgreSQL CHECK loophole in an isolated transaction: ciphertext with a NULL key version was accepted by the historical CHECK (SQL UNKNOWN). The transaction was rolled back.
- Added `20260831120000_customer_national_id_key_required`, an additive constraint requiring non-null key version when ciphertext exists. Historical migration bytes are unchanged. No plaintext identity or real data is involved.
- Pulled the omitted-birthday preservation and strict calendar validation from child #41 forward so the intermediate PR cannot clear a masked date on unrelated edits; regression tests included.
- Scope remains the Iranian national-ID slice only, not passport/foreign identity, full document storage, retention or production key management. DEC-OPEN-006/011 are not marked accepted by this review.
- Final integration gates: frozen install; Prisma validate/generate; all 11 migrations on empty isolated PostgreSQL, seed twice; lint/typecheck/full production build; 420 tests across 80 files; whitespace/scope/secret-pattern checks passed. Unchanged packages may use the task cache.
- Runtime review: 11 synthetic HTTP/database checks passed on API 4015, Web 3115 and PostgreSQL 5435, including required/checksummed/duplicate national ID, masking/reasoned reveal/audit, persisted ciphertext, unchanged omitted birthday, invalid dates, branch rejection and concurrent 200/409. This is HTTP smoke, not a visual browser QA claim.

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

## پیگیری نمایش شماره و تماس — 2026-08-31

- کنار هر Customer/Passenger، میان‌بر «نمایش شماره و تماس» مستقیماً تب Contacts را باز می‌کند.
- کاربر دلیل مجاز را انتخاب و «نمایش شماره کامل» را می‌زند؛ همان API دارای Permission/Branch Scope/Audit استفاده می‌شود.
- لینک `tel:` فقط برای شماره کامل تلفن پس از Reveal مجاز ساخته می‌شود؛ ایمیل، مقدار Masked و URI نامعتبر قابل شماره‌گیری نیستند.
- Auto-remask قبلی و دکمه پنهان‌کردن دستی شماره‌ها باقی هستند؛ هیچ شماره‌ای به URL صفحه یا Storage اضافه نمی‌شود.
- Schema، Migration، Seed، Dependency، داده مشتریان و تنظیمات سرویس‌ها تغییر نمی‌کنند.
- ۱۲۳ تست Web و ۸۱ تست API Customers، lint کامل Web، typecheck و Production Build پاس شدند.
- مرورگر تعاملی در محیط جاری با خطای ACL ابزار قابل تست نبود؛ Smoke احراز‌شده این پیگیری انجام نشد.

## Verification اولیه کد ملی

- هر ۸ Migration روی PostgreSQL 18 خالی اعمال و وضعیت Migration همگام تأیید شد.
- Seed دو بار با موفقیت اجرا شد.
- تست واقعی با دو Customer Person و دو کد ملی مصنوعی مستقل انجام شد؛ رابطه مشتری/مسافر نیز ثبت شد.
- API فقط مقدار Masked را برگرداند و هیچ ciphertext، fingerprint، IV یا auth tag به Client نداد.
- مقدار کامل کد ملی فقط با مجوز `customers.sensitive.read`، دلیل مجاز، Audit و Auto-remask نمایش داده می‌شود.
- lint، typecheck، تمام ۳۳۴ تست Monorepo و Production Build پاس شدند.
- Smoke احراز‌شده `/customers` روی Web و API ایزوله پاس شد.
