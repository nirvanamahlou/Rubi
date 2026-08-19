# وظایف PC-B

## FOUNDATION-004 — Frontend Foundation

- مالک: `PC-B`
- Branch: `codex/pc-b-frontend-foundation`
- Base: Commit `b5b7c5d` از `origin/develop`
- وضعیت: `READY_FOR_REVIEW`
- Migration/Schema/Backend Contract: بدون تغییر
- قفل Dependency/Lockfile: پس از تکمیل تغییرات این Work Item آزاد شد.

### محدوده تکمیل‌شده

- Design System فارسی، RTL و responsive با tokenهای رنگ، فاصله، radius، shadow و فونت Vazirmatn
- Theme روشن/تیره، زیرساخت locale فارسی و آماده‌سازی تغییر زبان
- App Shell شامل Sidebar راست‌چین و جمع‌شونده، Header، Breadcrumb، جست‌وجوی نمایشی،
  اعلان، منوی کاربر، انتخاب شعبه، Mobile Navigation و Main Content responsive
- مسیر، منو، Breadcrumb، Page Header و Placeholder برای ۱۷ بخش قطعی CRM
- Dashboard Shell با KPI، نمودار، فعالیت و وظایف کاملاً مشخص‌شده به‌عنوان Demo/Placeholder
- صفحه مستقل منابع انسانی فقط با Route، Header، Breadcrumb، Loading و Empty State؛
  هیچ فرم یا قابلیت تجاری HR ساخته نشد.
- صفحه `/status` با Web/API status، زمان بررسی، loading/error/retry و Health URL محیطی
- کامپوننت‌های عمومی Button، Input، Select، Textarea، Checkbox، Dialog، Drawer،
  Dropdown Menu، Tabs، Badge، Card، Tooltip، Skeleton، Alert، Empty/Error State،
  Page Header، Data Table Shell، Filter Bar، Pagination Shell، Form Field و Confirm Dialog
- هدف کیفی ثبت‌شده: LCP ≤ 2000ms، INP ≤ 200ms، CLS ≤ 0.1، حداکثر 150KB gzip
  JavaScript در هر Route، Lighthouse Performance ≥ 90 و Accessibility ≥ 95

### فایل‌های اصلی

- `apps/web/src/app/(crm)/**`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/components/ui/**`
- `apps/web/src/components/dashboard/dashboard-shell.tsx`
- `apps/web/src/components/status/status-panel.tsx`
- `apps/web/src/messages/fa.ts`
- `apps/web/src/lib/navigation.ts`
- `apps/web/src/app/globals.css`
- `apps/web/package.json` و `pnpm-lock.yaml`

دو فایل `apps/web/AGENTS.md` و `apps/web/CLAUDE.md` توسط Next.js 16.3.1 در اجرای
development تولید شدند. طبق راهنمای همراه همین نسخه، نگه‌داشتن آن‌ها رفتار پیش‌فرض
توصیه‌شده برای دسترسی Agentها به مستندات version-matched است.

### Dependencyهای اضافه‌شده

- Radix UI: Checkbox، Dialog، Dropdown Menu، Select، Slot، Tabs و Tooltip
- `lucide-react`
- `@tanstack/react-query`
- `react-hook-form` و `zod`
- `next-intl`
- `class-variance-authority`، `clsx` و `tailwind-merge`
- `@fontsource-variable/vazirmatn`

TanStack Table و Recharts عمداً اضافه نشدند؛ در این مرحله جدول و نمودار فقط Shell هستند.

### تست و Build

- `pnpm lint`: پاس؛ ۶ task
- `pnpm typecheck`: پاس؛ ۸ task با DATABASE_URL مصنوعی `.env.example`
- `pnpm test`: پاس؛ ۱۳ تست در کل Workspace، شامل ۶ تست Frontend
- `pnpm build`: پاس؛ Web/API/Worker/packageها و ۲۱ صفحه Static
- `git diff --check`: پاس
- تست Routeها: هر ۱۷ Route کد ۲۰۰، `h1` و `main#main-content` داشت.
- Smoke الزامی: `/`، Dashboard، Customers، Sales، Reservations، Finance، Marketing،
  Human Resources، Master Data، Settings و Status کد ۲۰۰ و HTML فارسی/RTL داشتند.
- API Health و Swagger هنگام اجرا کد ۲۰۰ داشتند؛ پس از توقف API، Health قطع و صفحه
  `/status` همچنان در دسترس بود.
- اسکن Accessibility فایل‌به‌فایل اجرا شد؛ یافته‌های واقعی label/live-region اصلاح شدند.
  هشدارهای landmark و heading اسکنر عمدتاً ناشی از ندیدن ترکیب Root Layout و App Shell بودند.
- `pnpm format:check` کل مخزن روی ۶۸ فایل قدیمی و خارج از Scope شکست خورد؛ فایل‌های این
  Work Item جداگانه با Prettier قالب‌بندی شدند.
- QA تعاملی RTL/Responsive/Theme و Lighthouse اجرا نشد: اتصال Browser داخلی Codex پیش
  از بازکردن صفحه با خطای ACL محیط متوقف شد. این موارد صرفاً از نظر کد، CSS و build بررسی شدند.

### اجرای Local

اگر پورت ۳۰۰۰ آزاد است:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:4000/api/v1'
pnpm --filter @rubi/web dev
```

در این Smoke Test پورت ۳۰۰۰ توسط Docker/WSL اشغال بود و Web روی پورت ۳۱۰۰ اجرا شد:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:4000/api/v1'
pnpm --filter @rubi/web exec next dev --port 3100
```

برای API محلی، ابتدا packageهای مشترک و سپس API اجرا شوند:

```powershell
pnpm --filter @rubi/config build
pnpm --filter @rubi/contracts build
pnpm --filter @rubi/api dev
```

آدرس‌های Smoke Test:

- Frontend: `http://localhost:3100` (Server موقت متوقف شده است)
- API: `http://localhost:4000/api/v1` (Server موقت متوقف شده است)
- Swagger: `http://localhost:4000/api/docs`

### مشکلات و ریسک‌های باقی‌مانده

- مقدار `NEXT_PUBLIC_API_BASE_URL` باید در هر محیط build/deploy تنظیم شود؛ URL در کد
  hardcode نشده است.
- اندازه bundle و Core Web Vitals/Lighthouse باید پس از فراهم‌شدن Browser/CI اندازه‌گیری شوند.
- App Shell فعلاً داده نمایشی دارد و permission/auth واقعی در Work Item مالک PC-A اعمال می‌شود.
- Providerهای واقعی، داده Dashboard و APIهای تجاری هنوز قرارداد تأییدشده ندارند.

### نیازهای Backend

- `GET /api/v1/health` موجود و مصرف شد.
- Dashboard فقط باید Reporting View/API تأییدشده را مصرف کند.
- هر Route تجاری پیش از اتصال، به قرارداد versioned، permission و error model مالک ماژول نیاز دارد.
- هیچ API Contract مشترکی در این Task تغییر نکرد.

### Task پیشنهادی بعدی PC-B

یک Work Item مستقل برای یکی از ماژول‌های تحت مالکیت PC-B، ترجیحاً Human Resources
Discovery/Contract یا Dashboard Reporting Contract، پس از رفع تصمیم‌های باز و رزرو
Migration/Dependency/API Contract لازم.
