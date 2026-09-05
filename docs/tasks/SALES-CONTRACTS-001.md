# SALES-CONTRACTS-001

- Status: `READY_FOR_REVIEW`

## Authorized continuation — 2026-09-05

Latest follow-up supersedes the earlier activation gate and route UI limitations; historical verification below is retained.

## Searchable route and independent directions — 2026-09-05

- Added required country/city selectors for both ends, country-filtered cities, Persian/English search, rounded themed menus with keyboard selection, and reference-backed Iran/Tehran → Turkey/Antalya defaults. Existing drafts retain their route; unavailable reference records are not fabricated.
- Flight outbound/return and transfer outbound/return are independent checkboxes. Trip type follows selected directions. Selected services get ordered detail substeps; transfer date/pickup/dropoff/notes persist in existing service metadata. Other optional services can carry customer notes.
- Return search reverses the route and starts at the outbound ticket date (or travel date for a return-only booking), without an upper date bound. A chronological overlap with an outbound arrival is rejected. Return-only flights do not require a fabricated outbound ticket.
- Sales v1 metadata.direction is OUTBOUND/RETURN for directional services. Distinct service keys flow through passenger assignments and the existing immutable Reservations snapshot. Legacy services without direction retain their original trip-type validation. No schema, migration, shared contract shape, dependency, Finance or permission changes in this follow-up.
- Verification: 9 Web Sales tests; 26 API Sales tests including all 15 non-empty combinations; Web/API typecheck; Sales lint; Web/API production builds (35 routes). Local build includes unrelated concurrent changes, which are excluded from Sales commits. No authenticated visual browser QA claim.
- Operational activation from the previous continuation completed after explicit user approval: four approved role-permission links added to local Rubi with IAM audit records; branch membership hashes unchanged and grants verified. This resolves the historical approval blocker below.

## Earlier authorized runtime continuation

- Owner explicitly approved Ticket Catalog persistence/public API and Reservations intake to support selectable offers and versioned Sales dispatch.
- PC-A reserves Ticket Catalog/Reservations runtime, their versioned public contracts/root exports, additive Prisma migration, permission seed and module wiring under this task; existing Migration/Central Docs locks remain in force. No dependency changes.
- Ticket Catalog produces branch-scoped offers/revalidation; Sales consumes only its public service. Sales produces immutable sales.v1 requests; Reservations consumes them idempotently and owns execution records. Changes are additive and preserve existing contracts.
- Acceptance: route/services first, selectable outbound/independent return search, destination hotel search/visa, age categories, negotiated IRR/foreign totals, payment rows/check dates, owner scope and Finance-confirmed settlement.
- Earlier verification applies only to the earlier slice, not this continuation.
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

The following section records the original slice. The 2026-09-05 continuation below supersedes its runtime and seven-step UI limitations.

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

## Continuation delivery and verification — 2026-09-05

- Commits: `1d145c4` (public contracts/schema/seed), `914450d` (runtime/API/outbox), `aeef6be` (route-first UI/payments). Same Draft PR #90; no unrelated Customers/Documents changes included.
- Ticket Catalog owns immutable published offers, permission/branch-scoped search, idempotent publication and audit. Sales validates the selected snapshot through its public service; no cross-module private-table access. Capacity is checked, not held or allocated.
- Reservations owns idempotent request intake and a branch-scoped inbox. Sales durable outbox retries until receipt, then records acknowledgement. Passenger assignments and ticket selections travel with the versioned snapshot. Intake does not implement ticket issuance, vouchers or procurement.
- Six-step full-page form: route/services, travel selection, customer, passengers, totals/installments, review. Blue selectable offer cards, paginated independent return search from the lower date without an upper cap, destination hotel search and visa selection, cabin class, and age bands are connected to real APIs. Outbound currently uses one departure date, not a date range.
- Contract payments can be added from the contract list, including check dates/details. Multi-currency settlement remains outstanding while any currency is unpaid; pending schedules do not count as Finance-confirmed receipts.
- Additive migration `20260905070000_travel_runtime_intake`: all 32 migrations succeeded on a second fresh PostgreSQL 18 database; seed ran twice successfully. Permission-only operational definitions, no real traveler or offer data. Seed transaction has a bounded 30-second timeout.
- Dedicated integration suite: 5 passed, including 4 real PostgreSQL tests for publication/idempotency/scope, return search/revalidation, concurrent immutable intake, mixed-currency settlement and durable dispatch acknowledgement. Full workspace tests, typecheck, lint and production build passed. Full tests include 74 optional database skips, with the four new database tests separately executed successfully. Build produced 35 routes.
- Full local checks included independently modified Customers/Documents/shared button files; these were preserved and excluded from this task's commits. CI should validate the committed branch independently.
- Existing local database reported migrations up to date. Web `http://localhost:3100/sales/contracts/new` and API health returned HTTP 200; ticket API CORS preflight returned 204 for port 3100. This is not authenticated end-to-end verification. Browser automation failed with host ACL errors.

## Remaining activation and limits

- Auto-review denied operational role grants because the earlier authorization did not identify exact recipient roles/resources/scope. No new role grants were applied to the operational database. Explicit approval is required for `sales_staff: ticket_catalog.read` and `administrator: ticket_catalog.read, ticket_catalog.manage, reservations.read`, limited to each role/user's already authorized branches; no new branch access.
- Standard seed definitions were verified only in the isolated database; do not run them on operational data to bypass the denied grant action. Existing role grants for these resources were observed as zero.
- Legacy browser-local ticket definitions are not automatically published/migrated. Operators must publish real scheduled offers through the new authorized interface. No synthetic production data was created.
- State remains IN_PROGRESS pending access activation and authenticated browser verification; receipt in Reservations means queued for execution, not fulfillment.
