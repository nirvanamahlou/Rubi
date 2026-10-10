# LEGAL-ENTITY-BRAND-LOGO-001

## هدف

نمایش لوگوی شرکت فعال در App Shell؛ با انتخاب «جهان باستان»، لوگوی افقی ارسالی جای لوگوی «نیایش سیر سحر» قرار می‌گیرد.

## محدوده

- Asset افقی جهان باستان در Web public assets
- انتخاب برند نمایشی بر اساس Legal Entity Context موجود
- نمایش صحیح در Sidebar کامل، Sidebar جمع‌شده و Drawer موبایل
- تست هدفمند مدل برند و کنترل کیفیت Web

## خارج از محدوده

- Backend، Database، Prisma Schema/Migration/Seed و داده کاربر
- API Contract، Permission، Dependency/Lockfile و تنظیمات استقرار
- تغییر `main`، Force Push یا تغییر مستقیم `develop` خارج از Pull Request

## وضعیت

آماده بررسی روی `codex/pc-b-jahan-bastan-logo` از `origin/develop@0f1d7b6fd15cba995be9793e0a9686474ad8c4c9`.

مالک در 2026-09-01 صریحاً دریافت آخرین تغییرات PC-A، Push Branch و Merge با `develop` را مجاز کرد. `origin/develop@f78e70e` شامل PR #74 PC-A بدون Conflict در Branch کاری ادغام و کنترل کیفیت کامل تکرار شد.

## پیاده‌سازی

- App Shell از همان Legal Entity Context موجود برای انتخاب برند استفاده می‌کند.
- `JAHAN_BASTAN` به تصویر افقی ارسالی، نام «CRM شرکت جهان باستان» و متن جایگزین فارسی متصل است.
- `NIYAYESH_SEIR_SAHAR` و Context تجمیعی رفتار پیشین نیایش سیر را حفظ می‌کنند.
- فایل `jahan-bastan-horizontal.png` بایت‌به‌بایت با ورودی مالک یکسان است: SHA-256 برابر `19AF0D9A5B1D2F1987EC27D56775730FCA12A77A0F64B255ED89177B0AE812C7`.

## کنترل کیفیت

- Full Workspace tests: `1,383` تست اجراشده موفق؛ `70` تست PostgreSQL اختیاری skip
- Web tests پس از Integration: `565/565` موفق
- Full Workspace lint: موفق، بدون Warning
- Full Workspace typecheck: موفق
- Full Production Build: موفق، Web با ۳۴ Route
- Smoke لوکال: API health، Login Web و Asset لوگو همگی HTTP 200
- کنترل بصری Asset: نسبت افقی و محتوای تصویر صحیح است

## پایان قفل

`RELEASED — PC-B/LEGAL-ENTITY-BRAND-LOGO-001 ready for review`. هیچ قفل Migration، Contract، Dependency/Lockfile، Permission، Database یا Branch گرفته نشد.
