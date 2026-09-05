# SALES-CONTRACTS-001

- Status: `READY_FOR_REVIEW`

## Combined flight/hotel details — PC-A — 2026-09-05

- Flight and hotel share one detail step regardless of checkbox selection order; flights precede the hotel section. Hotel options are destination-city-filtered public Master Data references with normalized Persian/English name/code search.
- Suggested check-in is outbound departure calendar day +1; suggested check-out is return departure day -1, using the same Asia/Tehran date displayed by Sales ticket cards. Missing directions do not fabricate dates. Invalid/zero-night stays block continuation with an explicit warning.
- Per-field manual provenance stays local to the draft, survives subsequent ticket changes and permits intentionally clearing a field; legacy dates are preserved. Reset action explicitly re-enables both suggestions. Existing SalesHotelSelectionInput carries only the final dates to the immutable Reservations intake snapshot.
- Reservations editing is BLOCKED pending a versioned operational amendment API, authorization/audit/concurrency design and resolution of the existing unrelated dirty Prisma ownership. No direct Sales table writes from Reservations, mutation of the intake fingerprint/snapshot, fabricated save or schema change.
- 50 Sales Web tests, scoped lint, Web typecheck and production build (35 routes) passed. No authenticated visual QA claimed; stopped runtime servers stay stopped. Existing Customers/Documents/Passport/Button changes are excluded; PR #90 remains Draft, not globally ready for review.

## Vertical route pairs and English Gregorian Sales calendars

- Origin/destination each group country above city, with two desktop columns and a stacked mobile layout. Search/filter/reference semantics unchanged.
- Additive gregorianEnglish option on shared DatePicker and display helpers defaults to false. SalesDatePicker opts in for all Sales date fields, and the Sales range picker uses the same English month names. Gregorian panels have English labels/weekdays/digits and LTR navigation; Persian mode and other consumers remain unchanged. Stored ISO date/time values do not change.
- Shared Calendar Owner reserved by PC-A for these clean shared files pending review. No dependency, API, schema or IAM modifications. 48 Sales/shared-calendar tests, scoped lint/typecheck and Web production build passed. Authenticated visual QA remains unclaimed.

## Calendar parity and ticket presentation

- Final Web production build passed (35 routes), with the configured public API URL retained for local runtime.

- Sales-local range picker now follows shared DatePicker styling: input-like calendar trigger, segmented calendar-system control, primary header and month/year grids. Existing shared date utilities power all calculations. Above/below placement and bounded scrolling prevent the low-screen clipping shown in the reference. Shared calendar implementation remains untouched.
- Range stays optional, clearable, single-calendar and inclusive; filter query semantics and return lower-bound/independent upper-bound behavior remain unchanged.
- Ticket cards expose actual carrier/service number, reference-backed city names, separate departure/arrival dates and minute-only times, derived elapsed duration, authoritative cabin and total capacity. Display timezone is explicitly Asia/Tehran for both endpoints; stored UTC values stay unchanged. Blue selection also uses an icon/text and aria-pressed. No price, airport code, or remaining capacity is invented.
- 39 Web Sales tests cover placement bounds, range selection, real card labels, selection accessibility, duration and overnight Tehran date rollover; scoped lint/typecheck pass. Authenticated visual/browser QA remains unclaimed due to the previously reported tool failures. No schema, API or IAM changes.

## Combined people step and inline creation

- Five steps now combine customer lookup/selection and passenger birthdates/age display. Selecting another customer preserves all existing passengers and birthdates; duplicate selections are ignored.
- Sales-local inline person editor offers customer/passenger creation through existing customersApi.create only. Names are required; passenger birthdate is required; national ID is optional and is not stored in the contract draft. Customer creation can include passenger role via an explicit checkbox. Successful owner-API response supplies the real ID; failures never fabricate people.
- The entered birthdate populates the contract passenger even when the create response masks it. Creation uses existing session/permission/branch checks with no grants or bypasses. An in-flight guard prevents double-click submissions; ambiguous network errors advise searching before retrying since the owner endpoint has no create idempotency contract. Canceling the contract does not delete an already created person; the UI explains separate persistence.
- 35 Sales Web tests, scoped lint, typecheck and production build pass. Tests cover roles, validation, preservation, duplicate selection, public API success/failure and no nested form. No actual person records were created during verification; authenticated browser QA remains unclaimed. Concurrent Customers/Contracts/Prisma edits remain excluded.

## Compact entry and dashboard connectivity follow-up

- Replaced oversized form header, stepper and minimum-height card with a bounded compact layout; country/city pairs share one desktop row, services use small selectable controls, directional options stay independent, and footer actions remain accessible. Shared UI files are unchanged.
- Diagnosed the prior production bundle: NEXT_PUBLIC_API_BASE_URL was unresolved, preventing browser API calls. Added only the public local API address to ignored apps/web/.env.local and rebuilt. Local environment files are not committed; each other environment must supply its own public API URL at build time.
- Read-only SalesRepository dashboard/list probes with a nonexistent-contract scope succeeded without exposing user records. API health returns 200 and CORS accepts localhost:3100. Dashboard/list use independent settled results; genuine network/session errors stay explicit rather than being replaced by fake zero counts.
- 27 Sales Web tests pass, including compact form structure, dashboard partial failure, configured authenticated fetch and expired-session/network errors. Scoped lint and production typecheck/build pass. No schema, migration, IAM or other module changes. Browser tool failed at initialization; authenticated UI/visual verification remains unclaimed.

