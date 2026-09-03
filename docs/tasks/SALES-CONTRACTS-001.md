# SALES-CONTRACTS-001

- Status: `READY_FOR_REVIEW`
- Owner: `PC-A`
- Branch: `codex/pc-a-sales-contracts`
- Base: `origin/develop@85204a427ee575df1e81493e531418830b250abc`
- Worktree: isolated from the dirty primary workspace

## Reserved scope

- Sales Contracts module under `apps/api/src/sales/**` and `apps/web/src/modules/sales/**`
- Existing Sales routes under `apps/web/src/app/(crm)/sales/**`
- Module-local contracts, Sales tests, and this task-local document
- Cross-module access only through public contracts/ports; no direct table query or internal infrastructure import

## Active lock state

- PR #91 merged as `b69b7fa`; the atomic `DOCUMENTS-004-HANDOFF` is present in this
  branch through merge commit `8d3b89d`. آخرین `origin/develop@85204a4` نیز با Merge
  معمولی `dbaf450` وارد شد و تعارض اسناد با حفظ کامل Handoff فروش و Marketing حل شد.
- `Migration Owner`: `PC-A/SALES-CONTRACTS-001`.
- `Central Docs Owner`: `PC-A/SALES-CONTRACTS-001`.
- `Dependency/Lockfile Owner`: `RELEASED / UNASSIGNED`; this task does not reserve it
  and will not change dependencies or lockfiles.
- `Sales shared-contract/root export Owner`: `PC-A/SALES-CONTRACTS-001`.

## Non-interference boundary

- PR #85 and all Customers/Documents files in it remain unchanged.
- PC-B Master Data/Documents work remains untouched: no merge, cherry-pick, copy, or rewrite.
- No direct changes to `main` or `develop`; merge and force-push are prohibited.

## Delivered vertical slice

- قرارداد عمومی `sales.v1` و endpointهای versioned برای Dashboard، فهرست، جزئیات، ایجاد، ویرایش، پرداخت، تأیید، لغو، ReservationRequest، Audit و تاریخچه وضعیت منتشر شد.
- Prisma و Migration افزایشی `20260903123000_sales_contracts_vertical_slice` مالک Contract، Passenger، Service، Allocation، Ticket/Hotel selection، Price component، Payment schedule، Reservation request، Audit و Status history است. شناسه ماژول‌های بیرونی opaque است و FK یا Query مستقیم بیرونی وجود ندارد.
- Permissionهای Sales به‌صورت deny-by-default Seed شدند و نقش `sales_staff` فقط Permissionهای عملیاتی Sales و Public Contractهای لازم Customers، Master Data، Legal Entity و Documents را دریافت می‌کند.
- Repository و API واقعی با Branch scope، مالک/کانتر قرارداد، Optimistic Lock، Idempotency و Audit پیاده شد. مانده با Decimal دقیق و فقط از `FINANCE_CONFIRMED` کم می‌شود؛ برنامه و پرداخت pending مانده را کم نمی‌کند.
- تأیید قرارداد، Snapshot تغییرناپذیر `SalesReservationRequestV1` را در صف پایدار Sales ثبت می‌کند. تا انتشار Runtime Public API در Ticket Management، قرارداد دارای Offer بلیت هنگام تأیید fail-closed است و هیچ موجودی یا پاسخ ساختگی تولید نمی‌شود.
- صفحه `/sales` از placeholder به داشبورد واقعی API ارتقا یافت و `/sales/contracts/new` فرم تمام‌صفحه هفت‌مرحله‌ای مشتری، مسیر، خدمات، رفت‌وبرگشت، هتل، ویزا، مسافر، قرارداد چندارزی، چندپرداختی و چک است. تاریخ/زمان از DatePicker مشترک و payload زمان از UTC استفاده می‌کند.

## Verification

- Prisma format/validate/generate: موفق.
- PostgreSQL `18.1-alpine` خالی: هر ۳۱ Migration اعمال و `migrate status` به‌روز؛ Seed دو بار پیاپی موفق. کانتینر اختصاصی تست پس از Gate حذف شد.
- Full lint: ۶ Task موفق. Full typecheck: ۹ Task موفق.
- Full test پس از آخرین Merge: ۱٬۴۸۵ تست موفق؛ ۷۰ تست PostgreSQL اختیاری موجود طبق Suite skip شدند و Gate مستقل PostgreSQL بالا موفق است.
- Full Production Build: ۶ Task موفق؛ ۳۵ صفحه تولید و `/sales` و `/sales/contracts/new` موفق prerender شدند.
- Dependency و `pnpm-lock.yaml` تغییر نکرد؛ `main` و `develop` مستقیم تغییر نکردند و Rebase/Force Push انجام نشد.
