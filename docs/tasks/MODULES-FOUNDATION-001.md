# MODULES-FOUNDATION-001 — Foundation رابط تمام ماژول‌ها

وضعیت: `READY_FOR_REVIEW`
مالک: `COMPUTER_ID=PC-A`
Branch: `codex/pc-a-all-modules-foundation`
Baseline: `origin/develop@45c107e`
مجوز: Cross-module Frontend/Foundation؛ مالکیت نهایی ماژول‌ها تغییر نمی‌کند.

## هدف و مرز

تمام ۱۷ مسیر CRM برای بررسی محلی با رابط فارسی، RTL، Responsive و داده ساختگی آماده
می‌شوند. تغییر فقط در Web UI، قراردادهای ماژول‌محلی UI، تست Web و اسناد Task است.
Prisma/Migration/Seed/Persistence/Repository و Controller فعال ساختگی ممنوع‌اند. تنها استثنا
Supply-chain Build Policy Fix محدود در `pnpm-workspace.yaml` است؛ Dependency، Version و
Lockfile، قرارداد عمومی پایدار، Query بین‌ماژولی، فایل خروجی جعلی، Secret، Credential و
PII ممنوع‌اند.

## کنترل اولیه

- Dev Serverهای Rubi متوقف و Working Tree اولیه clean بود.
- `origin` همان Repository خصوصی Rubi است و `develop` با `origin/develop` همگام شد.
- PRهای #18، #19، #20، #21 و #22 در `origin/develop` موجودند.
- Merge Commitهای `45c107e471d53d1c724303de02ba01a5e0e16b2a` و
  `201ee096b07696a4df66a3602f2b93b9dc89daeb` ancestor قطعی develop هستند.
- تمام ۳۰ صفحه `crm.pdf` با استخراج متن و Render تصویری مرور شد.
- اسناد قطعی Repository در تعارض بر PDF مقدم‌اند.

## تعریف وضعیت

- `PRESERVE`: قابلیت موجود حفظ و فقط Integration/Navigation/هماهنگی ظاهری کنترل می‌شود.
- `BUILD`: Foundation قابل بررسی در این Task تکمیل می‌شود.
- `DEFERRED`: intent در UI هست؛ اتصال واقعی، Persistence، Worker یا artifact موکول است.

## Coverage Matrix کامل PDF

