# دستورالعمل اجرایی Agentها

این فایل برای تمام مسیرهای Repository معتبر است. جزئیات محصول را از اسناد مرجع
بخوانید و در حافظه گفتگو نگه ندارید.

## منابع قطعی

1. `docs/PRODUCT_REQUIREMENTS.md` — نیازمندی‌های کسب‌وکار و حدود محصول
2. `docs/ARCHITECTURE.md`، `docs/MODULE_BOUNDARIES.md` و
   `docs/MODULE_OWNERSHIP.md` — معماری، مالکیت داده و مالکیت نهایی ماژول‌ها
3. `docs/TRAVEL_WORKFLOW_ARCHITECTURE.md` — مرجع تاییدشده فروش، تخصیص مسافر،
   رزرواسیون، تعریف بلیت، Manifest، خرید و تحویل مالی
4. `docs/DATA_MODEL.md` — مدل داده و قواعد یکپارچگی
5. `docs/DEVELOPMENT_WORKFLOW.md` — قرارداد همکاری PC-A و PC-B
6. `docs/PROJECT_STATUS.md`، `WORK_ASSIGNMENTS.md` و `PLANS.md` — وضعیت و برنامه
7. Git history و Prisma migrations، پس از ایجاد — واقعیت پیاده‌سازی

در تعارض اسناد، امنیت و یکپارچگی داده مقدم است؛ تعارض را در `docs/DECISIONS.md`
ثبت و قبل از پیاده‌سازی حل کنید.

## پیش از هر تغییر

- `COMPUTER_ID` را مشخص کنید (`PC-A` یا `PC-B`).
- `git status --short --branch`، شاخه و `git remote -v` را بررسی کنید.
- `git fetch --prune origin` اجرا و اسناد وضعیت/تخصیص را کامل بخوانید.
- روی `main` یا `develop` کار نکنید و Remote موجود را حذف یا جایگزین نکنید.
- یک واحد کار مستقل در `WORK_ASSIGNMENTS.md` رزرو کنید.
- شاخه وظیفه‌محور بسازید: `codex/pc-a-<task-name>` یا
  `codex/pc-b-<task-name>`.
- مالکیت ماژول و هر قفل فعال Migration، Dependency/Lockfile یا فایل مرکزی را در
  `docs/MODULE_OWNERSHIP.md` و `WORK_ASSIGNMENTS.md` کنترل کنید.
- اگر فایل هدف تغییر محلی یا مالک فعال دیگری دارد، کار را متوقف و هماهنگ کنید.

## قواعد پیاده‌سازی

- معماری Modular Monolith و مرز ماژول‌ها را حفظ کنید؛ دسترسی مستقیم به جدول
  ماژول دیگر ممنوع است مگر از قرارداد/سرویس عمومی آن ماژول.
- PC-A و PC-B هر دو Full-Stack هستند و Database، Backend، Frontend و Test ماژول‌های
  تحت مالکیت خود را توسعه می‌دهند؛ تقسیم ثابت Backend/Frontend معتبر نیست.
- در هر لحظه فقط یک Migration Owner و یک Dependency/Lockfile Owner مجاز است؛
  فایل‌های مرکزی نیز پیش از تغییر باید در یک Work Item قفل شوند.
- تغییر API/Event Contract مشترک پیش از اجرا با producer، consumer و برنامه سازگاری
  ثبت و هماهنگ می‌شود.
- مبلغ با Decimal و کد ارز، زمان با UTC و ارتباط‌ها با FK واقعی ذخیره شوند.
- Secret، Credential، داده واقعی مسافر، اطلاعات کارت یا CVV وارد Git نشود.
- Migration مخرب، merge، deploy و تغییر مستقیم `main`/`develop` بدون تأیید ممنوع است.
- تغییرات کاربر یا کامپیوتر دیگر حذف، stash یا بازنویسی نشود.

## پایان کار

- lint، typecheck، تست هدفمند و build بخش‌های متاثر را اجرا کنید.
- `docs/PROJECT_STATUS.md`، `WORK_ASSIGNMENTS.md` و در صورت لزوم اسناد دامنه را
  به‌روز کنید.
- فقط فایل‌های همان واحد کار را stage کنید؛ Commit کوچک و توصیفی بسازید و شاخه
  خود را به `origin` push کنید.
- PR ابتدا به `develop` باز می‌شود؛ انتشار پایدار با تایید از `develop` به `main`
  انجام می‌شود و سازنده شاخه خودکار Merge نمی‌کند.
- وضعیت تست، Migration، ریسک و handoff لازم برای کامپیوتر دیگر را گزارش کنید.
