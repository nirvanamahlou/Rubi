# Rubi Airline CRM

Rubi یک CRM ماژولار برای شرکت خدمات مسافرتی و هواپیمایی است. Repository به‌صورت
Modular Monolith در یک pnpm/Turborepo monorepo پیاده‌سازی می‌شود. رابط کاربری فارسی و
RTL است و نام‌گذاری کد، API و دیتابیس انگلیسی باقی می‌ماند.

Technical Bootstrap شامل Web، API، Worker، Prisma Client و زیرساخت توسعه محلی است؛
هنوز هیچ ماژول تجاری، مدل دیتابیس تجاری، Migration یا Seed وجود ندارد.

## پیش‌نیازها

- Node.js `24.x` (نسخه مبنا `24.19.0`؛ فایل `.nvmrc` موجود است)
- pnpm `11.19.0`
- Docker Engine و Docker Compose برای سرویس‌های محلی

## راه‌اندازی سریع

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:generate
pnpm dev
```

آدرس‌های پیش‌فرض:

- Web App: `http://localhost:3000`
- Web status: `http://localhost:3000/status`
- API health: `http://localhost:4000/api/v1/health`
- Swagger UI: `http://localhost:4000/api/docs`
- MinIO API/Console: `http://localhost:9000` و `http://localhost:9001`

برای توقف سرویس‌های Docker بدون حذف volumeها:

```powershell
pnpm infra:down
```

Credentialهای `.env.example` فقط synthetic و مخصوص Local هستند. مقدار واقعی یا Production
در Repository قرار ندهید. فایل `.env` توسط Git ignore می‌شود.

## ساختار Repository

```text
apps/web                 Next.js App Router، Tailwind و RTL پایه
apps/api                 NestJS REST API، Swagger، validation و health
apps/worker              NestJS standalone، BullMQ و Redis health
packages/database        Prisma 7، PostgreSQL datasource و Client factory
packages/contracts       قرارداد مشترک Health
packages/config          helperهای تنظیمات مشترک
packages/eslint-config   ESLint flat config مشترک
packages/typescript-config TypeScript strict presets
infrastructure           Docker Compose توسعه محلی
tests                    محل تست‌های cross-application آینده
```

## دستورات توسعه و کنترل کیفیت

| دستور               | کاربرد                                                 |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | اجرای هم‌زمان appها در حالت توسعه                      |
| `pnpm build`        | Prisma generate و production build همه workspaceها     |
| `pnpm lint`         | ESLint همه workspaceها                                 |
| `pnpm typecheck`    | Prisma generate و TypeScript strict check              |
| `pnpm test`         | اجرای unit testها با Vitest                            |
| `pnpm format:check` | کنترل Prettier                                         |
| `pnpm db:format`    | فرمت Prisma schema                                     |
| `pnpm db:validate`  | اعتبارسنجی Prisma schema                               |
| `pnpm db:generate`  | تولید Prisma Client در مسیر ignore‌شده                 |
| `pnpm infra:config` | اعتبارسنجی Compose با مقادیر example                   |
| `pnpm infra:up`     | اجرای PostgreSQL، Redis، MinIO و bucket initialization |
| `pnpm infra:down`   | توقف containerها بدون حذف volumeها                     |

برای اجرای یک app به‌تنهایی:

```powershell
pnpm --filter @rubi/web dev
pnpm --filter @rubi/api dev
pnpm --filter @rubi/worker dev
```

Worker برای startup به Redis در دسترس نیاز دارد. Prisma commandها نیز `DATABASE_URL` را از
`.env` ریشه می‌خوانند. schema فعلی عمداً model ندارد و تولید Client بدون مدل مصنوعی معتبر است.

## داده نمایشی اسناد

پس از اجرای Migrationها و Seed معمول، هر توسعه‌دهنده می‌تواند همان هفت سند و تصویر کاملاً
ساختگی را روی دیتابیس و Storage محلی خود ایجاد کند. ابتدا نتیجه را بدون هیچ تغییری ببینید:

```powershell
pnpm documents:demo:preview
```

سپس، در حالی که Antivirus محلی فعال است، داده‌ها را اعمال کنید:

```powershell
pnpm documents:demo:apply
```

فرمان Apply فقط در محیط `development/test` و فقط برای PostgreSQL محلی Rubi روی پورت
`55432` اجرا می‌شود. اجرای دوباره رکورد تکراری نمی‌سازد و Metadata ویرایش‌شده کاربر را
بازنویسی نمی‌کند. تنظیمات به‌طور پیش‌فرض از `apps/api/.env` خوانده می‌شوند؛ برای مسیر
دیگر، `RUBI_API_ENV_FILE` را تعیین کنید. این بسته حساب مدیر یا رمز ایجاد نمی‌کند و به یک
مدیر فعال و شعبه مجاز موجود نیاز دارد.

## اسناد مرجع

- نیازمندی محصول: [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md)
- معماری و مرزها: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)، [docs/MODULE_BOUNDARIES.md](docs/MODULE_BOUNDARIES.md) و [docs/MODULE_OWNERSHIP.md](docs/MODULE_OWNERSHIP.md)
- مدل داده: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- روش همکاری: [AGENTS.md](AGENTS.md) و [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md)
- وضعیت و تخصیص: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) و [WORK_ASSIGNMENTS.md](WORK_ASSIGNMENTS.md)

هر مشارکت‌کننده باید پیش از تغییر، `AGENTS.md` را کامل بخواند و واحد کار خود را رزرو کند.