| # | مسیر | Coverage قابلیت‌های PDF | تصمیم |
| -: | --- | --- | --- |
| ۱ | `/dashboard` | فروش/درخواست/قرارداد؛ صف استعلام/اجرا/صدور/واچر/بیمه/Manifest؛ ظرفیت کل/Hold/فروخته/باقی؛ دریافت/مانده/چک/مسدودی/حساب/بدهی؛ سود قرارداد/خدمت/تخفیف؛ شعب/کاربران/دو سایت/Ticket/Task | `BUILD` با Preview |
| ۲ | `/customers` | مشتری حقیقی/حقوقی، تماس/آدرس/هویت/پرداخت‌کننده؛ مسافر/خانواده/همراه/سرگروه/اضطراری؛ پاسپورت/ویزا/انقضا؛ رضایت و Customer 360 کامل | `PRESERVE`؛ PII جدید ممنوع |
| ۳ | `/customer-affairs` | request مقصد/تاریخ/مسافر/بودجه/خدمت؛ Lead source/channel/owner/stage/probability/lost؛ activity/follow-up؛ qualification/handoff؛ Ticket صدور/شکایت/تغییر/اصلاح/cancel/refund/payment/resend؛ SLA/escalation/satisfaction | `PRESERVE` PR #18/#22 |
| ۴ | `/reservations` | inquiry بلیت/هتل/تور/API/کارگزار/قیمت/کنسلی/جایگزین/Hold؛ snapshot فقط‌خواندنی/correction؛ issue دستی/Provider/API/ظرفیت شرکت، PNR/number/reissue/void/cancel/refund؛ Manifest قالب/Excel/ارسال/پاسخ/نسخه؛ hotel/room/bed/meal/leader/transfer/sign/Confirmation/voucher؛ Saman idempotent؛ purchase request references | `BUILD`؛ اتصال واقعی `DEFERRED` |
| ۵ | `/ticket-management` | airline/flight/route/airport/terminal/time/class/baggage/rule؛ source company/charter/quota/Provider/API/manual؛ buy/sell/currency/markup/commission/discount/validity؛ capacity/Hold/confirmed/sold/remaining/anti-oversell؛ stop/version/reason/audit؛ Excel/recurring/copy/bulk/export | `BUILD`؛ بدون صدور مسافر |
| ۶ | `/sales` | qualified request؛ customer/payer/passenger/doc؛ تخصیص ticket/hotel/room/insurance/tour/bus/visa/transfer/CIP/manual؛ search/capacity/price/rule/Hold؛ quotation buy/sell/markup/discount/currency/tax/fee/version؛ contract terms/attachments/status؛ publish Finance/Reservations؛ execution/release/delivery | `BUILD`؛ Persistence `DEFERRED` |
| ۷ | `/purchases` | travel purchase؛ Reservation request با contract/service/passenger/supplier/operator؛ initial/discount/net/currency/FX/fee/tax/due/evidence؛ lifecycle؛ PO/invoice/payable/settlement؛ price version/history/margin؛ cancel/refund/penalty | `BUILD`؛ posting واقعی `DEFERRED` |
| ۸ | `/finance` | financial case/receipt/payment/refund/check/account/reconciliation؛ payable/settlement؛ Financial Release states و ۳۰ capability ثبت‌شده | `PRESERVE` PR #21 |
| ۹ | `/marketing` | campaign/budget/segment/SMS/email/template/discount/promotion/UTM/source/Lead/consent/unsubscribe/CAC/conversion/revenue/performance | `BUILD`؛ ارسال واقعی `DEFERRED` |
| ۱۰ | `/organizations` | agency/corporate profile/representative/user/contract/credit/agreed rate/discount/commission/account manager/passenger/order/consolidated invoice/receipt/check/settlement/document | `BUILD`؛ credit enforcement `DEFERRED` |
| ۱۱ | `/human-resources` | employee/contact/bank masked/branch/unit/position/manager/chart/contract/attendance/shift/leave/mission/overtime/performance/training/asset/document/expiry/Finance link/permission/audit | `BUILD`؛ PII و payroll واقعی ممنوع |
| ۱۲ | `/tasks` | individual/group/assignee/observer/due/priority/checklist/attachment/CRM ref؛ approval contract/discount/purchase/payment/delivery؛ event/schedule/notification/reminder/retry/escalation/run result | `BUILD`؛ engine `DEFERRED` |
| ۱۳ | `/documents` | customer/passport/quotation/contract/ticket/Manifest/hotel form/voucher/policy/invoice/receipt/purchase/finance/org/HR؛ category/version/confidentiality/expiry/owner/history/secure link | `BUILD` archive؛ storage/signed URL `DEFERRED` |
| ۱۴ | `/reports` | customer/lead/sales/allocation/reservation/capacity/issue/Manifest/hotel/voucher/insurance/procurement/discount/net/margin/finance/check/AR/AP/branch/user/supplier/org/marketing/support/HR/custom؛ filter/saved/schedule/PDF/Excel/CSV | `BUILD` UI؛ artifact/view `DEFERRED` |
| ۱۵ | `/integrations` | site 1/2؛ flight/hotel/bus/tour/Saman/payment/SMS/email/accounting/webhook/airline Excel؛ sandbox/prod/mapping/redacted log/retry/timeout/rate/idempotency/duplicate prevention/health | `BUILD`؛ Secret/API واقعی ممنوع |
| ۱۶ | `/system` | users/roles/permissions/teams/branches/scopes/sessions/2FA/login/audit؛ company/logo/brand/domain/locale/timezone/Jalali/calendar؛ numbering/Hold/Manifest/issue/delivery/cancel/refund/markup/discount/PDF/message/password/session/API/SLA/log | IAM `PRESERVE` + settings Preview `BUILD` |
| ۱۷ | `/master-data` | geography؛ currency/FX/bank/payment؛ airline/class/baggage/bus/route/Manifest؛ hotel/chain/room/meal/facility؛ insurance/tour/transfer/CIP/visa؛ supplier/provider؛ leader؛ acquaintance/channel/lost/customer type/tag/branch/unit/position؛ inactive-only | `PRESERVE` Persistence موجود |

## فرایند سراسری

`Customer Request → Sales + Passenger Allocation → Reservation Inquiry/Hold → Sales Contract
→ Finance + Execution → Purchase Request → Ticket/Voucher/Insurance → Manifest
→ Supplier Payable → Financial Release → Sales Access → Passenger Delivery → Support`

