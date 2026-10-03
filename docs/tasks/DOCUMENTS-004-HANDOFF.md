# DOCUMENTS-004-HANDOFF — تحویل عملیات اسناد به SALES-CONTRACTS-001

- Computer: `PC-B`
- Task: `DOCUMENTS-004-HANDOFF`
- Branch: `codex/pc-b-documents-004-handoff`
- Base: `origin/develop@1e5c55e3b2d9dcc58c407d0ca205abed86b4c605`
- Status: `READY_FOR_REVIEW`
- Type: فقط مستندات؛ بدون کد، Schema، Migration، Seed، Dependency یا Lockfile

## Merge تأییدشده

PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شده است. این Commit در تاریخچه `origin/develop` وجود دارد و `DOCUMENTS-004-OPERATIONS` برابر `DONE/MERGED` است.

پیاده‌سازی، Migrationهای ادغام‌شده، قرارداد عمومی Documents و Shared Calendar همان خروجی پایدار PR #89 باقی می‌مانند. این Handoff آن‌ها را بازنویسی نمی‌کند و فقط پایان مالکیت موقت Task و انتقال قفل‌های لازم را ثبت می‌کند.

## انتقال اتمیک قفل‌ها

جدول زیر یک انتقال واحد و تفکیک‌ناپذیر است؛ هیچ حالت میانی با دو Migration Owner یا Central Docs Owner معتبر نیست.

| قفل                                     | مالک پیشین                      | وضعیت پس از Handoff        |
| --------------------------------------- | ------------------------------- | -------------------------- |
| Documents shared-contract Owner         | `PC-B/DOCUMENTS-004-OPERATIONS` | `RELEASED / STABLE`        |
| Shared Calendar Owner                   | `PC-B/DOCUMENTS-004-OPERATIONS` | `RELEASED / STABLE`        |
| Dependency/Lockfile Owner               | بدون مالک فعال                  | `RELEASED`                 |
| Migration Owner                         | `PC-B/DOCUMENTS-004-OPERATIONS` | `PC-A/SALES-CONTRACTS-001` |
| Central Docs Owner                      | `PC-B/DOCUMENTS-004-OPERATIONS` | `PC-A/SALES-CONTRACTS-001` |
| Sales shared-contract/root export Owner | بدون مالک فعال                  | `PC-A/SALES-CONTRACTS-001` |

این رزرو فقط با Merge همین Handoff به `develop` مرجع رسمی مشترک می‌شود. تا آن زمان PR #90 و Branch فروش دست‌نخورده می‌مانند و باید وضعیت مسدود فعلی خود را حفظ کنند.

## مرز قطعی Documents و Sales

- Documents فقط مالک نگهداری، نسخه‌بندی و دسترسی فایل است.
- Sales مالک قرارداد فروش و گردش کسب‌وکاری آن است و فقط از قرارداد عمومی Documents برای اتصال فایل استفاده می‌کند.
- Sales حق Query مستقیم جدول‌های Documents، import کردن Repository یا زیرساخت داخلی آن و بازنویسی چرخه نگهداری/دسترسی Documents را ندارد.
- مالکیت Sales shared-contract مجوز تغییر Documents contract نیست؛ تغییر آینده Documents به هماهنگی producer/consumer و Work Item مستقل نیاز دارد.
- `Dependency/Lockfile Owner` برای Sales برابر `RELEASED` می‌ماند. افزودن Dependency فقط پس از اثبات نیاز واقعی، ثبت دلیل، تعیین فایل دقیق و رزرو مستقل مجاز است.

## محدوده و عدم مداخله

- فقط `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md`، `docs/tasks/DOCUMENTS-004-OPERATIONS.md` و همین سند تغییر می‌کنند.
- هیچ کد، Prisma Schema، Migration، Seed، Dependency، Lockfile، Contract یا فایل ماژولی تغییر نمی‌کند.
- PR #90، Branch `codex/pc-a-sales-contracts`، `main` و Source Branchهای قبلی تغییر، Merge، Rebase، Force Push یا حذف نمی‌شوند.

## کنترل تحویل

- Prettier محدود روی چهار فایل مستنداتی
- اعتبارسنجی مقصد لینک‌های Markdown
- تعادل code fenceهای Markdown
- Scope scan و `git diff --check`
- Commit کوچک، Push معمولی و Draft PR مستقل به `develop`
- در صورت سلامت Scope، تبدیل PR به Ready؛ Merge توسط این Task انجام نمی‌شود
