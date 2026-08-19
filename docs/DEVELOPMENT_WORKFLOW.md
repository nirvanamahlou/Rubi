# قرارداد توسعه دوکامپیوتری

## هدف

PC-A و PC-B روی یک Repository و بدون تکیه بر حافظه گفتگو کار می‌کنند. Git history،
اسناد وضعیت و migrations تنها مرجع هماهنگی هستند. `origin` باید Repository مشترک
`Rubi` باقی بماند و هیچ Agentی مجاز به حذف یا جایگزینی Remote موجود نیست.

## شناسه و الگوی شاخه

- PC-A: `COMPUTER_ID=PC-A` و `codex/pc-a-<task-name>`
- PC-B: `COMPUTER_ID=PC-B` و `codex/pc-b-<task-name>`
- هر واحد کار مستقل یک شاخه دارد؛ ماژول‌های مستقل در شاخه‌های جدا توسعه می‌یابند.
- `main` فقط production-ready و `develop` محل یکپارچه‌سازی staging است.
- تغییر مستقیم، force-push یا merge روی `main`/`develop` بدون تایید صریح ممنوع است.

## شروع واحد کار

```text
1. Read AGENTS.md + PROJECT_STATUS + WORK_ASSIGNMENTS + relevant docs
2. git status --short --branch
3. git remote -v
4. git fetch --prune origin
5. Confirm no local/remote ownership collision
6. Reserve Work ID in WORK_ASSIGNMENTS.md
7. Create codex/<computer>-<task> from the agreed base
8. Re-check status before editing
```

مبنای شاخه باید در ردیف تخصیص مشخص شود. تا زمان ایجاد `develop`، کار Bootstrap فقط
از `origin/main` منشعب می‌شود؛ پس از ایجاد `develop`، قابلیت‌ها از `origin/develop`
منشعب می‌شوند.

## مالکیت فایل و Migration

- مالک واحد کار، مالک فایل‌های اعلام‌شده است؛ هم‌پوشانی باید پیشاپیش حل شود.
- هر Migration فقط روی یک شاخه ایجاد و هرگز پس از Push بازنویسی نمی‌شود.
- تغییر schema مشترک ابتدا با قرارداد و نام موجودیت در `DATA_MODEL.md` هماهنگ شود.
- تغییرات محلی ناشناس نه حذف، نه stash و نه overwrite می‌شوند.
- Rebase/merge پرریسک، force-push و پاک‌سازی تاریخچه بدون هماهنگی ممنوع است.

## Commit، Push و Review

- Commitها کوچک، هدفمند و ترجیحاً با پیشوند `docs:`, `chore:`, `feat:`, `fix:` هستند.
- فقط فایل‌های همان Work ID stage شوند؛ پیش از Commit، diff staged بازبینی شود.
- شاخه با upstream به `origin` Push می‌شود.
- ادغام از طریق review به base توافق‌شده انجام می‌شود؛ سازنده شاخه ادغام مستقیم نمی‌کند
  مگر مالک Repository صریحاً تایید کند.
- پس از Push، hash، تست‌ها، ریسک و اقدام لازم PC دیگر در Project Status ثبت می‌شود.

## Quality Gate

با توجه به نوع تغییر: format/lint، typecheck، unit/integration/contract/E2E، migration
test، permission test، affected build و smoke test اجرا می‌شود. برای اسناد، کنترل
لینک‌ها، Mermaid، سازگاری اصطلاحات و `git diff --check` حداقل gate است.

## برخورد با تعارض یا حادثه

- اگر هر دو سیستم یک محدوده را رزرو کرده‌اند، کار جدید متوقف و مالک زودتر ثبت‌شده
  حفظ می‌شود.
- Secret یا PII commit‌شده یک incident است: Push متوقف، credential rotate و روش
  پاک‌سازی تاریخچه با مالک Repository هماهنگ می‌شود.
- Migration شکست‌خورده rollback عملیاتی امن می‌خواهد؛ migration اعمال‌شده حذف یا
  rename نمی‌شود.
- پرداخت موفق/صدور ناموفق داده مالی را rollback نمی‌کند؛ workflow جبرانی مطابق
  معماری اجرا می‌شود.

## Handoff اجباری

گزارش پایان شامل: محدوده تکمیل‌شده، فایل‌ها، تست/نتیجه، Migration، Commit/branch،
تصمیم یا ریسک باز، و آنچه سیستم دوم باید fetch/بررسی کند است.