ظرفیت، عملیات، Financial Release و Delivery محورهای مستقل‌اند. Reservation تخصیص
passenger/service را تغییر نمی‌دهد؛ Ticket Catalog سند مسافر صادر نمی‌کند. تولید، صدور و
Render هر سند بر عهده ماژول اصلی است: Sales قرارداد؛ Reservations بلیت، Manifest، فرم
رزرو، واچر و بیمه؛ Finance رسید، فاکتور و خروجی مالی؛ Purchases سفارش و اسناد خرید؛
و HR اسناد پرسنلی را تولید می‌کند. Documents فقط Artifact نهایی را دریافت و نگهداری
می‌کند و مالک archive، version، confidentiality/access، expiry/retention، file owner،
download/view audit و secure link است.

## استاندارد مشترک

| استاندارد | پوشش |
| --- | --- |
| فارسی/RTL/Responsive/آبی/کنترل بزرگ | App Shell و Workspace مشترک |
| داشبورد داخلی | KPI ساختگی با برچسب Preview |
| Search/Filter/Sort/Pagination | کنترل محلی روی نمونه |
| Create/View/Edit | Preview بدون ذخیره |
| Loading/Empty/Error/Forbidden/Preview | State switcher قابل تست |
| Permission Matrix | permission پیشنهادی deny-by-default |
| Timeline/Audit | placeholder بدون actor/PII واقعی |
| Cross-module reference | owner contract/reference؛ بدون query مستقیم |
| خروجی | دکمه غیرفعال تا Worker ماژول مالک و تحویل Artifact نهایی به Documents؛ بدون فایل جعلی |
| Synthetic data | «نمونه طراحی و ذخیره‌نشده» |

## Deferred مشترک

Persistence/Prisma/Migration/Seed؛ Provider/Gateway/Saman/Messaging/Accounting/دو سایت؛
Worker/Queue/Retry واقعی؛ Excel/PDF/CSV واقعی؛ approved reporting views؛ Secret/PII؛
shared contract جدید؛ تصمیم‌های باز Provider، سایت/برند، retention، HR، SLA، numbering
و Manifest template.

## Supply-chain Build Policy Fix — Review PR #23

- مکانیزم رسمی pnpm 11 یعنی `allowBuilds` در `pnpm-workspace.yaml` استفاده می‌شود.
- فقط `@parcel/watcher` و `@swc/core` مقدار `true` دارند؛ تمام Packageهای native/build
  شناخته‌شده دیگر صریحاً `false` هستند و wildcard وجود ندارد.
- هیچ Dependency یا Version اضافه/تغییر نمی‌کند و `pnpm-lock.yaml` باید بدون Diff بماند.
- Fresh Install frozen در Worktree موقت بدون `ERR_PNPM_IGNORED_BUILDS` پاس شد؛ خروجی
  lifecycle فقط `@parcel/watcher install` و `@swc/core postinstall` را نشان داد،
  `pnpm-lock.yaml` ثابت ماند، Worktree موقت حذف و قفل موقت `RELEASED` شد.

## Quality Gate

- `pnpm lint`: پاس؛ ۶ workspace اجرایی موفق.
- `pnpm typecheck`: پاس؛ ۹ task موفق همراه Prisma Client generate بدون تغییر Schema.
- `pnpm test`: پاس؛ Web برابر ۷۳ تست، API برابر ۱۰۷ تست، Contracts برابر ۱۲ تست،
  Database برابر ۱۰ تست، Config برابر ۲ تست و Worker برابر ۱ تست.
- `pnpm build`: پاس؛ ۶ task موفق و هر ۱۷ route اصلی در خروجی production موجود است.
- HTTP production smoke: هر ۱۷ route با cookie کاملاً ساختگی، status 200 و HTML معتبر.
- Browser QA داخلی دو بار به خروج ناگهانی trusted browser process برخورد کرد؛ مطابق
  قرارداد Task، production build و HTTP smoke جایگزین و محدودیت شفاف ثبت شد.
- Sidebar با تست رگرسیون overflow/truncate پوشش داده شد.
- هیچ Prisma Schema، Migration، Seed، Dependency، Lockfile، Persistence، Controller
  ساختگی، فایل PDF/Excel/CSV جعلی، Secret، Credential یا PII واقعی تغییر/ایجاد نشد.
- `git diff --check`، Scope و Secret/PII scan پاس شدند؛ فایل‌های تغییرکرده با Prettier همخوان‌اند.