## Optional flight dates and flag-only transfers

- Verification: 20 Sales Web tests and 28 Sales API tests passed; scoped ESLint, Web/API typecheck and both production builds passed. Web restarted on localhost:3100 and the contract page returned HTTP 200. No authenticated visual verification is claimed.

- FLIGHT deselects/disables BUS and TRAIN; Sales domain rejects the same combination at the API boundary. Transfer remains independently directional, has no detail step or pickup/dropoff/date requirements, and prints TRANSFER INCLUDED with the chosen directions.
- The route/services step no longer asks for departure date. Public flight search defaults to future offers ordered by departure; a Sales-local single-calendar Persian/Gregorian optional range can be applied/cleared. Past range endpoints cannot be selected. The outbound upper bound never restricts return flights.
- Payload travel date derives from the selected outbound/return offer, then hotel check-in, then explicit service start for non-flight/non-hotel passenger-age calculation. Search filters do not change the contracted travel date. Earlier transfer-detail requirements in this document are superseded.
- No schema, migration, seed, dependency, shared-calendar or other module implementation changes. Concurrent Customers/Documents changes remain outside these commits. Authenticated browser/visual QA remains unavailable due to the previously reported Windows tool failures.

## Combined flight selection, synthetic offers and output template

- Flight details are one step, with outbound and return columns on desktop (stacked within the same step on narrow screens). Selecting outbound reveals return options in the adjacent column; both required choices must be completed before continuing. Return-only remains supported.
- The business checkbox persists `businessOutput` in each selected Flight service's existing metadata. It affects only the output label; inventory queries do not filter by that checkbox, and ticket snapshots retain each authoritative offer's real cabinClassCode for revalidation. No actual fare/class upgrade is implied.
- Added a print-preview template based on the supplied Flight ticket.png layout: navy/teal header, existing Niyayesh brand asset, identity/passenger fields, itinerary table, fare/payment and notice sections, with optional BUSINESS label. Available during review and after creation, per selected passenger. Printing uses a separate body portal to omit CRM navigation/form content.
- This is explicitly DRAFT / NOT VALID FOR TRAVEL. No source-image passenger, sample e-ticket number, PNR, airline logo, baggage allowance, airport code or payment/issuance confirmation is fabricated. Current Sales offers expose cities/times, not official airport/issuance data; those remain placeholders or labelled cities. Actual issuance/document release remains owned by Reservations/Finance/Documents. Visual browser/physical print QA has not been performed.
- User-authorized local synthetic offers published through TicketPublicService on existing HQ, with offline audit attribution and no IAM changes: TEST-AYT-01/02 outbound Tehran → Antalya on 2026-09-10 at 07:00/12:00 UTC; TEST-AYT-03/04 return on 2026-09-17 08:00 and 2026-09-20 09:00 UTC. Each capacity 20, duration three hours, TEST AIRLINE, ECONOMY. No traveler, real booking or Finance confirmation created. Stable publication keys replay to the same four IDs; all four verified through public search.
- Sales Web tests: 15 passed; scoped lint, Web typecheck and final production build (35 routes), including print isolation, passed. No schema/migration/dependency changes. Unrelated concurrent Customers/Documents/Prisma changes excluded from task commits.

## Turkey/Antalya maintenance and ticket panel removal — 2026-09-05

- Resolved the earlier reference-data blocker using an offline Nest context for the owner Master Data service, following the module's existing local-maintenance attribution pattern. Only the explicitly named local Rubi database was permitted. No HTTP auth weakening, IAM user/session/branch/permission creation, direct private-table queries or repository imports were used by the maintenance caller.
- Created active Turkey (`TR`), the required Antalya region, and active Antalya city linked to that country/region. Read-back through the owner service verified the links/status; repeating the operation reused all three records without creating duplicates. Writes retain the owner's validation and audit path with explicit offline maintenance identifiers, not a real logged-in user identity.
- Removed only the PublishedOffers panel mount/import from TicketWorkspace. Existing offer records, public API, sale revalidation and the component source remain intact. The existing weekly/monthly Repeat Ticket action is unchanged. Repeat Ticket remains the pre-existing local catalog workflow; removing this panel does not newly wire that workflow to offer publication.
- Ticket Catalog tests: 96 passed; Ticket Catalog lint, Web typecheck and production build (35 routes) passed. No schema/migration/dependency or other module source changes in this follow-up. Concurrent Customers/Documents/Prisma changes are not part of these commits.

## Parent service selection/dashboard follow-up

- Selecting the Flight or Transfer parent checkbox now selects both OUTBOUND/RETURN and expands the two independent child checkboxes underneath. Disabling the parent clears its directions without changing the other service. Re-enabling starts with both directions again.
- `/sales` remains the contract dashboard with its New Contract action. The new-contract page now has a visible link back to that dashboard; existing local draft persistence is retained.
- Web Sales tests: 12 passed; Sales lint and Web typecheck passed. No API/schema/migration/permission changes for this follow-up. Unrelated local changes remain excluded.
- User also authorized adding Turkey and Antalya to Master Data. This data operation is NOT completed or verified: browser runtime failed with Windows ACL errors, the Computer Use Node runtime also failed, and unauthenticated public Master Data API access returned 401. No authentication bypass or private-table write was used. Reference creation still needs a working authenticated public interface.

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
