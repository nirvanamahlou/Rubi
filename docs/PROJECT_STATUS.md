## 2026-10-07 — SALES-CHILD-UNDER15-1007 — PC-A — READY_FOR_REVIEW

Owner supersedes under18 with under15: selectable child ages2..14, last band14 to less than15. Exact hotel birthday classification aligns Web/save/update/confirmation at15; stale draft ages15+ reject rather than receive child pricing. Infant, legacy capacity, flight categories, original imported tariff bands and stored contracts remain unchanged. Boundary12/14/15 regressions gate the owner-authorized develop merge with affected lint/typechecks and full CI; no database, schema, dependency or runtime deployment.

## 2026-10-07 — ENGLISH-UI-1007 — PC-A — READY_FOR_REVIEW

Application display now supports personal Persian/English selection at login and in the header, with offline fixed-text translation, English accessibility/metadata, LTR layout, Latin digits, calendar labels and locale-aware PDF/Excel outputs. Canonical customer input, wire values, permissions, Decimal amounts and concurrency controls remain unchanged. Existing English reference names are preferred where available; unknown stored names are retained. The isolated legacy editor uses a reversible same-origin adapter. Translation coverage and derived catalogue checks gate future fixed-text additions through existing CI.

Owner explicitly approved only fixed display strings sent for the initial translation, including bounded API/contract display text. No source code, secrets or customer records were transmitted. Full Web suite passes2,609 tests with six existing skips;25 focused API output/HTTP tests pass. Web/API lint, typechecks and production builds pass. Native-browser login proof covers both languages, English wordmarks and an unsubmitted synthetic username surviving language changes. Authenticated browser workflows remain unverified. Full exact-head monorepo CI gates the owner-authorized develop merge. No own dependency/schema/migration or operational runtime/database deployment. Bounded locks release with review candidate; see docs/tasks/ENGLISH-UI-1007.md for future additions and handoff.

## 2026-10-07 — SALES-CHILD-UNDER18-1007 — PC-A

Owner confirmed under18 (last selectable band17 to less than18) and explicitly authorized develop merge. Sales age selector expands child2..17 while infant0..1 and unrelated selector limits remain unchanged. Actual-birthday exact hotel occupancy checks align Web, API save/update and confirmation at18; matching imported bands remain authoritative and absent age tariffs fail closed. Legacy capacity/flight age categories and existing contracts are not rewritten. Boundary12/17/18 and missing-band regressions cover draft and assigned guests. No schema, shared wire contract, dependency, operational data or runtime deployment; affected tests/lint/typechecks and exact-head CI gate merge.

## 2026-10-06 — HOTEL-OCCUPANCY-REIMPORT-1006 — PC-A — PREVIEW_REVIEW

Repeated Excel import matches exact branch/city/date/currency/board/hotel/supplier independent of chunk boundaries, updates existing standalone occupancy packs using their current version, skips unchanged content and creates only unmatched rows/periods. Missing source hotels/rooms/compositions and unrelated suppliers/boards/tour packs remain untouched. Ambiguous duplicate targets and oversize merged packs fail closed. User-visible hotel-create failure was caused by unsupported countryId in the consumer payload; removed it while preserving geography preflight, and added actual producer allowlist regression. Reservations256 tests (two existing skips), scoped lint and Web typecheck pass;55-route production build and owned3210 activation are final delivery gates. No actual importer execution, live3100/operational database/develop mutation. Same previewPR671 follow-up.

## 2026-10-06 — HOTEL-OCCUPANCY-BULK-REGISTER-1006 — PC-A — PREVIEW_REVIEW

Whole-file Nora import now registers automatically dated/currency/board-scoped hotel packs instead of mapping one hotel into a manual draft. Missing hotel/room references use existing public Master Data CRUD under original permissions, while existing links are preserved with CAS. One owner-supplied editable supplier name applies to the file; missing supplier creation requires explicit confirmation. Accepted pack commands reuse actor/payload-derived replay keys after uncertain responses; partial progress is reported without destructive rollback. Human policy: exact guest-composition tariff wins over generic ROOM only on matching guest shape and overlapping days. Other conflicting rows require correction or explicit valid-only consent. Read-only corrected-file proof yields38,019 eligible tariffs for65 hotels /389 bounded packs;2,010 ROOM overrides plus884 conflicting and157 invalid-date rows reconcile41,070 source rows. Reservations251 tests (two existing skips), scoped lint/typecheck and55-route production build pass. Only preview3210 activation is in scope; no actual file registration, live3100/database/develop mutation or authenticated browser proof. Package-generator use of exact occupancy packs remains a separate integration, not implied by persistence.

## 2026-10-06 — HOTEL-PACK-DESTINATION-ROW-1006 — PC-A — PREVIEW_REVIEW

Country/city selection now presents a compact responsive row with visible «انتخاب کشور و شهر»، «کشور» and «شهر» labels plus distinct themed placeholders. Authorized writers start with an unsaved draft, without needing the extra new-pack click before selecting a destination. Preferred Turkey/Antalya IDs are resolved only from the existing authenticated active Master Data projection; no identifiers or fallback database records are invented, and no stored pack or existing user selection is overridden. Read-only diagnostic confirms active Turkey and its active Antalya city already exist in the copied preview database. No database/API/permission/schema/migration/dependency change. Reservations Web237 tests pass with two existing skips; scoped lint, typecheck and production build gate only owned Web3210 activation. No authenticated real import or operational/live3100/develop mutation. Same PR671 follow-up, bounded locks release with candidate commit.

## 2026-10-06 — HOTEL-PACK-BROWSER-1006 — PC-A — PREVIEW_REVIEW

PR671 follow-up adds a bottommost authorized saved-pack browser: complete paginated branch directory → distinct cities → exact pack/date/currency/version selection → searchable saved hotels → explicit whole-pack price PATCH. Search never removes unshown rows/rooms; exact tariff decimals/ages/boards/currency, broker/capacity/factor/tour identities, CAS, operation-key retry and append-only revisions are preserved. Stale detail responses are ignored; unsaved edits guard city/date/branch navigation and have an explicit discard action. Genuine legacy bases remain editable even beside exact rooms; exact-only nominal compatibility bases are read-only and never presented as actual composition prices.

Owner explicitly approves bounded PC-B public geography extension to PC-A: existing authenticated Reservations pack-options now projects active countries, country-filtered cities and canonical city-by-ID lookup through MasterTravelDirectory. Permanent ownership/permissions unchanged; legacy city/hotel callers remain compatible. Country and city precede file selection; destination changes clear file/mappings, with explicit confirmation before discarding selected draft hotels. An explicit preview button reads Excel locally; actual persistence still requires broker/reference/date validation and the separate «ثبت بستهٔ نرخ» action. No automatic import, schema/migration/dependency/operational data/live3100/develop change. Exact-occupancy Package Pricing integration is NOT implemented by exposing nominal compatibility rates to legacy tour factors.

Scoped lint, API/Web typechecks, Reservations Web233 tests (two existing skips), Reservations/public-directory API187 tests (six opt-in skips), API production build and the55-route Web production build gate owned preview3210/4210 refresh. Synthetic hook regressions cover stale selection, guarded discard, offline retry and version advancement; no authenticated real import/payment workflow executed. PC-B reviews only the bounded public directory diff. Own locks release with review candidate; private workbook/outputs remain untracked.

## 2026-10-06 — SALES-PASSENGER-AGE-THEME-1006 — PC-A — PREVIEW_REVIEW

Child/infant age controls now use the existing themed accessible searchable combobox rather than browser-native selects. Larger48px fields/text and responsive grid preserve canonical age bands, clearing/null versus infant zero, pricing and payload validation. All333 Sales tests pass (one existing skip), scoped lint and Web typecheck pass; production build gates owned Web3210 activation. No API/schema/dependency/database/live3100/develop merge or authenticated browser workflow. PR671 follow-up; bounded locks release with candidate commit.

## 2026-10-06 — HOTEL-OCCUPANCY-IMPORT-READER-1006 — PC-A — PREVIEW_REVIEW

Follow-up PR671 fixes XLSX namespace prefixes and named output-sheet relationships (not first/single sheet), preserves physical row numbers, ignores passive links without following them, and separates file errors from rejected rows. Browser-local searchable paginated preview includes all data/valid/error/excluded counts, distinct hotel/room counts and currency price counts. Full corrected XLSX native-browser parser test confirms40,913 valid prices and157 original reversed date ranges. Reservations208 tests pass with two existing skips; scoped lint/typecheck/production build gate owned Web3210 restart. No authenticated import, operational data or API/schema/dependency/develop change. Owner-requested filtered workbook delivered privately: AutoFilter across20 columns/all41,070 data rows, frozen header and independent821,420-cell preservation check. Own bounded locks release with commit.

## 2026-10-06 — HOTEL-OCCUPANCY-IMPORT-PREVIEW-1006 — PC-A — PREVIEW_REVIEW

Corrected private Nora output workbook delivered separately (41,070 rows; IN DBL PP removed). Per-room legal Pareto maxima, per-row total occupancy and every child age slot independently verified; original prices/dates/metadata unchanged. Full-file parsing accepts40,913 rows and explicitly rejects157 reversed source date ranges without guessing. Reservations local-only XLSX draft mapping, versioned optional exact room-night tariffs, search/date/price editing and Sales age/actual-guest room allocation/base pricing implemented. Source decimals retained; final financial sum rounded once, negotiated agreement preserved. Existing real FKs, permissions, CAS/audit/replay and legacy tour-factor isolation retained. 524 Web affected tests,267 API affected tests and8 exact Contracts tests pass (existing opt-in skips); API/Web/Contracts lint/typechecks and builds,55 Web routes and preview PostgreSQL rollback/CHECK proof passed. Separate copied-DB preview only; no actual Nora import, operational DB/live3100/deploy/develop merge. Owner reviews authenticated import flow; docs/tasks/HOTEL-OCCUPANCY-IMPORT-PREVIEW-1006.md records limitations and rollout. Bounded source/schema/contract locks release with candidate commit, no dependency changes.

## 2026-10-06 — TICKET-NO-DELETE-1006 — PC-A — READY_FOR_REVIEW

Defined-ticket deletion is removed from flight-load future/expired row actions and the legacy ticket card/confirmation flow. The Web API client no longer exposes delete. The authenticated legacy DELETE command rejects with HTTP400 before any DB transaction; existing status controls, history, prices, finance references, tour deletion and historical migration bytes remain. 184 Ticket Catalog Web tests (one existing skip), scoped Web/API ESLint and API typecheck pass. 181 API tests (19 opt-in skips) include three real PostgreSQL/HTTP lifecycle tests; fresh synthetic DB was fully migrated and removed after success. API typecheck/build passed. Web production build and exact-head CI gate user-authorized develop merge; bounded locks released with commit. No schema/migration/permission/dependency change or runtime rollout.

## 2026-10-05 — SYSTEM-USERS-TILE-1005 — PC-A — READY_FOR_REVIEW

User Management is now a directly linked purple card inside the existing responsive System Management grid, with a stronger border, users icon and quick-access footer. The duplicate page-top link is removed. Persian/English labels, company-settings filtering, search and existing IAM access-link protection remain. No API, permissions, migration, dependency or live runtime change. 19 focused existing tests, scoped ESLint, format and diff checks pass. Scoped lint, local Web typecheck/build and exact-head CI gate the user-authorized develop merge. Bounded locks released with commit; no authenticated browser/runtime rollout.

## 2026-10-05 — RESERVATION-ACTIONS-ENGLISH-1005 — PC-A — READY_FOR_REVIEW

Supplier-form save is the first action above download and print, with one save button and unchanged disabled/cancelled protections. The permission-scoped broker directory supplies an additive English name without contacts; both-language lookup preserves old Persian selections and new supplier form snapshots save the registered English name when available. Existing fallback supports records without English names. Twelve focused tests, affected lint and API build pass; production Web/TypeScript and full CI gate merge. No schema/migration/dependency/permission change; user authorizes develop merge, bounded locks released.

## 2026-10-05 — RESERVATION-LABEL-1005 — PC-A — READY_FOR_REVIEW

Corrected reservation module and navigation group to رزرواسیون, including page heading, related notification/Workbench/module-foundation titles and English category mapping. Updated existing navigation/settings assertions. Focused 45 tests, scoped ESLint, Web TypeScript and 55-route production generation pass. Routes, access control, APIs and stored data unchanged; no migration or dependency changes. User authorizes develop merge; bounded locks released.

## 2026-10-06 — SALES-DESTINATION-TOTAL-1006 — PC-A — READY_FOR_REVIEW

Sales contract list displays destination only instead of origin-arrow-destination and adds canonical total beside outstanding. Each currency renders separately with existing exact decimal-string formatting; payment/settlement calculations, filters, export and access remain unchanged. All Sales326 tests pass (one existing skip), including exact large totals, overpaid balances and unknown destination/amounts. Web lint/typecheck/production build and exact-head CI gate authorized develop merge. No API/schema/migration/dependency/database/runtime change or authenticated browser QA; bounded locks release with candidate commit.

## 2026-10-05 — VOUCHER-SEARCHABLE-LEADER-1005 — PC-A — READY_FOR_REVIEW

Voucher broker and same-broker leader use searchable dropdowns. Leader selection automatically fills and saves authorized canonical Board/name/contact through existing CAS; failed saves retain retry. Reservations accepts the directory's existing 300-character Board without truncation and normalizes absent phones. The bottom voucher action, document/editor and server confirmation/issue require an actual sent supplier form, preserving historical issued vouchers and finance/insurance/branch gates. Web184 and API157 tests pass (two Web and six opt-in API skips), both apps' lint/typecheck/build and 55-route Web generation pass. No schema/migration/dependency/operational database/runtime change or authenticated browser QA. Exact-head CI gates authorized develop merge; bounded locks released with candidate commit.

## 2026-10-05 — TICKET-CATALOG-SALE-DEFAULT-1005 — PC-A — READY_FOR_REVIEW

New ticket-only contracts use the public Ticket Catalog fare for readonly day sale and an initially equal editable agreement. One-way/combined round-trip seat-tier quotes remain exact; explicit negotiated totals survive seated passenger changes and restored drafts. Mixed/package pricing, unpriced/manual entry and persisted contract editing are unchanged. Payload pricing and catalog quote metadata remain separate. Sales323 tests (one existing skip), Web lint/TypeScript and 55-page production build pass. Prior exact-head CI gates pass; latest integrated-head CI gates owner-authorized develop merge. Concurrent work retained; bounded locks released with PR662 candidate. No authenticated browser QA, API/schema/migration/dependency/runtime change.

## 2026-10-04 — FINANCE-WORKFLOW-EXPORTS-1004 — PC-A — READY_FOR_REVIEW

Finance operational case workflow, approved HR salary entry table/public bridge, branch manager deadline reminders, server filters/paging/private views and authorized genuine XLSX/server PDF/recorded-transaction receipts are implemented. Multi-stage approval remains deferred by owner. Additive migration only; permission catalog adds finance.export and finance.request.manage without role grants. Existing source authority and legacy payments are unchanged; no operational database/runtime/deploy is modified. Full API2008, six real fully migrated PostgreSQL cases, integrated Web Finance/HR155, real Chrome PDF rasterized Persian layout QA and affected lint/type checks passed. Concurrent develop at6f06c4d8 was integrated with its Finance ticket-payment/delivery and B2B changes preserved. Final integrated production build/CI remain gates; bounded locks release with candidate commit. See docs/tasks/FINANCE-WORKFLOW-EXPORTS-1004.md for rollout, compatibility and honest operational limits.
## 2026-10-04 — SALES-EXACT-TRIP-FLOW-1004 — PC-A — READY_FOR_REVIEW

New Sales contracts select exact outbound/return Tehran days in the route/passenger step. Public paginated Ticket Catalog availability marks eligible dates; reverse-route return dates respect arrival and Min/Max, and the next step filters to the exact selected days. Floating flights retain explicit manual dates. Round-trip agreed/day-sale totals appear once while both service identities and exact currency sums remain in the payload. Passenger occupancy prompts are removed; aggregate room counts, guest selection and authoritative capacity validation remain. Pricing uses a compact responsive two-column layout. Sales/DatePicker 320 tests pass (one existing skip; longer Windows test timeout), focused 17 tests, scoped lint, Web typecheck and 55-route production build pass; exact-head CI gates develop merge. No API/schema/migration/dependency/runtime change or authenticated browser QA. Bounded locks release with commit.
## 2026-10-04 — CABIN-FILTER-ENGLISH-1004 — PC-B — READY_FOR_REVIEW

Only the Cabin filter choices now display `Economy`, `Premium Economy`, `Business` and `First Class`. The canonical enum values, original query slot, existing filter descriptor title, Persian form/table/KPI labels, form choices, other filters and backend behavior remain unchanged. Focused 78 and all 607 Master Data Web tests, Contracts build, scoped lint/format, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA; bounded locks release with commit and lead owns review/push/develop merge.

## 2026-10-04 — CABIN-CREATE-CHECK-1004 — PC-B — READY_FOR_REVIEW

Cabin Class creation failed before persistence because `cabinType`, already required by the visible form and supported by the Prisma enum/repository mapper, was missing from the API resource allowlist. The bounded repair accepts that canonical field while preserving enum validation, booking-code uniqueness, permissions and legacy behavior. Exact regressions cover the visible create payload without `englishName`, generated internal name, explicit enum normalization and projected response. Focused API 35 and Web 19 tests, full Master Data API 502 and Web 606 tests, scoped lint/format, API/Web typechecks and production builds, and the 55-route Web build pass. No schema/migration/runtime/database/API endpoint change or authenticated browser QA; PostgreSQL persistence was not rerun locally and repository persistence is covered by the existing synthetic harness. Bounded locks release with commit; lead owns review/push/develop merge.

## 2026-10-04 — FINANCE-INBOX-RELIABILITY-1004 — PC-A — READY_FOR_REVIEW

Finance ticket payments now accept an additive operation UUID and observed payment version, serialize operation/request races, validate replay payload/actor/branch, and replay full settlements even after Procurement closes the pending envelope. Finance Web freezes uncertain retries and separates successful payment from failed receipt upload, offering receipt-only retry against the committed payment. HR public pagination is complete/validated and referral response uses HR's existing permission-aware/idempotent public endpoint. Procurement invoice/return actions are connected; Finance/source versions are separate, revised unpaid correction sources may be re-reviewed and stale-source payments are rejected. Tehran whole-day filters, actionable-payment KPIs, per-line Reservations history and an explicit queue-versus-transaction-history distinction are delivered. No amount approval ceiling is introduced per owner decision; overpayment protection remains.

Validation: full API 1961 tests, final focused Finance/HR regressions, Finance Web 37 tests, two real concurrent-payment PostgreSQL tests rerun against final payment code on a random fully migrated database, affected typechecks/lint and a 55-route production build passed. Latest develop has no overlapping Finance code changes; integration and Linux CI gate merge. Full Windows Web testing reproduces two unchanged Master Data raw-source CRLF/LF assertions on the base worktree; those other-owner files were not modified. No operational database, schema/migration/dependency, live runtime or authenticated browser QA. See docs/tasks/FINANCE-INBOX-RELIABILITY-1004.md for compatibility and remaining product scope.


## 2026-10-04 — FINANCE-DELIVERY-TICK-1004 — PC-A — READY_FOR_REVIEW

The concurrent customer-document delivery option in receipt approval now needs only its checkbox. The existing AFTER_RECEIPT command supplies an automatic reason; the extra basis, manual Audit reason and manager-exception fields are removed from this option. Backend audit, permissions, receipt validation and the separate contract delivery controls remain intact. Finance Web 37 tests and all eight exact-source-head CI jobs passed, including lint/typechecks and full production builds. No API/schema/migration/dependency/database/runtime changes or authenticated browser QA. User authorizes develop merge after CI; bounded locks release with commit.

## 2026-10-04 — ACCOMMODATION-MEAL-SERVICE-CODE-1004 — PC-B — READY_FOR_REVIEW

The Accommodation Meal/Service table now labels its existing canonical `record.code` column «کد سرویس». The shared first cell remains the sole code cell; no duplicate column or new data field was added, and other Accommodation tables are unchanged. Focused 10 and all 602 Master Data Web tests, scoped Prettier/ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA or API/schema/form/export/dependency/database change. Bounded locks release with commit.

## 2026-10-04 — INSURER-BROKER-HIDE-ORGANIZATIONS-1004 — PC-B — READY_FOR_REVIEW

Insurer and Broker create/edit forms no longer expose Organization. New insurers persist independently; the nullable insurer Organization FK retains uniqueness and restrictive legacy references, and v1 API clients may still provide a validated Organization. Broker primary contact is shown only when editing an existing organization-linked record; its hidden Organization scope is retained locally but omitted from PATCH, preserving the stored link. A disposable PostgreSQL 16 database verified the migration, multiple NULL rows, legacy PATCH/CAS preservation, uniqueness and FK/restrict behavior. Focused Database 1, API 14 and Web 22 tests, full Master Data API 491 and Web 601 tests, scoped ESLint, Prisma format/validate/generate, all affected typechecks/builds and the 55-route Web build pass. Database Designer schema analysis passed; its migration generator failed on its own Column serialization bug and is not treated as migration evidence. No authenticated browser, live runtime or operational DB was changed. Deployment order is migration, API, Web; rollback is guarded and cannot delete independent insurer rows. Bounded locks release with commit.

## 2026-10-04 — SALES-TICKET-SEARCH-SPEED-1004 — PC-A — READY_FOR_REVIEW

Flight lookup now starts when route and future travel range are ready in the first contract step. The next step reuses the exact in-flight/recent first-page request for up to10seconds rather than starting the same lookup again. Form-local abort signals prevent obsolete responses; mismatched route/date/page/cabin/return queries fetch separately, and failed speculative searches retry on entry. No persistent/shared cache or API/schema/dependency change; authoritative inventory and contract validation remain unchanged. Sales284 tests and final10 focused tests pass; lint/typecheck/build gate delivery and local activation.

## 2026-10-04 — SALES-RANGE-AIRLINE-1004 — PC-A — READY_FOR_REVIEW

The required flight date range is now a prominent start/end control in the first route/passenger step. Flight continuation requires the confirmed future range; date changes still invalidate catalog selections and stale fares. Both floating flight legs select active existing airlines through the public paginated MasterData API with five normalized substring suggestions; the selected name remains the contract snapshot. Sales279 tests and final eight focused tests pass; lint/typecheck and55-route production build gate delivery. No API/schema/dependency/database/runtime change or authenticated browser QA. User authorizes develop merge after CI; scoped locks release at commit.

## 2026-10-04 — INSURANCE-PLAN-TOGGLE-OPERATIONS-1004 — PC-B — READY_FOR_REVIEW

The insurer nested-plan expand/collapse button moved from the Persian-name cell into the centered Operations action group. The insurer name remains the View trigger; native keyboard behavior, accessible name, `aria-expanded`, corrected `aria-controls`, toggle state and nested-plan loading/CRUD/permission behavior are preserved. Focused 9 and all 598 Master Data tests, scoped ESLint/Prettier, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA or API/schema/dependency/database/runtime change; bounded locks release with commit.

## 2026-10-04 — MASTER-DATA-XLSX-DOWNLOAD-1004 — PC-B — READY_FOR_REVIEW

Master Data Excel downloads now reject empty, wrong-MIME and non-ZIP HTTP 200 responses instead of saving them with an `.xlsx` extension. All nine list workspaces use one safe browser-download helper that keeps the Blob URL alive for a bounded 60 seconds and always removes its temporary anchor. Independent openpyxl validation opened populated and header-only generated workbooks with exact Persian headers and values. Focused Web 28, focused API 38 and all 596 Master Data Web tests, scoped ESLint/Prettier, Web typecheck and the 55-route production build pass. The former immediate URL revocation is a verified weakness, but no user-provided corrupt file was available to claim an exact reproduction. No authenticated browser/runtime, real-data, API/schema/contract/dependency or database change; bounded locks release with commit.

## 2026-10-04 — RESERVATIONS-HEADER-SEARCH-1004 — PC-A — READY_FOR_REVIEW

Reservations now displays `رزروسیون` in Persian navigation groups/items, breadcrumbs/search, module/workbench cards, change notifications and the page heading. English navigation uses `Reservations`. The global-search trigger and its desktop header container are bounded to 16rem; the visible Ctrl+K badge is removed while Ctrl/Cmd+K and the search dialog remain functional. 98 existing focused tests, scoped lint, Web typecheck and the 55-route production build pass. No route/API/permission/schema/dependency/database changes or authenticated browser/local runtime rollout. Bounded central UI locks release with commit; user authorizes develop merge after CI.

## BROKER-LEADERS-BOARD-1004 — 2026-10-04 — PC-A

Bounded owner-authorized Master Data/Reservations implementation: exact new Broker identity/phone/airport Board form, country-scoped multi-city selection and multiple tour leaders. Atomic aggregate writes, encrypted contact envelopes, omitted-phone preservation, child version/membership checks and deactivate-only removals retain existing data. Voucher selection automatically fills Board/name/full phone through the existing audited owner service and rejects stale responses after broker changes.

Local Master Data API 496 tests and Master Data Web/voucher 604 tests passed; Prisma format/validate/generate and database/contracts builds passed. API/Web production builds (55 Web routes), refreshed scoped lint/typechecks and final focused API 111 pass; latest develop integration and full CI remain gates. Local database connection unavailable, so no operational migration/runtime rollout. Apply the additive broker migration before API rollout. Permanent PC-B ownership retained; owner explicitly authorized this PC-A slice. Handoff: docs/tasks/BROKER-LEADERS-BOARD-1004.md.

## 2026-10-04 — SALES-RANGE-FLOATING-1004 — PC-A — READY_FOR_REVIEW

New contract flight details require confirming both future range endpoints after passenger counts; company ticket searches and continuing the flight step are gated accordingly. Past days are white and disabled in both calendars using Tehran midnight, and apply rejects a past start even when its end is future. Floating flight cancellation uses current state, removes only the selected leg and its stale fare, and exposes a clear company-inventory action; editing an existing manual flight preserves its fare. Web production build (55 routes), typecheck and 277 Sales tests (one pre-existing skip) and scoped lint pass. No API/schema/dependency/database/runtime change or authenticated browser QA. User authorizes develop merge after checks; scoped locks release with delivery.


## 2026-10-04 — CABIN-KPI-PERSIAN-1004 — PC-B — READY_FOR_REVIEW

Only the Cabin Classes KPI label changed from `Cabinها` to `انواع کابین`. Metric computation and canonical English cabin types remain unchanged across the form, dropdown, table, View, API and stored values. Focused 23 and all 583 Master Data tests, scoped ESLint/Prettier, Web typecheck and the production Web build pass. No authenticated browser/runtime QA; bounded locks release with commit.

## 2026-10-04 — SUPPLIER-BROKER-FOURTH-KPI-1004 — PC-B — READY_FOR_REVIEW

Suppliers now has a fourth global `دارای خدمات` KPI based on nonblank canonical service codes, while Brokers replaces the inactive-profile KPI with global `دارای تماس اصلی` based on the canonical active primary-contact projection. Complete unfiltered pagination rejects malformed, incomplete, changing or duplicate results; stale requests are ignored, and a fourth-KPI failure no longer clears the existing three summary cards. Focused 16 and all 582 Master Data tests, scoped ESLint/Prettier, Web typecheck and the 55-route production build pass after refreshing the existing contracts build output. Authenticated browser/runtime QA was not performed. No API/schema/permission/dependency/database/runtime change; bounded locks release with commit.

## 2026-10-04 — VISA-REQUIRED-DOCUMENTS-1004 — PC-B — READY_FOR_REVIEW

Visa create/edit now manages an optional names-only list of required documents with accessible add/remove controls and no file upload. The API trims, validates and stably deduplicates at most 50 names of 160 characters; PATCH omission preserves and an empty list clears. Public Master Data attributes expose the array as a JSON string compatible with the existing scalar attributes contract. Legacy guidance UUID data remains stored and exportable, but the new form does not submit it. A fresh disposable PostgreSQL 17 database applied all 115 migrations and verified empty defaults, persistence, retained guidance and the database count constraint. Focused API 48 and Web 33 tests, full Master Data API 488 and Web 583 tests, scoped lint, Prisma validation/generation, affected typechecks/builds and the 55-route Web build pass. No operational database/runtime or authenticated browser QA; bounded locks release with commit.

## 2026-10-03 — B2B-PHONE-VERIFICATION-1003 — PC-B — READY_FOR_REVIEW

Cooperation registration now has an optional mobile verification stage before contract/credit. Entered phones require a development-only code and a server-bound, expiring single-use grant before contact creation through the public MasterData service. Actor/session/branch/draft/role/phone/organization checks, resend and attempt limits, bounded memory capacity, no-store responses and fail-closed production gates protect the dedicated wizard path. Blank email, stale requests and expired grants have regressions. API focused tests (16), full Organizations suite (138), B2B contract tests (3), scoped lint, contracts build/typecheck, API/Web full typechecks and production builds pass; Web emits 55 routes. Local Prisma artifacts were regenerated without schema/migration or DB changes. Frozen contract v1.1 and scope: docs/tasks/B2B-PHONE-VERIFICATION-1003.md. No authenticated browser QA, operational data changes or shared-runtime rollout. Independent review accepted candidate 98a9c908 with no open blockers; OTP-R3-01/R3-02/N01 resolved. PR #587 targets develop; concurrent develop documentation entries are preserved during synchronization and refreshed final-candidate review gates handoff. SMS.IR and durable atomic storage remain required before production activation; this development simulation is not KYC or proof of possession. No persistent verified claim is added to other contact paths.

## 2026-10-03 — BUS-INLINE-FACILITIES-1003 — PC-B — READY_FOR_REVIEW

Bus Types create/edit now exposes the same always-visible canonical Add Facility action as Train Types. It reuses the existing Facilities form and public API; returned IDs append/deduplicate in the multi-reference value while preserving the parent draft. View, locked and saving guards plus Train/Hotel behavior remain unchanged. Focused 8 and all 572 Master Data tests, scoped ESLint/Prettier, Web typecheck and the 55-route production build pass. Coverage is SSR plus pure state-helper/reference-contract assertions; mounted/authenticated browser QA was not performed. No API/schema/database/dependency/permission/runtime change; bounded locks release with commit.

## 2026-10-03 — BUS-HIDE-EXTRA-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

Bus Companies now renders code, company and country from its resource-specific column model, plus the renderer's independent authenticated logo, status and operations columns. Logo Reference, Integration Connection and bus-type count are hidden only from this table, and Version / Audit remains absent; forms, View, export, backend data and all other resources remain unchanged. Focused 16 and all 570 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA; bounded locks release with commit.

## 2026-10-03 — CABIN-TYPE-SELECT-1003 — PC-B — READY_FOR_REVIEW

Cabin Classes now uses the existing canonical `cabinType` selector labeled «نوع کلاس», with Economy, Premium Economy, Business and First Class. New forms default to Economy and edits hydrate the stored enum; create/edit payloads omit legacy `englishName`, preserving existing stored data. Table links, View details, identity/action titles and completion checks use the selected enum. Existing API generation of required internal `name` from bookingCode remains unchanged. Focused 49 and all 539 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA; no API/schema/export/backend change; bounded locks release with commit.

## 2026-10-03 — CABIN-HIDE-EXTRA-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

Cabin Classes now renders code, English title and booking code from its resource-specific column model, plus the renderer's independent authenticated logo, status and operations columns. Display order and Ticket Catalog usage are hidden only from this table, and Version / Audit remains absent; forms, View, export, backend data and all other resources remain unchanged. Focused 18 and all 538 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA; bounded locks release with commit.

## 2026-10-03 — PASSPORT-NAME-FIELD-ORDER-1003 — PC-A — READY_FOR_REVIEW

International Sales passenger entry now places English passport first/last names as the second/third columns after the passenger role, before national ID. Customers/default domestic column order and validation/persistence remain unchanged. 11 focused tests, scoped ESLint, Web typecheck and the 55-route production build pass; no authenticated browser/runtime QA or API/schema/dependency change. Bounded locks released; user authorizes develop merge after CI.

## 2026-10-03 — AIRCRAFT-HIDE-EXTRA-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

Aircraft Types now renders code, manufacturer/model and English title from its resource-specific column model, plus the renderer's independent authenticated logo, status and operations columns. Body type, capacity and display order are hidden only from this table; forms, View, export, backend data and all other resources remain unchanged. Focused 18 and all 538 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA; bounded locks release with commit.

## 2026-10-03 — VOUCHER-SUPPLIER-ZERO-LEADER-PICKER-1003 — PC-A — READY_FOR_REVIEW

Voucher preview and PDF now show `SUPPLIER` as `0` and omit the lower reservation-recipient name. Before issuance, the voucher action has a tour leader selector above preview, scoped to the chosen broker and loading the full phone from Master Data. Reservation form supplier remains unchanged. 20 focused tests, scoped lint, Web typecheck and the 55-route production build pass; no authenticated runtime/browser QA or database change. PR targets develop.

## 2026-10-03 — MARKETING-SETTINGS-SYSTEM-1003 — PC-B — READY_FOR_REVIEW

Marketing Settings now lives under System Management → Marketing. The Marketing hub no longer offers Settings, and `/marketing?section=settings` redirects to `/system?module=marketing`. The six original channel/site/role/alert/general/log views retain their interactions and detail dialogs, while existing persisted Marketing settings remain in place. 39 focused tests, scoped lint, Web typecheck and a 55-route webpack production build pass. Default Turbopack is blocked only by the reused dependency junction. No API, migration, permissions, dependency, operational data or local runtime change; bounded locks are released. See `docs/tasks/MARKETING-SETTINGS-SYSTEM-1003.md`.

## 2026-10-03 — INSURANCE-NESTED-PLANS-1003 — PC-B — READY_FOR_REVIEW

Insurance Plans are now nested immediately beneath expandable Insurer rows while Coverage remains a top-level tab. Child rows retain logo, coverage, status and View/Edit/Delete actions; the existing plan form locks and force-binds the parent insurer. Generation guards reject stale child responses, and successful CRUD refreshes both the child page and parent summary without clearing the expanded insurer identity. Focused 26 and all 536 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. Tests cover async helper/state boundaries and SSR/source structure; authenticated browser/runtime QA was not performed. No API/schema/organization-model change; bounded locks release with commit.

## 2026-10-03 — VISA-HIDE-VALIDITY-MODE-1003 — PC-B — READY_FOR_REVIEW

Visa Services create/edit no longer renders the reference-validity-mode selector. New mutations keep the canonical `DAYS` mode; edits preserve supported stored modes by using them only for days-field behavior and omitting mode from PATCH. `DAYS` keeps the optional validated day field, while legacy `PASSPORT_EXPIRY` keeps it hidden. View/table/backend remain unchanged and Excel retains `referenceValidityMode` immediately before `referenceValidityDays`. Focused 32 and all 534 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime or database QA was performed; bounded locks release with commit.

## 2026-10-03 — SALES-CONTRACT-COLUMNS-NUMBERING-1003 — PC-A

Sales list adds customer telephone, origin/destination route and original registration date. Optional additive summary fields use public Master Data/Customers services with existing sensitive-contact permission, audit and branch rules; encrypted buyer snapshots take precedence. New contract numbers use a separate PostgreSQL non-cycling sequence starting 120123, preserving old numbers. All 91 Sales API and 10 workspace tests pass; 114 migrations and real concurrency/import/exhaustion regressions pass on disposable PostgreSQL 18. See `docs/tasks/SALES-CONTRACT-COLUMNS-NUMBERING-1003.md` for rollout and compatibility. Final quality/build and PR results are recorded in the work item.

## 2026-10-03 — TRANSFER-HIDE-MIN-CAPACITY-1003 — PC-B — READY_FOR_REVIEW

Transfer Type create/edit no longer renders the minimum suggested capacity control. The edit mutation omits that legacy attribute, allowing the API's existing partial-update merge to retain the stored value; View/table/backend remain unchanged and Excel still exports `suggestedCapacityMin` immediately after `suggestedCapacity`. Focused form/model/export regression (31), all 533 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime or database QA was performed; bounded locks release with commit.

## 2026-10-03 — MASTER-DATA-TIGHT-SEARCH-FILTERS-1003 — PC-B — READY_FOR_REVIEW

All dedicated English-name filter controls are removed across Master Data while English fields in forms, View, stored data and general search remain unchanged. The shared projection drops stale hidden English values from list and Excel requests and preserves each remaining filter's original backend slot; both Sales References tabs now use this same path. The module-local filter layout is compact and responsive with readable date ranges and compact desktop actions. Focused 70 and all 536 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed; bounded locks release with commit.

## 2026-10-03 — MASTER-DATA-CENTER-OPERATIONS-1003 — PC-B — READY_FOR_REVIEW

Every actual Master Data Operations table header, cell and immediate action group is now centered with renderer-local utilities. Coverage includes Accommodation, three Finance tables, Geography, Insurance, the generic live fallback, Suppliers/Brokers, Transportation, Travel Services and nested Bank Branches; the already-centered Sales References table is unchanged. Button order, callbacks, permission guards, accessible labels, focus behavior, RTL and all non-Operations cells remain intact. AST regression covers 20 structural/behavior cases; all 487 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. Local contracts output was refreshed from unchanged tracked source after the initial typecheck exposed a stale dist. No authenticated browser/runtime or database QA was performed; bounded locks release with commit.

## 2026-10-03 — TRAVEL-SERVICES-EXCEL-EXPORT-1003 — PC-B — READY_FOR_REVIEW

Excel download for Leaders, Tour Types, Transfer Types and Visa Services now submits each canonical column once. Leader exports intentionally omit the unavailable raw phone input fields rather than exposing decrypted data or expanding the API with masked fields. The existing selected resource, effective filters, permission boundary and workbook contract remain unchanged. Focused regression (8), all 467 Master Data Web tests, scoped ESLint, Web typecheck and the 55-route production build pass. Safe in-memory diagnostics generated and unzipped all four workbooks, confirming the exact ordered header labels and every sample field value across 11/8/11/12 aligned header/data cells. No authenticated browser/runtime or database QA was performed; bounded locks release with commit.

## 2026-10-03 — FLIGHT-MULTIPLE-CABINS-1003 — PC-A — READY_FOR_REVIEW

Weekly and advanced flight creation now accept multiple cabin classes with their own capacities, for example 20 Economy seats and 5 Business seats, and show the combined total. Each class publishes an independent existing inventory/offer; duplicates and invalid capacities fail before publication, and recurring/shared-return flights and retries preserve per-cabin identity. Sales ticket pricing groups the same flight's cabins below each other, labels the class and its total/remaining seats, and keeps independent price/tier/commission editors. 199 tests, full/scoped Web lint, typecheck and the 55-route Webpack production build pass; GitHub's normal production build also passes. No migration, shared API, dependency, permission, operational-data or primary-runtime change. PR #571 targets develop; final CI gates owner-authorized merge. Scoped locks release with the handoff commit. See docs/tasks/FLIGHT-MULTIPLE-CABINS-1003.md.

## 2026-10-03 — LEADER-REPLACE-DOCS-KPI-1003 — PC-B — READY_FOR_REVIEW

The Leader fourth KPI is now global `لیدرهای چندزبانه`, counting each leader once only when at least two distinct nonblank trimmed case-normalized languages exist. The existing global query now selects languages beside destinations without an extra query; zero remains zero and old/missing/loading/error summary values render `—`. The optional additive contract preserves `incompleteDocuments: null`. Focused API/Web tests (8/6), full Master Data API/Web suites (478/465), scoped lint, contracts/database builds, API/Web typechecks and API/Web production builds pass. Prisma Client was refreshed generate-only with a process-local dummy URL and no DB contact or tracked output. No authenticated runtime QA was performed; locks release with commit.

## 2026-10-03 — LEADER-HIDE-DOCUMENTS-1003 — PC-B — READY_FOR_REVIEW

The Leader list now omits only the visible Documents header and its placeholder cell, leaving nine aligned columns. Visa guide documents and all Leader form, View, export, API, database and document behavior remain unchanged. Focused regression (5), all 464 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime or database QA was performed, and bounded locks release with the scoped commit.

## 2026-10-03 — SALES-REFERENCE-EXCEL-EXPORT-1003 — PC-B — READY_FOR_REVIEW

Excel download for both Acquaintance Methods and Sales Channels now submits the exact unique canonical columns `code`, `name`, `englishName`, `description`, `displayOrder`, `status` and `updatedAt`. The existing resource and effective filter payload, export permission, API validation and workbook contract remain unchanged. A safe in-memory diagnostic built and unzipped both resource workbooks, confirming seven header cells, seven populated data cells and the expected sample values. Focused regression (10), all 464 Master Data Web tests, the API XLSX fixture (2), scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime or database QA was performed, and bounded locks release with the scoped commit.

## 2026-10-03 — SALES-REFERENCE-CENTER-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

The shared Sales References table now centers the Code header/value and Operations header/cell/action group on both Acquaintance Methods and Sales Channels. Code keeps its LTR monospaced semantics, action order and callbacks remain View, Edit and Delete, and all other columns retain start alignment. Focused regression (9), all 463 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-03 — SALES-REFERENCE-REPLACE-REVIEW-KPI-1003 — PC-B — READY_FOR_REVIEW

The fourth KPI on both Acquaintance Methods and Sales Channels is now `دارای عنوان انگلیسی`, backed by the existing unfiltered global list and an explicit `در کل اطلاعات پایه` hint. Only nonblank string English titles count; duplicate titles on separate records count separately. Loading/error render `—`, valid empty renders zero, and stale resources, malformed/incomplete pagination or duplicate record IDs cannot publish a misleading total. The first three cards, filters, forms, profiles, API and backend remain unchanged. Focused regression (8), all 462 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-03 — MASTER-DATA-HIDE-AUDIT-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

Visible Last Change/Audit table columns were removed across all current Master Data renderers: Hotels, Hotel Chains, Countries, Regions, Insurers, Airlines, Cabin Classes, Rail Companies, Bus Companies and the generic fallback. Combined `Version / Audit` columns were removed as a whole; independent record/template Version columns remain. Finance Audit operations/timelines, transport profile audit, View/form timestamps, sorting, exports, persistence, optimistic concurrency and backend audit records are unchanged. Focused regressions (42), all 461 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-01 — TRAVEL-HIDE-USAGE-COLUMNS-1001 — PC-B — READY_FOR_REVIEW

The Tour Types and Transfer Types lists no longer display their usage columns. Leaders and Visa Services were already without that column and remain unchanged; AST regressions verify exact headers, matching row-cell counts and the retained prior Tour Types last-change removal across all four tables. Tour Type View usage, model metadata, forms, exports, API and backend behavior remain unchanged. Focused regression (5), all 456 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-01 — TOUR-TYPE-HIDE-LAST-CHANGE-1001 — PC-B — READY_FOR_REVIEW

Only the visible «آخرین تغییر» header and matching value cell were removed from the Tour Types list. Its remaining nine headers and row cells stay aligned. The Tour Type form/View still exposes last-change metadata, Excel export still includes `updatedAt`, and the API, backend, audit behavior and other travel-service tables remain unchanged. Focused regression (5), all 456 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-01 — SALES-REFERENCE-PROFILE-CLEANUP-1001 — PC-B — READY_FOR_REVIEW

The shared Acquaintance Methods and Sales Channels View profile no longer repeats version or Persian title in its detail section. The identity header still names the selected record, and English title, display order and description remain visible. Forms, internal version/CAS, API, export and backend behavior are unchanged. The shared view regression was narrowed only for these two resources; all other specialized profiles retain their visible-version assertion. Focused regressions (15), all 455 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-01 — SALES-REFERENCE-HIDE-METADATA-1001 — PC-B — READY_FOR_REVIEW

The shared Acquaintance Methods and Sales Channels table now omits the visible display-order, record-usage and last-change columns. Both resources render the same seven exact headers with seven aligned row cells. Display order remains in create/edit and profile views, and all query, export, persistence, API and backend behavior is unchanged. Focused regression (6), all 454 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-01 — ACQUAINTANCE-HIDE-ENGLISH-FILTER-1001 — PC-B — READY_FOR_REVIEW

Acquaintance Methods now exposes only its dedicated code filter; the English-name filter is absent and a stale hidden `columnFilter2` cannot reach list or Excel-export requests. Sales Channels retains both canonical filters, while general search, English-name form/profile fields and all API/schema/backend behavior remain unchanged. Focused regression (6), all 454 Master Data Web tests, scoped lint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA was performed, and bounded locks release with the scoped commit.

## 2026-10-01 — ACQUAINTANCE-HIDE-ORDER-COLUMN-1001 — PC-B — READY_FOR_REVIEW

The Acquaintance Methods table now omits only the visible display-order header and matching cell. The shared Sales Channels table retains that column, and an AST regression evaluates both resource shapes to verify aligned headers/rows while preserving the form/profile order field. Focused regression (5), scoped lint, all 453 Master Data tests, Web typecheck and 55-route production build pass; no authenticated browser/runtime QA was performed. No API, export, backend, schema, dependency, database or runtime change was made, and bounded locks release with the scoped commit. Final documentation-only verification update does not change product or build inputs.

## 2026-10-01 — BROKER-HIDE-PURCHASE-COLUMN-1001 — PC-B — READY_FOR_REVIEW

Only the visible «محدودیت خرید» header and matching placeholder cell were removed from the Brokers list. The remaining nine headers and row cells stay aligned; the Suppliers table and the purchase-restriction field in forms/profiles remain unchanged. Focused regression (6), all 452 Master Data Web tests, scoped lint, Web typecheck and the lead-owned 55-route production build pass. No authenticated browser/runtime QA was performed; no API, export, backend, schema, dependency, database or runtime change was made. Bounded implementation locks release with the scoped commit.

## 2026-10-01 — TRANSPORT-REPLACE-COMPLETION-KPIS-1001 — PC-B — READY_FOR_REVIEW

Six Transport «نیازمند تکمیل» cards now use the approved canonical global distinct metrics for airline origin countries, aircraft body types, rail-company countries, train categories, bus-company countries and bus service classes. The cards state their global scope; a valid empty summary renders zero, while loading/error, malformed pagination or a stalled page render unavailable. Late responses from a previous tab cannot overwrite the current summary. First-three KPIs and the Cabin review/Manifest publication cards remain unchanged. Focused KPI regressions (21), all 452 Master Data Web tests, scoped lint and Web typecheck pass. Final production build and authenticated browser QA remain lead-owned; no API, schema, contract, dependency, database or runtime change was made.

## 2026-10-01 — COMPOSITE-HIDE-CONTRACT-COLUMN-1001 — PC-B — READY_FOR_REVIEW

The composite-hotel member table no longer displays the contract-reference placeholder column. Its remaining four headers and row cells stay aligned, while usage condition, forms, profile behavior, API/export and backend data remain unchanged. Focused accommodation regression (9), all 434 Master Data Web tests, scoped lint and Web typecheck pass. Final production build remains lead-owned; no schema, dependency, database or runtime change was made.

## 2026-10-01 — HOTEL-PRICING-WHITE-TEXT-1001 — PC-B — READY_FOR_REVIEW

The accommodation header's `قیمت‌گذاری هتل‌ها` action now keeps an explicit white foreground in both themes and on hover. The override is local to that link; shared primary-button tokens and the neighboring all-sections outline action are unchanged. Focused action/visual regressions (19), all 433 Master Data Web tests, scoped lint and Web typecheck pass. Final production build remains lead-owned; no API, schema, dependency, data or runtime change was made.

## 2026-10-01 — HOTEL-EXCEL-TEMPLATE-1001 — PC-B — CHECK_BLOCKED

The Hotel Excel parser now accepts the supplied canonical formatted workbook, including namespace-prefixed OOXML, its exact title/guidance preamble, row-four headers and blank formatted rows. Physical row numbers remain 5/6/7, while formulas, hyperlinks, DTD/entities, external relationships and existing archive limits remain rejected regardless of namespace prefix. The external workbook itself stays outside Git and was read only; it produces three rows, no blocking issues and the existing explicit unsupported-field warnings. Existing reference resolution, commit, audit, permissions and idempotency are unchanged. Focused tests, all 476 Master Data API tests and scoped lint pass; final typecheck/build await regeneration of the stale Prisma client because this checkout has no `DATABASE_URL`. No schema, contract, dependency, database or runtime change was made.

## 2026-10-01 — HOTEL-REPLACE-COMPLETION-KPI-1001 — PC-B — READY_FOR_REVIEW

The Hotels KPI grid replaces only «نیازمند تکمیل» with «هتل‌های زنجیره‌ای», using the existing canonical global count of hotels whose chain reference is present. The card states its global scope explicitly; real zero renders as zero, while loading and invalid/missing runtime values render unavailable rather than a fabricated count. The remaining hotel KPIs and all other accommodation tabs are unchanged. Focused rendered-grid regressions, all 432 Master Data Web tests, scoped lint and Web typecheck pass. Final production build remains lead-owned; no API, schema, contract, dependency, database or runtime change was made.

## 2026-10-01 — SUPPLIER-INLINE-SERVICE-CREATE-1001 — PC-B — READY_FOR_REVIEW

The Supplier services selector now shows Add Service without requiring a search. It reuses the canonical travel-service form and validation, then appends the returned service code—not its ID—without replacing prior selections or the rest of the supplier draft. Broker and unrelated selector behavior remain unchanged; read-only and locked fields expose no creation action. Focused SSR/state-helper regressions, all 422 Master Data Web tests, scoped lint and Web typecheck pass. No browser/runtime, API, schema, contract, dependency or database change was made; final production build remains lead-owned.

## 2026-10-01 — HOTEL-INLINE-REFERENCE-CREATE-1001 — PC-B — READY_FOR_REVIEW

Hotel meal/service, room-type and facility selectors now expose a clear Add action without requiring a search first. Each action reuses the canonical source form and validation; room type remains name-only, meal/service retains required code/name/category, and facility retains its existing optional free-text category. A saved child is appended to the existing IDs without replacing the parent hotel draft, while cancel/failure and read-only/locked states remain safe. Focused SSR/state-helper regressions, all 418 Master Data Web tests, scoped lint and Web typecheck pass. The repository has no DOM interaction-test dependency, so callback behavior is covered through the production state helper and real SSR structure rather than claimed browser interaction; authenticated browser/runtime QA was not run. Final production build is delegated to lead verification.

## 2026-10-01 — HOTEL-HIDE-PROVIDER-COLUMN-1001 — PC-B — READY_FOR_REVIEW

Only the `HOTEL_PROVIDER` supplier column and matching row cell were removed from the Hotels table. The hotel profile/form, supplier relation, API/export and stored data remain unchanged. A focused structural regression verifies the exact header and visible row-cell alignment; all 414 Master Data Web tests, scoped lint and Web typecheck pass. No build was duplicated because final integration build belongs to the lead, and no runtime or authenticated browser QA was performed.

## 2026-10-01 — RESERVATION-PASSENGER-PURCHASE-1001 — PC-A — READY_FOR_REVIEW

Reservation purchase now shows the contract hotel and its assigned passengers directly, records a nightly hotel amount per passenger, calculates each stay total from the sent reservation-form dates, and sends only the server-recalculated aggregate to Finance. Hotel/transfer broker and currency choices are active searchable Master Data references. Contract transfers appear immediately below the hotel, default to its broker and can be changed independently. The additive nullable JSON passenger breakdown preserves legacy purchase rows. 11 focused tests, scoped lint, API/Web typechecks, Prisma validation and the full six-task production build with 55 Web routes pass. No dependency, permission, seed, operational-data or runtime change. Owner requested develop merge after CI.

## 2026-10-01 — RESERVATION-REFERENCE-EDIT-1001 — PC-A — READY_FOR_REVIEW

Reservation operational editing now selects active outbound/return airlines, hotels and brokers through searchable Master Data dropdowns; room details and remaining operational fields stay manual. Operational corrections can no longer amend or appear in Sales contracts, legacy correction metadata is ignored by the print projection, child rows use a clean کودک label, and selected edit tabs stay readable on hover. Manifest origin/destination country and country-scoped city filters also use the standard searchable Master Data dropdown with canonical IDs. 47 focused Web/API tests, scoped lint, both typechecks and the full production build with 55 Web routes pass. No schema, migration, shared-contract, dependency, operational-data or runtime change. Owner authorized develop merge after CI.

## 2026-10-01 — VOUCHER-DOWNLOAD-SUMMARY-1001 — PC-A — READY_FOR_REVIEW

Issued hotel vouchers now have a direct authenticated PDF download using saved voucher settings, supplier booking reference, selected passenger room types and the existing isolated renderer. Unissued/cancelled vouchers are rejected, and no-letterhead settings avoid logo retrieval. Booking Summary uses a separate bordered section, spacing and navy/teal header in preview and downloaded PDFs. 13 targeted tests, scoped lint, Web typecheck/build checked. No API contract, migration, dependency, operational data or runtime change. Owner requests develop merge after checks.

## 2026-10-01 — AIRPORT-TERMINAL-KPI-1001 — PC-B — READY_FOR_REVIEW

The airport workspace now renders a fourth KPI, `ترمینال‌های مرتبط`, scoped explicitly to the current visible page. It uses the existing projected `terminalCount` values and refuses to present a partial total when any row is missing a canonical nonnegative safe integer; empty pages remain a real zero. The original airport KPIs, filters, rows, status behavior and all other geography resources are unchanged. Pure calculation and real KPI-grid SSR regressions cover empty, multiple, missing, invalid, fractional, unsafe and overflow cases. No API, schema, migration, dependency, data or runtime changes; authenticated browser QA was not available.

## 2026-10-01 — CONTRACT-PRICE-COMPACT-1001 — PC-A — READY_FOR_REVIEW

Owner requested a smaller agreed-price presentation after reviewing PR522 locally. The title and currency-specific amounts now share a compact strip with table-sized numeric text, soft individual currency chips and safe wrapping; the tall heading and large rows are removed. Same shared preview/PDF renderer and exact amounts retained. 22 tests, scoped lint and synthetic A4 visual QA pass; no API/schema/dependency/data changes. Continued authorized merge/local correction follows full CI.

## 2026-10-01 — SUPPLIER-HIDE-PURCHASE-COLUMN-1001 — PC-B — READY_FOR_REVIEW

Only the «محدودیت خرید» column and matching placeholder cell were removed from the Suppliers list. The Brokers list still shows the column, the shared supplier/broker profile still shows its purchase-restriction detail, and forms, exports, actions, backend policy and stored data remain unchanged. A structural TSX regression validates exact header/row alignment for both tables; authenticated browser QA was not run and no runtime was changed.

## 2026-10-01 — TERMINAL-REPLACE-REVIEW-KPI-1001 — PC-B — READY_FOR_REVIEW

The terminal workspace replaces only the misleading «نیازمند بازبینی» KPI with «در حال تعمیرات», explicitly scoped to the current page. It counts only the existing projected boolean `isUnderMaintenance === true`; false, missing and malformed values do not contribute. The total, active and international terminal KPIs and every other geography resource remain unchanged. Pure helper and real KPI-grid SSR regressions cover empty, multiple and malformed flag cases. No API, schema, migration, dependency, data or runtime changes; authenticated browser QA was not run.

## 2026-10-01 — TERMINAL-REMOVE-AIRPORT-FILTER-1001 — PC-B — READY_FOR_REVIEW

The terminal list airport filter, its local state, scoped-query field and reset wiring are removed together, so no selected airport can remain as a hidden stale filter. Terminal-type and all shared filters remain. The airport FK, nested airport children, inline creation and race-safe standalone parent selection are unchanged. A focused source regression verifies the removed list-filter path and retained creation relation. No API, schema, migration, contract, dependency, data or runtime changes; authenticated browser QA was not run.

## 2026-10-01 — CONTRACT-AGREED-PRICE-DESIGN-1001 — PC-A — READY_FOR_REVIEW

The owner's screenshot confirmed the previous redesign was deployed but the horizontal agreed-total strip still did not satisfy the requested field layout. The shared Sales print renderer now labels the field قیمت توافق‌شده قرارداد above a white amount area, with separate clearly divided amount/currency rows. Preview and PDF use the same renderer; exact existing Decimal arithmetic and legacy balance fallback are retained. 22 focused tests and synthetic A4 PDF visual review pass. No API/schema/dependency/data changes; local correction follows develop merge and CI.

## 2026-10-01 — TIER-SAVE-BUTTON-1001 — PC-A — READY_FOR_REVIEW

An explicit tier-price save button now appears beside each enabled tier editor, for single and round-trip prices. It invokes the existing versioned save API with the current tiers; incomplete capacity schedules and in-flight saves disable it. Existing focused tests, scoped lint, typecheck and production build checked. No API/schema/migration/dependency/runtime change. Owner requests merge to develop after checks.

## 2026-10-01 — GREGORIAN-NAVIGATION-1001 — PC-A — READY_FOR_REVIEW

Gregorian calendar headers now place previous on the left and next on the right, independently of Persian/English labels or surrounding RTL form direction. Shared picker (including Sales), Ticket, Customers, flight ranges and Marketing calendars follow the same rule for month, year and year-grid navigation. Persian mode retains its existing direction. 34 targeted tests, scoped lint, Web typecheck and 55-route production build passed; full CI is required before the owner-authorized develop merge. No API, migration, dependency, operational data or local runtime change.

## 2026-09-30 — MASTER-DATA-VIEW-DESIGN-0930 — PC-B — READY_FOR_REVIEW

Read/view presentation redesign covers all Master Data profiles and view-capable forms. User follow-ups add inline country-child expansion and terminal-list Last Change column removal; audit/backend remain intact. Existing data, permissions and create/edit workflows remain unchanged. Global Worker Orchestrator bootstrap and configuration stay outside Rubi. No migration, dependency, database or local runtime changes.

Shared semantic RTL details, inline country children, country-scoped province creation and race-safe guarded terminal parent selection are implemented. All 381 Master Data tests, scoped lint, Web typecheck and the production build with 55 routes pass. Authenticated browser QA remains unverified because the connector failed before opening a browser surface; no operational data or runtime changed. Scoped locks release with the implementation commit owned by the lead.

## 2026-09-30 — MANIFEST-COUNTRY-ROUTE-0930 — PC-A — READY_FOR_REVIEW

Manifest search now has separate country/city origin and destination filters. Country changes reset their corresponding city selection; choices include both ends of known routes, so reverse searches remain available. Cities use real reference names and IDs and countries are resolved through existing public Master Data services, with no direct cross-module table reads. The selected path defines display direction: Antalya → Tehran appears outbound and Tehran → Antalya return, regardless of the original contract direction; export identities/data are unchanged. Old Iran Airtour/Antalya title and Sparta introduction removed. 24 Web and 32 API tests, scoped lint, contracts build and API/Web typecheck/production builds checked before PR. Optional v1 geography preserves legacy clients and unknown countries are not inferred. No migration/dependencies/operational data changes. Owner authorized develop merge after CI.

## 2026-09-30 — MASTER-DATA-COUNTRY-HIDE-VERSION-0930 — PC-B — READY_FOR_REVIEW

Countries no longer renders the Version column or matching cell. Record versions remain in the API and mutation concurrency controls; other geography tables are unchanged. 14 focused Web tests, scoped ESLint, Prettier and diff check pass. No migration, operational data or localhost runtime change. Branch `codex/pc-b-country-hide-version-0930` for review in develop.

## 2026-09-30 — CONTRACT-PDF-DOWNLOAD-0930 — PC-A — READY_FOR_REVIEW

Reservations contract preview now offers an authenticated PDF download with loading/error feedback instead of opening a browser tab. Saved workflow/contract changes refresh the mounted preview; both preview and downloaded PDF continue using the latest authorized Sales output and recorded operational amendments. The agreed-total area is a labeled, light bordered field with readable LTR digits and separate currency units/rows, preserving exact registered amounts. 26 output/amendment/PDF-route/preview tests and scoped lint passed; Web typecheck/build checked before PR. A real synthetic PDF was rendered and visually checked on A4, including two currencies. No migration/API/dependency or real contract-data changes. Primary unrelated PDF edits preserved; owner authorized develop merge.

## 2026-09-30 — MANIFEST-LOAD-SEARCH-0930 — PC-A — READY_FOR_REVIEW

Reservations manifests now search a date range and selectable contract routes before displaying separate outbound/return load tables and XLSX actions. Ticket Catalog public inventory supplies capacity, allocated sales, active holds and remaining seats; the selected template is shown. All latest received Reservation intakes participate without Finance approval, while branch/sensitive passenger permissions and assignments remain enforced. New-only does not fall back to all and return export history is independent of outbound. 39 focused API and 9 Web tests pass; scoped lint, strict types and production builds checked. Optional inventory fields and additive route-choice endpoint are v1-compatible; no migration, dependency, operational data or runtime changes. See [handoff](tasks/MANIFEST-LOAD-SEARCH-0930.md).

## 2026-09-30 — RESERVATION-MONTH-FILTER-0930 — PC-A — READY_FOR_REVIEW

Reservations inbox now defaults to one previous calendar month through today's Tehran date on contract creation date, and shows both bounds in the date controls. Explicit user ranges remain authoritative; clearing filters restores this default. The existing regression test covers the lower boundary, old/future exclusions and custom history selection. 19 focused tests and scoped lint passed; Web typecheck/build verified after refreshing stale contracts outputs. No API, migration, dependencies or operational data changes. Owner authorized develop merge and existing local3100 update after CI.

## 2026-09-30 — RESERVATION-CONTRACT-COLUMNS-0930 — PC-A — READY_FOR_REVIEW

Reservations inbox and Excel now use the requested 46-column order. Visa/flight action and confirmation checkboxes save server time and authenticated actor in existing immutable workflow revisions; correction and cancellation use real Sales contract operations. The Sales public projection supplies age counts and exact per-currency financial totals; costs use Reservations purchase history, and direct-ticket commissions use historical Ticket Catalog revisions. Missing historical tour-pricing links remain unavailable. 65 Web and 17 API tests, both typechecks and production builds passed; full API/Web lint passed. No migration, dependencies or operational-data change. Owner authorized merge to develop after checks. Details: [RESERVATION-CONTRACT-COLUMNS-0930](tasks/RESERVATION-CONTRACT-COLUMNS-0930.md).

## 2026-09-30 — ROUNDTRIP-SALE-CAPACITY-0930 — PC-A — READY_FOR_REVIEW

Round-trip ticket selection displays and enforces the lower remaining capacity of both legs. Requests above this limit clear both flight quotes. Existing row-locked server reservation rejects insufficient capacity before creating either allocation; regression tests cover outbound/return limits after allocations and active holds, rejection above the limit and acceptance exactly at it. 41 focused Web tests and 4 focused API tests pass. Scoped lint, Web/API typechecks and production builds pass after regenerating stale local contracts/Prisma outputs. No schema, migration, shared contract, dependency, operational data or local runtime changes. PR to develop for review; no automatic merge.

## 2026-09-29 — SIDEBAR-ALL-SECTIONS-VISIBLE-0929 — PC-B — READY_FOR_REVIEW

تمام گروه‌های مجاز منوی کناری از ابتدا باز می‌شوند تا لینک‌های رزرواسیون، مالی، سرمایه انسانی، اسناد و تنظیمات کنار فروش دیده شوند. کنترل باز و بسته‌کردن گروه‌ها و بررسی دسترسی هر مسیر بدون تغییر است. دو تست مرتبط، ESLint محدوده، typecheck و build تولیدی Web با ۵۵ مسیر موفق شدند. وب روی ۳۱۰۰ و API روی ۴۰۰۰ پس از راه‌اندازی مجدد پاسخ ۲۰۰ دادند. هیچ مجوز یا داده‌ای تغییر نکرد.

## 2026-09-30 — TICKET-SEAT-CAPACITY-FOLLOWUP-0930 — PC-A — READY_FOR_REVIEW

The seat-tier editor now caps each entered seat count by the remaining capacity and disables another tier when all seats are assigned. Round-trip pricing uses the lower capacity of the outbound and return tickets, with Ticket Catalog rejecting any tier schedule above that limit. Ten focused Web tests and ten API tests pass. Scoped lint, typechecks and production builds for both applications pass. No schema, migration, contract, dependency or operational-data changes.

## 2026-09-29 — DOCUMENTS-009-OVERVIEW-CONNECTIONS-REMOVAL-0929 — PC-B — READY_FOR_REVIEW

سکشن کامل کارت‌های «ارتباط اسناد با بخش‌های نورا» از نمای کلی Documents حذف شد؛ شاخص‌ها، تازه‌های آرشیو، کارهای من، منوی دسته‌ها و اتصال کنار فهرست یک دامنه حفظ شدند. کد و استایل بلااستفادهٔ مخصوص کارت‌ها هم پاک شد. ۹ تست Documents، lint موردی، Web typecheck و Production Build با ۵۵ مسیر موفق‌اند. بدون API، Migration، Permission، داده، Dependency یا runtime. Branch `codex/pc-b-documents-overview-connections-removal-0929` از `origin/develop@bb4209e0`؛ برای Review به develop می‌رود و Merge خودکار نمی‌شود.

## 2026-09-29 — ADMIN-SCREEN-VISIBILITY-0929 — PC-A — READY_FOR_REVIEW

Follow-up to the authorized merge/local release: active system administrators receive a derived, unassignable UI marker so all catalogued sections are visible, including pages without native operation grants. Stored markers and role titles cannot confer administrator authority. Native operation/branch guards remain authoritative. Focused API/Web/contracts tests: 13/9/4 passed; scoped lint, typechecks and contracts build checked before release. No schema/migration/dependency changes. Details: [ADMIN-SCREEN-VISIBILITY-0929](tasks/ADMIN-SCREEN-VISIBILITY-0929.md).

## 2026-09-29 — MANAGER-ACCESS-VISIBILITY-0929 — PC-A — READY_FOR_REVIEW

حساب Ramtin که نقش فعال سیستمی `administrator` دارد اکنون در مدیریت کاربران تمام مجوزهای native و همهٔ زیربخش‌های کاتالوگ را برای نقش «مدیر» می‌بیند و می‌تواند انتخاب کند؛ API هنگام ذخیره همین نقش را دوباره کنترل می‌کند. گزینه‌های قابل‌واگذاری کاربران عادی بدون تغییر و محدود به مجوزهای خودشان هستند. ۱۰ تست API و ۲۰ تست پیشنهاد Web، lint و typecheck دو برنامه، و build API/Web (۵۵ مسیر) موفق‌اند. بدون Migration، Dependency یا تغییر حساب/دادهٔ واقعی. PR #483 به develop باز است و CI/review در انتظار است؛ merge و انتشار محلی انجام نشده‌اند. جزئیات: [MANAGER-ACCESS-VISIBILITY-0929](tasks/MANAGER-ACCESS-VISIBILITY-0929.md).

## 2026-09-29 — MASTER-DATA-GEOGRAPHY-FINANCE-CLEANUP-0929 — PC-B — READY_FOR_REVIEW

گردش تأیید نرخ از ناوبری پنهان شد، اما API، داده‌های تاریخی/Audit و Maker/Checker حفظ شدند. کارت KPI و فیلترهای روش پرداخت حذف شدند، نه CRUD. جغرافیا اکنون درخت کشور ← شهر ← فرودگاه ← ترمینال دارد؛ چند شهر/فرودگاه/ترمینال پشتیبانی و فرودگاه/ترمینال اختیاری‌اند. `regionId` در Prisma از قبل nullable بود و الزام create در API کاهش یافت، بدون Migration یا تغییر قرارداد عمومی. Web/API lint و typecheck، API build و Web production build با ۵۳ مسیر موفق‌اند. تست‌های خودکار و گردش احرازشدهٔ مرورگر اجرا نشدند. شاخه `codex/pc-b-master-data-rate-geo-0929` روی PR باز #455 stack شده و برای Review/rebase نیازمند توجه به تعارض والد است؛ ادغام یا تغییر runtime انجام نشده.

## 2026-09-28 — MASTER-DATA-RECORD-ICON-ACTIONS-0928 — PC-B — READY_FOR_REVIEW

کنترل‌های عملیات رکورد در تمام workspaceهای اطلاعات پایه با الگوی فقط‌آیکون یکسان شدند؛ مشاهده و ویرایش outline و حذف قرمز. نام دسترس‌پذیر و تأیید حذف محفوظ است. ۳۶۴ تست Master Data، lint محدوده، typecheck و build تولیدی Web با ۵۳ مسیر موفق‌اند. این تغییر فقط Web و تست‌های مربوط را در بر می‌گیرد؛ بدون API، داده یا Migration.

# 2026-09-29 — MANAGER-ACCESS-VISIBILITY-0929 — PC-A — READY_FOR_REVIEW

پیگیری محدودیت دسترسی مدیر: حساب دارای نقش فعال سیستمی administrator باید همهٔ مجوزهای native و همهٔ زیربخش‌های کاتالوگ را برای تنظیم نقش «مدیر» ببیند و واگذار کند؛ سایر اپراتورها فقط دسترسی فعلی خود را واگذار می‌کنند. کار روی IAM و فرم مدیریت کاربران رزرو شده است. بدون تغییر کاربر واقعی یا شعب؛ آزمون و handoff پس از اصلاح ثبت می‌شود.

# 2026-09-29 — PERMISSION-VISIBILITY-SALES-SCOPE-0929 — PC-A — READY_FOR_REVIEW

Visibility requires native module permissions for legacy and managed accounts, alongside managed screen selection. Denied routes render no business content; Sales Excel/PDF/payment controls use explicit native permissions. Effective IAM permissions narrow sales experts to own contracts; the appended sales-manager title recommends branch-wide scope. Validation: full Web 1775 passed/3 skipped; IAM/Sales 136 passed across the broad suite and isolated HTTP startup recheck. Scoped lint, consumer typechecks and production builds verified; CI full tests/build/PostgreSQL gate passed on 4b94ff93. CI formatting correction is isolated to one test. Draft PR [#468](https://github.com/nirvanamahlou/Rubi/pull/468); the user explicitly approved develop integration and PR merge; both coordination entries are preserved. No migration, operational grant or runtime change. Details: [handoff](tasks/PERMISSION-VISIBILITY-SALES-SCOPE-0929.md).

# 2026-09-29 — SALES-TOUR-DEFINITION-0929 — PC-A — READY_FOR_REVIEW

تعریف تور از مدیریت بلیت جدا و به‌صورت آخرین گزینهٔ گروه فروش در `/sales/tours` قرار گرفت. فروش با مجوز محدود تور می‌تواند تعریف را بسازد/ویرایش کند و تور بدون نوبت را حذف کند؛ تور دارای نوبت به‌خاطر حفظ سوابق حذف نمی‌شود. ۳۰ تست API، ۵۲ تست Web، lint، typecheck و build هر دو بخش موفق‌اند. تست واقعی PostgreSQL محلی به‌دلیل نبود `TRAVEL_TEST_DATABASE_URL` غیرفعال بود. بدون Migration یا تغییر حساب‌های واقعی؛ PR [#464](https://github.com/nirvanamahlou/Rubi/pull/464)؛ پیاده‌سازی `ce100064` و ادغام develop `bfa4b4ff`. جزئیات: [SALES-TOUR-DEFINITION-0929](tasks/SALES-TOUR-DEFINITION-0929.md).

# 2026-09-29 — DROPDOWN-SUBSTRING-0929 — PC-A

Dropdown search always includes the displayed name plus aliases/codes and matches at any position before limiting to six results. Persian/English/code substring regressions passed; server Master Data already uses contains/insensitive. No migration or API changes. See [handoff](tasks/DROPDOWN-SUBSTRING-0929.md).

# 2026-09-29 — SEARCHABLE-DROPDOWNS-0929 — PC-A

Shared Web selection controls now search in the primary field, display six initial/matching results, preserve canonical form values and add subtle light/dark contrast. Master Data/Ticket/Marketing reference adapters retain scope and authorization. Browser synthetic interaction/form verification passed; no migration or operational data changes. See [handoff](tasks/SEARCHABLE-DROPDOWNS-0929.md).

# 2026-09-29 — TICKET-MANAGEMENT-QA-0929 — PC-A

Server-backed flight cards/counts and fresh-browser editing now match the managed list. Exact identity fixes duplicate-schedule actions; capacity reflects holds. Archive preserves fare/commission history. Synthetic lifecycle and HTTP QA pass; no migration or operational data changes. See [task handoff](tasks/TICKET-MANAGEMENT-QA-0929.md).

## 2026-09-29 — ROLE-ACCESS-PRESETS-0929 — PC-A — READY_FOR_REVIEW

User management recommends role-specific sections/actions with explicit confirm, apply-and-customize or keep-current choices. Role selection alone preserves current grants; pending proposals prevent accidental save. Native suggestions intersect actor grants/options; screen suggestions intersect visibility, unknown roles have no grants and branch scopes stay unchanged. Finance/Reservation staff and managers have distinct policies. 32 focused tests and strict Web typecheck pass; scoped lint, production build and CI checked before integration. No API/contract/schema/dependency or account mutation. Details: [ROLE-ACCESS-PRESETS-0929](tasks/ROLE-ACCESS-PRESETS-0929.md).

# 2026-09-29 — SALES-HOTEL-ENGLISH-OPTIONS-0929 — PC-A

Sales contracts now open the active hotel list for the selected city, show available English hotel names, and retain text search and destination/tour filters. Canonical hotel id and room-selection behavior are preserved. Four existing picker tests, scoped lint, Web production typecheck and the 54-route build pass. No API/database/data/runtime changes; authenticated browser interaction was not exercised. See [handoff](tasks/SALES-HOTEL-ENGLISH-OPTIONS-0929.md).

## 2026-09-29 — USER-ACCESS-UI-0929 — PC-A — READY_FOR_REVIEW

User management now uses checkbox-first access cards: parent selection reveals child visibility/action checkboxes; partial grants stay expanded and indeterminate. Responsive compact cards, distinct selected-user styling and sticky save control replace dropdowns and excessive whitespace. Existing grant setters and authorization remain intact. 15 focused Web tests, strict typecheck and scoped lint pass; production build checked before handoff. No schema/API/dependency or operational account edits.

## 2026-09-28 — USER-ACCESS-TREE-0928 — PC-A — COMPLETE

مدیریت کاربران زیر مدیریت سیستم اضافه شد: ایجاد حساب، عنوان نقش، وضعیت و شعب، دسترسی مستقل به بخش‌ها/زیربخش‌ها و مجوز عملیات، انتخاب همه و حالت انتخاب جزئی. نقش خصوصی هر کاربر از IAM موجود استفاده می‌کند؛ تغییر یک حساب روی حساب دیگر اثر ندارد. منو، جست‌وجو، مسیر مستقیم و تب‌های ثبت‌شده طبق پروفایل پنهان می‌شوند؛ کنترل اختصاصی HR، اطلاعات پایه، حسابداری، مارکتینگ، فروش/قیمت‌گذاری و میزکار متصل است. واگذاری بیش از دسترسی اپراتور و حذف آخرین مدیر فعال ممنوع است. نقش‌های قدیمی تا ذخیره صریح پروفایل سازگار می‌مانند. بدون Migration، Dependency، تغییر کاربر واقعی یا runtime. مالک، merge به develop را صریحاً مجاز کرده است. جزئیات بررسی‌ها و handoff: [USER-ACCESS-TREE-0928](tasks/USER-ACCESS-TREE-0928.md).

## 2026-09-28 — TICKET-PRICES-COMPACT-0928 — PC-A

Ticket pricing rows now place compact flight summaries, base price/currency/save controls and per-target commission cards side by side on desktop. Smaller screens wrap into readable rows; short copy labels retain full accessible names and bulk-copy semantics. Follow-up includes sale target removal via branch-scoped expectedVersion deactivation, retained price history, visible inline feedback and a focused commission refresh that removes stale drafts only for the copied target and branch. Actual PostgreSQL regression confirms company 4% copied from a lower pair reopens on all priced singles/pairs. No schema/migration/dependency change. Owner authorizes merge and updating the existing local runtime. Validation: 13 API unit tests, 5 isolated PostgreSQL tests, 8 Web tests, scoped lint, strict API/Web typechecks and production API/Web builds passed.

## 2026-09-28 — MANIFEST-BLUE-CENTER-0928 — PC-A

فقط قالب دیفالت هوایی، اتوبوس و قطار: رنگ هدر Blue Accent 1 Darker 25% (#2F5496)، متن سفید و تراز افقی/عمودی وسط برای همهٔ سلول‌ها. قالب‌های اختصاصی ارسالی کاربر عیناً حفظ شده‌اند. ۲۸ تست منیفست موفق؛ بدون تغییر داده، Migration، Dependency یا منطق مالی. قفل محدود آزاد است؛ کنترل‌های CI و rollout در سند واحد ثبت می‌شوند.

## 2026-09-28 — TICKET-CHANNEL-PRICES-0928 — PC-A — READY_FOR_REVIEW

Unified one-way/round-trip pricing list, combined origin/destination/trip/date/search filters and per-ticket target commission fields are implemented. Copy is atomic and applies only that target to priced future tickets/pairs of the same branch; exact Decimal net fares recalculate after base changes. Additive optional contracts preserve older clients and legacy absolute partner fares. All 100 migrations passed in a fresh isolated database. Validation: 21 API tests (including 4 real PostgreSQL regressions), 11 Web tests, scoped lint, API/Web strict typechecks and production builds (53 Web routes) passed. Populated rendering verifies the pair/single list, saved percentages and target net values. The browser preview could not attach, so authenticated interactive visual QA is not claimed. The owner-authorized develop merge follows integration of current Manifest/Finance changes. Operational data and running localhost remain unchanged. See [task handoff](tasks/TICKET-CHANNEL-PRICES-0928.md).

# 2026-09-28 — MANIFEST-DOWNLOAD-FINANCE-0928 — PC-A

رفع دانلود خاموش منیفست روی HTTP شبکه با fallback شناسه درخواست، کلید مستقل برای بازیابی خروجی قبلی، نمایش خطا کنار بلیط و لینک مستقیم دریافت فایل. شمارش کارت و خروجی فقط قراردادهای دارای تأیید مالی معتبر را شامل می‌شوند و تأیید هنگام خروجی مجدداً کنترل می‌شود. ۲۸ تست API شامل مسیر واقعی HTTP و فایل باینری، ۶ تست Web، build هر دو بخش و lint موفق‌اند؛ بدون Migration یا Dependency. جزئیات: docs/tasks/MANIFEST-DOWNLOAD-FINANCE-0928.md. تغییرات اصلی کاربر محفوظ‌اند؛ نشست مرورگر روی صفحه ورود است و کلیک احراز‌شدهٔ کاربر بررسی نشده است.

## TICKET-SUPPLY-REPEAT-0928 — PC-A — 2026-09-28

- سه گزینه تامین قابل انتخاب: شناوری، ظرفیت شرکت و API. مقادیر ذخیره‌شده قدیمی allotment/charter حفظ و در رابط با عنوان شناوری خوانده می‌شوند؛ قرارداد دامنه تغییر نمی‌کند. انتخاب API نوع تامین است و اتصال خودکار به تامین‌کننده خارجی ایجاد نمی‌کند.
- تعداد نوبت شامل تاریخ شروع است؛ هفتگی با فاصله دقیق هفت روز و ساعت/مدت سفر قبلی. هر نوبت پس از ثبت سرور مستقل به مجموعه مرورگر اضافه، فهرست رسمی تازه و فیلتر کارت‌ها برای نمایش تازه‌ترین‌ها بازنشانی می‌شود. موفقیت‌های قبل از خطای شبکه حفظ و تلاش مجدد در همان پنجره از شناسه‌های ثابت و checkpoint استفاده می‌کند.
- فهرست رسمی ویرایش مستقل تعریف موجود در مرورگر و حذف را دارد. DELETE موجود علاوه بر بلیط تاریخ‌گذشته، بلیط آینده فاقد تخصیص فعال، رزرو ظرفیت فعال و تور متصل را آرشیو می‌کند؛ قفل ردیف، شعبه، نسخه و audit حفظ می‌شوند. FK و سوابق قرارداد/مالی حذف نمی‌شوند. محدودیت ۵۰۰ رکورد فهرست مدیریت و ذخیره محلی تعریف بلیط از قبل برقرار است.
- بدون Migration، قرارداد مشترک، وابستگی یا داده عملیاتی. runtime ۳۱۰۰ و PR قبلی تورها دست‌نخورده‌اند. ۳۳ آزمون Web و ۱۱ آزمون API، lint فایل‌های متاثر، typecheck Web/API و build تولیدی Web/API با ۵۳ مسیر Web موفق‌اند.

## 2026-09-28 — FINANCE-TICKET-PAYMENT-0928 — PC-A — READY_FOR_REVIEW

Payment-method selection uses a native accessible control with explicit failed/empty-list feedback and retry. Existing seat-count × unit-cost capture remains persisted; the invoice preview now uses exact four-decimal arithmetic. The payment dialog explains repeated partial payments and shows the invoice amount as initial remaining balance. Eleven targeted Web tests, scoped lint, Web typecheck and production build (53 routes) passed. No new migration, shared contract, dependency, permissions or operational data changes. Branch: codex/pc-a-finance-ticket-payment-0928 from origin/develop@e4eb048c. Original edits and Web3100/API4000 are unchanged; reviewed integration/runtime update remains subject to approval. See docs/tasks/FINANCE-TICKET-PAYMENT-0928.md.

## 2026-09-28 — MANIFEST-TRANSPORT-FORMAT-0928 — PC-A

خروجی دیفالت منیفست هدر آبی FF1D4ED8 با متن سفید، جهت چپ‌به‌راست، ستون مقصد و جنسیت mr/mrs دارد. ردهٔ سنی تخصیص و override حفظ و fallback سن در تاریخ سفر برای دادهٔ قدیمی افزوده شد. اتوبوس و قطار از snapshot خدمات تأییدشدهٔ فروش و با همان گیت مالی/مجوز/تخصیص مسافر، کارت و XLSX دیفالت مناسب دارند. ۳۴ تست API، تست Web، lint، typecheck و build هر دو بخش (۵۳ مسیر) موفق‌اند؛ بدون Migration یا Dependency. جزئیات و محدودیت snapshotهای قدیمی در docs/tasks/MANIFEST-TRANSPORT-FORMAT-0928.md. قفل محدود اسناد/قرارداد آزاد است.

## 2026-09-28 — قالب پیش‌فرض و انتخاب قالب منیفست (PC-A)

- در شاخه مستقل codex/pc-a-manifest-default-template-0928 از origin/develop@1de70e5c، انتهای فرم بلیت انتخاب‌گر جست‌وجوپذیر قالب افزوده شد؛ نام گزینه‌ها از ایرلاین و مقصد است و انتخاب nullable روی Published Offer با FK واقعی ذخیره می‌شود. بلیت‌های قدیمی و گزینهٔ «پیش‌فرض» از XLSX عمومی استفاده می‌کنند.
- خروجی عمومی شامل نام قرارداد (شمارهٔ ثبت‌شده قرارداد)، نام و نام خانوادگی، تاریخ پرواز، بلیت/شماره پرواز، ایرلاین، رده سنی، ملیت، تاریخ تولد، جنسیت، کلاس پروازی و کد ملی است؛ مسیر میان دو کشور، شماره و انقضای پاسپورت هم دارد. خروجی فقط مسافران تخصیص‌یافته به همان بلیت را با ترتیب/ردهٔ سنی رزرواسیون شامل می‌شود و تأیید مالی و مجوز اطلاعات حساس حفظ شده‌اند. قالب صریح نامعتبر، همان کارت را غیرفعال می‌کند و به قالب دیگری تغییر نمی‌کند.
- ۱۳۶ تست API و ۱۲۳ تست Web موفق‌اند؛ ۸ تست Integration وابسته به TEST_DATABASE_URL اجرا نشده‌اند. lint محدوده، typecheck و build API/Web (۵۳ مسیر)، Prisma و اجرای همه migrationها روی PostgreSQL آزمایشی خالی موفق‌اند. تمرین FK، حفظ null بلیت قدیمی و ممنوعیت حذف قالب متصل را تأیید کرد.
- Migration افزایشی 20260928120000_ticket_manifest_template پیش از انتشار API/Web لازم است؛ دیتابیس عملیاتی، localhost جاری، تغییرات محلی قبلی، مجوزها و dependency/lockfile تغییر نکرده‌اند. قالب‌های اختصاصی، قواعد فعلی workbook ایرلاین و سقف ۶۱ مسافر را نگه می‌دارند. قفل محدود این واحد پس از commit آزاد است؛ PR برای develop بدون merge خودکار تهیه می‌شود. جزئیات: docs/tasks/MANIFEST-DEFAULT-TEMPLATE-0928.md.

## 2026-09-28 — HR-WORKBENCH-SURVEYS-0928 — READY_FOR_REVIEW

نظرسنجی‌های ارسال‌شده از میزکار با مقصد منابع انسانی از سرویس عمومی Workbench در بخش جدید HR نمایش داده می‌شوند. دسترسی شعبه و گیرنده، ناشناس‌ماندن فرستنده و صفحه‌بندی در API اعمال می‌شوند. بدون Migration یا تغییر داده. ۱۰ تست API و ۵۴ تست HR Web، lint، typecheck و build هر دو بخش موفق‌اند. اجرای مشترک ۳۱۰۰ تغییر نکرده است. جزئیات: docs/tasks/HR-WORKBENCH-SURVEYS-0928.md.

## 2026-09-27 — WORKBENCH-FEEDBACK-ATTACHMENT-0927 — PC-B — READY_FOR_REVIEW

پیوست نظرسنجی میزکار دیگر از API عمومی اسناد استفاده نمی‌کند؛ endpoint محدود و احراز‌شدهٔ Workbench Feedback فقط PDF/JPEG/PNG تا ۱۰ مگابایت را با مالک، شعبه و reference ثابت همان نظرسنجی ثبت می‌کند. این مسیر هیچ مجوز عمومی اسناد به کاربر اضافه نمی‌کند. Migration افزایشی و idempotent نوع سند «پیوست نظرسنجی» و دستهٔ آرشیو عمومی را برای پایگاه‌های موجود ایجاد می‌کند. lint و typecheck API/Web، Prisma validate، build API، ۱۱ تست API و یک تست Web موفق‌اند. build تولیدی Web به‌دلیل فرآیند build هم‌زمان اجرا نشد و باید در CI یا محیط آزاد تکرار شود؛ Schema و دادهٔ عملیاتی تغییر نکرده‌اند. Migration در پایگاه‌دادهٔ محلی سرویس ۴۰۰۰ اعمال شد و نوع سند و دستهٔ آرشیو فعال‌اند؛ migration status، Prisma validate و تست‌های هدفمند API موفق‌اند.

## 2026-09-27 — WORKBENCH-REQUEST-ROUTE-REDESIGN-0927 — PC-B — READY_FOR_REVIEW

فرم «درخواست جدید» میزکار با سربرگ، راهنمای زمینه‌ای، آیکون‌های معنادار و اکشن روشن بازطراحی شد. درخواست‌های ثبت‌شده همچنان با قرارداد عمومی Customer Affairs نگهداری می‌شوند، اما از این پس با modal «جزئیات درخواست» داخل میزکار پیگیری می‌شوند؛ مسیر یا لینک خروج به امور مشتریان حذف شد. کارت‌های اتصال به ماژول‌های دیگر، ارجاع‌های امور مشتریان و اعلان‌های منابع انسانی نیز از tab «کارتابل درخواست‌ها» حذف شدند تا فقط خود کارتابل میزکار نمایش داده شود. اتصال backend برای ثبت و گردش درخواست حفظ شده است. ESLint متمرکز، typecheck Web و ۵۲ تست Workbench موفق‌اند. بدون تغییر API، Schema/Migration، قرارداد، Permission، وابستگی یا دادهٔ عملیاتی.

## 2026-09-23 — WORKBENCH-QA-FIXES-0923 — PC-B — READY_FOR_REVIEW

ثبت یادداشت میزکار اکنون هنگام انتظار برای ذخیره قفل می‌شود؛ کلیک یا submit تکراری دیگر درخواست دوم نمی‌سازد و دکمه‌های ذخیره، انصراف و بستن تا پایان عملیات وضعیت درست دارند. دو تست تازه رقابت هم‌زمان و آزادشدن قفل پس از خطا را پوشش می‌دهند. مجموع ۵۲ تست Workbench، lint متمرکز، typecheck و build تولیدی Web با ۵۲ route موفق‌اند. Web اصلاح‌شده روی ۳۱۰۰ و API سالم روی ۴۰۰۰ اجرا و ارتباط فرم ورود با پاسخ واقعی API بازآزمایی شد. بدون Migration، Schema، Permission، قرارداد مشترک یا تغییر دادهٔ عملیاتی.

## 2026-09-27 — TICKET-PROCUREMENT-FINANCE-PAYMENT-0927 — IN_PROGRESS

درخواست خرید بلیت در کارتابل مالی به «تعداد صندلی × قیمت خرید هر صندلی» منتقل
می‌شود و جمع فاکتور فقط در Backend محاسبه می‌گردد. پرداخت‌های جزئی از حساب و روش
انتخاب‌شده append-only باقی می‌مانند و رسید اختیاری پرداخت از طریق Documents با
مرجع همان پرداخت ذخیره می‌شود. فرم و command جدید بلیط توضیح آزاد ندارند و تاریخچه
قدیمی بازنویسی نمی‌شود. مدیریت قیمت بلیت نیز مقصد نسخه‌دار قیمت (مثل مجموعه یا
علی‌بابا) را در مالکیت Ticket Catalog نگه می‌دارد تا برای API آینده قابل مصرف باشد.
Migration افزایشی است و هنوز روی دیتابیس محلی یا عملیاتی اجرا نشده است.

## 2026-09-27 — SEARCH-FIRST-FORM-AUDIT-0927 — PC-B — READY_FOR_REVIEW

انتخاب‌گرهای مخاطب پیشنهاد، نوبت تور و مراجع اطلاعات پایه تا وارد شدن عبارت جست‌وجو هیچ نتیجه‌ای نمایش یا از API دریافت نمی‌کنند. مقدار از پیش انتخاب‌شده برای ویرایش حفظ می‌شود، اما سایر گزینه‌ها فقط پس از جست‌وجو در دسترس‌اند. تست‌های متمرکز و lint محدوده موفق‌اند؛ Migration، قرارداد، API و دادهٔ عملیاتی تغییری نکرده‌اند.

## 2026-09-23 — HEADER-DATE-RTL-0923 — READY_FOR_REVIEW

ترتیب تاریخ فارسی سربرگ به ساختار طبیعی RTL «روزهفته روز ماه سال» تبدیل شد و ساعت برای جلوگیری از جابه‌جایی علائم در یک بخش LTR مستقل قرار گرفت. ۹ تست هدفمند، lint، typecheck، build تولیدی Web با ۵۲ مسیر و QA واقعی داشبورد روی `3100` موفق‌اند؛ API و داده تغییر نکردند.

## 2026-09-23 — HEADER-DATE-CLOCK-0923 — READY_FOR_REVIEW

ساعت جاری کنار تاریخ سربرگ با timezone و نوع ارقام تنظیم‌شده سامانه و بدون نمایش ثانیه اضافه شد و در مرز هر دقیقه تازه می‌شود. ۸ تست هدفمند، lint، typecheck و build تولیدی Web با ۵۲ مسیر موفق‌اند؛ Web روی `3100` و API روی `4191` با پاسخ سلامت `200` اجرا شدند. API، داده، Schema/Migration و Dependency/Lockfile تغییر نکردند.

## 2026-09-23 — PACKAGE-GENERATOR-TEMPLATE-REFRESH-0923 — READY_FOR_REVIEW

هفت قالب اصلاح‌شدهٔ مالزی و تایلند با فایل‌های ارسالی مالک جایگزین شدند: کوالالامپور، کوالالامپور+پنانگ، کوالالامپور+سنگاپور، کوالالامپور+لنگکاوی، پوکت، پاتایا و بانکوک+پوکت. مختصات ویرایش و پیش‌نمایش برای ابعاد جدید تنظیم شد و هندسهٔ سه قالب تایلند نیز کامل شد. ۱۱ تست هدفمند، lint، typecheck، Build تولیدی Web با ۵۲ مسیر و QA مرورگر هر هفت قالب موفق‌اند. API، قرارداد مشترک، Migration، Dependency/Lockfile و داده عملیاتی تغییر نکردند.

## 2026-09-22 — SALES-PAYMENT-SHARE-SUMMARY-0922 — READY_FOR_REVIEW

پنجره «افزودن پرداخت» اکنون برای ارز انتخاب‌شده مبلغ کل قرارداد، تأییدشده مالی، مبلغ در انتظار مالی، مبلغ جاری و درصد آن از کل را نشان می‌دهد و مانده پس از تأیید همین پرداخت را زنده محاسبه می‌کند. ورود مبلغ به کنترل خوانا با جداکننده هزارگان تبدیل شد و مازاد بر مانده هشدار مشخص دارد. محاسبات Decimal با BigInt انجام می‌شوند. ۹ تست هدفمند، lint، typecheck و build تولیدی Web با ۵۰ route موفق‌اند؛ بدون API، Finance، Schema/Migration، Permission یا داده عملیاتی.

## 2026-09-21 — CUSTOMER-HIDE-TECH-BADGES-0921 — READY_FOR_REVIEW

کارت سه‌ردیفیِ توضیحات فنی از پایین فضای مشتریان و مسافران حذف شد؛ اجرای دسترسی حساس، City FK، Audit و کنترل نسخه در Backend دست‌نخورده ماند. ۴۱ تست Customers، lint متمرکز، typecheck و build تولیدی Web با ۵۰ route موفق‌اند.

## 2026-09-21 — TICKET-AUTO-ACTIVE-0921 — READY_FOR_REVIEW

بلیط تازه و پیش‌نویس‌های معتبر قبلی بدون ورود دلیل کاربر فعال می‌شوند؛ ارز پیشنهادی خرید اختیاری است و قیمت خرید بعداً در مالی تکمیل می‌شود. Audit تغییر وضعیت با دلیل ثابت سیستمی حفظ شده است. ۱۱۴ تست هدفمند، lint، typecheck و build تولیدی Web/API موفق‌اند. شاخهٔ مستقل `codex/pc-a-ticket-auto-active-0921`؛ بدون Migration، Schema یا تغییر دادهٔ عملیاتی.

## 2026-09-21 — TOUR-DEPARTURE-TICKET-RANGE-0921 — READY_FOR_REVIEW

انتخاب بلیت‌های رفت و برگشت نوبت تور به بازهٔ روز شروع تا پایان متصل شد؛ فقط بلیت‌هایی که تاریخ حرکت محلی تهرانشان داخل بازهٔ inclusive است نمایش داده می‌شوند. ۲ تست متمرکز، lint، typecheck و build تولیدی Web با ۵۰ route موفق‌اند.

## 2026-09-21 — TICKET-SALE-CURRENCY-SELECT-0921 — READY_FOR_REVIEW

ارز قیمت فروش تکی مدیریت بلیت از ورودی آزاد به dropdown متصل به همهٔ ارزهای فعال اطلاعات پایه تبدیل شد؛ ثبت با کد تایپی یا ارز خارج از فهرست مجاز نیست و نبود فهرست ثبت را متوقف می‌کند. ۱۵ تست متمرکز، lint، typecheck و build تولیدی Web با ۵۰ route موفق‌اند.

## 2026-09-21 — SALES-TICKET-CLARITY-0921 — READY_FOR_REVIEW

Airline, route, departure/arrival dates and times are clearer in the contract ticket selector; selected cards use a restrained themed border. Capacity/fare guards and Tehran timezone preserved. Owner-authorized overlap reconciliation excludes stale namespace changes without modifying old worktrees. 7 tests, lint, TypeScript and production build (50 pages) passed. No migration or 3100 changes. Branch: codex/pc-a-finance-sales-clarity-0921. Details: [task](tasks/SALES-TICKET-CLARITY-0921.md).

## 2026-09-21 — TOUR-DEFINITION-PRICING-HANDOFF-0921 — IN_PROGRESS

فرم تعریف تور از زمان‌بندی و قیمت جدا شد: مدیریت بلیت فقط مشخصات و خدمات ثابت را ثبت می‌کند و فهرست فشرده تورها را نشان می‌دهد؛ ساخت نوبت و اتصال بلیت‌ها در مدیریت قیمت پکیج انجام می‌شود و هر نوبت مسیر مستقیم به اتصال هتل‌های همان مقصد و بازه دارد. فرم نرخ هتل با نوبت، مقصد و تاریخ‌های از پیش انتخاب‌شده باز می‌شود. ۸ تست هدفمند، typecheck، lint و build تولیدی Web با ۵۰ route موفق‌اند؛ بدون Migration، Dependency یا تغییر داده عملیاتی.

## 2026-09-21 — FINANCE-INBOX-CLARITY-0921 — READY_FOR_REVIEW

Compact request list with explicit selection, responsive filters and a labelled sticky details panel. Current receipt, supplier-payment and ticket-cost workflows preserved during owner-authorized reconciliation of stale local changes. 11 focused tests, lint, Web TypeScript and production build (50 pages) passed. No migration, dependency, operational data or 3100 changes. Branch: codex/pc-a-finance-inbox-clarity-0921; review before merge. Details: [task](tasks/FINANCE-INBOX-CLARITY-0921.md).

## 2026-09-21 — PROCUREMENT-NAVIGATION-HR-CONSISTENCY-0921 — PC-B — READY_FOR_REVIEW

نگاشت ثانویهٔ مدیریت سیستم با منوی اصلی یکسان شد: «خرید و تأمین» فقط زیر «سرمایه انسانی» قرار دارد و از «رزرواسیون و تأمین سفر» حذف شده است. تست متمرکز هر دو نگاشت را کنترل می‌کند. اصلاح امن‌سازی فرم برای رکوردهای قدیمی نیز در `develop` موجود است؛ runtime پورت 3100 باید از آخرین `develop` اجرا شود.

## 2026-09-21 — PROCUREMENT-DRAFT-FORM-HEADER-CLEANUP-0921 — PC-B — READY_FOR_REVIEW

نشان تکراری «ثبت پیش‌نویس» از بالای فرم درخواست خرید حذف شد و دکمهٔ «ذخیره پیش‌نویس» در پایین فرم برای انجام عملیات باقی ماند. تست متمرکز فرم این تفکیک را کنترل می‌کند؛ API، Schema/Migration، Permission و داده تغییری ندارند.

## 2026-09-21 — PROCUREMENT-DRAFT-SAVE-LOCAL-TASKS-RESILIENCE-0921 — READY_FOR_REVIEW

ثبت پیش‌نویس خریدِ بدون مسئول یا تأییدکننده دیگر task عملیاتی نمی‌سازد؛ در نتیجه نبود موقت جدول projection وظایف در دیتابیس محلی، تراکنش ایجاد خرید را برنمی‌گرداند. دکمهٔ «تأیید و انتشار» داخل فرم و کنار «ذخیره پیش‌نویس» قرار دارد و درخواست کامل را با مجوز ثبت به `SUBMITTED` می‌برد؛ سپس «ارسال برای تأیید» با سیاست و تأییدکنندهٔ واقعی آن را وارد گردش بررسی می‌کند. درخواست‌های دارای مسئول، تأیید یا اقدام‌های غیرایجادی همچنان به اتصال Tasks متکی هستند. ۸ تست فرم، تست Tasks، تست یکپارچهٔ guardشدهٔ انتشار، lint/typecheck API/Web و build API موفق‌اند؛ Migration/Schema و دادهٔ عملیاتی تغییری ندارند.

## 2026-09-21 — PROCUREMENT-CATEGORY-ONLY-REQUEST-FORM-0921 — PC-B — READY_FOR_REVIEW

فرم ایجاد درخواست خرید فقط «دسته خرید» را از کاربر می‌گیرد؛ «نوع خرید» حذف شده و برای حفظ سازگاری با اعتبارسنجی فعلی API، در درخواست تازه به‌طور داخلی `خرید عمومی` مقداردهی می‌شود. ۱۰ تست هدفمند، lint و typecheck Web موفق‌اند؛ API، Schema/Migration، مجوز و دادهٔ عملیاتی تغییری ندارند.

## 2026-09-21 — PROCUREMENT-NAVIGATION-AND-DRAFT-ROBUSTNESS-0921 — PC-B — READY_FOR_REVIEW

یک درخواست قدیمی با فیلد دسته‌بندی ناقص باعث خطای اجرای فرم خرید می‌شد؛ فرم اکنون مقدار ناقص را امن نادیده می‌گیرد و خطای `trim` رخ نمی‌دهد. جایگاه نمایش «خرید و تأمین» نیز طبق درخواست مالک به زیرگروه «سرمایه انسانی» منتقل شد. ۲۱ تست هدفمند، lint و typecheck Web موفق‌اند؛ API، دادهٔ خرید، Schema/Migration و مجوزها تغییری نکرده‌اند.

## 2026-09-21 — PROCUREMENT-REQUEST-NO-SUPPLIER-0921 — PC-B — READY_FOR_REVIEW

فرم «درخواست خرید جدید» اکنون بدون ثبت یا انتخاب تأمین‌کننده قابل تکمیل و ثبت است؛ تأمین‌کننده در درخواست اولیه اختیاری است و برای مرحلهٔ استعلام/سفارش تعیین می‌شود. توضیح این قاعده داخل فرم اضافه شد و قواعد دامنه نیز ارسال درخواست بدون `supplierId` یا `supplierName` را معتبر می‌دانند؛ الزام تأمین‌کننده در استعلام، سفارش و فاکتور تغییری نکرده است. تست هدفمند، lint و typecheck Web/API موفق‌اند. Branch: `codex/pc-b-procurement-request-no-supplier-0921`.

## 2026-09-19 — SYSTEM-REMOVE-MODULE-SETTINGS-0919 — PC-B — READY_FOR_REVIEW

تب و دکمهٔ تکراری «تنظیمات بخش‌ها» از مدیریت سیستم حذف شدند. ناوبری مدیریت سیستم اکنون بر هفت گروه اصلی فضای کار، فروش و ارتباط با مشتری، رزرواسیون و تأمین سفر، مالی، سرمایه انسانی، اسناد و گزارش‌ها و تنظیمات شرکت استوار است و هر انتخاب کارت‌های همان حوزه را نمایش می‌دهد. عملیات ویرایش نسخه‌دار و بررسی/تاریخچهٔ تغییرات حفظ شده‌اند. تست هدفمند، ESLint، typecheck و build تولیدی Web موفق‌اند. Migration، API، داده، مجوز و وابستگی‌ها تغییری نکردند.

## 2026-09-19 — LOGIN-NOORA-CLOUD-OUTLINE-0919 — PC-B — READY_FOR_REVIEW

ابر مه‌آلود صفحهٔ ورود با ابر خطی آبیِ مرجع جایگزین شد؛ سطح داخلی نیمه‌شفاف است و `NOORA` در مرکز آن دیده می‌شود. پس از توقف هواپیما ظاهر می‌شود و برای کاربران با کاهش حرکت، بدون انیمیشن نمایش دارد. تست هدفمند، typecheck و build تولیدی Web موفق‌اند و منطق ورود، API، Migration و دادهٔ عملیاتی تغییری نکرده‌اند.

## 2026-09-20 — TICKET-TIME-REPEAT-0920 — آماده بازبینی

فیلدهای تاریخ و ساعت حرکت/رسیدنِ Ticket Catalog برای بلیت یک‌طرفه، رفت‌وبرگشت و هر قطعهٔ ترکیبی بازگشتند. زمان ورودی با منطقهٔ زمانی مسیر به UTC تبدیل می‌شود و زمان حرکت، تاریخ اولین بلیت را همگام می‌کند؛ در نتیجه تکرار هفتگی/ماهانه ساعت‌های ثبت‌شده را همراه تاریخ جابه‌جا می‌کند. بلیت قدیمیِ بدون ساعت همچنان تکرارپذیر است. ۱۰۰ تست Ticket Catalog، lint و typecheck Web موفق‌اند و build تولیدی در Worktree جدا خروجی `BUILD_ID` ساخته است. Schema/Migration/API/contract/runtime و Web3100 تغییر نکرده‌اند. جزئیات در [TICKET-TIME-REPEAT-0920](tasks/TICKET-TIME-REPEAT-0920.md) است.

## 2026-09-20 — LOGIN-STATIC-BACKGROUND-0920 — PC-A — READY FOR REVIEW

- طبق درخواست مالک، نوشتهٔ `NOORA` و طرح ابری/باد از صفحهٔ ورود حذف شد. تصویر موجود `login-airline-b2.png` بدون تغییر فایل، حرکت یا تعویض به‌عنوان پس‌زمینهٔ ثابت حفظ شده و crop موبایل و overlay خوانایی قبلی باقی مانده‌اند.
- اعتبارسنجی: ۵ تست متمرکز صفحه ورود، lint فایل‌های تغییرکرده، typecheck کامل Web و build تولیدی ۵۰ مسیر موفق‌اند. API، احراز هویت، فرم ورود، Schema/Migration، Permission، Dependency/Lockfile، داده و Web3100 تغییر نکردند.

## 2026-09-20 — HOTEL-RATE-ROOM-CAPACITY-0920 — READY_FOR_REVIEW

مدیریت نرخ هتل از ضرایب ثابت به نرخ نوع اتاق واقعی با ظرفیت مستقل بزرگسال و کودک ارتقا یافت. اتاق بدون ضریب در ارقام پکیج نمایش یا محاسبه نمی‌شود و در فروش قابل انتخاب نیست و Backend فروش ظرفیت هر اتاق را هنگام ایجاد، ویرایش و تأیید قرارداد به‌صورت fail-closed کنترل می‌کند. Migration روی PostgreSQL 18.1 خالی، Prisma، lint/typecheck، تست‌های هدفمند و Build API/Web پاس شدند؛ قفل‌های Migration/Contract/Central Docs تا Merge و Handoff رسمی فعال‌اند.

## 2026-09-20 — FINANCE-CUSTOMER-DOCUMENT-DELIVERY-0920 — DONE/MERGED

مجوز تحویل مدارک مشتری از خرید و پرداخت کارگزار و اجرای رزرواسیون مستقل شد.
مالی اکنون می‌تواند آن را پس از حداقل یک دریافت تأییدشده، پس از تسویه کامل، یا
با استثنای معتبر مدیر صادر کند. مبنا، دلیل، نسخه، عامل و اطلاعات استثنا Audit
می‌شوند؛ جست‌وجوی قرارداد شماره کامل و بخشی را می‌پذیرد. Sales و Manifest فقط
مجوز contract-level مالی را مصرف می‌کنند. جزئیات در
[FINANCE-CUSTOMER-DOCUMENT-DELIVERY-0920](tasks/FINANCE-CUSTOMER-DOCUMENT-DELIVERY-0920.md)
ثبت شده است.

PR #322 با Merge Commit `9c536233` وارد `develop` شد و قفل‌های Task آزاد شدند.

## 2026-09-19 — FINANCE-OPERATIONAL-CARTABLE-0919 — READY_FOR_REVIEW

کارتابل مالی اکنون تأیید دریافت را فقط پس از انتخاب حساب مقصد فعال، هم‌ارز و متعلق
به شعبه قرارداد می‌پذیرد و همان حساب را با FK واقعی روی پرداخت قرارداد ذخیره و audit
می‌کند. پرداخت کارگزار از حساب مبدأ، تعریف حساب جدید، مانده و جزئیات انتقال، جست‌وجوی
قرارداد و تأیید/لغو دستی تحویل مدارک از قابلیت‌های عملیاتی موجود به همان کارتابل متصل
مانده‌اند. KPIهای کارت‌محور و شمارنده‌های باز/سررسیدگذشته اکنون با جست‌وجو، بخش، وضعیت
و بازه تاریخ همگام‌اند.

Migration افزایشی روی PostgreSQL محلی اعمال و وضعیت ۸۵ migration به‌روز تأیید شد.
۸ تست API و ۸ تست Web، Prisma validate، lint و typecheck چهار بخش API/Web/Contracts/
Database و build تولیدی API/Web موفق‌اند. نسخه جدید روی Web 3100 و API 4190 با health
و CORS موفق فعال است. هیچ پرداخت بیرونی یا داده مالی ساختگی ثبت نشده است.

## 2026-09-19 — SYSTEM-MANAGEMENT-NAVIGATION-003 — PC-B — READY_FOR_REVIEW

دسته‌های قابل‌گسترشِ `/system` اکنون همان منبع canonical سایدبار را مصرف می‌کنند؛ بنابراین عنوان و مسیر زیر‌بخش‌ها در دو جای رابط واگرا نمی‌شوند. فضای کار شامل «میزکار من» و «داشبورد» است و پیوندهای قیمت‌گذاری فروش، عملیات/فرآیند رزرواسیون، کاربران، شرکت‌های حقوقی و سلامت سامانه نیز به زیرگروه واقعی خود افزوده شدند. خرید و تأمین از سرمایه انسانی به گروه درست «رزرواسیون و تأمین سفر» منتقل شد. ۲۰ تست هدفمند ناوبری و مدیریت سیستم، lint و typecheck وب موفق‌اند؛ API، قرارداد، Migration، داده و مجوزها تغییری نکرده‌اند. ساخت production به‌سبب اشتراک `.next` با dev server فعال ۳۱۰۰ بدون پیشرفت ماند و فقط فرایند ساخت متوقف شد؛ HTTP 200 runtime حفظ شد.

## 2026-09-19 — DASHBOARD-VISUAL-DETAIL-OUTPUT-0919 — READY_FOR_REVIEW

پنل «جزئیات نمودار» دیگر نمونه‌های خامِ نقاط خروجی را به‌شکل تاریخ/مبلغ نمایش
نمی‌دهد. اطلاعات زمینه‌ای شامل بازهٔ فعال، نوع نمودار، واحد پول، تعریف کسب‌وکار،
قاعدهٔ نمایش، فیچرهای استفاده‌شده و محدودیت‌ها باقی می‌مانند. تست هدفمند Dashboard،
lint، typecheck و build تولیدی Web موفق‌اند؛ API، Schema/Migration، Permission،
دادهٔ عملیاتی و Dependency/Lockfile تغییر نکردند.

## 2026-09-19 — DASHBOARD-KPI-TREND-PRESENTATION-0919 — READY_FOR_REVIEW

آیکون انتخاب تقویمِ برچسب‌های محور زمان نمودار روند با `CalendarDays` بزرگ‌تر،
رنگ اصلی رابط و stroke واضح اصلاح شد. همچنین جداکنندهٔ بصری پیش از Sparkline از
همهٔ KPI Cardها حذف شد. ۱۶ تست Dashboard، lint و typecheck Web موفق‌اند؛ API،
Schema/Migration، Permission، دادهٔ عملیاتی و Dependency/Lockfile تغییر نکردند.

## 2026-09-19 — DASHBOARD-TREND-AXIS-CALENDAR-0919 — READY_FOR_REVIEW

نمودارهای روند Dashboard اکنون فقط سری بازهٔ انتخاب‌شده را نمایش می‌دهند؛
`comparisonValues` از قرارداد Projection و producer حذف شده است، در حالی که
مقایسهٔ دورهٔ قبل برای KPI Cardها و visualهای غیرروند همچنان از دادهٔ تأییدشده
می‌آید. ناحیهٔ رسم خط با gutter مستقلِ محور مقدار و محور زمان بازچینی شد تا marker
و خط با عنوان‌ها و برچسب‌های محور تداخل نداشته باشند. انتخاب «تاریخ شمسی/تاریخ
میلادی» در سرستون هر نمودار روند، تنها قالب برچسب محور زمان را در `Asia/Tehran`
تغییر می‌دهد و داده یا بازهٔ Query را تغییر نمی‌دهد. واحد پول نیز در تمام صفحات
دارای این فیلتر، بلافاصله پس از «بازه زمانی» نمایش داده می‌شود.

۶ تست هدفمند Reporting و ۱۶ تست Dashboard، lint و typecheck API/Web و build
تولیدی هر دو برنامه موفق‌اند. Migration، Schema، Permission، Dependency/Lockfile
و داده‌های دمو/عملیاتی تغییر نکرده‌اند. runtime تازه روی `localhost:3000` و API
روی ۴۰۰۰ با پاسخ HTTP ۲۰۰ فعال‌اند.

## 2026-09-17 — SYSTEM-MANAGEMENT-BACKEND-001 — PC-B — READY_FOR_REVIEW

تغییرات تازهٔ develop برای Backend مدیریت سامانه همراه با تغییرات این چت یکپارچه شد: قرارداد v1، ۳۰ Permission، ۱۲ جدول افزایشی، تنظیمات نسخه‌دار، شماره‌گذاری اتمیک، اعلان، قالب immutable، Feature Flag، درخواست Backup، Health/Job read-only و نشست مدیریتی امن. حفاظت IAM در برابر Self-escalation و حذف آخرین مدیر فعال نیز حفظ شد.

## 2026-09-17 — RESERVATION-UI-AND-CONTRACT-ACTIONS-0917 — COMPLETE

تغییرهای خارج‌ماندهٔ رابط رزواسیون به نسخهٔ نهایی افزوده شدند: پنل عملیات فشرده زیر جدول، ویرایشگر قراردادی با بخش‌های واضح‌تر، نمایش ردهٔ کودک هتل در فرم/واچر، ویرایش مشخصات هویتی مسافر با مجوز حساس، و پنهان‌شدن کارت عمومی در نمای Manifest. سه دکمهٔ عملیات هر ردیف قرارداد فروش اکنون در یک ستونِ عرض ثابت هستند. یک نقص قدیمی در الحاق مجوزهای System به فهرست IAM نیز رفع شد. ۳۲ تست Web، ۱۰ تست API، typecheck و build API/Web موفق‌اند؛ Migration و دادهٔ عملیاتی تغییر نکردند.

## 2026-09-17 — CONTRACT-PASSENGER-CONTROLS-0917 — READY_FOR_REVIEW

جدول ورود اطلاعات مسافران قرارداد اکنون برای جنسیت انتخاب دوگزینه‌ای مرد/زن دارد و مقدار سازگار M/F را ذخیره می‌کند. در عنوان هر سه فیلد کشور نیازمند ISO3، دکمه راهنمای کوچک اضافه شد که فهرست اسکرول‌دار نام کشورهای پرکاربرد و کد سه‌حرفی آن‌ها را در همان صفحه باز می‌کند. ردیف جدید، ردیف پاک‌شده و مسافر افزوده‌شده، سه فیلد ISO3 را با IRN پیش‌پر می‌کنند اما کاربر می‌تواند هر سه را تغییر دهد؛ پرونده‌های از پیش موجود تغییر نمی‌کنند. ۳۱ تست مدل و ۱۱ تست رابط، lint، typecheck و build تولیدی Web موفق‌اند و نسخه جدید روی پورت‌های 3100 و 3200 فعال است. Branch: codex/pc-a-contract-passenger-controls-0917.

نوار دسته‌های `/system` اکنون همان ساختار افقی خود را حفظ می‌کند، ولی نام‌هایش با گروه‌های سایدبار Rubi یکسان است. کلیک روی هر عنوان، زیرمجموعه‌های واقعی آن را باز و کارت‌ها را به همان گروه محدود می‌کند؛ کادرهای خاکستری و دکمه‌های سکشن بالای صفحه حذف شده‌اند.

## 2026-09-16 — PROCUREMENT-INVOICE-ATTACHMENTS-0916 — READY_FOR_REVIEW

فرم فاکتور خرید اکنون دکمهٔ بارگذاری مستقیم دارد. فایل با نوع سند Procurement، مرجع درخواست خرید و شناسهٔ آرشیو خودکار در Documents ذخیره می‌شود و نسخهٔ سالم آن به فاکتور در حال ثبت پیوست می‌گردد؛ سپس در «اسناد و فایل‌ها» نیز قابل مشاهده است. تست فرم و lint موفق‌اند. Branch: `codex/pc-b-procurement-invoice-attachments-0916`.

## 2026-09-16 — PROCUREMENT-RECORD-ACTIONS-0916 — READY_FOR_REVIEW

همهٔ ردیف‌های خرید و تأمین اکنون کنترل‌های آیکونی ویرایش و حذف دائمی دارند. ویرایش، فرم همان پرونده یا تأمین‌کننده را باز می‌کند؛ حذف بعد از تأیید صریح از API انجام می‌شود و فهرست‌ها تازه‌سازی می‌شوند. حذف پرونده، وابستگی‌های متعلق به Procurement را در یک تراکنش پاک می‌کند و وظایف باز را می‌بندد؛ اگر مالی پرونده را پذیرفته باشد، عملیات متوقف می‌شود تا سابقهٔ مالی حفظ شود. تست API حذف و lint فایل‌های متاثر موفق‌اند؛ typecheck سراسری تا رفع خطای موجود `contractPartyName` در رزواسیون و فروش مسدود است. Branch: `codex/pc-b-procurement-record-actions-0916`.

## 2026-09-16 — RESERVATION-PANEL-HORIZONTAL-0916 — PC-A — READY_FOR_REVIEW

پنل عملیات رزواسیون زیر جدول فشرده شد تا در دسکتاپ، بدون جابه‌جایی صفحه، قرارداد انتخاب‌شده و سه گروه عملیات کنار هم دیده شوند. نوار قرارداد انتخاب‌شده کوتاه است؛ عملیات قرارداد در دو ردیف چهارستونه، اطلاعات قرارداد در دو ردیف دو ستونه و یادداشت‌ها با یک دکمهٔ کم‌ارتفاع نمایش داده می‌شود. روی موبایل گروه‌ها به دو ستون و سپس یک ستون برمی‌گردند. اولین قراردادِ فهرستِ فیلترشده به‌صورت پیش‌فرض انتخاب می‌شود؛ با تغییر فیلتر یا حذف انتخاب قبلی، پنل و همهٔ عملیات به نخستین قرارداد باقی‌مانده متصل می‌شوند. ۲۸ تست هدفمند، lint فایل‌های TypeScript، typecheck و build تولیدی Web موفق‌اند. Migration، API، دادهٔ عملیاتی و Runtime مشترک تغییر نکردند. Branch: `codex/pc-a-reservation-panel-horizontal-0916`.

## 2026-09-16 — PROCUREMENT-LIFECYCLE-ENTRY-0916 — PC-B — READY_FOR_REVIEW

تب‌های چرخهٔ پروندهٔ خرید اکنون با سوابق محلی واقعی‌نما قابل مشاهده و فرم عملیات آن‌ها قابل استفاده‌اند: استعلام، سفارش، رسید کالا، اصلاح رسید، پذیرش خدمت، مغایرت، مرجوعی، فاکتور و ارجاع مالی. ثبت/اصلاح فقط با نقش عملیاتی مجاز انجام می‌شود و هر تغییر به‌صورت نسخه یا اصلاح جبرانی حفظ می‌شود؛ برای کاربر فاقد مجوز، بخش خالی نمی‌ماند و نقش «کارشناس تأمین و سفارش» را مشخص می‌کند. شش پروندهٔ محلی بدون عنوان یا نشان آزمایشی، شامل دادهٔ مرحله‌ای در همهٔ تب‌ها، با ابزار `procurement:demo:apply` روی PostgreSQL localhost وارد شده‌اند. هیچ سفارش بیرونی، پرداخت یا سند حسابداری واقعی ایجاد نشده است. تست‌های هدفمند فرم، lint و typecheck Web، Prisma validate و اجرای/بازرسی ابزار دادهٔ محلی موفق‌اند. Branch: `codex/pc-b-procurement-lifecycle-entry`.

## 2026-09-16 — RESERVATION-TABLE-WINDOW-LAYOUT-0916 — PC-A — READY_FOR_REVIEW

پنل عملیات قرارداد در رزواسیون اکنون زیر بخش جدول قرار دارد و دکمه‌ها در دسکتاپ به‌صورت چهارستونه نمایش داده می‌شوند. صفحه‌بندی از فهرست حذف شد؛ تمام قراردادهای بازه در یک جدول اسکرول‌پذیر با ارتفاع نزدیک هفت ردیف قابل انتخاب‌اند. اگر کاربر بازهٔ تاریخ تعیین نکند، فهرست از تاریخ قرارداد فقط سه ماه تقویمی اخیر را نمایش می‌دهد؛ با انتخاب هر بازهٔ تاریخ، همان بازه بدون محدودیت پیش‌فرض اجرا می‌شود. ۲۱ تست هدفمند، lint، typecheck و build تولیدی Web موفق‌اند. Migration، دادهٔ عملیاتی و Runtime مشترک تغییری نکردند.

# وضعیت پروژه

## 2026-09-21 — LOGIN-BRAND-CLEANUP-RESTORE-0921 — PC-B — READY_FOR_REVIEW

ابر و نوشتهٔ `NOORA` که پس از ادغام‌های بعدی ناخواسته به صفحهٔ ورود برگشته بود، مطابق نسخهٔ تأییدشدهٔ PR #327 دوباره حذف می‌شود. تصویر هوانوردی ثابت باقی می‌ماند و Web/API محلی برای رفع خطای اتصال روی پورت‌های استاندارد پروژه اجرا خواهند شد.

پیاده‌سازی کامل است: سه فایل Login به نسخهٔ ثابت و بدون ابر بازگردانده شدند و ۲ تست مستقیم، typecheck و lint وب موفق‌اند.

## DOCUMENTS-003E — تم یکپارچه تقویم‌های اسناد — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-documents-calendar-theme` یک Variant بصری افزایشی
  برای DatePicker مشترک ساخته و آن را فقط روی سه تقویم Documents فعال کرده است: دو فیلتر
  بازه ثبت و تاریخ اعتبار فرم بارگذاری. ظاهر پیش‌فرض سایر ماژول‌ها تغییر نمی‌کند.
- تقویم اکنون با هویت آبی–فیروزه‌ای Rubi، Header گرادیانی، آیکن و Popover رنگی و وضعیت‌های
  واضح Hover، امروز و روز انتخاب‌شده نمایش داده می‌شود. رنگ‌های زمینه و متن از Tokenهای
  Theme استفاده می‌کنند و در حالت روشن و تیره هماهنگ می‌مانند.
- رفتار شمسی/میلادی، مقدار ISO و API قبلی حفظ شده است. تعویض تقویم، انتخاب روز و بستن با
  `Escape` در پیش‌نمایش واقعی مرورگر بررسی شد؛ lint، typecheck، هر ۵۷۰ تست Web و
  Production Build موفق‌اند.
- این Slice هیچ Backend، Database، Schema/Migration/Seed، Contract، Permission،
  Dependency/Lockfile یا داده کاربردی را تغییر نمی‌دهد. جزئیات در
  `docs/tasks/DOCUMENTS-003E-CALENDAR-THEME.md` ثبت شده است.

## B2B-BACKEND-ONLY-CONNECTIONS-001 — حذف نمایش مستقل ارتباطات CRM

- تب و پنل مستقل «ارتباطات CRM» از پرونده سازمان/آژانس حذف شد. ارتباط واقعی Backend، قرارداد و client آن حفظ شده و همان داده‌ها همچنان در KPIهای پرونده و نمای مالی مصرف می‌شوند.
- بدون Migration، تغییر Schema/API/Permission/Dependency یا دست‌کاری داده. ۱۳۰ تست Organizations، ۸ تست API، lint و typecheck وب و build تولیدی ۴۶ مسیر موفق‌اند. شاخه `codex/pc-b-b2b-backend-only-connections` برای Review به `develop` تحویل می‌شود؛ جزئیات در `docs/tasks/B2B-BACKEND-ONLY-CONNECTIONS-001.md` ثبت شده است.

## MASTER-013-AIRLINE-DESCRIPTION-0919 — PC-B — READY_FOR_REVIEW

- اشارهٔ Credential و اتصال Provider از توضیح کاتالوگ ایرلاین حذف شد؛ کدهای IATA/ICAO و سایر رفتارها بدون تغییر باقی ماندند. تست مستقیم کاتالوگ اضافه شد.

## 2026-09-19 — REPORTING-XLSX-COMPACT-LAYOUT-0919 — LOCAL_COMPLETE

خروجی Excel گزارش‌ها اکنون نام گزارش را در سطر ۱، زمان تولید را در سطر ۲، جدول
فیلترها را در سطرهای ۳ و ۴ و سرستون و دادهٔ گزارش را از سطر ۵ نمایش می‌دهد. نام
گزارش در عرض جدول merge شده، تمام مقدارها و عنوان‌ها وسط‌چین‌اند و Gridlineهای شیت
برای نمایش حرفه‌ای فایل پنهان شده‌اند. Schema/Migration، داده، Dashboard،
Dependency و Lockfile تغییر نکردند. تست هدفمند Export، lint و typecheck API موفق
بودند؛ build مستقل API هنگام استفادهٔ Runtime محلی از `dist` با `ENOTEMPTY` متوقف شد.
Runtime قبلی API علت نمایش قالب قبلی بود و با نسخهٔ جدید همین Worktree جایگزین شد؛
Web و API هر دو پاسخ HTTP ۲۰۰ می‌دهند. فایل‌های خروجی موجود immutable هستند و فقط
خروجی تازه با قالب جدید تولید می‌شود.

تکمیل جدید: عنوان اصلی گزارش در سطر اول Excel با فونت ۱۶ و به‌صورت مستقل از
عنوان جدول زمان تولید نمایش داده می‌شود.

رفع سازگاری Excel: خروجی دیگر از قابلیت Excel Table داخلی استفاده نمی‌کند تا
نام ستون‌های تکراری یا غیرسازگار باعث Repair شدن فایل نشوند. ظاهر سرستون‌ها و
داده‌ها، وسط‌چین‌شدن، Gridline مخفی و فونت ۱۶ عنوان گزارش حفظ شده‌اند. فایل تازه
با `openpyxl` بازخوانی شد و اندازهٔ عنوان ۱۶ و اندازهٔ عنوان زمان ۱۲ تأیید شد.
پردازش قدیمی API که یک build میانی با ارجاع نامعتبر به سبک Excel را در حافظه
داشت، متوقف و API با کامپایل کامل همین Worktree روی پورت ۴۰۰۰ جایگزین شد. خروجی
نمایندهٔ ۱۲ ستونی `paid_not_issued` نیز با سازندهٔ فعال بازخوانی و معتبر شد.

تکمیل بعدی همان قالب: زمان تولید دیگر متن UTC نیست. جدول «زمان تولید گزارش» عنوان
merged و دو ستون «تاریخ شمسی» و «ساعت خروجی گرفتن» دارد؛ تاریخ با تقویم فارسی و
زمان با منطقهٔ `Asia/Tehran` نمایش می‌یابد. جدول فیلترها به سطرهای ۵ و ۶ و دادهٔ
خروجی به سطر ۷ منتقل شد. ۲ تست Export، lint و typecheck API موفق‌اند؛ API و Web
پاسخ HTTP ۲۰۰ دارند.

## 2026-09-19 — REPORTING-PENDING-RESERVATION-COLUMN-SCOPE-0919 — LOCAL_COMPLETE

ستون و امکان مرتب‌سازی «اقدام رزرو در انتظار» اکنون تنها در گزارش عملیاتی
`paid_not_issued` دیده می‌شود؛ گزارش‌های فروش، مالی، CRM و تحلیلی آن را در نمای
نتیجه و خروجی دریافت نمی‌کنند. محاسبهٔ داخلی row برای سازگاری قرارداد موجود حفظ
شده است، اما در ستون‌های قابل‌نمایش یا قابل‌مرتب‌سازی افشا نمی‌شود. ۶ تست API و
۱۷ تست Web، lint و typecheck هر دو برنامه موفق‌اند؛ Schema/Migration، داده،
Dashboard، Dependency و Lockfile تغییری نکردند.

## 2026-09-19 — DASHBOARD-VISUAL-DETAILS-DRAWER-0919 — READY_FOR_REVIEW

جدول جزئیات دادهٔ نمودار به `<details>` بازشوندهٔ پیشین بازگشت. دکمهٔ پایین-راست `جزئیات نمودار` اکنون Drawer قابل‌دسترسی مشابه پنل تعریف KPI باز می‌کند و هدف، خروجی واقعی، قاعدهٔ نمایش، فیچرهای منبع و مجوز همان visual را می‌نمایاند؛ دکمهٔ گزارش مرتبط در footer Drawer فرم پیکربندی را بدون بستن Drawer باز می‌کند. ۱۶ تست Dashboard، lint، TypeScript و build تولیدی Web موفق‌اند؛ API و داده تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-KPI-SPARKLINE-SCALE-0919 — READY_FOR_REVIEW

نمودارهای روند کوچک KPI Cardها بزرگ‌تر و خواناتر شدند: canvas از `160×58` و `h-14` به `240×84` و `h-20` رسیده، تمام عرض Card را با `preserveAspectRatio=none` می‌گیرد و ضخامت خط از `2.5` به `3.25` افزایش یافته است؛ سایهٔ هر سری حفظ شد. ۱۶ تست Dashboard، lint، TypeScript و build تولیدی Web موفق‌اند؛ API و داده تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-VISUAL-DETAILS-CONTROLS-0919 — READY_FOR_REVIEW

کنترل تقویم محور X برای نگه‌داشتن «تاریخ شمسی/میلادی» در یک خط، عرض ثابت `8.5rem`، `shrink-0` و `whitespace-nowrap` دارد و گروه کنترل روند متناسب با آن فضا می‌گیرد. دکمهٔ پایین-راستِ `جزئیات نمودار` با وضعیت دسترس‌پذیر، خلاصه و جدول دادهٔ همان visual را باز و بسته می‌کند. ۱۶ تست Dashboard، lint، TypeScript و build تولیدی Web موفق‌اند؛ API و داده تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-RANGE-FILTER-RTL-0919 — READY_FOR_REVIEW

گزینه‌های بازشوندهٔ فیلتر بازهٔ زمانی Dashboard برای خوانایی RTL راست‌چین شدند: محتوا `dir=rtl` و aligned-to-end است و گزینه‌ها با `justify-end text-right` نمایش دارند. رنگ hover و رفتار فیلتر تغییر نکرده است. ۱۶ تست Dashboard، lint، TypeScript و build تولیدی Web موفق‌اند؛ API و داده تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-TREND-CONTROL-LAYOUT-0919 — READY_FOR_REVIEW

کنترل‌های سرستون نمودار روند اصلاح شدند: واحد پول با اندازهٔ پیشین در سمت راستِ تقویم محور زمان قرار می‌گیرد و هر دو زیر برچسب نوع نمودار، در یک ردیف ثابت و بدون wrap نمایش دارند. نمودارهای غیرروند همان انتخاب‌گر مستقل ارز را حفظ می‌کنند. ۱۶ تست Dashboard، lint، TypeScript و build تولیدی Web موفق‌اند؛ API و داده تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-VISUAL-CURRENCY-SELECTOR-0919 — READY_FOR_REVIEW

قرارداد عمومی Dashboard به‌صورت افزایشی `currencySeries` برای هر visual پولی
منتشر می‌کند. هر سری labels، values، comparison و trend همان ارز را جداگانه دارد
و هیچ جمع یا تبدیل FX در UI رخ نمی‌دهد. هر نمودار مبلغ‌محور در سربرگ خودش dropdown
واحد پول دارد؛ تغییر آن محلی است و فیلتر یا نمودارهای دیگر را تغییر نمی‌دهد. نمودار
شمارشی، صف اقدام و قیف تصمیم که مبلغی نشان نمی‌دهند selector ندارند. ۶ تست Reporting
و ۱۶ تست Dashboard، lint/typecheck API/Web و build تولیدی هر دو سرویس موفق‌اند؛ Web
روی ۳۰۰۰ و API روی ۴۰۰۰ پاسخ HTTP ۲۰۰ دارند. Migration، Schema، داده، Permission،
وابستگی و Lockfile تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-TREND-PLOT-BOUNDS-0919 — READY_FOR_REVIEW

هندسهٔ نمودارهای line Dashboard برای استفادهٔ بهتر از عرض card اصلاح شد: نقطهٔ شروع
plot به چپ منتقل شد و انتهای plot پیش از مرز SVG می‌ایستد. gutter مستقلِ اعداد y
حفظ شده، اما دیگر فضای چپ غیرضروری ندارد و آخرین label زمان مانند «شهریور 1405»
داخل کادر باقی می‌ماند. ۱۶ تست Dashboard، lint، typecheck و build تولیدی Web
موفق‌اند؛ Web روی ۳۰۰۰ و API روی ۴۰۰۰ پاسخ HTTP ۲۰۰ دارند. Migration، Schema،
داده، Permission، وابستگی و Lockfile تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-KPI-SEMANTIC-DELTA-0919 — READY_FOR_REVIEW

تگ تغییر KPI دیگر صرفاً بر اساس فلش بالا/پایین رنگ نمی‌گیرد؛ رنگ، اثر کسب‌وکاری
تغییر را بیان می‌کند. KPIهای کنترلی (`guardrail`) و شاخص‌های ماهیتاً زیان‌زا مانند
استرداد، لغو، تخفیف، هزینه، کمیسیون، تاخیر و بدهی، هنگام افزایش تگ قرمزِ واضح و
هنگام کاهش تگ سبز می‌گیرند. فلش جهت واقعی تغییر را نگه می‌دارد. KPIهای عادی برعکس
رفتار می‌کنند: افزایش سبز و کاهش قرمز. ۱۶ تست Dashboard، lint، typecheck و build
تولیدی Web موفق‌اند؛ Web روی ۳۰۰۰ و API روی ۴۰۰۰ پاسخ HTTP ۲۰۰ دارند. Migration،
Schema، داده، Permission، وابستگی و Lockfile تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-TREND-POINT-TOOLTIP-0919 — READY_FOR_REVIEW

Tooltip نقطه‌های نمودار روند فقط زمان همان bucket و مقدار همان نقطه را نمایش
می‌دهد. برای bucket ساعتی، تاریخ و ساعت در `Asia/Tehran` با هم می‌آیند؛ bucketهای
روز، هفته و ماه نیز به‌ترتیب با برچسب زمانی خوانای خودشان نمایش می‌یابند. برچسب خام
ISO و عبارت اضافی «بازه انتخاب‌شده» حذف شد. تقویم tooltip همان انتخاب شمسی/میلادی
نمودار است. ۱۶ تست Dashboard، lint، typecheck و build تولیدی Web موفق‌اند؛ Web روی
۳۰۰۰ و API روی ۴۰۰۰ پاسخ HTTP ۲۰۰ دارند. Migration، Schema، داده، Permission،
وابستگی و Lockfile تغییر نکرده‌اند.

## 2026-09-19 — DASHBOARD-TREND-TEXT-SUMMARY-0919 — READY_FOR_REVIEW

جدول بازشوندهٔ هر نمودار روند، دیگر timestamp خام منبع را نمایش نمی‌دهد. همان
منطق دانه‌بندی نمودار برای آن استفاده می‌شود: امروز ساعتی، هفته و ماه روزانه، فصل
هفتگی و سال ماهانه. عنوان خلاصه، نام ستون زمان و برچسب همهٔ ردیف‌ها با این grain
هماهنگ‌اند و انتخاب «تاریخ شمسی/تاریخ میلادی» نمودار، جدول را نیز با تقویم یکسان و
زمان `Asia/Tehran` قالب‌بندی می‌کند. Migration، Schema، داده، Permission، وابستگی
و Lockfile تغییر نکرده‌اند. ۱۶ تست Dashboard، lint، typecheck و build تولیدی Web
موفق‌اند؛ Web روی ۳۰۰۰ و API روی ۴۰۰۰ پاسخ HTTP ۲۰۰ دارند.

## 2026-09-19 — DASHBOARD-TREND-SPARKLINE-AXIS-0919 — READY_FOR_REVIEW

Sparklineهای KPI Card بدون marker نقطه‌ای، با خط و سایهٔ گرادیانی باقی مانده‌اند.
نشان تغییر KPI اکنون آیکون جهت و درصد خواناتر دارد: رشد سبز، افت قرمز و ثبات آبی؛
این نشان همچنان از بازهٔ هم‌طول قبل در Projection تأییدشده محاسبه می‌شود. نمودارهای
روند اصلی عنوان‌های محور را ندارند، gutter مقدار در چپِ canvas جدا شده و نمودار در
عرض کامل canvas رسم می‌شود. نمایش محور زمان برای امروز ساعتی، هفته/ماه روزانه، فصل
هفتگی و سال ماهانه است؛ testهای calendar فاصلهٔ واقعی هر bucket را تأیید می‌کنند.

۱۰ تست هدفمند API و ۱۶ تست Web، lint و typecheck API/Web و build تولیدی Web موفق
هستند. Migration، Schema، Permission، Dependency/Lockfile و داده‌های
دمو/عملیاتی تغییر نکرده‌اند. Web روی `localhost:3000` و API روی ۴۰۰۰ با پاسخ HTTP
۲۰۰ فعال‌اند.

## 2026-09-19 — SALES-CONTRACT-TABLE-0919 — LOCAL_COMPLETE

فهرست قراردادهای `/sales` به جدول فشرده‌تر و قابل اسکن بازطراحی شد: سرستون با کنتراست ملایم، ردیف‌های راه‌راه، شماره قرارداد برجسته، نام مشتری کنترل‌شده و ستون عملیات سه‌دکمه‌ای هم‌ردیف. پرداخت‌ها، PDF قرارداد و مدارک مسافر همان عملیات پیشین با مجوزها و مسیرهای قبلی‌اند. API، داده، مجوز، Migration و وابستگی تغییری نکردند. build بستهٔ Contracts، ۸ تست هدفمند Sales، lint سه فایل تغییرکرده، typecheck Web و build تولیدی Web موفق‌اند. شاخه: `codex/pc-a-sales-contract-table-0919`.

- 2026-09-16 Package Pricing commission follow-up: drafts/publications now support percent or fixed commission with an explicit currency. Fixed commission is deducted once from the matching currency profit bucket and never changes sale; historical rows default to percent. Additive migration was applied only to isolated `rubi_pricing_flow_0916`. Tour demo 1 published version 3 with fixed EUR 15 while tour demo 2 remains percent.

## 2026-09-16 — TOUR-HOTEL-PRICING-FLOW-0916 — MERGED WITH DEVELOP / VERIFIED LOCALLY

فرایند تور/نوبت بلیت ← بسته نرخ خرید هتل متصل به همان نوبت ← جدول خرید کل
اقامت و تعدیل درصدی/ثابت ← فروش پکیج چندارزی پیاده شد. هتل‌ها مستقل و جمع
مبلغ فقط بین ارزهای یکسان است؛ کمیسیون از سود همان ارز کسر می‌شود. ترکیب
اتاق خانوادگی در پیش‌نویس و انتشار ثبت می‌شود؛ اکسل و بنر طبق درخواست مؤجل‌اند.
با درخواست صریح مالک، `origin/develop@10851d1a` داخل شاخه Task ادغام شد. چهار
تعارض مرکزی با حفظ هر دو سمت حل شدند: Package Pricing و Reporting هر دو در
AppModule فعال‌اند، روابط هر دو دامنه در Prisma باقی مانده‌اند و تاریخچه هر دو
واحد در اسناد حفظ شده است. Prisma validate/generate، typecheck بسته‌های
Contracts/Database/API/Web، همه تست‌های API (۱۴۳۶ پاس، ۱۳۵ skip)، همه تست‌های
Web (۱۴۷۷ پاس)، lint کامل API/Web و build تولیدی هر دو برنامه با ۴۸ route موفق‌اند.

در دیتابیس کپی `rubi_pricing_flow_0916` مجوزهای محلی Seed شد و دو تور آینده با
چهار پرواز، پرداخت کامل مالی، دو هتل EUR/IRR، دو نسخه پیش‌نویس و دو نسخه انتشار
برای هر تور با maker/checker واقعی تست شدند. دیتابیس عملیاتی دست‌نخورده است. شاخه
محلی می‌ماند چون origin عمومی است و هیچ Push عمومی انجام نشده است.

## 2026-09-16 — HOTEL-RATE-PACKS-0915 — PC-A — PER-HOTEL CURRENCY READY FOR REVIEW

در جدول نرخ خرید گروهی هتل، هر ردیف هتل اکنون ستون و انتخاب‌گر ارز مستقل
`EUR`، `USD` یا `IRR` دارد؛ مبلغ پایه و محاسبهٔ تمام رده‌های اتاق با ارز همان
ردیف نمایش و ذخیره می‌شود. Migration افزایشی `currency` را به ردیف‌های نرخ
افزود و نرخ‌های تاریخی را از ارز بستهٔ خود مقداردهی کرد؛ درخواست‌های کلاینت
قدیمی نیز به‌صورت سازگار همان ارز پیش‌فرض بسته را برای هر ردیف دریافت می‌کنند.
Prisma generate، typecheck API/Web، build تولیدی API/Web و health API4200
موفق‌اند؛ Web3200 و API4200 با نسخهٔ تازه اجرا شده‌اند. کنترل دیداریِ مرورگر
به‌دلیل خطای sandbox ابزار در دست مالک محصول است. Web3100، Sales و Package
Pricing تغییر داده نشدند.

## 2026-09-15 — HOTEL-RATE-PACKS-0915 — PC-A — ISOLATED 3200 IMPLEMENTED / REVIEW PENDING

صفحهٔ `/reservations/hotel-rates` روی شاخهٔ مستقل
`codex/pc-a-hotel-rate-packs-0915` به جریان شهر ← بازهٔ اقامت ← تیک هتل‌های
فعال و قابل‌فروش همان شهر ← ویرایش کارگزار، پایه و ضرایب تبدیل شد. بسته‌های
ثبت‌شده ردیف جدا در جدول شهر/تاریخ/تعداد شب/هتل/نسخه دارند و با بازکردن ردیف، نسخهٔ
جدید همان بسته ثبت می‌شود. Batch و ردیف قدیمی immutable می‌مانند. Migration
افزایشی فقط روی PostgreSQL آزمایشی Web3200/API4200 اعمال شد؛ Web3100،
دیتابیس عملیاتی، Sales/Package Pricing و `develop/main` تغییر نکردند. دسترس‌پذیری
شبانهٔ واقعی منبع ندارد؛ تیک، تأیید اپراتور برای همان بازه است و API مرجع
active/saleable/city را بازبینی می‌کند. جزئیات و QA در
`docs/tasks/HOTEL-RATE-PACKS-0915.md`.
Prisma schema معتبر و client تولید شد؛ ۱۹ تست API و ۴ تست Web، lint هدفمند و
build تولیدی هر دو برنامه پاس شدند. بستهٔ synthetic تهران برای ۲۰۲۷-۰۲-۰۱ تا
۲۰۲۷-۰۲-۰۶ ساخته/باز شد و نرخ ۱۰۰ به ۱۱۰ در نسخهٔ ۲ رسید. API4200/Web3200
و login/detail دوباره پاسخ ۲۰۰ دارند. قفل‌های Migration و اسناد این کار آزادند؛
انتقال به ۳۱۰۰ و ادغام به Review و تصمیم مالک محصول وابسته است.
پیگیری UX گزارش‌شده نیز در همان PR #293 انجام شد: دکمهٔ «بستهٔ جدید» قبلاً فقط
فرم همیشه‌نمایان را پاک می‌کرد و وقتی خالی بود بی‌اثر به‌نظر می‌رسید؛ اکنون
یک ردیف پیش‌نویس ثبت‌نشده و جدول ویرایش را باز می‌کند و جست‌وجوی شهر را فوکوس
می‌دهد. فهرست بسته‌ها و شهر/بازه هم جدولی شدند؛ نرخ‌های هتل همان جدول انتخاب/ویرایش
هستند. ۶ تست Web، typecheck، lint و build ۴۸مسیره موفق‌اند؛ Web3200/API4200
پاسخ ۲۰۰ دارند. آزمون کلیک در مرورگر واردشدهٔ Codex به دلیل محدودیت مهارت
Computer Use به تأیید بصری مالک محصول واگذار است؛ ۳۱۰۰ و Sales تغییر نکردند.

## 2026-09-15 — PACKAGE-PRICING-001 Finance ticket bridge and tour publications (isolated 3200)

The owner-approved `origin/develop` merge was committed on the PC-A task
branch only; PR #278 still targets `develop` and is not merged. A real Ticket
offer now creates an amount-free, FK-linked Procurement purchase request;
Finance records immutable adult/child purchase-cost revisions, invoice and
payment evidence directly. Only a fully PAID cost is exposed through Finance's
public projection to Sales; a partial payment or a legacy catalog estimate is
not treated as confirmed. `/sales/pricing` reads the same tour, Reservations'
hotel purchase batch and Finance paid flight rates, saves versioned drafts by
tour/batch and publishes 18 independent hotel/room prices in the synthetic
three-hotel example after maker/checker and currency/capacity/source recheck.
The known occupancy codes have final package sale and net profit after
commission; family remains hotel-only until occupancy is defined. A new
synthetic offer produced a NEW Finance request without amount, a full synthetic
Finance payment released its cost, draft version 1→2 reopened, self-publication
returned 403, and a second synthetic reviewer published version 1. Two
additive migrations succeeded in a fresh 67-migration isolated PG rehearsal
and on the separate 3200 preview DB. Web3200/API4200 responded 200;
Web3100, shared data, `develop` and `main` remain untouched. Browser visual QA
was unavailable due the Windows sandbox ACL helper; component/API tests and
production builds are the available evidence. Cross-currency FX, Sales
contract quote selection and unknown family occupancy remain follow-ups.

Final isolated smoke after rebuilt Web3200/API4200: 200 login/health,
67/67 migrations up to date, one saved publication with 18 room prices,
the same offer ID on an idempotent retry, and the original Web3100 listener
unchanged. API/Web lint, typecheck, focused tests and production builds pass.
Scoped implementation commit `e9f91e6f` released the reserved PC-A migration,
central-doc and shared-contract locks; PR #278 remains a draft review, unmerged.

The older preview-only entry below records the earlier stage, not the current
publication status.

## 2026-09-15 — PACKAGE-PRICING-001 tour-cost Sales preview (not published)

The /sales/pricing page is now a real Sales sidebar child and tour-cost
workspace instead of the old mostly-empty tab layout. It reads existing tour
departures through Ticket Catalog's public service and hotel broker purchase
rates through Reservations' public projection, scoped to branch/date/hotel.
Separate hotel/room stay-sale previews respond to fixed/percent increase or
decrease; commission is a net-margin expense, not a sale uplift. The isolated
Web3200/API4200/PostgreSQL demo has one synthetic five-night tour and three
hotel rates; authenticated tour/cost endpoints returned 200. Web3100 and
operational data were not changed. Publication/durable Sales drafts remain
incomplete: the owner requires Ticket-definition purchase requests priced and
paid by Finance, but current TicketPublishedOffer has no purchase fare and
Finance inbox has no pre-sale Ticket source. Package price publication stays
disabled instead of inventing a flight cost or net profit. Browser visual QA
was unavailable because its sandbox helper failed; API/live route, component
tests and builds are the available checks. See docs/tasks/PACKAGE-PRICING-001.md
and ADR-PACKAGE-FLIGHT-FINANCE-COST-0915.

## 2026-09-15 — PACKAGE-PRICING-001 — PC-A — ISOLATED WEB3200 PREVIEW

- گزارش کاربر از نبود بخش مدیریت قیمت در UI درست بود: route /sales/pricing وجود داشت اما داشبورد Sales هیچ ورودی نمایانی به آن نداشت. CTA «مدیریت قیمت و پکیج‌ها» به سرصفحه قراردادها افزوده شد؛ ساختار ۱۷ آیتم منوی اصلی حفظ شد.
- نسخه جدید Web3200 build شد: ۹ تست Sales/Pricing، lint و typecheck موفق؛ با session واقعی آزمایشی، داشبورد Sales و صفحه Pricing هر دو ۲۰۰ هستند و href دکمه در HTML زنده دیده می‌شود. بازبینی بصری در مرورگر همچنان با مالک محصول است.
- Web3200 به API4200 و PostgreSQL آزمایشی مستقل متصل است؛ Web3100/API مشترک و داده عملیاتی دست‌نخورده‌اند.
- تداخل route بازه نرخ هتل با wildcard اطلاعات پایه رفع شد. شهر تهران و سه هتل synthetic در Grid قابل دریافت‌اند؛ بازه پنج‌شبه با دو هتل منتخب ذخیره و از نسخه ۱ به ۲ ویرایش شد و نرخ اصلاح‌شده ۱۳۰ بازخوانی شد.
- مسیر صفحه و login در Web3200 و health API4200 پاسخ ۲۰۰ می‌دهند. تأیید بصری مرورگر از داخل ابزار به علت reset مکرر آن ممکن نشد؛ بازبینی ظاهر و تصمیم انتقال به 3100 با مالک محصول است.

## 2026-09-14 — PACKAGE-PRICING-001 — PC-A — IMPLEMENTED / PARTIAL UPSTREAM BLOCKED

- زیر‌بخش `/sales/pricing` بدون آیتم مستقل منوی اصلی به Sales افزوده شد. Preview و قیمت‌های synthetic قبلی حذف شدند و UI هشت‌برگه از API واقعی، branch scope و permissionهای مستقل استفاده می‌کند.
- قرارداد نسخه‌دار، ۱۳ مدل Package Pricing، Migration افزایشی، موتور Decimal، نسخه قیمت immutable، maker/checker، quote، render request واقعی با `AWAITING_RENDERER`، توقف فروش، قالب نسخه‌دار و Audit پیاده‌سازی شده‌اند.
- Follow-up قیمت هتل تکمیل شد: در `/master-data/accommodation/hotel-rates` شهر و بازه اقامت انتخاب می‌شود، شب‌ها محاسبه و همه هتل‌های فعال همان شهر در Grid اکسل‌مانند با تیک حضور در تور، مبلغ پایه و ضرایب قابل ویرایش نمایش داده می‌شوند. هر Save یک نسخه immutable می‌سازد و بازه بعداً قابل بازکردن و اصلاح است.
- Public Contract نسخه‌دار نرخ پایه هتل از Master Data به Package Pricing متصل شد؛ مبلغ و ضرایب snapshot می‌شوند و reference قدیمی یا خارج از شعبه fail-closed است. blocker هتل رفع شد، اما تولید Price Version ترکیبی همچنان تا producer نرخ/ظرفیت بلیت در Ticket Catalog fail-closed است؛ Renderer نیز در `AWAITING_RENDERER` می‌ماند.
- جزئیات، endpointها، validation و handoff در [PACKAGE-PRICING-001](tasks/PACKAGE-PRICING-001.md) ثبت شده است.

## 2026-09-16 — اتصال‌های عملیاتی غیررزرواسیونی خرید — PC-B — READY_FOR_REVIEW

Procurement اکنون سیاست تأیید نسخه‌دار Settings، projection پایدار وظایف، کارتابل Finance برای تأیید/برگشت/پرداخت مرحله‌ای فاکتور و اصلاح مالی مرجوعی را دارد. سفارش صادرشده در outbox امن تأمین‌کننده با HMAC، idempotency، replay guard و retry ثبت می‌شود و تا هنگام معرفی URL و Secret بیرونی، ارسال واقعی ندارد. اتصال Reservations بنا به درخواست مالک خارج از این واحد کار است. Migration افزایشی policy، task، revision مالی و inbox تأمین‌کننده را ایجاد می‌کند و جدول قدیمی حساب تسویه را به‌صورت idempotent جبران می‌کند. ۳۰ تست یکپارچه Procurement، ۲۱ تست API هدفمند، Prisma validate/generate، lint/typecheck و build Contracts/Database/API موفق بوده‌اند. Migration روی runtime محلی نیز با backup پیشین با موفقیت اعمال شد. Branch: `codex/pc-b-procurement-live-integration`.

## 2026-09-16 — RESERVATION-SECTION-EDIT-AGE-BANDS-0916 — PC-A — READY_FOR_REVIEW

پنجره «ویرایش» رزواسیون اکنون در تب‌های طرف قرارداد، پرواز، هتل، سایر و مسافران ورودی‌های قابل‌ویرایش همان بخش را نشان می‌دهد و هر ثبت یک نسخهٔ مستقل از فرم رزواسیون می‌سازد. تب هتل تاریخ ورود/خروج، مشخصات هتل، سرویس، نوع اتاق و تعداد اتاق‌ها را ویرایش می‌کند. در تب مسافران، ردهٔ بلیط ADL/CHD/INF از ردهٔ کودک هتل جداست؛ برای هر کودک انتخاب‌شده تعیین «۲ تا ۶» یا «۶ تا ۱۲» اجباری است و همین مقدار در PDF ارسالی کارگزار و خروجی قرارداد چاپ می‌شود. مشاهدهٔ قرارداد در رزواسیون اکنون همان خروجی HTML فروش را نمایش می‌دهد و امکان چاپ یا ذخیره PDF دارد؛ بنابراین اختلال موتور PDF سروری مانع مشاهدهٔ قرارداد نیست.

فیلد نام طرف قرارداد برای سازگاری با اصلاحات قدیمی اختیاری نگه داشته شد. typecheck بسته‌های Contracts/API/Web، lint فایل‌های متاثر، ۶ تست API و ۱۸ تست Web قابلیت اصلی، ۱۶ تست هدفمند خروجی قرارداد و build تولیدی API/Web موفق‌اند. Migration، Seed، دادهٔ عملیاتی و Runtime مشترک تغییر نکرد. Branch: `codex/pc-a-reservation-section-edit-age-bands-0916`.

## 2026-09-15 — FINANCE-INBOX-TICKET-BRANDING-0915 — PC-A — READY_FOR_REVIEW

کارتابل درخواست‌های مالی نسخهٔ ۳۲۰۰ با کامپوننت موجود در آخرین `origin/develop@f5c1a159` یکسان است و مسیر `/finance/requests` در build وب ۳۱۰۰ موجود است؛ هر دو پورت قبل از ورود به `/login` هدایت می‌شوند. در این واحد کار هیچ کدی از کارتابل، ناوبری، سرور ۳۲۰۰ یا بخش‌های دیگر تغییر نکرد.

فقط PDF بلیط اصلاح شد: لوگوی نیایش در سربرگ بلیط خودِ شرکت بزرگ‌تر است و لوگوی ثبت‌شدهٔ هواپیمایی با تفاوت فاصله و نوشتار نام در قرارداد/اطلاعات پایه نیز پیدا می‌شود. اگر برای ایرلاین لوگویی در اطلاعات پایه ثبت نشده باشد، نام ایرلاین نمایش داده می‌شود؛ لوگوی ساختگی استفاده نمی‌شود. ۱۱ تست هدفمند Web، lint فایل‌های متاثر، typecheck کل Web و build Web/Contracts موفق‌اند. یک PDF نمونهٔ A4 با Chrome ساخته، با Poppler رندر و از نظر برش‌نخوردن متن/لوگو بررسی شد. Migration، تغییر دادهٔ عملیاتی یا تغییر مستقیم develop انجام نشد. Branch: `codex/pc-a-finance-inbox-brand-0915`.

## 2026-09-14 — RESERVATION-TICKET-PDF-PASSENGER-0914 — PC-A — READY_FOR_REVIEW

نام مسافر در درخواست‌های تازه Sales داخل Snapshot نسخه‌دار Reservations حفظ می‌شود. برای قراردادهای قدیمی مانند `SC-2026-000003` که نام در Snapshot جا افتاده، پنجره بلیط و PDF نام را از پرونده اصلی مسافر می‌خوانند، بدون بازنویسی Snapshot یا سند تاریخی. موتور PDF مسیر Chrome یا Edge و فونت نازنین محلی را خودکار پیدا می‌کند و نبود فونت سفارشی مانع صدور نیست. ۴ تست API، ۱۸ تست Web، lint/typecheck/build API/Web و ساخت واقعی PDF با Chrome نصب‌شده موفق‌اند. جزئیات در [RESERVATION-TICKET-PDF-PASSENGER-0914](tasks/RESERVATION-TICKET-PDF-PASSENGER-0914.md) ثبت شده است.

## 2026-09-15 — PC-C Dashboard/Reports + PC-A/PC-B develop integration

شاخهٔ `codex/pc-c-dashboard-reporting-integration-0915` نسخهٔ ثبت‌شدهٔ Dashboard/Reports را با `origin/develop@ff15c7d3` ترکیب می‌کند. هر دو ماژول API Reporting و Procurement در AppModule حفظ شده‌اند، رابطه‌های Prisma افزایشی‌اند و ارجاع‌های Reporting به نام جدید `@nora/database` هماهنگ شده‌اند. دادهٔ نمونه و artifactهای محلی وارد Git نشده‌اند؛ Worktree اجرایی `dashboard-reporting-latest` و سرویس ۳۰۰۰ تغییر نکرده‌اند.

Prisma validate، typecheck و build بسته‌های مشترک/API/Web، lint محدودهٔ Dashboard/Reports و ۲۶ تست API + ۶۶ تست Web موفق‌اند. Branchهای جدیدتر PC-A Manifest و PC-B Procurement هنوز مستقل از develop هستند و ادغام خودکار آن‌ها در این واحد کار انجام نمی‌شود. انتشار نهایی از مسیر PR به develop و CI پیگیری می‌شود.

احراز هویت Git روی PC-C برقرار شد و شاخه به `origin` پوش شد. PR شمارهٔ 289 برای ادغام در `develop` باز است؛ مرج نهایی تابع بررسی وضعیت CI و قابلیت مرج است.

## REPORTING-AUTHENTICATED-RUNTIME-REPAIR — 2026-09-15

- ریشهٔ مشترک HTTP 500 در Dashboard/Reports/Favorites: جدول `b2b_organization_users` در دیتابیس محلی موجود نبود. Interceptor سراسری B2B تمام درخواست‌های دارای Actor را پیش از Controller با Prisma P2021 متوقف می‌کرد. Health عمومی و تست مستقیم Repository این مسیر را پوشش نمی‌دهند.
- پس از بکاپ محلی، Migration افزایشی موجود `20260910100000_b2b_organization_users` اجرا و با Prisma به‌عنوان applied ثبت شد. هیچ قاعدهٔ احراز هویت یا مرز دسترسی B2B حذف نشد.
- اعتبارسنجی روی API واقعی پورت ۴۰۰۰ با ورود حساب موقت: ۱۱ KPI و ۱۰ نمودار دارای منبع نمونه، ۱۲ گزارش متصل، ذخیرهٔ فیلتر، افزودن/خواندن/حذف علاقه‌مندی، شمارنده‌ها و دانلود فایل موفق‌اند. فایل XLSX باز و ساختار worksheet بررسی شد؛ CSV محتوای گزارش و Filter Snapshot دارد. PDF فعلی فقط خلاصهٔ محدود دارد.
- حساب، نقش و خروجی‌های تست پاک شدند؛ دادهٔ نمونهٔ اصلی حفظ و در Git ثبت نشد. برای پذیرش Runtime، تست HTTP احرازشده لازم است؛ Health 200 به‌تنهایی کافی نیست.

## REPORTING-CATEGORY-FILTER-RTL-ICON — 2026-09-15

- گزینه‌های فیلتر دسته‌بندی در کاتالوگ گزارش‌ها اکنون متن راست‌چین و آیکون تک‌رنگ همان دسته را در سمت راست متن دارند؛ گزینهٔ «همه دسته‌ها» نیز آیکون عمومی تک‌رنگ دارد.
- تغییر فقط در Frontend همین Worktree یکپارچه انجام شد. تست جدید، Web TypeScript و lint موفق‌اند؛ یک تست قدیمی مرتبط با نمایش کد `RPT-001` در کل مجموعهٔ کامپوننت همچنان با نسخهٔ فعلی کاتالوگ ناسازگار است.

## DASHBOARD-REPORTING-DEMO-PROJECTION-REPAIR — 2026-09-15

- علت خطای Dashboard: تاریخ ISO بازه پیش‌فرض دوباره با `T00:00...Z` ترکیب و
  `RangeError` در API ایجاد می‌شد. تاریخ اصلاح و اعتبارسنجی بازه اضافه شد.
- ۱۸۰ fact محلی بررسی شد: در ۳۱ روز اخیر ۵۵ fact IRR با فروش 873432000 و
  ۶ fact USD با فروش 81968000؛ جمع این دو ارز نمایش داده نمی‌شود.
- Projection حالا فقط شناسه‌های دارای محاسبهٔ مشخص سفر را پاسخ می‌دهد؛ نبود
  Producer برای شاخص غیرسفری و گزارش چک/HR/دفتر/SLA به عدد فرضی تبدیل نمی‌شود.
- API اصلاح‌شده روی ۴۰۰۰ و Web Worktree یکپارچه روی ۳۰۰۰ فعال‌اند. مشاهدهٔ UI
  احرازشده در این نشست قابل انجام نبود و باید در نشست کاربر تأیید شود.

## DASHBOARD-REPORTING-LATEST-009 — نسخه یکپارچه Dashboard و Reports

آخرین نسخه Reports تا `9d8d985f` و Dashboard تا `af6de805` روی شاخه مستقل
`codex/pc-c-dashboard-reporting-latest` ترکیب شدند. route `/dashboard` به Workspace
نهایی متصل است و `/reports` آخرین کاتالوگ و فرم‌های گزارش را حفظ می‌کند. ۵۶ تست،
lint، typecheck و build تولیدی ۴۶ route پاس شدند. جزئیات در
[DASHBOARD-REPORTING-LATEST-009](tasks/DASHBOARD-REPORTING-LATEST-009.md) ثبت شده است.

## REPORTING-REMOVE-SCHEDULING — حذف قابلیت زمان‌بندی گزارش

- تب و صفحه «زمان‌بندی‌ها» و دکمه/فرم «زمان‌بندی گزارش» از Workspace گزارش‌ها حذف
  شدند؛ navigation، شمارنده‌ها و client وب نیز دیگر این قابلیت را ارائه نمی‌کنند.
- Endpointها، DTO، قرارداد، policy، service و queryهای repository اختصاصی
  زمان‌بندی از API Reports حذف شدند. جدول و Migration تاریخی برای جلوگیری از حذف
  داده دست‌نخورده باقی مانده‌اند و دیگر از مسیر عمومی Reports قابل دسترسی نیستند.
- بدون تغییر Dependency/Lockfile، Seed، داده عملیاتی، IAM یا ماژول‌های دیگر.
- ۳۶ تست Web و ۲۲ تست API، lint، TypeScript و build هر دو سمت موفق‌اند؛ Web و API
  روی پورت‌های ۳۰۰۰ و ۴۰۰۰ پاسخ ۲۰۰ و مسیر حذف‌شده زمان‌بندی پاسخ ۴۰۴ می‌دهد.

## REPORTING-REMOVE-FAVORITES-UI — ساده‌سازی کاتالوگ و گزارش‌های من

- آیکن ستاره و رفتار Favorite موقت از تمام کارت‌های کاتالوگ حذف شد.
- کنترل‌های «همه گزارش‌های من» و «محبوب‌ها» نیز از صفحه گزارش‌های من حذف شدند؛
  جدول اصلی گزارش‌های ذخیره‌شده مستقیماً نمایش داده می‌شود.
- API، Schema/Migration، Seed/Data و مجوزها تغییر نکردند. ۱۴ تست هدفمند، lint و
  TypeScript وب موفق‌اند و Frontend همین Worktree روی `localhost:3000` فعال است.
- جزئیات در [گزارش واحد کار](tasks/REPORTING-REMOVE-FAVORITES-UI.md) ثبت شده است.

## REPORTING-OPERATIONS-STAY-IN-VIEW — حفظ نمای عملیاتی هنگام اجرا

- دکمه اجرا در «گزارش‌های من»، «اشتراک‌گذاری‌شده با من»، «اجراها» و
  «زمان‌بندی‌ها» اکنون فرم پیکربندی و Filter Snapshot همان ردیف را بدون تغییر
  نمای فعال باز می‌کند؛ زیرنمای محبوب‌ها نیز حفظ می‌شود.
- Dialog پیکربندی در سطح Workspace رندر می‌شود، بنابراین جدول همان بخش پشت فرم
  باقی می‌ماند و بستن فرم کاربر را به کاتالوگ منتقل نمی‌کند. API، داده، مجوز و
  Schema/Migration تغییر نکرد.
- 15 تست هدفمند، TypeScript، lint محدوده و بررسی Git موفق‌اند. Build پس از Compile
  و TypeScript روی prerender دو مسیر نامرتبط `/_global-error` و
  `/pricing-management` با Invariant داخلی Next.js متوقف می‌شود. جزئیات در
  [گزارش واحد کار](tasks/REPORTING-OPERATIONS-STAY-IN-VIEW.md) ثبت شده است.

## REPORTING-CATALOG-MANAGEMENT-DECISIONS — بازبینی تصمیم‌محور کاتالوگ

- مدل واقعی CRM دوباره بررسی و پنج گزارش مدیریتی برای تعهد سفرهای پیش‌رو، سررسید
  پرداخت مشتریان، گلوگاه زمان چرخه رزرواسیون، حذف مالی از فهرست مسافران و رشد سبد
  مشتری با کدهای `RPT-032` تا `RPT-036` به کاتالوگ اضافه شد.
- عنوان کارت‌های مبهم به پرسش‌های روشن کسب‌وکاری تبدیل و گزارش دسته «اطلاعات پایه»
  حذف شد. گزارش‌های جدید تا انتشار Projection/Endpoint مالک دامنه صادقانه «در انتظار
  منبع داده» هستند؛ Schema/Migration/Seed، داده، API و مجوز تغییر نکرد.
- آزمون هدفمند 10/10، TypeScript و lint محدوده موفق‌اند. دو Suite تاریخی Reports
  همچنان مشکل Parser JSX دارند و Build پس از Compile/TypeScript روی prerender دو
  مسیر نامرتبط `/_global-error` و `/pricing-management` با Invariant داخلی Next.js
  متوقف می‌شود. جزئیات در
  [گزارش واحد کار](tasks/REPORTING-CATALOG-MANAGEMENT-DECISIONS.md) ثبت شده است.

## REPORTING-OPERATIONS-CONFIG-LAUNCH — بازیابی فرم و فیلتر از عملیات

- Deep Link دکمه «اجرا» در گزارش‌های من، اشتراک‌گذاری‌شده، اجراها و زمان‌بندی‌ها
  اکنون Workspace را با گزارش انتخاب‌شده و Filter Snapshot همان ردیف remount می‌کند؛
  در نتیجه فرم پیکربندی به‌جای کاتالوگ خالی باز می‌شود.
- تاریخ، شرکت، ارز و فیلترهای غیرهویتی از URL و فیلترهای هویت‌دار از Session Storage
  بازیابی می‌شوند. هیچ API، Schema/Migration/Seed، داده یا مجوزی تغییر نکرد.
- ۳۶ تست هدفمند Reports، lint محدوده، typecheck وب و build تولیدی ۴۶ مسیر Web
  موفق شدند.
- جزئیات فنی در
  [گزارش واحد کار](tasks/REPORTING-OPERATIONS-CONFIG-LAUNCH.md) ثبت شده است.

## REPORTING-CATALOG-FEATURE-COVERAGE — توسعه کاتالوگ بر مبنای مدل واقعی

- ساختار Prisma و فیچرهای فعلی Sales، B2B، Ticket Catalog، Reservations، Finance،
  Customer Affairs، Customers، Documents، HR، Workbench و Master Data بررسی شد.
- ۱۳ گزارش کاربردی جدید با کدهای پایدار `RPT-020` تا `RPT-032`، عنوان پرسشی،
  خروجی رسمی، Grain، Dimensions، Measures، فیلتر، Drill-down و Permission به
  کاتالوگ اضافه شدند؛ تعداد کل گزارش‌ها اکنون ۳۲ است.
- چون Public Projection و Endpoint اجرایی این ۱۳ گزارش هنوز توسط مالکان دامنه
  ارائه نشده، وضعیت آن‌ها صادقانه «در انتظار منبع داده» است. Schema، Migration،
  Seed، API، داده عملیاتی و مجوزها تغییر نکردند.
- ۲۲ تست هدفمند Reports، lint فایل‌های تغییرکرده، typecheck وب، build قراردادها و
  build تولیدی ۴۶ مسیر Web موفق شدند.
- جزئیات نگاشت مدل‌ها و مسیر اجرایی‌کردن در
  [گزارش واحد کار](tasks/REPORTING-CATALOG-FEATURE-COVERAGE.md) ثبت شده است.

## REPORTING-RESTORE-219-LATEST — بازیابی نسخه نهایی Reports روی مبنای جدید

- آخرین `origin/develop` در `40d8f1f4` دریافت شد و UI اختصاصی Reports فقط از
  snapshot نهایی `219091bf` بازیابی شد؛ تغییرات بعدی Reports وارد نسخه فعال نشدند.
- تمام تغییرات یکپارچه همکاران در مبنای develop حفظ شده‌اند. فایل‌های مشترک، API،
  Prisma schema، migration، seed و داده محلی تغییر نکردند.
- typecheck و production build وب موفق، lint محدوده Reports بدون خطا و ۱۰ تست سالم
  مدل/client موفق‌اند. دو suite تاریخی مبتنی بر JSX به‌علت ناسازگاری parser فعلی
  Vitest با syntax همان snapshot collect نمی‌شوند و برای حفظ نسخه مرجع اصلاح نشدند.
- Runtime وب این شاخه روی پورت 3000 و API موجود بدون restart روی پورت 4000 ارائه
  می‌شود. جزئیات در `docs/tasks/REPORTING-RESTORE-219-LATEST.md` ثبت شده است.

## 2026-09-15 — RESERVATION-PURCHASE-LAYOUT-0915 — PC-A — IN REVIEW

فرم خرید رزرواسیون برای هتل و ترانسفر کارگزار چیدمان جدا و واکنش‌گرا دارد. قیمت هتل به انتخاب کاربر به‌صورت هر شب یا جمع کل وارد می‌شود؛ حالت هر شب با تعداد شب‌های آخرین فرم ارسال‌شده به کارگزار به جمع خرید تبدیل و همان مبلغ به مالی ارسال می‌شود. خرید بلیط در این فرم درخواست نمی‌شود و شرط تحویل مدارک مالی فقط خریدهای هتل/ترانسفر همین مسیر را بررسی می‌کند. قیمت خرید بلیط هنگام تعریف آن در مسیر مستقل Ticket Catalog/Procurement با PR #282 وارد develop شده. ۴ تست هدفمند Web، ۶ تست هدفمند API، lint/typecheck و build تولیدی هر دو برنامه با ۴۶ مسیر وب موفق‌اند. بدون Schema/Migration، داده عملیاتی، Permission یا Dependency؛ گزارش بررسی در [RESERVATION-PURCHASE-LAYOUT-0915](tasks/RESERVATION-PURCHASE-LAYOUT-0915.md).

## 2026-09-14 — TICKET-REPEAT-PURCHASE-0914 — آماده بازبینی

فرم تعریف بلیط اکنون «تاریخ اولین بلیط» را مستقل از ساعت حرکت می‌گیرد. تکرار هفتگی یا ماهانه بر پایه همین تاریخ انجام می‌شود و بلیط قدیمی بدون ساعت دیگر با خطای «زمان حرکت بلیط مبدأ معتبر نیست» متوقف نمی‌شود. برای رفت‌وبرگشت، تاریخ اولین اجرای هر جهت جداگانه قابل انتخاب است.

قیمت خرید مثبت تعریف بلیط با مبلغ Decimal، ارز، تأمین‌کننده و تاریخ خدمت در مالکیت Procurement ثبت می‌شود، تا پیش از رسیدگی مالی قابل اصلاح است و در کارتابل Finance نمایش داده می‌شود. Migration افزایشی است و داده قدیمی را تغییر نمی‌دهد. ۱۹ تست Web، ۸ تست API، lint، typecheck و build API/Web و اعتبارسنجی Prisma موفق‌اند. جزئیات در [TICKET-REPEAT-PURCHASE-0914](tasks/TICKET-REPEAT-PURCHASE-0914.md) ثبت شده است.

## MASTER-012-AIRLINE-BAGGAGE-FORM — PC-B — READY_FOR_REVIEW

- پیگیری 2026-09-15: عنوان فارسی قواعد بار حذف و نام داخلی سازگار با Backend خودکار و انگلیسی شد؛ تست فرم و Fixture هم به‌روز شدند.
- در فرم ایرلاین مدیریت مستقیم قواعد بار برای بزرگسال/کودک/نوزاد، کلاس پروازی و دامنه مسیر اضافه و زیرناوبری قواعد بار حذف شد. مدل و FKهای موجود، API و مصرف‌کنندگان بدون تغییر ماندند. ۲۴ تست هدفمند، lint، typecheck و build ۴۶مسیره Web موفق‌اند. جزئیات در `docs/tasks/MASTER-012-AIRLINE-BAGGAGE-FORM.md`.

## 2026-09-14 — PROFILE-PLACEHOLDER-AVATAR-001 — PC-B — VERIFIED

در منوی پروفایل، حالت‌های «در حال دریافت اطلاعات» و «کارمند سامانه» دیگر به حروف مخفف داخل آواتار تبدیل نمی‌شوند؛ متن کامل کنار یک دایره ساده با رنگ سالید نمایش داده می‌شود و نام واقعی کاربر پس از دریافت نشست همچنان initials خودش را دارد. دو narrowing فقط‌نوعی برای خروجی تازه‌مرج‌شده رزرواسیون، build دقیق `develop` را بدون تغییر رفتار بازیابی کرد. ۹ تست هدفمند، lint، typecheck کامل و build تولیدی ۴۶ Route موفق‌اند؛ بدون تغییر API، داده، Permission، Schema/Migration یا Dependency.

## MASTER-011 — بازیابی اصلاحات جاافتاده اطلاعات پایه

سه اصلاح حمل‌ونقل شامل یکپارچه‌سازی فیلدهای هواپیما، انتقال «قواعد بار» به داخل ایرلاین و اجباری‌شدن عنوان انگلیسی کلاس پروازی با PR #241 وارد `develop` شده‌اند. دو تحویل مستقلِ باقیمانده نیز روی آخرین نسخه بازیابی شدند: لوگوی ایرلاین، بانک، بیمه، هتل، زنجیره هتل، شرکت ریلی/اتوبوس، سازمان، تأمین‌کننده و کارگزار اکنون از endpoint محدود Master Data واقعاً در Documents ذخیره و با نسخه خوش‌بینانه به همان رکورد متصل می‌شود؛ همچنین تغییرات Audit اطلاعات پایه در زنگوله نمایش داده می‌شوند، بدون حذف اعلان‌های پایدار عمومی یا HR.

این بازیابی با namespace و Cookie فعلی `Nora` سازگار است و Schema، Migration، Seed، Dependency، Permission یا داده عملیاتی را تغییر نمی‌دهد. ۵۹ تست API، ۳۹ تست Web، lint و typecheck هر دو برنامه و build تولیدی API/Web با ۴۶ Route موفق‌اند.

## MASTER-010 — عنوان انگلیسی کلاس پروازی

عنوان فارسی از فرم ایجاد/ویرایش، فهرست، پروفایل و خروجی Excel کلاس پروازی حذف و عنوان انگلیسی در Web و API اجباری شد. برای حفظ Schema و FKهای موجود، ستون داخلی `name` بدون Migration از `englishName` همگام می‌شود؛ Fixtureهای ساده و واقع‌نما نیز English-only شدند. ۳۹ تست هدفمند Web و ۳۲ تست هدفمند API، lint، TypeScript و build تولیدی Web/API موفق‌اند. این تحویل به‌ترتیب روی PRهای #240 و #236 متکی است و جزئیات در [MASTER-010-CABIN-CLASS-TITLE](tasks/MASTER-010-CABIN-CLASS-TITLE.md) ثبت شده است.

مالک محصول ادغام PR تجمیعی #241 با `develop` را برای بازیابی این سه اصلاح جاافتاده مجاز کرده است؛ آخرین `develop` داخل شاخه ادغام و هر دو مجموعه تغییر حفظ می‌شوند.

## MASTER-009 — انتقال قواعد بار به بخش ایرلاین

تب مستقل «قواعد بار» از ناوبری اصلی حمل‌ونقل حذف و مدیریت آن به زیرناوبری داخلی «ایرلاین‌ها» منتقل شد. صفحه هنگام مشاهده قواعد بار همچنان عنوان و مالکیت «ایرلاین‌ها» را حفظ می‌کند، اما فرم، فیلتر، KPI، جدول و عملیات واقعی قواعد بار با ارتباط `airlineId` بدون کپی داده یا تغییر قرارداد در همان بخش باقی مانده‌اند. ۳۲ تست هدفمند، lint، typecheck و build تولیدی ۴۶مسیره Web موفق‌اند. این تحویل روی PR #236 متکی است و جزئیات در [MASTER-009-AIRLINE-BAGGAGE](tasks/MASTER-009-AIRLINE-BAGGAGE.md) ثبت شده است.

## MASTER-008 — یکپارچه‌سازی فیلدهای نوع هواپیما

در فرم، جدول، پروفایل و خروجی Excel «انواع هواپیما»، عنوان فارسی حذف و سازنده/مدل به یک فیلد «سازنده و مدل» تبدیل شد. API مقدار ترکیبی را اعتبارسنجی و در ستون‌های فعلی تفکیک می‌کند و برای سازگاری مصرف‌کنندگان قبلی یک نام داخلی غیرنمایشی می‌سازد؛ بنابراین Schema، Migration و قرارداد مرکزی تغییر نکرده‌اند. Fixtureهای آزمایشی ساده و واقع‌نما نیز با `Airbus / A320-200` و `Boeing / 777-300ER` هماهنگ شدند. ۲۹ تست هدفمند Web، ۲۷ تست هدفمند API، lint محدوده، TypeScript Web/API و build تولیدی هر دو برنامه موفق‌اند. جزئیات در [MASTER-008-AIRCRAFT-FIELDS](tasks/MASTER-008-AIRCRAFT-FIELDS.md).

## WORKBENCH-041 — رفع خطای پیام‌رسان

در نگاشت پیام‌های عادی، شناسهٔ خالیِ فرستندهٔ فورواردشده دیگر به کوئری UUID کاربران ارسال نمی‌شود؛ این مشکل باعث خطای ۵۰۰ در فهرست گفتگوها و ایجاد گفت‌وگوی مستقیم بود. تست رگرسیون پیام‌رسان، lint و rebuild API موفق شدند و API جدید روی ۴۱۹۱ فعال است.

## 2026-09-14 — BRAND-NORA-001 — PC-B — IMPLEMENTED / VERIFIED

- نام محصول و namespace داخلی در نسخه یکپارچه تمام بخش‌ها به `Nora/نورا` تغییر کرد. packageهای workspace اکنون `@nora/*` هستند و Web/API/Worker، Swagger، کوکی‌ها، هدرها، PDF/XLSX، اعلان‌ها، تنظیمات نمونه و فایل‌های برنددار با Nora هماهنگ‌اند.
- شناسه‌های تاریخی GitHub/مسیر سیستم‌عامل و شناسه‌های سازگاری رمزنگاری/ذخیره‌سازی حفظ شدند تا لینک‌ها و داده‌های قبلی نشکنند. هیچ Schema/Migration/Seed، داده، نقش یا مجوز تغییر نکرد.
- install frozen، lint، typecheck، build کامل ۴۶ route و همه تست‌ها موفق‌اند: ۱۳۷۹ Web، ۱۳۳۳ API و ۱۴۹ تست package. گزارش: `docs/tasks/BRAND-NORA-001.md`.
- Build `unified-ZyV35vImKKoEtH_BCsmJV` روی Web3100/API4191 فعال و هر دو readiness برابر ۲۰۰ است؛ صفحه ورود محلی بعد از reload بدون خطای اتصال نمایش داده شد.

## WORKBENCH-037 — حذف کارت پایین درخواست‌های منابع انسانی

کارت نمایشی «درخواست‌های منابع انسانی» از مقصدهای پایین خانه میزکار حذف شد. این تغییر فقط پوسته Frontend را پوشش می‌دهد؛ Backend، مسیر `/hr`، مجوزهای خواندن HR و اعلان‌های منابع انسانی دست‌نخورده ماندند. چهار تست هدفمند، lint، TypeScript و Production Build با ۴۶ Route موفق‌اند.

## MARKETING-001H — حذف انتخاب‌گر Preview از Hub

انتخاب‌گر «پیش‌نمایش» مشخص‌شده در Screenshot 602 و شبیه‌ساز حالت‌های وابسته از سربرگ صفحه اصلی مارکتینگ حذف شدند. این تغییر فقط پوسته نمایشی Hub را پوشش می‌دهد؛ کارت‌ها، مسیرها، فرم‌ها، پیش‌نمایش‌های تخصصی و Backend تغییری نکردند. ۲۱ تست مارکتینگ، lint، TypeScript و Production Build با ۴۶ Route موفق‌اند.

## FINANCE-008 — عملیات واقعی کارتابل مالی

کارتابل مالی اکنون فقط نمایش‌دهنده نیست: دریافت ثبت‌شده مسافر از همان‌جا تأیید یا
با علت برای اصلاح به فروش بازگردانده می‌شود. برای خرید خدمات رزرواسیون نیز مالی
حساب واقعی و روش پرداخت را انتخاب می‌کند، پرداخت جزئی یا کامل ثبت می‌شود و مبلغ
پرداخت‌شده/مانده در هر دو بخش دیده می‌شود. پرداخت ارزی Snapshot نرخ روز، معادل
ریالی و زمان UTC دارد؛ توضیح مالی و شماره پیگیری اختیاری‌اند.

Migration و Seed محلی اعمال شده و نقش `finance_staff` بدون حذف دسترسی قبلی به
`Ramtin` افزوده شده است. کل ۱۲۸۳ تست API و ۱۳۴۳ تست Web، typecheck، lint و
build تولیدی API/Web با ۴۶ مسیر موفق‌اند و Web3100/API4190 فعال‌اند. جزئیات در
[FINANCE-008](tasks/FINANCE-008-INBOX-ACTIONS.md) ثبت شده است.

## WORKBENCH-040 — Performance summary

Personal performance now shows leave count, dated shifts, approved payslip period/net amount, today's entry/exit, own customers and sales. Raw activity rows were removed. Additive HR projection preserves self/branch scope and applies approved attendance corrections. No employee reassignment or migration. See [WORKBENCH-040](tasks/WORKBENCH-040-PERFORMANCE-SUMMARY.md).

## WORKBENCH-039 — Selected department contrast

The messenger unit list no longer overrides the selected primary button with a light surface background. Selected labels and icons use theme foreground contrast, unselected units retain their surface style, and aria-pressed exposes selection. No message delivery or API behavior changes. Validation is recorded in docs/tasks/WORKBENCH-039-UNIT-CONTRAST.md.

## FINANCE-007 — تکمیل کارتابل درخواست‌های مالی

کارتابل مالی بازطراحی و ساده شد: Preview قدیمی، نوشته‌های فنی و اقدام غیرفعال حذف شدند و درخواست‌های واقعی فروش، ارجاع‌های مالی منابع انسانی و خرید خدمات رزرواسیون اکنون از مرز عمومی ماژول‌های مالک وارد صف واحد می‌شوند. منبع خرید مستقل چون Producer عملیاتی ندارد، داده ساختگی نمایش نمی‌دهد. ۳ تست API، ۸ تست قرارداد Web، ۳ تست Migration، lint محدوده، typecheck و build تولیدی API/Web موفق‌اند؛ Web3100 و API4190 فعال‌اند. مشخصات Seed نقش مالی کامل شده، اما انتساب افزایشی `finance_staff` به `Ramtin` برای رفع نهایی 403 هنوز منتظر تأیید صریح مالک محصول است. جزئیات در [FINANCE-007](tasks/FINANCE-007-INBOX-COMPLETION.md) ثبت شده است.

## WORKBENCH-038 — عملکرد من

تب «عملکرد من» و endpoint فقط‌خواندنی خود کاربر اضافه شد: مرخصی، شیفت و آخرین فیش
تأییدشده از سرویس عمومی منابع انسانی، مبلغ فروش با Decimal و تعداد مشتریان قراردادهای
تأییدشده خود کاربر از Sales، و رویدادهای شغلی از IAM/HR/Sales/Customers. دامنه خود
کاربر و شعب مجاز حتی برای مدیران حفظ می‌شود؛ داده ساختگی یا تأیید واریز بانکی تولید
نمی‌شود. محدوده شمارش فعالیت‌ها و سقف آمار در UI مشخص است. بدون Migration یا
Dependency؛ جزئیات در [WORKBENCH-038](tasks/WORKBENCH-038-MY-PERFORMANCE.md).

۱۸ آزمون هدفمند API و ۴۹ آزمون Web، lint محدوده، TypeScript و build تولیدی هر دو
برنامه (۴۶ مسیر وب) موفق‌اند. این واحد هنوز runtime مشترک ۳۱۰۰/۴۱۹۰ را تغییر نداده است.

## FINANCE-007 — تکمیل کارتابل درخواست‌های مالی

کارتابل مالی بازطراحی و ساده شد: Preview قدیمی، نوشته‌های فنی و اقدام غیرفعال حذف شدند و درخواست‌های واقعی فروش، ارجاع‌های مالی منابع انسانی و خرید خدمات رزرواسیون اکنون از مرز عمومی ماژول‌های مالک وارد صف واحد می‌شوند. منبع خرید مستقل چون Producer عملیاتی ندارد، داده ساختگی نمایش نمی‌دهد. ۳ تست API، ۸ تست قرارداد Web، ۳ تست Migration، lint محدوده، typecheck و build تولیدی API/Web موفق‌اند؛ Web3100 و API4190 فعال‌اند. مشخصات Seed نقش مالی کامل شده، اما انتساب افزایشی `finance_staff` به `Ramtin` برای رفع نهایی 403 هنوز منتظر تأیید صریح مالک محصول است. جزئیات در [FINANCE-007](tasks/FINANCE-007-INBOX-COMPLETION.md) ثبت شده است.

## WORKBENCH-037 — حذف کارت پایین درخواست‌های منابع انسانی

کارت نمایشی «درخواست‌های منابع انسانی» از مقصدهای پایین خانه میزکار حذف شد. این تغییر فقط پوسته Frontend را پوشش می‌دهد؛ Backend، مسیر `/hr`، مجوزهای خواندن HR و اعلان‌های منابع انسانی دست‌نخورده ماندند. چهار تست هدفمند، lint، TypeScript و Production Build با ۴۶ Route موفق‌اند.

## APP-SHELL — انتقال کنترل‌های نوار بالا به چپ

گروه تاریخ، زبان، پوسته، اعلان و منوی کاربر اکنون به‌صورت یک بلوک منسجم در لبه چپ هدر RTL قرار دارد. رفتار کنترل‌ها و نمایش واکنش‌گرا حفظ شده و ۴ تست متمرکز، lint، typecheck و build ۴۶ مسیر موفق بوده است. جزئیات در [APP-SHELL-HEADER-UTILITY-LEFT-001](tasks/APP-SHELL-HEADER-UTILITY-LEFT-001.md) ثبت شده است.

## FINANCE-006 — بازطراحی کنترل پرداخت و تحویل مدارک

نمای پرداخت کارگزاران و مجوز تحویل مدارک اکنون در خود کارتابل درخواست‌ها یک جریان دو مرحله‌ای روشن دارد. هر قرارداد، وضعیت خدمات و اقدام بعدی را در کارت مستقل نشان می‌دهد و علت قفل بودن تحویل مدارک را صریح اعلام می‌کند. کنترل از Workspace قدیمی حسابداری به `/finance/requests` منتقل شده و منطق/API مالی تغییری نکرده است. تست کامل Web (۱۳۴۰ مورد)، تست متمرکز، lint، typecheck و build ۴۶ مسیر موفق بود. جزئیات در [FINANCE-006](tasks/FINANCE-006-DELIVERY-PANEL-REDESIGN.md) ثبت شده است.

PR #254 در `e40878f1` Merge و build `55JsHVl1EIROpWDpoCZuS` روی Web3100 فعال شد؛ API4190 سالم است.

## FINANCE-005 — دراپ‌داون‌های بسته حسابداری

هر چهار گروه منوی داخلی حسابداری هنگام ورود بسته‌اند. «ارتباط با سامانه مودیان
مالیاتی» و «حسابداری مالیاتی» نیز به دراپ‌داون تبدیل شدند، ولی مطابق دستور مالک محصول
فعلاً هیچ زیرگروه یا محتوایی ندارند. ۲۵ تست هدفمند، lint، TypeScript و build تولیدی ۴۶
مسیر موفق‌اند؛ بدون تغییر API، داده، Permission، Schema/Migration یا Dependency.
جزئیات در [FINANCE-005](tasks/FINANCE-005-ACCOUNTING-DROPDOWN-DEFAULTS.md) ثبت شده است.
هر چهار Gate CI موفق شدند و PR #246 با Merge Commit `88d26ebc` وارد `develop` شد.
Web3100 با Build ID `60YeidM5vzsZuojUx7D85` فعال و API4190 سالم است.

## FINANCE-004 — منوی داخلی حسابداری

صفحه حسابداری اکنون یک منوی داخلی مستقل و جمع‌شونده کنار سایدبار اصلی دارد. «دفتر
کل» با پنج زیرگروه، «دریافت و پرداخت» با گزارش پرداخت و دریافت، و ورودی‌های «ارتباط
با سامانه مودیان مالیاتی» و «حسابداری مالیاتی» به مسیرهای پایدار متصل‌اند. همه مقصدها
طبق دستور مالک محصول تا اعلام جزئیات فقط پوسته خالی دارند و هیچ عملیات یا داده مالی
ساخته نشده است. ۲۰ تست Finance/Navigation، Prettier، ESLint، TypeScript، build تولیدی ۴۶
مسیر و QA مرورگر موفق‌اند. جزئیات در
[FINANCE-004](tasks/FINANCE-004-ACCOUNTING-SECONDARY-NAV.md) ثبت شده است.
مالک محصول در 2026-09-13 ادغام این واحد با `develop` و فعال‌سازی Web3100 را تأیید کرد.
تغییرات با Merge Commit `b5fdbe75` وارد `develop` شد.
Web3100 با Build ID `RAhkQQeixfqHkOKXiubFX` از Worktree ادغام‌شده فعال است و مسیر
حسابداری پاسخ مورد انتظار احراز هویت را می‌دهد.

## FINANCE-003 — کارتابل واقعی و بازطراحی‌شده مالی

کارتابل `/finance/requests` به صف فقط‌خواندنی داده‌های persisted تبدیل شد: پرداخت‌های
فروش با وضعیت انتظار تأیید مالی و ارجاع‌های منابع انسانی به مقصد Finance، از طریق public
application serviceهای ماژول مالک و با دامنه شعبه/مجوز تجمیع می‌شوند. رابط جدید شامل
hero، KPI، وضعیت اتصال واحدها، جست‌وجو، فیلتر و نمای جزئیات است؛ Preview قدیمی جدا و
غیرعملیاتی باقی مانده و داده synthetic وارد صف زنده نمی‌شود. `finance.read` به IAM و seed
نقش مالی افزوده شد، اما seed روی دیتابیس عملیاتی اجرا نشده است. Reservations و Purchases
تا انتشار producer استاندارد با وضعیت «متصل نیست» نمایش داده می‌شوند و تأیید/پرداخت تا
Persistence مستقل Finance غیرفعال است. ۸۲ تست هدفمند، lint، typecheck و build API/Web
موفق و QA مرورگر ایزوله تأیید شد؛ runtime مشترک تغییر نکرد. جزئیات در
[FINANCE-003](tasks/FINANCE-003-INBOX-REDESIGN-INTEGRATION.md) ثبت شده است.
مالک محصول در 2026-09-13 ادغام نسخه ترکیبی و نمایش کارتابل جدید روی Web3100 را مجاز
کرد؛ بازآزمایی روی آخرین `develop` شامل ۵۵ تست هدفمند، lint/typecheck و build API/Web
موفق بود.
هر چهار Gate نهایی CI موفق شدند و PR #237 با Merge Commit `2fc5e6d2` وارد `develop`
شد. Web3100 با Build ID `H2SQ5Bcvdx249ZC-GP-m1` و API4190 سالم از نسخه ترکیبی فعال‌اند.

## WORKBENCH-037 — اصلاح کارت خوشامدگویی و پیام‌های واحدی

تاریخ امروز و تعداد شعب مجاز از کارت خوشامدگویی میزکار حذف شدند و کارت فقط هویت
کاربر و شرکت فعال را نمایش می‌دهد. lint وب، typecheck سراسری ۹ Job و build تولیدی
۴۶ مسیر موفق بودند؛ بدون تغییر API، دیتابیس، وابستگی یا داده عملیاتی.

فهرست واحدهای مالی، رزرواسیون، AI، فروش، ویزا، منابع انسانی و مدیریت به پیام‌رسان
بازگشت و اکنون کنار نماهای مستقل مخاطبان، گروه‌ها و گفت‌وگوها قرار دارد. آیکن، جست‌وجو
و تعداد قالب‌های هر واحد نمایش داده می‌شود و انتخاب مخاطب/گروه، ساخت گروه، ارسال پایدار،
پیوست و فوروارد از سرویس‌های موجود Messaging، IAM و Documents استفاده می‌کنند. ۴۷ تست
Workbench و ۴۲ تست مجزای HR موفق بودند؛ اجرای کامل Web نیز ۱۳۳۷ تست موفق داشت و دو
Timeout پنج‌ثانیه‌ای قدیمی HR زیر بار موازی در اجرای مجزا پاس شدند.

## HR-014 — حذف پنل مستقل ارتباطات از رابط کاربری

- نتیجه: lint و TypeScript وب، ۲۶۰ تست موجود و build تولیدی ۴۶ مسیر موفق‌اند. مرج PR #226 با دستور صریح جدید کاربر مجاز شد؛ تداخل افزوده‌های مستندات با حفظ هر دو واحد کار رفع شد. بدون فعال‌سازی روی اجرای مشترک ۳۱۰۰.

- مطابق اصلاح صریح مالک محصول، پنل «ارتباط منابع انسانی با بخش‌های سامانه» از پوسته مشترک تمام صفحه‌ها و لینک ارجاع از جزئیات پرونده HR حذف شد. کد رابط و client اختصاصی همین پنل نیز حذف شدند؛ پارامتر قدیمی `hrConnections` دیگر آن را نمایش نمی‌دهد.
- سرویس‌ها و قراردادهای Backend، داده‌های ثبت‌شده، مجوزها و اتصال واقعی حساب کاربری/ارز/سند/کارمند در فرم‌های اصلی حفظ شده‌اند. بدون Migration یا تغییر Dependency و بدون جایگزینی Runtime مشترک. شاخه `codex/pc-b-hr-backend-only-0912`؛ نتیجه کنترل‌ها و PR در `docs/tasks/HR-014-BACKEND-ONLY.md` ثبت می‌شود.

## DASHBOARDS-001 — واگذاری اجرا به PC-C

مالک محصول در 2026-09-13 اجرای بخش Dashboard را به `COMPUTER_ID=PC-C` واگذار
کرد. Scope مجاز شامل ماژول و Route داشبورد Web، Aggregationهای مجاز داخل Reporting
و اسناد اختصاصی Dashboard است. PC-C باید از آخرین `origin/develop` و Branch مستقل
`codex/pc-c-dashboards-<task>` استفاده کند و Preview خود را فقط روی پورت 3000 متعلق
به Worktree خودش اجرا کند.

این واگذاری مالکیت داده یا منطق Finance، Sales، Reservations، Customers، HR،
Marketing، Documents و Master Data را منتقل نمی‌کند. Dashboard فقط Projection یا
Public Contract تاییدشده را مصرف می‌کند و حق Query مستقیم جدول عملیاتی یا نمایش
عدد ساختگی ندارد. هیچ Migration، Schema، Seed، Dependency/Lockfile، قرارداد مشترک
یا فایل Navigation با این مجوز رزرو نشده است. جزئیات در
[DASHBOARDS-PC-C-AUTHORIZATION](tasks/DASHBOARDS-PC-C-AUTHORIZATION.md) ثبت شده
است.

## WORKBENCH-036 — اتصال کامل بک‌اند میزکار

یادداشت و تقویم شخصی، پروفایل و عکس، علاقه‌مندی اسناد، پیوست و unread پیام،
درخواست‌های داخلی و نظرسنجی اکنون ذخیره پایدار دارند. Workbench داده‌های IAM،
Documents، Messaging، Customer Affairs، HR و Notifications را فقط از سرویس عمومی
مالک مصرف می‌کند. تقویم نیز ارجاع‌های مجاز Customer Affairs را در API میزکار
تجمیع می‌کند. مسیریابی درخواست به کاربر فعال واحد، اعلان تراکنشی، ناشناس‌سازی
گیرنده و کنترل عضویت/شعبه پیاده شده‌اند. ۲۴ تست سرویس API، ۱۰ تست HTTP اسناد و
۴۷ تست Web همراه lint/typecheck پاس شدند؛ جزئیات در
[WORKBENCH-036](tasks/WORKBENCH-036.md) ثبت است.

در درخت نهایی بازپایه‌شده، lint سراسری ۶ Job، typecheck سراسری ۹ Job و build
تولیدی ۶ Job شامل ۴۶ مسیر Web نیز بدون خطا تمام شد. CI روی exact head همهٔ چهار
Gate تست کامل، کیفیت، build و PostgreSQL 18 را گذراند؛ هر ۵۹ Migration از دیتابیس
خالی اعمال شد و تکرارپذیری Seed نیز تأیید شد. PR #234 با Merge Commit
`1707d980` وارد `develop` شد و همهٔ قفل‌های موقت این واحد کار آزاد شدند.

## CA-FORM-LIST-FLOW — ساده‌سازی فرم و بازگشت به فهرست

ورودی منبع درخواست و صف مسئول از فرم ایجاد درخواست حذف شد؛ مقادیر داخلی لازم برای API حفظ شدند. تراز بالای فیلدها فاصلهٔ اضافی توضیحات خاص را رفع می‌کند. پس از ثبت درخواست/تیکت، به‌جای جزئیات خودکار، فهرست ردیفی تازه‌شده باز می‌شود و جزئیات همچنان با انتخاب ردیف قابل‌دسترسی است. ۵۳ تست هدفمند موفق؛ بدون تغییر داده یا API. جزئیات در `docs/tasks/CA-FORM-LIST-FLOW.md`.

## CA-REPORT-LAYOUT — چیدمان گزارش امور مشتریان

نمای گزارش با کارت‌های خلاصه، توزیع دو ستونه وضعیت درخواست/تیکت و کارت‌های فشرده رضایت/اقدام اصلاحی بازطراحی شد. تعداد و سهم هر وضعیت از کل کنار نوار نمایش داده می‌شود؛ میانگین رضایت با درصد رضایت اشتباه گرفته نمی‌شود. تم نورا و حالت موبایل حفظ شده، بدون تغییر API یا داده. ۵۱ تست هدفمند موفق است؛ وضعیت بیلد و اجرای۳۱۰۰ در `docs/tasks/CA-REPORT-LAYOUT.md` ثبت می‌شود.

## HR-015 — حذف پنل از اجرای مشترک

حذف رابط PR226 روی آخرین نسخه تحویل‌شده امور مشتریان b1da23bd اعمال شد. ۳۰۶ تست، lint، TypeScript و build وب موفق شدند. بک‌اند، دیتابیس و اتصال فرم‌ها حفظ شده‌اند؛ فعال‌سازی فقط وب است. مرجع: docs/tasks/HR-015-RUNTIME.md.

## CA-STAFF-PICKER-CLARITY — برچسب تاریخ و شفافیت انتخاب کارکنان

«ثبت پرونده» از برچسب و نام دسترس‌پذیر فیلتر تاریخ حذف شد. انتخاب مسئول همچنان از قرارداد عمومی HR می‌خواند؛ کارکنان بدون userId به‌جای پنهان‌شدن با توضیح و به‌صورت غیرقابل‌انتخاب دیده می‌شوند. شناسه کارمند هرگز به‌جای شناسه کاربر ارسال نمی‌شود. اتصال هویت واقعی کارمند/حساب و فعال‌سازی نسخه تازه باقی است؛ حساب یا مجوز خودکار ساخته نشد. مهارت senior-frontend برای حفظ انتخاب‌گر تم نورا و حالت‌های بارگذاری/خطا استفاده شد.

## CUSTOMER-AFFAIRS-REPORT-DATA-E2E — داده گزارش و تست مرورگری

۲۴ درخواست، ۳۶ تیکت، ۲۰ پاسخ رضایت و ۸ اقدام اصلاحی ساختگی با عنوان طبیعی و نشان منشأ در audit اضافه شد؛ اجرای مجدد داده تکراری نمی‌سازد. عبارت «(شامل این روز)» حذف و دو وضعیت گزارش فارسی شد. ۴۶ تست Web و build موفق؛ گردش مرورگری ثبت تا بستن تیکت، یادداشت، جست‌وجو، بازه یک‌روزه و گرید ماه/سال تأیید شد. وقفه اتصال دیتابیس باعث توقف API در اجرای اول شد؛ پس از بازیابی، گردش موفق بود، اما علت اصلی وقفه هنوز مشخص نیست. روی ۳۱۰۰ فعال است؛ جزئیات و محدودیت‌ها: `docs/tasks/CUSTOMER-AFFAIRS-REPORT-DATA-E2E.md`.

## CUSTOMER-AFFAIRS-DATE-FILTER — فیلتر تاریخ ثبت

بازه از/تا تاریخ در فهرست درخواست‌ها و پشتیبانی و نماهای تحویل فروش/معوق اضافه شد. تقویم مشترک نورا با انتخاب گریدی ماه/سال بدون تغییر مصرف می‌شود. کل روز پایان لحاظ و مرزها با منطقه زمانی مرورگر به UTC تبدیل می‌شوند؛ API روی تاریخ ثبت، پیش از شمارش و صفحه‌بندی، با حفظ شعبه فیلتر می‌کند. پاک‌کردن بازه و حفظ آن در URL فعال است. ۸۴ تست API و ۴۶ تست Web، lint و کنترل TypeScript موفق‌اند؛ بدون migration یا تغییر داده. آمار کلی و گزارش تجمیعی خارج از این فیلتر هستند. جزئیات: `docs/tasks/CUSTOMER-AFFAIRS-DATE-FILTER.md`.

## CUSTOMER-AFFAIRS-REQUEST-LABELS — حذف عنوان سرنخ، حفظ درخواست‌ها

طبق توضیح کاربر، عنوان سرنخ از منوی اصلی، تب درخواست‌ها، آمار، گزارش و فرم‌های امور مشتریان حذف و با درخواست مشتری جایگزین شد. هیچ درخواست، پیگیری یا داده‌ای حذف نشده؛ کلیدهای فنی leads و قرارداد API برای سازگاری حفظ شدند. مهارت senior-frontend در حفظ الگوی رابط و نام‌گذاری یکپارچه استفاده شد. فعال‌سازی روی ۳۱۰۰ همچنان معلق است؛ بررسی بصری اجرای جدید ادعا نمی‌شود.

## CUSTOMER-AFFAIRS-CUSTOMER-PICKER — انتخاب از مشتریان و مسافران

انتخاب‌گر فرم ایجاد درخواست، ایجاد تیکت و ویرایش پرونده از API عمومی Customers با هر دو نقش مشتری/مسافر فعال استفاده می‌کند. صفحه‌بندی، حفظ انتخاب میان جست‌وجوها، نمایش نام مشتری فعلی در ویرایش و لینک مستقیم پرونده اصلی در تب جدید اضافه شد؛ متن فنی با عنوان فارسی و تم مشترک جایگزین شد. ۴۳ تست، lint، typecheck و build تولیدی ۴۶ مسیر موفق‌اند. بدون تغییر API، داده یا مجوز؛ فعال‌سازی روی ۳۱۰۰ همچنان معلق است و بررسی مرورگری نسخه جدید ادعا نمی‌شود.

## CUSTOMER-AFFAIRS-WORKFLOW-COMPLETION — کد آزموده‌شده، فعال‌سازی معلق

تبدیل اتمیک سرنخ به مشتری از سرویس عمومی Customers، فرم پاسخ فروش با قرارداد واقعی، احتمال تبدیل مستقل از امتیاز ارزیابی، فیلتر سایت، اعلان خودکار پیگیری/SLA با جلوگیری از تکرار، توقف زمان حل هنگام انتظار مشتری و ارسال پیامک sms.ir اضافه شد. پیامک و زمان‌بند پیش‌فرض خاموش‌اند؛ کلید، خط و کاربران مجاز باید خارج Git تنظیم شوند. پذیرش پیام توسط سرویس به معنی تحویل نیست و ارسال با نتیجه نامعلوم خودکار تکرار نمی‌شود. ۱۷۷ تست API و ۳۹ تست Web، lint، typecheck و build هر دو بخش موفق شدند. بدون migration، ارسال واقعی یا تغییر داده تجاری؛ راه‌اندازی مجدد همچنان مسدود و نمایش نسخه جدید تأیید نشده است. اتصال زنده سایت‌ها، callback خودکار واحدها، دریافت پیام/گزارش تحویل، ارسال خودکار نظرسنجی و تقویم کاری SLA هنوز باقی‌اند. جزئیات در `docs/tasks/CUSTOMER-AFFAIRS-WORKFLOW-COMPLETION.md`.

## CUSTOMER-AFFAIRS-THEMED-SELECTS — کد آماده، راه‌اندازی مجدد مسدود

دراپ‌داون‌های فیلتر، فرم ایجاد/ویرایش و انتخاب مسئول از Select مشترک نورا با RTL و رنگ‌های تم استفاده می‌کنند. ۳۸ تست و build/typecheck تولیدی ۴۶ مسیر موفق شد. دستور راه‌اندازی مجدد وب۳۱۰۰ پیش از اجرا توسط سیاست محیط رد شد؛ فعال‌شدن و بررسی بصری نسخه جدید ادعا نمی‌شود. API و داده‌ها تغییری نکردند. فرض‌های قبلی رابط داخلی دسکتاپ و تم نورا حفظ شده‌اند؛ بدون تغییر dependency، schema یا کامپوننت مرکزی.

## CUSTOMER-AFFAIRS-SITE-BRIDGE — بک‌اند پیاده شد، اتصال زنده سایت‌ها غیرفعال

ثبت تیکت و استعلام وضعیت با هویت مستقل سایت، جلوگیری از ثبت تکراری، فیلتر API بر اساس سایت و کلید خارجی مبدأ تیکت اضافه شد. مسیر دریافت صف و ثبت پاسخ ارجاع برای فروش، رزرواسیون، مالی و اسناد با کنترل مجوز مقصد اضافه شد؛ مصرف خودکار این قرارداد توسط تمام ماژول‌ها هنوز انجام نشده است. ۶۴ تست، lint/typecheck و build API موفق بود. مهاجرت افزایشی پس از آزمون PostgreSQL و پشتیبان‌گیری روی دیتابیس محلی اعمال شد؛ داده قبلی و مهاجرت جدیدتر Workbench حفظ شدند. فرانت و مجوزها تغییر نکردند. jahanbastan.ir و nystkt.ir تا تنظیم حساب/شعبه و adapter سمت سایت غیرفعال‌اند. شرح قرارداد و محدودیت‌ها در `docs/tasks/CUSTOMER-AFFAIRS-SITE-BRIDGE.md`؛ بدون merge یا انتشار تولیدی.

## CUSTOMER-AFFAIRS-BACKEND-ROUTING — کد آمادهٔ یکپارچه‌سازی

مسیر اعلان تغییر مسئول سرنخ/تیکت، اعلان مسئول اجرایی، برگشت پاسخ فروش و لینک مستقیم پرونده در بک‌اند تکمیل شد. پاسخ تکراری ارجاع/فروش اعلان مجدد نمی‌سازد و نوشتن شرطی از پاسخ هم‌زمان جلوگیری می‌کند؛ ثبت اعلان در همان تراکنش است. ۵۲ تست هدفمند، ESLint/typecheck و build API موفق بود. فرانت، داده، مجوز و schema تغییر نکرد. بررسی فرایند محلی تأیید کرد Web3100 همچنان متعلق به Worktree تجمیعی است و API4190 Listener ندارد؛ API با همان تنظیمات قبلی آغاز شد، بدون جایگزینی وب یا اجرای seed/migration. تغییرات جدید PC-A روی origin ادغام نشدند. اتصال سایت‌ها و قراردادهای جدید بخش‌های مقصد هنوز تکمیل نشده‌اند؛ جزئیات در `docs/tasks/CUSTOMER-AFFAIRS-BACKEND-ROUTING.md`.

## CUSTOMER-AFFAIRS-INTERNAL-LINKS — اصلاح دامنه به بک‌اند، بدون سکشن جدید

کاربر تصریح کرد اتصال‌ها فقط در بک‌اند باشند و سکشن جدا ایجاد نشود. فرانت همین واحد پیش از commit حذف شد و فرم‌ها/بک‌اند قبلی حفظ شدند. API موجود برای مراجع قرارداد/رزرو/سند و پاسخ تحویل به فروش تغییر نکرد. در بررسی خواندنی، Documents پاسخ داد ولی Sales/Reservations برای حساب فعلی 403 داشتند؛ هیچ مجوز یا داده‌ای تغییر نکرد. تکمیل callback واحدها و اتصال سایت‌ها هنوز پیاده نشده و نیازمند قرارداد/هماهنگی مالک است. نقشه وضعیت در `docs/tasks/CUSTOMER-AFFAIRS-INTERNAL-LINKS.md`؛ بدون migration یا merge.

## CUSTOMER-AFFAIRS-OPERATIONAL-FORMS — تکمیل بخش مبتنی بر API موجود

ویرایش اطلاعات درخواست/تیکت، منبع و توضیحات خاص، انتخاب مسئول و گیرنده ارجاع از فهرست عمومی مجاز کارکنان، تغییر مراحل مجاز و دلیل شکست، دسته‌های صدور/اصلاح مشخصات/ارسال مجدد مدرک و فرم نتیجه/اثربخشی اقدام اصلاحی اضافه شدند. ۳۵ تست، ESLint/typecheck و build تولیدی ۴۶ مسیر موفق بود؛ فرم ویرایش و شکست در مرورگر احرازشده بررسی شد. در شعبه بررسی‌شده کارمند متصل به حساب کاربری وجود نداشت؛ داده ساختگی یا مجوز جدید اضافه نشد. Web3100 فعال و API4190 دست‌نخورده است. این خروجی تمام بک‌لاگ نیست: احتمال تبدیل، تبدیل به مشتری، پذیرش فروش، اتوماسیون وظایف و ارتباطات بیرونی باقی‌اند؛ جزئیات در `docs/tasks/CUSTOMER-AFFAIRS-OPERATIONAL-FORMS.md`. بدون merge.

## CUSTOMER-AFFAIRS-FORM-DIALOGS — تکمیل

هفت فرم ایجاد/ویرایش امور مشتریان به دیالوگ مشترک نورا منتقل شد؛ صفحه زمینه حفظ می‌شود و فرم‌های جست‌وجو در صفحه باقی مانده‌اند. خطای ذخیره داخل پنجره، جلوگیری از بستن با کلیک بیرون، قفل هنگام ذخیره و برگشت فوکوس اضافه شد. ۳۰ تست، ESLint، typecheck و build تولیدی ۴۶ مسیر موفق بود؛ نمایش موبایل ۳۹۰ پیکسلی و فرم/تقویم/دریافت مشتری در مرورگر احرازشده بررسی شد. Web3100/PID10196 با API عمومی ۴۱۹۰ فعال است؛ API4190/PID12504 و داده‌ها تغییر نکردند. جزئیات در `docs/tasks/CUSTOMER-AFFAIRS-FORM-DIALOGS.md`؛ بدون merge.

## CUSTOMER-AFFAIRS-WORKFLOW-REDESIGN — تکمیل

ساختار امور مشتریان به چهار بخش نمای کلی، درخواست‌ها و سرنخ‌ها، تیکت‌های پشتیبانی و گزارش‌ها بازطراحی شد. پیگیری‌های معوق و منتظر پذیرش فروش فیلترهای زمینه‌ای هستند؛ کارت‌های ناوبری تکراری حذف شدند. چک‌لیست احراز، ویرایش پیگیری بعدی، ثبت نوع ارتباط و فرم دلیل/نتیجه جایگزین اقدامات مبهم شدند؛ دکمه‌های تیکت تابع مرحله فعلی‌اند. ESLint، ۲۹ تست هدفمند و build/typecheck تولیدی ۴۶ مسیر موفق بودند. مرورگر احرازشده و موبایل ۳۹۰ پیکسلی بررسی شد و Web3100 فعال است؛ API4190، داده‌ها و مجوزها تغییر نکردند. اتصال بیرونی و پذیرش فروش خارج از این واحد Web هستند؛ جزئیات در `docs/tasks/CUSTOMER-AFFAIRS-WORKFLOW-REDESIGN.md`. بدون merge.

## CUSTOMER-AFFAIRS-REMOVE-HR-OUTLET — تکمیل

کارت تکمیلی «درخواست‌های منابع انسانی» فقط از فضای کاری امور مشتریان حذف شد؛ خود ماژول منابع انسانی و رفتار پیش‌فرض کارت در سایر مسیرها تغییری نکرد. ESLint و قالب‌بندی محدوده، پنج تست هدفمند و build/typecheck تولیدی ۴۶ مسیر موفق بودند. مرورگر احرازشده چهار تب اصلی، ۶ سرنخ باز، ۵ تیکت باز، نبود کامل عنوان کارت و نبود خطای کنسول را روی Web3100/PID15936 از source `010c655` تأیید کرد؛ API4190/PID12504، داده‌ها، schema، مجوزها و dependencyها تغییر نکردند. Draft PR #233، بدون merge.

## CUSTOMER-AFFAIRS-REMOVE-SETTINGS — تکمیل

بخش تنظیمات داخلی امور مشتریان به‌طور کامل حذف شد: تب، view فقط‌خواندنی، آیکن و CSS بلااستفاده آن پاک شدند. چهار تب «نمای کلی»، «پیش از فروش»، «پشتیبانی» و «گزارش‌ها» حفظ شده‌اند؛ تنظیمات عمومی شرکت در منوی اصلی تغییری نکرد. ESLint و قالب‌بندی، چهار تست هدفمند و build/typecheck تولیدی ۴۶ مسیر موفق بودند. مرورگر احرازشده چهار تب باقی‌مانده را روی Web3100/PID15724 از source `5ebca3d` تأیید کرد؛ API4190/PID12504 و داده‌ها تغییر نکردند. بدون merge.

## CUSTOMER-AFFAIRS-REMOVE-TAGLINE — تکمیل

زیرعنوان «همراه مشتری، از اولین درخواست تا آخرین پیگیری» فقط از سربرگ امور مشتریان حذف شد و عنوان، دکمه‌ها، رنگ‌بندی و داده‌ها حفظ شدند. ESLint و قالب‌بندی محدوده، چهار تست هدفمند و build/typecheck تولیدی ۴۶ مسیر موفق بودند. نمای داده‌دار در مرورگر احرازشده روی Web3100/PID29056 از source `f894409` بدون متن حذف‌شده تأیید شد؛ API4190/PID12504 و داده‌ها تغییر نکردند. بدون merge.

## CUSTOMER-AFFAIRS-VISUAL-POLISH — تکمیل

نمای امور مشتریان با رنگ‌های آبی نورا، فیروزه‌ای و رنگ‌های وضعیت بازپردازی شد: تب فعال، کارت‌های شاخص، کارت‌های دسترسی و پنل‌های فهرست عمق و تمایز بصری بیشتری دارند و حالت کاهش حرکت نیز حفظ شده است. چهار تست هدفمند، قالب‌بندی CSS، diff check و build/typecheck تولیدی ۴۶ مسیر موفق بودند. نمای داده‌دار در مرورگر احرازشده روی Web3100/PID15612 از source `a7a8ab7` تأیید شد؛ API4190/PID12504، داده، schema و dependency تغییری نکردند. بدون merge.

## CUSTOMER-AFFAIRS-REMOVE-INTRO — تکمیل

کادر معرفی نمای کلی امور مشتریان و دو متن درخواستی حذف شدند؛ کارت‌ها و گزارش‌ها حفظ شدند. تست هدفمند، lint و build/typecheck موفق و نمایش مرورگر پس از ورود تأیید شد. نسخه وب روی همان ۳۱۰۰ با source `ac15df6` و PID13128 فعال است؛ API و داده‌ها تغییر نکردند. Draft PR #225، بدون merge.

## UNIFIED-CUSTOMER-AFFAIRS-3100 — اجرای مشترک فعال

نسخهٔ جاری Excel/آژانس‌ها، پیام‌رسان و امور مشتریان در یک Worktree مستقل تجمیع و روی Web3100/API4190 اجرا شد؛ دیگر برای امور مشتریان به ۳۱۰۲ نیاز نیست. ورود واقعی کاربر، داشبورد و گزارش امور مشتریان و پنجرهٔ ورود Excel در مرورگر تأیید شدند. Migration افزایشی پس از backup و rehearsal اجرا شد؛ ۳۸ کاربر، ۵ شعبه و ۴۴ سند حفظ شدند. با تأیید جداگانه کاربر فقط نقش مدیر سامانه ۱۹ مجوز امور مشتریان گرفت. Build شش Task، lint/typecheck پانزده Task و ۱۲۳۰ تست API موفق‌اند؛ تنها timeout اولیه HR در مجموعه وب با اجرای مستقل ۴۲ تست همان فایل رفع شد. Source runtime: `09b3b18`، Web PID1628، API PID12504. جزئیات و دستور راه‌اندازی در `docs/tasks/UNIFIED-CUSTOMER-AFFAIRS-3100.md`؛ main/develop تغییر نکرده‌اند.

## MASTER-007 — اصلاح بارگذاری لوگوی اطلاعات پایه (آماده بازبینی)

مسیر بارگذاری لوگوی اطلاعات پایه از دسترسی مستقیم Web به آرشیو اسناد جدا شد. ویرایشگر دارای `master_data.update` اکنون از endpoint محدود Master Data استفاده می‌کند و Documents همچنان مالک باینری، اسکن، Audit و رابطه منبع است. شناسه واقعی سند با کنترل نسخه به ایرلاین، بانک، بیمه، هتل، زنجیره هتل، شرکت ریلی/اتوبوس، سازمان، تأمین‌کننده و کارگزار متصل می‌شود؛ جایگزینی و حذف نیز فقط برای فایل مربوط به همان رکورد مجاز است. ۵۰۶ تست API، ۳۳۸ تست Web، lint، typecheck و build تولیدی هر دو برنامه موفق‌اند. این اصلاح Schema، Migration، Seed، Dependency و IAM grant ندارد؛ جزئیات در [MASTER-007](tasks/MASTER-007-LOGO-UPLOAD.md) ثبت شده است.

## WORKBENCH-021 — مخاطبان، گروه و فوروارد پیام

پیام‌رسان میزکار به سرویس پایدار Messaging متصل شد: مخاطبان فعال داخلی CRM با
دامنه شعبه مشترک، گفت‌وگوی مستقیم، ساخت گروه چندنفره، ارسال متن و فوروارد سروری
پیاده‌سازی شدند. IAM حساب‌های غیرفعال و پرتال آژانس را حذف می‌کند؛ هر خواندن و
نوشتن نیز عضویت مقصد و دامنه شعبه را کنترل می‌کند. Migration افزایشی سه جدول با
FK و idempotency دارد و کل ۵۶ Migration در PostgreSQL ایزوله موفق بود. ۱۲۲۲ تست
API، ۱۳۲۷ تست Web، lint، typecheck و build تولیدی ۴۶ route پاس شدند. جزئیات در
[WORKBENCH-021-MESSAGING](tasks/WORKBENCH-021-MESSAGING.md) ثبت شده است.

نسخه ترکیبی `05768d7` روی Web3100 و API4190 فعال است. Migration پس از backup
روی دیتابیس فعلی اعمال شد و ۳۸ کاربر، ۵ شعبه و ۴۴ سند بدون تغییر باقی ماندند.
مرورگر احرازشده سه مخاطب داخلی مجاز و فرم کامل ساخت گروه را تأیید کرد؛ برای QA
هیچ گفت‌وگو، گروه یا پیام واقعی ساخته نشد.

## B2B-RESTORE-REGISTRATION-DOCUMENTS-001 — بازگردانی اسناد فرم ثبت آژانس

فرم مرحله‌ای ثبت آژانس برای سازمان جدید دوباره کنترل کامل فایل سند قرارداد و فایل هر تضمین را نشان می‌دهد. فایل‌های انتخاب‌شده تا زمان ایجاد شناسهٔ پایدار سازمان در همان فرم نگه داشته می‌شوند، سپس از API عمومی Documents ذخیره و پیش از ثبت پیش‌نویس به قرارداد یا تضمین مربوط متصل می‌شوند. دلیل ثبت یا اصلاح نسخه اختیاری شد؛ دلیل تصمیم‌های ارسال، تأیید و رد همچنان برای Audit الزامی است. ۱۲۸ تست Organizations، ۱۲۱ تست B2B API، ۶۷ تست Contracts، lint محدوده، TypeScript و build تولیدی Web/API موفق بودند. مرورگر احرازهویت‌شده روی Web3100 نمایش کنترل‌های قرارداد و تضمین، گزینه‌های واقعی Documents و برچسب دلیل اختیاری را بدون خطای کنسول تأیید کرد؛ هیچ سازمان یا سند آزمایشی ذخیره نشد. بدون Schema، Migration، Seed، Dependency یا تغییر IAM.

## CUSTOMER-AFFAIRS-003 — رابط امور مشتریان با تم نورا

مانع QA زنده: API4190 سالم است اما مبدأ پیش‌نمایش ۳۱۰۲ در CORS آن مجاز نیست؛ ابتدا هماهنگی Runtime و سپس ورود لازم است. سرویس مشترک تغییر داده نشد.

مرجع HTML کاربر به رابط متصل به API با ناوبری پنج‌بخشی، کارت‌های رنگی، فهرست و نمای مرحله‌ای سرنخ‌ها، پیگیری‌های معوق، صف پشتیبانی و گزارش واقعی تبدیل شد. فونت، رنگ‌های روشن/تیره، کنترل‌ها و پوسته اصلی نورا حفظ شده‌اند. فرم‌ها و عملیات برش عملیاتی قبلی بازاستفاده می‌شوند؛ تنظیمات خواندنی است و قابلیت ساختگی ندارد. این شاخه ادامه Draft PR #221 است و تغییری در Schema، Migration یا Backend ندارد. پیش‌نمایش مستقل ۳۱۰۲ پشت ورود عادی است؛ QA تصویری احرازهویت‌شده پس از ورود کاربر باقی می‌ماند. جزئیات و آزمون‌ها: `docs/tasks/CUSTOMER-AFFAIRS-003.md`.

## B2B-REMOVE-HR-REQUESTS-001 — حذف درخواست‌های منابع انسانی از پرونده ۳۶۰

کارت سراسری «درخواست‌های منابع انسانی» در تمام مسیر آژانس‌ها و مشتریان سازمانی، شامل فهرست و همهٔ سکشن‌های پروندهٔ ۳۶۰، مخفی شد. شرط داخلی پروفایل که کارت را بیرون از صفحهٔ مالی دوباره نمایش می‌داد حذف شد. داده‌ها، APIها، مجوزها و ماژول اصلی منابع انسانی تغییری نکردند. هر ۱۲۶ تست Organizations، lint فایل‌های متاثر، TypeScript و build تولیدی ۴۶ مسیر موفق بودند؛ بدون تغییر Schema، Migration، Dependency یا AppShell مرکزی.

## WORKBENCH-035 — قالب‌های تکمیلی پیام‌رسان

دو قالب قابل‌ویرایش «خرید» و «پیگیری صورتحساب» به واحد مالی و قالب «استعلام از کارگزار» به واحد رزرواسیون افزوده شد. هر قالب فیلدهای مرجع پرونده، مبالغ/تاریخ‌ها، طرف‌های مرتبط، توضیحات و فهرست پیوست را داخل ویرایشگر فعلی قرار می‌دهد و از کنترل پیوست موجود پیام‌رسان استفاده می‌کند. این تغییر فقط دادهٔ نمایشی قالب‌هاست و عملیات خرید، پرداخت، رزرو یا ارسال پیام ایجاد نمی‌کند. همهٔ ۴۴ تست میزکار، lint و TypeScript وب و build تولیدی ۴۶ مسیر موفق‌اند. جزئیات در [WORKBENCH-035](tasks/WORKBENCH-035.md).

## B2B-ORGANIZATION-PERMANENT-DELETE-001 — بازیابی درست حذف دائمی

پس از پاسخ خطای قطعی API، دکمهٔ «حذف دائمی» دیگر قفل نمی‌شود و با عنوان «تلاش دوباره» امکان اجرای مجدد دارد؛ پیام خطای قبلی نیز پیش از درخواست بعدی پاک می‌شود. اگر پاسخ سرور نامطمئن باشد، پنجره برای جلوگیری از حذف تکراری فقط پس از تازه‌سازی اجازهٔ ادامه می‌دهد. محدودیت مالک داده حفظ شده است: سازمان بدون وابستگی همراه نقش‌های مالک خودش حذف فیزیکی می‌شود و سازمان دارای قرارداد یا سابقهٔ وابسته حذف نمی‌شود. Lint فایل‌های متاثر، TypeScript، build تولیدی ۴۶ مسیر، ۱۲۵ تست ماژول Organizations و ۷ تست PostgreSQL ایزوله موفق بودند. مرورگر احرازهویت‌شده روی Web3100 نسخهٔ ادغام‌شده، بارگذاری فهرست ۸ سازمان و فعال‌بودن دکمهٔ قرمز پنجره را تأیید کرد؛ برای QA رابط هیچ داده‌ای از محیط کاربر حذف نشد. Runtime `b9244f4` / `hr005-72ea3c0ada5a1190` و API4190 سالم‌اند. بدون تغییر Schema، Migration، مجوز یا حذف آبشاری سوابق کسب‌وکار.

## CUSTOMER-AFFAIRS-002 — برش عملیاتی امن

بنیاد امور مشتریان به Vertical Slice پایدار برای Lead و Ticket ارتقا یافت: صف/مالک و
اقدام بعدی، Timeline، تشخیص تکرار، Handoff واقعی و نسخه‌دار Sales، ارجاع پایدار در
Workbench، SLA/تصعید، حل/بستن/بازگشایی، دعوت رضایت‌سنجی عمومی یک‌باره، اقدام اصلاحی،
IAM/Audit و گزارش branch-scoped پیاده شده‌اند. اتصال Customer، Sales، Reservation و
Document از public service است و reference فاقد adapter به‌صورت fail-closed رد می‌شود.
Migration از صفر روی DB ایزوله با همه ۵۶ migration موفق بوده و DB مشترک تغییر نکرده است.
هر دو اجرای Seed موفق بود، ۹ workspace تست سریال، lint، typecheck، build تولیدی،
Prettier فایل‌های Task، scope/secret/PII scan و `git diff --check` پاس شدند. Prettier کل
Repository به‌علت ۱۰۹۵ بدهی baseline خارج از Scope پاس نیست. Smoke واقعی API و
QA احرازهویت‌شده Desktop/Mobile روی `localhost:3100` نیز پاس شدند. جزئیات در
[CUSTOMER-AFFAIRS-002](tasks/CUSTOMER-AFFAIRS-002.md) است.
[CUSTOMER-AFFAIRS-002](tasks/CUSTOMER-AFFAIRS-002.md) است. Draft PR #221 آماده Review و
Migration/Contract/Central Docs lockها آزاد شدند.

## B2B-FINANCE-EXPORT-LAYOUT-001 — خروجی‌های فشرده مالی

یادداشت محدودیت دادهٔ آزمایشی از صفحه‌های مالی پروندهٔ ۳۶۰ حذف شد. خروجی Excel اسناد و خروجی Excel ردیف‌های فیلترشده به‌صورت دکمه‌های کوچک در سربرگ کارت اسناد، کنار اقدام ثبت مشخصات و فایل، قرار گرفتند و این چیدمان مشترک در همهٔ شش صفحهٔ مالی اعمال می‌شود. رفتار و دامنهٔ دادهٔ خروجی تغییر نکرد. Lint دو مؤلفه، TypeScript، ۱۴ تست هدفمند و build تولیدی ۴۶ مسیر موفق بودند. مرورگر احرازهویت‌شده چیدمان صفحه و حذف متن را تأیید کرد و هر دو فایل `financial-documents.xlsx` و `finance-preview-statement.xlsx` از Web3100 ساخته شدند. Web3100 با source `4a2656d` و manifest `hr005-a6cab0ba70c201ba` فعال است؛ API بدون تغییر باقی ماند. تغییر پیاده‌سازی از طریق PR212 در `develop` ادغام شد.

## WORKBENCH-034 — ارسال پایدار نظرسنجی

فرم «نظرسنجی و پیشنهادها» در خانه از حالت پیش‌نویس خارج شد. کاربر احرازشده موضوع، متن، واحد مقصد، حالت با نام/ناشناس و حداکثر ۱۰ پیوست PDF/تصویر را ارسال می‌کند؛ پیوست‌ها ابتدا با مرجع همان نظرسنجی در Documents ذخیره و بررسی می‌شوند و سپس رکورد پایدار با کد پیگیری ثبت می‌شود. گیرندگان از حساب‌های فعال همان شعبه و واحد منابع انسانی تعیین می‌شوند و در نبود اتصال کارمند، مدیران فعال همان شعبه اعلان را دریافت می‌کنند. اعلان به جزئیات متن کامل وصل است و فقط فرستنده یا گیرنده مجاز آن را می‌بیند. اعلان و نمای گیرندهٔ ارسال ناشناس فاقد هویت فرستنده‌اند؛ شناسه فرستنده فقط برای Audit در رکورد Workbench باقی می‌ماند. متن‌های پیش‌نویس حذف و دکمه ارسال فعال شد.

Migration افزایشی `20260912173000_workbench_feedback` پس از Backup و تمرین کامل روی کپی دیتابیس اعمال شد. Runtime مشترک Web3100/API4190 با دیتابیس و مخزن اسناد قبلی فعال است؛ مرورگر احرازشده نبود متن منسوخ، فعال‌بودن دکمه و متن ذخیره پیوست را تأیید کرد. ۱۲۲۲ تست API، ۱۳۱۹ تست Web با دو Timeout قدیمی HR زیر بار موازی، اجرای جداگانه موفق همان ۵۴ تست HR، ۴۴ تست Workbench، ۷۳ تست Database و ۶۸ تست Contracts عبور کردند؛ lint، typecheck و Build تولیدی ۴۶ مسیر نیز موفق‌اند. جزئیات در [WORKBENCH-034](tasks/WORKBENCH-034.md).

## WORKBENCH-033 — جابه‌جایی دسترسی سریع

کارت «دسترسی سریع» از ستون فرعی به ستون اصلی منتقل و دقیقاً بالای «اعلان‌های من» قرار گرفت. سه لینک پروفایل، فایل‌ها و پیگیری درخواست‌ها در نمایش عریض کنار هم هستند و رفتارشان تغییر نکرده است. Source833458d در runtime ترکیبی7f4f793 همراه اصلاح Excel آژانس‌ها حفظ شد. Lint، TypeScript و build تولیدی۴۶مسیر موفق؛ مرورگر احرازهویت‌شده ترتیب DOM و ظاهر صفحه را بدون خطای کنسول تأیید کرد. Web3100 PID29632/build gEMl1G7UjZStBq4fPr6UF؛ Draft PR212.

## WORKBENCH-032 — فرم رویداد و پرداخت بصری میزکار

فیلترهای تاریخ یادداشت به «از تاریخ» و «تا تاریخ» کوتاه شدند. تقویم فرم افزودن رویداد با عنوان، تاریخ، متن، لینک امن و تصویر تا ۵ مگابایت دارد و رویداد تازه را همان لحظه در روز مربوط همراه جزئیات، تصویر و لینک نمایش می‌دهد. این رویدادها فعلاً فقط در نشست مرورگر می‌مانند و API/Schema تغییری نکرده است. کارت انتخاب تم از تنظیمات شخصی حذف شد تا کنترل روشن/تیره فقط در سربرگ اصلی باشد. پیام‌رسان با سربرگ گرادیانی، فهرست واحدها و کارت‌های قالب رنگی بازطراحی شد و متن‌های وضعیت «فعال نیست/در دسترس نیست» از نمای پیام و پنجره پیام جدید حذف شدند؛ ارسال واقعی همچنان به سرویس پیام‌رسان وابسته است. ۵۶ تست Workbench/Profile، lint، TypeScript و build تولیدی ۴۶ مسیر موفق؛ مرورگر احرازهویت‌شده هر چهار تغییر و افزودن رویداد دارای متن/لینک/تصویر را بدون خطای کنسول تأیید کرد. Web3100 source623fbb0/PID14168/buildGhIUre85BIXBxND2PRsp2؛ API4190/PID15024 بدون تغییر. Draft PR211. جزئیات در [WORKBENCH-032](tasks/WORKBENCH-032.md).

## WORKBENCH-031 — رنگ نظرسنجی

کارت نظرسنجی پس‌زمینه یاسی/نیلی ملایم و حاشیه بنفش با variant تیره دارد. رفتار فرم تغییر نکرد. Lint و build۴۶route/TypeScript موفق؛ تصویر مرورگر تمایز کارت از اعلان سفید را تأیید کرد. Web3100 source1bf840b/PID8604/manifesthr005-ef61a0178f542c46؛ اصلاح subtitle آژانسf03d34c حفظ شد و API بدون تغییر. Draft PR210.

## WORKBENCH-030 — پنج اعلان منابع انسانی

خانه فقط پنج اعلان جدیدتر منابع انسانی را نشان می‌دهد؛ مشاهده همه همچنان فهرست کامل دریافتی مجاز را باز می‌کند. ۴۳ تست، lint و build۴۶route/TypeScript موفق؛ مرورگر پنج ردیف خانه و فهرست بزرگ‌تر مشاهده همه را تأیید کرد. Web3100 source84db303/PID18888/manifesthr005-aa1167e96130d48c؛ API بدون تغییر. Draft PR208.

## WORKBENCH-029 — قالب‌های رزرواسیون

چهار قالب مشخصات هتل با ظرفیت/ضریب/قیمت، هتل آلترنیتیو، بیمه و اصلاحیه با متن قابل‌ویرایش اضافه شد. از پیوست محلی موجود استفاده می‌شود؛ ارسال و بارگذاری واقعی متصل نیست. ۴۳ تست و lint موفق؛ تغییر footer آژانسd73d6bb حفظ شد. بدون عملیات رزرواسیون، بیمه، API یا Schema. Draft PR207. Build۴۶route و TypeScript موفق؛ مرورگر قالب‌ها و درج ظرفیت/ضریب/قیمت را تأیید کرد. Web3100 source6a5f848/PID25276/manifesthr005-89cc92386e0b762d؛ API بدون تغییر.

## WORKBENCH-028 — قالب‌های مالی

هشت قالب پیگیری تسویه، دریافتی، پرداختی، ارسال فیش، ارسال رسید، بستن حواله، اصلاحیه و صرافی با متن قابل‌ویرایش افزوده شد. از پیوست محلی موجود استفاده می‌شود؛ ارسال/بارگذاری واقعی یا عملیات مالی انجام نمی‌شود. ۴۳ تست، lint و build۴۶route/TypeScript موفق؛ مرورگر هشت قالب و درج متن حواله را تأیید کرد. Web3100 source96b6d2d/PID19644/manifesthr005-2bae95a936e93270؛ API بدون تغییر. Draft PR205.

## WORKBENCH-027 — حذف بخش وظایف

بخش وظایف و اتوماسیون از منو و مسیرهای جست‌وجوی مبتنی بر منو حذف شد. /tasks به /workbench هدایت می‌شود و اعلان تغییر قدیمی نیز به میزکار می‌رود. رکوردهای ذخیره‌شده یا API تغییر نکردند. ۱۳ تست ناوبری و lint موفق؛ Draft PR204. Build۴۶route و TypeScript موفق؛ مرورگر هدایت /tasks به میزکار و وجود فقط میزکار/داشبورد در گروه فضای کار را تأیید کرد. Web3100 source8660ad1/PID4684/manifesthr005-6177de449063aa7d؛ API بدون تغییر.

## WORKBENCH-026 — قالب‌های فروش

شش قالب اطلاعات تور، ظرفیت هتل‌ها، فیش واریزی، عکس پاسپورت، اطلاعات مشتری و قرارداد اضافه شد. اطلاعات تور شامل تاریخ رفت/برگشت، هتل و تعداد نفرات است؛ اطلاعات مشتری آدرس، شماره تماس و کد ملی دارد. همه متن‌ها قابل ویرایش و پیوست موجود قابل انتخاب‌اند؛ بارگذاری/ارسال واقعی همچنان فعال نیست. ۴۳ تست و lint موفق؛ Draft PR203. Build۴۶route و TypeScript موفق؛ مرورگر شش قالب و درج تاریخ/هتل/تعداد نفرات در متن را تأیید کرد. Web3100 sourcec0763cd/PID11996/manifesthr005-e28a1f0831a35fc2؛ API بدون تغییر. بدون داده واقعی یا تغییر API/Schema.

## WORKBENCH-025 — قالب‌های منابع انسانی

چهار قالب مشکلات سیستم و اینترنت، حقوق و مساعده، مرخصی، مدارک و اسناد با متن آماده قابل‌ویرایش و استفاده از کنترل پیوست موجود پیام‌رسان افزوده شد. فایل‌ها همچنان محلی‌اند و بارگذاری/ارسال واقعی فعال نیست. ۴۳ تست، lint و build۴۶route شامل TypeScript موفق؛ مرورگر چهار دکمه و درج متن را تأیید کرد. Web3100 source490870d/PID20556/manifesthr005-0981078b731c3983، API بدون تغییر؛ PR202 پیش‌نویس.

## WORKBENCH-024 — منوی حساب کوتاه

منوی حساب فقط «میزکار من» و «خروج از حساب» دارد؛ اطلاعات هویت روی دکمه سربرگ و رفتار خروج حفظ شدند. ۴ تست موجود، lint، TypeScript و build۴۶route موفق؛ مرورگر دقیقاً دو گزینه را تأیید کرد و خروج اجرا نشد. Web3100 source8b90094/PID13100/manifesthr005-7f2161165a8a8bf2 با حفظ اصلاح قلم آژانسa64ea2f؛ API بدون تغییر. Draft PR201.

## WORKBENCH-023 — نظرسنجی خانه

فرم نظرسنجی و پیشنهادها شامل موضوع/متن، واحد مقصد، فایل اختیاری و انتخاب با نام/ناشناس آماده است. کنترل‌ها با تم نورا هماهنگ‌اند. فایل‌ها فقط محلی انتخاب می‌شوند؛ سرویس ذخیره/ارسال و تضمین ناشناس‌بودن نزد گیرنده وجود ندارد، بنابراین دکمه ارسال غیرفعال و وضعیت پیش‌نویس صریح است. ۴۳ تست، lint، TypeScript و build۴۶route موفق؛ تغییرات لوگوی آژانس4786181 حفظ شده‌اند. بدون API/Schema/Migration. Draft PR199. مرورگر ورود/ویرایش متن، تغییر انتخاب ناشناس و بازنشانی فرم را تأیید کرد؛ داده آزمایشی پاک شد. Web3100 source37b72b8/PID12744/manifesthr005-33cbcefa9c0098c6؛ API بدون تغییر.

## WORKBENCH-022 — قالب و پیوست ویزا

قالب‌های مدارک ویزا و فیش واریزی با متن قابل‌ویرایش افزوده شد. انتخاب حداکثر۱۰ فایل PDF/تصویر تا۱۰MB برای هر فایل، حذف و تعویض محلی پیوست‌ها و جداسازی پیوست هر واحد آماده است. بارگذاری/ارسال واقعی انجام نمی‌شود و این محدودیت در UI روشن است؛ WORKBENCH-021 منتظر هماهنگی Migration است. ۴۳ تست، lint، TypeScript و build۴۶route موفق؛ مرورگر انتخاب قالب فیش و ویرایش متن و حضور کنترل فایل را تأیید کرد، پیش‌نویس آزمایشی بازنشانی شد. Web3100 source3bd4f5b/PID26640/manifesthr005-8878b91f78e1ba9e با حفظ footer8ff2da8؛ API بدون تغییر. Draft PR197.

## WORKBENCH-020 — دراپ‌داون هماهنگ نورا

شش انتخاب‌گر میزکار (درخواست، پیام، پوشه یادداشت و فیلتر تقویم) از Select مشترک نورا استفاده می‌کنند. حالت همه پوشه‌ها با مقدار خالی حفظ شد؛ بدون تغییر کنترل مشترک/API/وابستگی. ۴۳ تست، lint، TypeScript و build۴۶route موفق. مرورگر منوی درخواست در روشن/تیره و انتخاب با صفحه‌کلید را تأیید کرد؛ تم اولیه بازگردانده و پیش‌نویس آزمایشی بازنشانی شد. Web3100 sourcece2ca88/PID25968/manifesthr005-24fe5f715ad402af؛ API بدون تغییر. Draft PR195، بدون مرج.

## WORKBENCH-019 — واحدهای پیام و خلاصه خانه

ویزا، منابع انسانی و مدیریت با قالب‌های آماده افزوده شدند؛ همه هفت واحد در فهرست پیام‌ها و عنوان گفت‌وگو آیکن دارند. خانه برای هر فهرست اعلان و اسناد حداکثر۱۰ مورد نشان می‌دهد؛ مشاهده همه اعلان‌ها پنجره فهرست دریافتی (سقف سرویس۵۰ اعلان سامانه) و اسناد مسیر فایل‌های من را باز می‌کند. ارسال پیام همچنان سرویس فعال ندارد. ۴۳ تست، lint، TypeScript و build۴۶route موفق؛ Web3100 sourcec8164fc/PID27312/manifesthr005-da948517ea153e3e با حفظ اصلاحات خروجی آژانس. API بدون تغییر.

## WORKBENCH-018 — تقویم میزکار

تأیید نهایی: ۴۳ تست، lint، TypeScript و build با ۴۶ مسیر موفق. مرورگر احرازهویت‌شده پیمایش ماه/امروز، هفته، برنامه، بدون تاریخ و انتخاب روز را تأیید کرد. Web3100 با source9f5ef8c، PID4996 و manifesthr005-de22f3cb4ce5141b فعال است؛ API4190 تغییر نکرد. PR192 پیش‌نویس و مرج نشده است. اتصال موعدهای واقعی همچنان ارائه نشده است.

تب مستقل «تقویم من» با ظاهر هماهنگ نورا و مرجع تصویر558، نماهای ماه/هفته/برنامه/بدون تاریخ، پیمایش ماه و هفته، امروز، انتخاب روز، جست‌وجو و فیلتر وضعیت/اولویت اضافه شد. محاسبات شمسی از ابزار مشترک و انتساب موعد به روز از منطقه زمانی تهران استفاده می‌کند؛ هفته از شنبه است. مدل نمایش برای موعد اقدام آماده است، اما هیچ سرویس موعد کار/درخواست فعالی در میزکار وجود ندارد؛ این محدودیت صریح نمایش داده شده و زمان اعلان‌ها یا داده ساختگی جایگزین موعد نمی‌شوند. ۴۳ تست میزکار و lint موفق؛ بدون API، Schema یا وابستگی تازه.

## WORKBENCH-017 — فرم اطلاعات شخصی و عکس

تأیید نهایی UI: ۲۰ تست پروفایل/خروجی، lint، TypeScript و build۴۳route موفق. انتخاب عکس محلی، پیش‌نمایش، ورود شماره و بازنشانی در مرورگر تأیید شدند؛ داده آزمایشی پاک شد. Web3100 source1af4c0c/PID19708 با حفظ صادرات آژانس و اصلاح تاریخ PDF؛ PR190 پیش‌نویس. ذخیرهٔ واقعی همچنان انجام نشده و مجوز جدید IAM/Migration لازم است؛ API بدون تغییر.

فرم قابل ویرایش نام، ایمیل، شماره تماس و انتخاب/تعویض/حذف پیش‌نمایش عکس به تنظیمات شخصی اضافه شد؛ نام کاربری فقط‌خواندنی است. نوع واقعی فایل، حجم و decode تصویر بررسی می‌شود؛ داده در مرورگر ذخیره یا به سرویس ارسال نشده است. ذخیره واقعی تا واگذاری محدوده IAM/profile و تعیین قفل Migration غیرفعال و این محدودیت در فرم آشکار است. هماهنگ‌کننده تأیید کرد مجوز قبلی change-password این محدوده را پوشش نمی‌دهد؛ فعال‌سازی API نیز محدودیت مستقل قبلی دارد. ۱۲ تست پروفایل موفق. جزئیات در tasks/WORKBENCH-017-PERSONAL-PROFILE.md.

## WORKBENCH-016 — تفکیک تنظیمات و لاگ نشست‌ها

پیگیری عنوان: «خلاصه Permissionها» مطابق درخواست کاربر به «خلاصه دسترسی‌ها» تغییر کرد؛ فقط متن عنوان و بدون تغییر رفتار.

تأیید نهایی: ۸ تست، lint، TypeScript و build۴۳route موفق. مرورگر جدول لاگ بدون کارت حساب/دسترسی/نوار تکراری و تغییر واقعی تم با ماندگاری پس از reload را تأیید کرد؛ تم اولیه بازگردانده شد. Web3100 source86bb4a3/PID2772 با حفظ هر دو اصلاح toolbar آژانس؛ API دست‌نخورده. PR186 پیش‌نویس. اجرای Web پس از QA به مالک B2B برای حذف متن پرونده تحویل شد.

صفحه نشست‌ها فقط جدول زمان‌ها و وضعیت واقعی نشست‌های برگردانده‌شده از IAM را نمایش می‌دهد؛ سوابق تمدید/ابطال نیز برخلاف فیلتر قبلی حذف نمی‌شوند. اطلاعات حساب و دسترسی فقط در پروفایل است؛ نوار تکراری سه مسیر حذف شد. تنظیمات شخصی انتخاب واقعی روشن/تیره از ThemeProvider موجود با ماندگاری همان مرورگر دارد. برچسب میزکار «لاگ نشست‌ها» شد و وسط‌چینی حفظ شد. بدون تغییر API، قرارداد، پایگاه‌داده یا وابستگی. هشت تست پروفایل و TypeScript موفق؛ بررسی نهایی runtime پس از حفظ تغییر toolbar آژانس ثبت می‌شود.

## WORKBENCH-015 — وسط‌چین تنظیمات

برچسب و آیکن هر چهار اقدام حساب/تنظیمات میزکار وسط‌چین شد؛ تغییر فقط روی grid همان بخش است. Lint/typecheck و build۴۳route موفق. Web3100 source12c7c41/PID16500/manifesthr005-a72efdb4f2700f73؛ حذف subtitle آژانسe03afcf و تغییرات قبلی حفظ شدند. API دست‌نخورده؛ PR183 پیش‌نویس.

## WORKBENCH-014 — نمای کارت‌های یادداشت

براساس تصاویر552/553، دفتر یادداشت با کارت‌های کرم سه‌ستونه، جست‌وجو، فیلتر پوشه/تاریخ، پوشه جدید و کنترل ویرایش/سنجاق/حذف قابل بازگردانی ساخته شد. چک‌لیست روی کارت تیک و خط‌خوردن دارد. سه کارت اولیه صریحاً «قالب نمونه» هستند؛ اعمال ویرایش فقط پیش‌نویس حافظه صفحه است، نه ذخیره در حساب. هیچ API، Schema، Migration، browser storage یا ارسال داده ایجاد نشد؛ مجوز توسعه persistence همچنان پاسخ نگرفته است. پنجره‌های ویرایش هنگام بسته‌شدن دیگر میزکار را دوباره بارگذاری نمی‌کنند. Typecheck/lint و ۳۷ تست موجود میزکار موفق؛ runtime/QA نهایی پس از handoff ثبت می‌شود.

## WORKBENCH-012 — واحدهای مخاطب و قالب پیام

## 2026-09-12 — تجمیع نسخه‌های نهایی چندکامپیوتری

- شاخه `codex/pc-a-unified-latest-0912` آخرین Commitهای منتشرشده رزرواسیون،
  رابط کاربری مشترک، حسابداری، مدیریت قیمت، آژانس‌ها، میزکار و مجوز Reporting
  را بدون دست‌کاری Workspaceهای Dirty کنار هم قرار داده است.
- اختلاف‌های مشترک Navigation، DatePicker، تم تیره، تاریخ انقضای اسناد آژانس و
  صفحات جدید Finance/Reservations با حفظ جدیدترین رفتار هر بخش حل شدند.
- وضعیت فعلی `READY_FOR_MERGE` است: نصب Frozen، Prisma، lint، typecheck، ۲۶۵۴
  تست و Build شش Task/۴۶ Route پاس شدند. `main` در این عملیات تغییر نمی‌کند.

## خروجی بازه‌ای MANIFEST ایران ایرتور آنتالیا — 2026-09-12

بخش MANIFEST اکنون بازه تاریخ رفت را با تقویم میلادی می‌گیرد و دو خروجی دارد:
«فقط قراردادهای جدید» و «همه قراردادهای بازه». هر اجرای موفق و نسخه قراردادهای داخل
آن ذخیره می‌شود؛ بنابراین قرارداد یا نسخه تازه در خروجی بعدی جدید شناخته می‌شود.
آخرین نسخه هر قرارداد به ترتیب تاریخ رفت و شماره قرارداد در همان قالب رسمی
ایران ایرتور/اسپارتا قرار می‌گیرد. Gate مالی و مجوز اطلاعات حساس حفظ و موارد در
انتظار مالی از فایل حذف می‌شوند. Migration افزایشی روی دیتابیس لوکال موجود است؛
۴ تست API، ۱۶ تست Web، lint، typecheck، build تولیدی و بازبینی مرورگر موفق‌اند.
بدون داده واقعی، ارسال به ایرلاین یا تغییر IAM.
[گزارش](tasks/RESERVATION-MANIFEST-BATCH-0912.md).

## WORKBENCH-015 — وسط‌چین تنظیمات

برچسب و آیکن هر چهار اقدام حساب/تنظیمات میزکار وسط‌چین شد؛ تغییر فقط روی grid همان بخش است. Lint/typecheck و build۴۳route موفق. Web3100 source12c7c41/PID16500/manifesthr005-a72efdb4f2700f73؛ حذف subtitle آژانسe03afcf و تغییرات قبلی حفظ شدند. API دست‌نخورده؛ PR183 پیش‌نویس.

## WORKBENCH-014 — نمای کارت‌های یادداشت

براساس تصاویر552/553، دفتر یادداشت با کارت‌های کرم سه‌ستونه، جست‌وجو، فیلتر پوشه/تاریخ، پوشه جدید و کنترل ویرایش/سنجاق/حذف قابل بازگردانی ساخته شد. چک‌لیست روی کارت تیک و خط‌خوردن دارد. سه کارت اولیه صریحاً «قالب نمونه» هستند؛ اعمال ویرایش فقط پیش‌نویس حافظه صفحه است، نه ذخیره در حساب. هیچ API، Schema، Migration، browser storage یا ارسال داده ایجاد نشد؛ مجوز توسعه persistence همچنان پاسخ نگرفته است. پنجره‌های ویرایش هنگام بسته‌شدن دیگر میزکار را دوباره بارگذاری نمی‌کنند. Typecheck/lint و ۳۷ تست موجود میزکار موفق؛ runtime/QA نهایی پس از handoff ثبت می‌شود.

## REPORTING — مجوز اجرای PC-C و Gate مرحله P0-04

- `COMPUTER_ID=PC-C` برای ادامه Reporting در محدوده ماژول‌های Web/API Reporting،
  اسناد `REPORTING-*` و اجرای محلی پورت 3000 مجاز شد. Workspace و Worktree اعلام‌شده
  مقصد به‌ترتیب `F:/Projects/Nora` و `F:/Projects/Nora/.worktrees/reporting` هستند؛
  وجود و Writable بودن آن‌ها باید روی خود PC-C تأیید شود.
- مالکیت دائمی تغییر نکرد: PC-A مسئول Backend/grain و PC-B مسئول رابط مرکزی است؛ PC-C
  مجری تفویض‌شده P0 با Branch مستقل است. هیچ قفل Migration، Schema، Seed، Dependency،
  Lockfile یا shared contract به این مجوز منتقل نشد.
- مبنای محلی اعلام‌شده P0-01=`dcf2b2e`، P0-02=`b429b94` و P0-03=`f4f85bc` است، ولی
  این Commitها و Branch ریموت Reporting در fetch مرجع 2026-09-10 قابل مشاهده نبودند.
  بنابراین شروع P0-04 از نظر مجوز آماده است و از نظر Git فقط پس از تأیید محلی Commitها،
  کنترل Working Tree و Push معمولی شاخه PC-C آماده محسوب می‌شود.
- جزئیات Scope، امنیت، پورت و Handoff در
  [REPORTING-PC-C-AUTHORIZATION](tasks/REPORTING-PC-C-AUTHORIZATION.md) ثبت شده است.

## SALES-PRICE-MANAGEMENT-0912 — READY_FOR_REVIEW / UI_PREVIEW — 2026-09-12

- PC-A روی شاخه مستقل و stacked `codex/pc-a-pricing-management` ورودی «مدیریت قیمت»
  را بلافاصله پس از «قرارداد» در گروه فروش و route مستقل `/pricing-management` اضافه کرد.
- صفحه RTL و Responsive شامل قیمت‌های روزانه تورهای شرکت و بلیت‌های ملکی، فیلتر
  تاریخ/نوع/جست‌وجو، اعتبارسنجی مبلغ و ارز، انتخاب اقلام، پیش‌نمایش بنر و دانلود واقعی
  PNG مربع ۱۲۰۰ پیکسل در سه تم است.
- ۲۳ تست هدفمند، Web typecheck، lint محدود و Production Build با ۴۲ مسیر موفق‌اند؛
  Browser نمایش صفحه و پیام موفقیت ساخت PNG را بدون خطای Console تأیید کرد.
- Commit قابلیت `c8f41fc` Push و Draft PR #161 با base شاخه مالی stacked ایجاد شد.
- داده‌ها صریحاً synthetic و اعمال قیمت فقط Preview همان نشست است. ذخیره و انتشار
  عملیاتی تا قرارداد عمومی Ticket/Tour، Permission، Audit، optimistic version و
  Migration مستقل پیاده نشده و ادعا نمی‌شود.
- این شاخه برای حفظ ناوبری تأییدشده مالی روی `77e181d` و PR #153 قرار دارد؛ ادغام
  باید با رعایت همین وابستگی انجام شود. جزئیات: [SALES-PRICE-MANAGEMENT-0912.md](tasks/SALES-PRICE-MANAGEMENT-0912.md).

## FINANCE-002A — READY_FOR_REVIEW / PERSISTENCE_BLOCKED — 2026-09-12

- PC-A روی Branch `codex/pc-a-finance-core-accounting` از `origin/develop@4717b13`
  صفحات مستقل حسابداری و کارتابل مالی، Domain invariantهای Phase A و قراردادهای versioned
  دریافت/پرداخت را تکمیل کرد. Workspace قبلی FINANCE-001 حفظ شده است.
- Commitهای `d513e08` و `6de5d94` Push و Draft PR #153 به `develop` ایجاد شد.
- ۶۴ Contract test، ۱۹ Finance API test و ۱۴ Finance Web test پاس؛ lint/typecheck/build
  Web/API و Smoke مستقل Web3200/API4200 موفق است.
- Prisma/Migration/Seed و runtime رزرواسیون تغییر نکرد. Persistence، Posting واقعی،
  Audit پایدار و Outbox/Event تا Handoff قفل Migration برابر `BLOCKED` باقی می‌مانند.
- پیگیری رابط مطابق مرجع تصویری: «حسابداری»، «کارتابل درخواست‌ها» و «خرید و تأمین» به
  همین ترتیب سه آیتم گروه «مالی» هستند؛ `/finance` و `/finance/requests` صفحه‌های مستقل‌اند.
  ۳۱ تست هدفمند Web و ۶۴ تست Contract، lint/typecheck و Build نهایی ۴۱ مسیر موفق‌اند.
- پیگیری دوم فرم‌ها: نام/مبلغ/پرداخت قبلی/مانده قرارداد در دریافت و پرداخت دیده می‌شود؛
  دریافت حساب مقصد و پرداخت حساب مبدأ واقعیِ فهرست کدینگ را فقط از حساب‌های فعال، قابل
  Posting و هم‌ارز انتخاب می‌کنند. قرارداد و کارگزار مشخص‌اند؛ پرداخت‌های جزئی با ردیف
  مبلغ/پیگیری قابل افزودن و حذف، جمع و مانده بعد از عملیات و سابقه پرداخت نمایش داده
  می‌شوند. فیلدهای فنی Version/Idempotency از UI حذف و داخلی ماندند. ۳۲ تست هدفمند Web،
  typecheck، lint محدود، Build ۴۱ مسیر و Browser QA موفق‌اند؛ Persistence/Posting مسدود است.
- Commit پیگیری `70fde9b` روی شاخه مالی Push و به Draft PR #153 اضافه شد.
- پیگیری سوم فرم‌ها: «توضیح مالی» اختیاری شد و فیش/مدارک همراه درخواست با metadata امن،
  زمان UTC و وضعیت Scan در همان Dialog دیده می‌شوند؛ حالت بدون فایل نیز مشخص است. Finance
  فایل را کپی نمی‌کند و فقط Snapshot مرجع Documents را نمایش می‌دهد. ۳۳ تست هدفمند Web
  به‌همراه typecheck، lint محدود، Build ۴۱ مسیر و Browser QA موفق‌اند؛ Persistence و
  دریافت باینری واقعی همچنان در Task قفل‌شده بعدی است.
- Commit پیگیری فیش `7e673e8` روی شاخه مالی Push و به Draft PR #153 اضافه شد.
- پیگیری چهارم پرداخت: روش هر ردیف پرداخت جزئی اجباری و مستقل شد؛ حواله بانکی، چک، نقد،
  کارت‌خوان، کارت‌به‌کارت، برداشت مستقیم و سایر پشتیبانی می‌شوند. برای چک شماره چک اجباری
  و برای بقیه روش‌ها شماره پیگیری/مرجع اختیاری است. ۳۴ تست هدفمند Web، typecheck، lint،
  Build ۴۱ مسیر و Browser QA موفق‌اند. Commit `801455f` به Draft PR #153 Push شد؛ این
  فیلد تا Persistence بعدی هنوز ثبت پایدار ندارد.
- پیگیری پنجم نرخ ارز: در دریافت/پرداخت غیرریالی، نرخ روز هر واحد ارز به ریال اجباری است،
  معادل ریالی عملیات هم‌زمان محاسبه می‌شود و سابقه مبلغ ارزی، نرخ Snapshot، معادل ریالی و
  UTC را نمایش می‌دهد. ۳۶ تست هدفمند Web، typecheck، lint، Build ۴۱ مسیر و Browser QA
  موفق‌اند؛ نرخ فعلی ورودی کنترل‌شده Preview است و اتصال منبع authoritative/ذخیره پایدار
  به Task بعد از Migration واگذار شد. Commit `9f4e01d` به Draft PR #153 Push شد.
- جزئیات: [FINANCE-002A-ACCOUNTING-AND-INBOX.md](tasks/FINANCE-002A-ACCOUNTING-AND-INBOX.md).

## HR-013 — اتصال فرم‌ها و ارجاع بین منابع انسانی و بخش‌های سامانه — آماده ادغام تأییدشده

- مالک محصول اتصال واقعی داده‌ها به فرم‌ها و سپس Push/Merge را صریحاً درخواست کرد. PR #139 شامل لایه ارجاع اولیه و این تکمیل فرم‌هاست؛ ادغام به develop پس از موفقیت CI نسخه نهایی انجام می‌شود. فعال‌سازی اجرای محلی مستقل از این ادغام است.

- شاخه مستقل `codex/pc-b-hr-module-connections` از `origin/develop@e07c0c6`: فرم ارجاع از پرونده HR، صندوق مقصدها در ۱۶ مسیر منو، ۱۳ مجوز دریافت مستقل، فیلتر/صفحه‌بندی/آمار درخواست‌ها و سابقه پاسخ اضافه شد. تعریف بلیط از صندوق رزرواسیون استفاده می‌کند و داشبورد/گزارش‌ها فقط نمای مجاز همین درخواست‌ها هستند.
- درخواست با FK پرونده و کارمند، نسخه مبنا و متن صریحاً قابل اشتراک ذخیره می‌شود؛ کنترل شعبه، مجوز مقصد، منع پاسخ به درخواست خود، idempotency و optimistic concurrency اعمال می‌شوند. پاسخ به فرستنده برمی‌گردد و اعلان پایدار دارد. پرونده محرمانه از صندوق مقصد قابل خواندن نیست.
- فرم کارمند از حساب‌های فعال و آزاد IAM گزینه می‌گیرد و userId واقعی را ذخیره/بازخوانی می‌کند. ارز فرم‌های مالی HR از اطلاعات پایه می‌آید و هنگام ذخیره اعتبارسنجی می‌شود. فایل آرشیو با جست‌وجو و صفحه‌بندی در فرم HR قابل انتخاب است و FK سند با کنترل شعبه ذخیره می‌شود. اسناد هم می‌تواند پرونده کارمند را مستقیم از HR انتخاب کند؛ مرجع و نام پیش از بارگذاری از سرویس عمومی HR تأیید می‌شوند.
- فهرست مشترک کارکنان برای طرف‌حساب مالی، مسئول امور مشتریان و مسئول فرم‌های پایه از جمله میز کار/خرید در دسترس است؛ شناسه از نام جدا می‌ماند و کارکنان غیرفعال/حذف‌شده یا خارج شعبه در انتخاب‌ها نمی‌آیند. مجوز مستقل `hr.directory.read` دسترسی به پرونده محرمانه نمی‌دهد. فرم‌های مقصدی که Backend ذخیره ندارند همچنان پیش‌نمایش بودن را نشان می‌دهند.
- ۴۶۹ تست هدفمند موفق: ۱۵۷ Web، ۱۵۰ API، ۲۶ PostgreSQL مجزا، ۶۳ Contracts و ۷۳ Database. آزمون‌ها رفت‌وبرگشت IAM ↔ HR، صفحه‌بندی و دامنه مجاز، ارز فعال/غیرفعال و سندِ هم‌شعبه/شعبه دیگر را پوشش می‌دهند. جزئیات lint/typecheck/build و handoff در سند Task است.
- پرداخت واقعی، صدور سفر، قطع خودکار دسترسی، تکمیل خرید و اتصال دستگاه اجرا نشده‌اند. بدون Migration، تغییر Dependency، تغییر کاربر واقعی یا جایگزینی اجرای ۳۱۰۰. جزئیات استقرار هماهنگ و موارد باقی‌مانده: `docs/tasks/HR-013-CONNECTIONS.md`.

## خروجی مستقیم PDF بلیط رزرواسیون — 2026-09-12 — فعال در لوکال

پنجرهٔ «بلیط» اکنون برای مسافر انتخاب‌شده یا همهٔ مسافران دانلود مستقیم PDF دارد و چاپ مرورگر نیز حفظ شده است. خروجی فقط از snapshot ذخیره‌شدهٔ قرارداد و با سربرگ انتخاب‌شده ساخته می‌شود؛ چون سامانه هنوز شماره بلیط، PNR و بار مجاز صادرشده دریافت نمی‌کند، سند با برچسب روشن «پیش‌نمایش و فاقد اعتبار سفر» تحویل می‌شود. تأخیر تحویل فایل توسط Chrome در ویندوز نیز مدیریت شد. ۱۱ تست هدفمند، lint، typecheck، build تولیدی ۴۱ مسیر، تولید PDF یک‌صفحه‌ای A4 و بازبینی تصویری موفق‌اند. بدون Migration، تغییر مجوز، دادهٔ واقعی یا ارسال خارجی.

## جمع دریافت قرارداد در رزرواسیون — 2026-09-12 — فعال در لوکال

پنجرهٔ «دریافت‌ها» اکنون پرداخت‌کنندهٔ قرارداد، مجموع دریافت‌های تأییدشده و مبالغ در انتظار تأیید مالی را جداگانه و به تفکیک ارز نشان می‌دهد؛ جدول نیز «از طرف»، روش، وضعیت، مبلغ، ارز، تاریخ‌ها، ثبت‌کننده، بانک و پیگیری را از رکوردهای موجود Sales نمایش می‌دهد. هیچ دریافت یا وضعیت مالی ساخته یا تغییر داده نشد. ۱۱ تست هدفمند، lint، typecheck و build تولیدی ۴۱ مسیر موفق؛ Web3100/API4000 فعال و سالم‌اند.

## تنظیمات یکپارچه فرم رزواسیون — 2026-09-12 — فعال در لوکال

تنظیمات مستقل واچر از رابط حذف و ویرایش تاریخ هتل، نوع و تعداد اتاق و رده سنی
مسافران در «تنظیمات فرم رزواسیون» یکپارچه شد. همه تاریخ‌ها DatePicker مشترک میلادی
با انتخاب ماه و سال دارند. هر ذخیره نسخه تازه می‌سازد؛ تیک صریح دامنه تغییر تعیین
می‌کند اصلاح فقط فرم ارسالی و مبنای خرید باشد یا روی خروجی قرارداد و واچر هم اعمال
شود. خروجی قرارداد اکنون رده سنی اصلاح‌شده را نیز مصرف می‌کند و فرم خرید فقط آخرین
نسخه واقعاً ارسال‌شده به کارگزار را همراه تاریخ/اتاق/رده سنی نشان می‌دهد.
۱۲ تست API و ۱۲ تست Web، lint محدوده، typecheck API/Web و build تولیدی ۴۱ مسیر موفق
هستند. API4000 و Web3100 از همین checkout پاسخ ۲۰۰ می‌دهند. بدون Migration، IAM،
داده واقعی یا ارسال خارجی. [گزارش](tasks/RESERVATION-FORM-SETTINGS-0912.md).

## MANIFEST ایران ایرتور آنتالیا — 2026-09-12 — فعال در لوکال

قالب Pax List اسپارتا با ۱۲ ستون و همه شیت‌های راهنمای ایران ایرتور، پس از حذف کامل
داده‌های نمونه، به بخش `MANIFEST` رزرواسیون متصل شد. خروجی فقط برای مقصد آنتالیا و
پرواز رفت ایران ایرتور ساخته می‌شود، ترتیب عملیاتی مسافران را رعایت می‌کند و فایل ناقص
تحویل نمی‌دهد. نام لاتین پاسپورت، جنسیت، ملیت، کشور صادرکننده و کشور محل تولد به پرونده
Customer افزوده و همراه شماره/انقضای پاسپورت برای سفر خارجی در جدول فروش اجباری شد.
خواندن شماره پاسپورت با مجوز حساس و Audit موجود انجام می‌شود؛ اطلاعات نمونه فایل ورودی
در Repository باقی نمانده است.
۴۴ تست هدفمند API و ۴۰ تست هدفمند Web، lint محدوده، typecheck چهار بسته، اعتبارسنجی
Prisma و Build تولیدی API/Web موفق‌اند. Migration افزایشی لوکال اعمال و قالب در خروجی
Build سرور کپی شد. API روی ۴۰۰۰ و Web روی ۳۱۰۰ از همین Worktree فعال‌اند؛ هیچ فایل
برای ایرلاین ارسال و هیچ داده عملیاتی در QA تغییر داده نشد.

## خرید چندخدمتی رزرواسیون و پرداخت کارگزار — 2026-09-12 — فعال در لوکال

دکمه «خرید» برای هر خدمت قرارداد، کارگزار و مبلغ/ارز مستقل ثبت می‌کند؛ هر اصلاح نسخه
جدید و در انتظار مالی می‌سازد. صف مالی خریدهای آخر هر خدمت را با بانک، زمان انتقال، شماره
پیگیری و توضیح پرداخت نمایش و ثبت می‌کند. تأیید تحویل مدارک به فروش تا ثبت خرید و پرداخت
آخرین نسخه همه خدمات بسته است. سابقه قدیمی هزینه هتل خواندنی مانده و مبلغ‌های چندارزی با
تبدیل یا جمع ضمنی مخلوط نمی‌شوند. Migration افزایشی لوکال اعمال شد؛ هیچ پرداخت واقعی،
تأیید تحویل مدارک، مجوز یا داده عملیاتی در QA ثبت نشد. این اتصال عملیاتی جایگزین PO/Invoice
آتی Procurement یا سند حسابداری Finance نیست.

## RESERVATION-PASSENGER-DOCUMENTS-0910 — PC-A — LOCAL_COMPLETE_PENDING_ACTIVATION

اسامی مسافران رزرو از پرونده اصلی خوانده می‌شود و با مجوز فعلی و کنترل نسخه قابل ویرایش است. مدارک/پیوست قرارداد انتخاب مسافر، دسته‌بندی، نوع و بارگذاری دارد؛ همان فایل در بایگانی اسناد و پرونده انتخاب‌شده دیده می‌شود. ۸ تست API، ۳۹ تست Web، بررسی مرورگری با داده ساختگی، lint/typecheck و build موفق‌اند. بدون Migration، تغییر مجوز یا داده واقعی. هنوز روی 3100 فعال نشده؛ مالکیت اجرای ترکیبی با کار تور است. [گزارش و تحویل](tasks/RESERVATION-PASSENGER-DOCUMENTS-0910.md).

## TOUR-RUNTIME-0910 — VALIDATED / STARTUP_POLICY_BLOCKED

نسخه تور6ba6661 با نرخ هتل5b1d287 در شاخه مستقل codex/pc-a-tour-runtime-0910 با حفظ هر دو تاریخچه ادغام شد.53 تست API و115 تست Web، تولید Prisma و Build تولیدی API/Web41 مسیر موفق‌اند. Migration نرخ هتل قبلاً اعمال شده بود؛ فقط وضعیت خوانده شد. هیچ Migration، داده یا مجوز تازه تغییر نکرد.

راه‌اندازی وب با تأیید صریح کاربر توسط ابزار اجرا با «blocked by policy» رد شد. روش جایگزین برای دورزدن محدودیت اجرا نشده است؛3100 همچنان خاموش و API قبلی1064 روشن باقی ماند. مالک رزرواسیون اجرای ترکیبی را تحویل داد؛ کار تازهٔ آن مالک وارد این نسخه نشده است. آمادهٔ فعال‌سازی پس از رفع محدودیت محیط، بدون Push عمومی.

## TOUR-DETAILS-0910 — CODE_READY / ACTIVATION_PENDING

فرم کامل تعریف تور شامل معرفی/شرایط، قیمت و ارز انتخابی، تومان با تبدیل دقیق به ریال، مشخصات حمل‌ونقل، برنامه سفر قابل افزودن/حذف/جابه‌جایی و تصویر از آرشیو امن اضافه شد. اطلاعات در definition موجود تور ذخیره می‌شود؛ بدون Migration یا تداخل با کار نرخ گروهی هتل.41 تست API و99 تست رابط/مصرف‌کننده، lint محدوده، typecheck و Build API/Web موفق‌اند. نوبت و ظرفیت قبلی دست‌نخورده است؛ نوع قطار فعلاً مشخصات تعریف است، نه نوبت اجرایی قطار.

روی شاخه مستقل codex/pc-a-tour-details-0910 آماده است؛ اجرای3100/API4000 متعلق به کار فعال رزرواسیون تغییر نکرده و هماهنگی handoff ارسال شده است. بدون تغییر داده واقعی، انتشار عمومی یا ادعای تست مرورگر احرازشده. جزئیات: docs/tasks/TOUR-DETAILS-0910.md.

## RESERVATION-REFERENCE-FORM-0909 — PC-A — READY_FOR_REVIEW

Reservation request print now follows the supplied six-section English navy/teal A4 reference, populated from the selected contract and current operational arrangement/age. Existing logo selection, voucher and financial gates preserved. Missing fields stay unfilled; no sample PII copied. 49 tests, scoped lint/typecheck and 40-route build passed; actual one- and three-page synthetic PDFs visually inspected. Web3100 refreshed without API/data/permission changes. Details: [task report](tasks/RESERVATION-REFERENCE-FORM-0909.md).

## TRAVEL-DOCUMENT-HANDOFF-0909 — PC-A — READY_FOR_REVIEW

Persisted Reservations supplier/insurance/voucher/cancellation workflow, versioned operational order/age overrides, company/agency letterhead and printable request/voucher outputs. Sales passenger document access now requires Finance delivery authorization, with revocation and transactional owner notifications. Over-60 insurance extra is a per-passenger toman field with exact IRR reconciliation. Local additive migration applied after restored-copy rehearsal and fresh backup; 350 customers/5 contracts retained. API4000/Web3100 updated. Role grants remain pending user approval; no live financial or operational decisions, production deploy or merge. Tests, remaining limitations and handoff: [task report](tasks/TRAVEL-DOCUMENT-HANDOFF-0909.md).

## WORKBENCH-006 — عنوان خانه

عنوان نمای نخست میزکار، به درخواست کاربر، از «امروز من» به «خانه» تغییر کرد؛ شناسه و عملکرد تب همان قبلی است. تغییر محدود به برچسب نمایشی است.

نسخهd711222 روی۳۱۰۰/PID27380 فعال شد؛ lint،۱۰تست مدل و build/typecheck موفق. راه‌اندازی در فاصله هماهنگ‌شده بین ثبت فرم‌های آژانس انجام شد. API و داده‌ها تغییر نکردند. PR165 پیش‌نویس است.

## WORKBENCH-005 — میزکار بومی داخل پوسته نورا

در پاسخ به رد نسخه دمو توسط کاربر، مسیر مستقل `/workbench` با اجزای مشترک، تم روشن/تیره، حساب احرازشده، اعلان‌های مخاطب و فایل‌های شخصی Documents پیاده شد. منوی «میزکار من» مستقل از «وظایف و اتوماسیون» است؛ آدرس قدیمی دمو فقط به مسیر اصلی هدایت می‌شود. فایل HTML و پاسخ مستقل دمو حذف شدند. سرویس‌های فاقد ذخیره‌سازی مانند پیام خصوصی، یادداشت، علاقه‌مندی و کارتابل عمومی صریحاً غیرفعال‌اند. جزئیات و محدودیت‌ها در [WORKBENCH-005](tasks/WORKBENCH-005-NATIVE-SHELL.md) ثبت است.

نسخه2d5d5e8 با تغییرات رنگ و شمارش واقعی KPI آژانس‌ها روی۳۱۰۰/PID28628 فعال است. ۱۵۷ تست هدفمند، lint، typecheck/build و بررسی مرورگر با حساب واقعی موفق شدند؛ فایل‌های شخصی و صفحه‌بندی، منوی مستقل و تم روشن/تیره تأیید شد. API4190/PID15024 و داده‌ها تغییر نکردند. PR164 پیش‌نویس، بدون Merge.

## WORKBENCH-004 — مسیر مستقیم میزکار روی نسخه جدید برنامه

پس از جایگزینی اجرای میزکار با نسخه تازه آژانس‌ها، میزکار مجدداً بر پایه `56d5d48` اضافه شد تا فیلترهای جدید تاریخ حفظ شوند. با فعال‌بودن محیط نمونه، مسیر منوی فعلی `/tasks` مستقیماً به `/workbench/demo` هدایت می‌شود. بدون تغییر API، داده، Schema، Dependency یا منوی مشترک. ۱۰۳ تست، typecheck و build موفق‌اند؛ کلیک منو روی اجرای ۳۱۰۰ در مرورگر تأیید شد. نتیجه در [WORKBENCH-004](tasks/WORKBENCH-004-MENU-CURRENT-RUNTIME.md) ثبت شده است.

## B2B-NAMED-BRANCHES-001 — شعب نام‌گذاری‌شده و تراز انتخاب‌گر

چهار شعبه نیایش سیر، جهان باستان، جهان آکادمیا و قسطی رو ثبت و برای حساب فعلی فعال شدند؛ دفتر مرکزی برای سوابق قبلی حفظ شد. تراز و ارتفاع انتخاب‌گر شعبه قرارداد با دکمه‌های کناری هماهنگ شد. ۹۷ تست، lint/typecheck/build موفق‌اند. برنامه مستقل پیش‌نمایش میزکار پورت۳۱۰۰ را در زمان build اشغال کرد و متوقف نشد؛ نسخه7ada379 فعلاً روی۳۱۹۶ با API4191 فعال است. PR157 پیش‌نویس، بدون Merge.

## B2B-FINANCE-DOCUMENTS-EXPORT-001 — اسناد مالی و خروجی

در هر تب مالی پرونده، فرم مشخصات/فایل سند و فهرست مدارک همان بخش اضافه شد؛ گروه‌بندی با پیشوند عنوان و محدود به سازمان/شعبه است. خروجی Excel ردیف‌های مالی فیلترشده با برچسب آزمایشی و خروجی اسناد صفحه فعلی فراهم است. این ثبت از مسیر Documents انجام می‌شود و تراکنش حسابداری نیست. بررسی مرورگر، ۹۷ تست، lint/typecheck/build موفق‌اند؛ نسخهc37060c روی۳۱۰۰ فعال است. PR154 پیش‌نویس و بدون Merge.

## B2B-CREDIT-SECTION-FORMS-001 — فرم‌های اختصاصی اعتبار و تضمین

سیاست اعتبار، تضمین و افزایش موقت هرکدام فرم اختصاصی با انتخاب قرارداد مرتبط دارند. سایر شرایط نسخه حفظ می‌شوند؛ مشخصات قرارداد در قسمت بازشدنی قابل تکمیل است. افزایش موقت به افزایش واقعی مبلغ و تاریخ پایان نیاز دارد؛ محاسبه مبالغ ارزی دقیق و مستقل است. تأیید مستقل همچنان لازم است. Exposure به اتصال مالی وابسته و بدون ورودی دستی است. ۹۷ تست، lint/typecheck/build و بررسی مرورگر موفق‌اند؛ نسخه3cf0715 روی۳۱۰۰ فعال است. PR152 پیش‌نویس؛ بدون تغییر داده/API یا Merge.

## B2B-CONTRACT-DOCUMENT-FORM-001 — فرم مستقیم سند قرارداد

کشویی «بدون پیوست» در سند قرارداد حذف و فرم عنوان، نوع مدرک، دسته‌بندی، انقضا و فایل به‌صورت باز نمایش داده شد. اتصال فایل به قرارداد از مسیر موجود اسناد و فایل‌ها انجام می‌شود؛ پیوست قبلی حفظ و قابل برداشتن از قرارداد است. بررسی مرورگر و build موفق‌اند؛ نسخه1ed0a1c روی۳۱۰۰ فعال است. PR151 پیش‌نویس و بدون Merge؛ بدون تغییر داده/API.

## B2B-UNIFIED-USERS-001 — یکپارچه‌سازی کاربران سازمان

تب‌های «نقش‌های سازمانی» و «بخش‌های مجاز» حذف شدند؛ نقش و بخش‌های قابل مشاهده هر کاربر با عنوان مشخص داخل کارت همان کاربر نمایش داده می‌شود. فرم ویرایش و تاریخچه دسترسی حفظ شده‌اند. بررسی مرورگر، ۹۵ تست، lint/typecheck و build موفق‌اند؛ نسخه f50d293 روی۳۱۰۰ فعال است. PR150 پیش‌نویس؛ بدون تغییر داده یا مجوزها.

## B2B-ALL-AGENCIES-DEMO-001 — داده نمونه برای همه آژانس‌ها

برای هر هفت آژانس موجود داده آزمایشی ثبت شد: ۱۴ قرارداد پیش‌نویس، تضمین و سقف مستقل ریال/دلار، مدارک تضمین، شعب و نمایندگان، امضاداران غیرفعال، نرخ/تخفیف/پورسانت و ۲۱ کاربر نمونه محدود به پرونده خودشان. داده قبلی حفظ شد؛ بازخوانی و اجرای دوباره بدون تکرار تأیید شد و فعالیت‌ها در گزارش هر هفت پرونده ثبت شده‌اند. نسخه پشتیبان پیش از ثبت گرفته شد. داده روی runtime فعلی۳۱۰۰ در دسترس است؛ مالی همچنان پیش‌نمایش آزمایشی است. [جزئیات](tasks/B2B-ALL-AGENCIES-DEMO-001.md).

## B2B-PROFILE-TABS-001 — حذف میانبرهای بالای پرونده

چهار تب شعب، نمایندگان، امضاداران و مدیر حساب مطابق Screenshot535 از نوار بالای پرونده سازمان حذف شدند. تب مشخصات و نقش‌ها و بخش‌های داخلی همان صفحه حفظ شده‌اند؛ تغییری در داده/API وجود ندارد. بررسی مرورگر، lint/typecheck، ۹۵ تست Organizations و build موفق‌اند. نسخه c7f919e روی پورت ۳۱۰۰ فعال و سلامت API4191 تأیید شد؛ PR148 پیش‌نویس و بدون Merge است.

## B2B-DOSSIER-REPORTS-001 — گزارش فعالیت‌های پرونده

سه تب گزارش، Audit و خروجی به سوابق واقعی B2B، اطلاعات سازمان و اسناد متصل شدند؛ فیلتر شعبه/بخش/منبع/نتیجه و تاریخ شمسی، جزئیات انجام‌دهنده و فیلدهای تغییرکرده و خروجی تمام صفحات Excel کار می‌کنند. تاریخچه حذف‌ها حفظ و محدوده تاریخی نماینده هنگام انتقال بین سازمان‌ها کنترل می‌شود. ۶۱۳ تست API، ۹۵ تست Web، ۱۹ تست PostgreSQL، lint/typecheck/build و چهار Gate نهایی مخزن موفق‌اند. داده موجود افق سفر ۲۲ رویداد از سه منبع دارد. Web01ff6d1 روی 3100/hr005-e8ec9ec662bd3909 و API63bad33 روی4191 فعال و سالم‌اند؛ PR147 پیش‌نویس و بدون Merge. [جزئیات](tasks/B2B-DOSSIER-REPORTS-001.md).

## B2B-CONTRACT-CREDIT-DEMO-001 — اعتبار زیر قرارداد و نمونه‌های تضمین/مالی

بخش اعتبار و تضمین زیر قرارداد و شرایط تجاری قرار گرفت؛ منو و مسیر بالای صفحه هماهنگ‌اند. چهار قرارداد پیش‌نویس آزمایشی شامل ۱۲ تضمین، ۸ مدرک و سقف‌های مستقل ریال/دلار ثبت و اجرای دوباره بدون تکرار تأیید شد. شش تب مالی سناریوی نمونه با فیلتر و جزئیات دارند؛ داده مالی صرفاً پیش‌نمایش برچسب‌دار است و به مانده/ثبت حسابداری وصل نیست. ۹۲ آزمون سازمان‌ها، lint/typecheck، بررسی مرورگر، build چهل‌ویک‌مسیره و چهار Gate مخزن موفق‌اند. Source6ec0cd7 روی Web3100/hr005-ee20b418202c6261 و API4191 سالم فعال است. PR146 پیش‌نویس و بدون Merge؛ جزئیات: [B2B-CONTRACT-CREDIT-DEMO-001](tasks/B2B-CONTRACT-CREDIT-DEMO-001.md).

## B2B-CONTRACT-FORMS-002 — اصلاح فرم قرارداد و بارگذاری مدارک

تقویم‌های فرم‌های پرونده در پنجره‌ها اصلاح، انواع قرارداد تکمیل و روش پرداخت به مرجع واقعی اطلاعات پایه متصل شد. بارگذاری سند قرارداد و تضمین در فرم همان مورد انجام می‌شود؛ بخش مستقل بارگذاری و کنترل نوع سقف از UI حذف شده‌اند. فهرست نرخ توافقی پس از انتخاب بسته می‌شود. آزمون‌های هدفمند، PostgreSQL، بازخوانی قرارداد و بارگذاری واقعی دو سند ساختگی CLEAN و فیلتر اعتبار اسناد موفق‌اند. Migration افزایشی با backup/rehearsal و حفظ داده‌های ۱۲۹ جدول اعمال شد. Source3c6b3cb با build چهل‌ویک‌مسیره hr005-f4de59bf61e65404 روی Web3100/API4191 فعال و سالم است؛ چهار Gate مخزن موفق و PR145 به‌صورت Draft باز شده؛ Merge نشده است. جزئیات: [B2B-CONTRACT-FORMS-002](tasks/B2B-CONTRACT-FORMS-002.md).

## B2B-ORGANIZATION-USERS-001 — کاربران پرونده آژانس

فرم پاپ‌آپی ثبت حساب، ویرایش نقش/وضعیت و انتخاب شش بخش قابل مشاهده به کاربران و دسترسی اضافه شد. پرتال اختصاصی فقط پرونده همان آژانس را از عضویت سمت سرور می‌خواند؛ حساب‌ها هیچ نقش یا شعبه سراسری IAM نمی‌گیرند. تاریخچه تغییر دسترسی ذخیره می‌شود. مهاجرت افزایشی پس از بازیابی آزمایشی با حفظ داده‌های ۱۲۸ جدول اعمال شد؛ ۱۲ حساب آزمایشی در چهار آژانس ثبت و دسترسی کاربران قبلی حفظ شد. جزئیات و نتیجه نهایی اجرا: [B2B-ORGANIZATION-USERS-001](tasks/B2B-ORGANIZATION-USERS-001.md).

Source d8de690 روی Web3100 / hr005-67cffe6403214472 و API4191 فعال و سالم است. پورت API از4190 به4191 تغییر کرد تا محدودیت Fetch برطرف شود؛ داده و محل اسناد حفظ شده‌اند. ۲۴۶ تست هدفمند، Build چهل‌ویک‌مسیره، بررسی واقعی ورود/خروج چهار حساب و چهار Gate سراسری CI موفق‌اند. PR143 پیش‌نویس؛ Merge نشده است.

## B2B-DOSSIER-SHORTCUTS-001 — حذف میان‌برهای صفحه ۳۶۰

ردیف دکمه‌های مشخص‌شده در Screenshot532 و کادر «ثبت اطلاعات پرونده» از نمای اصلی آژانس/مشتری سازمانی حذف شد. کارت‌های اصلی و فرم‌های هر بخش در دسترس‌اند. Source e1f8d3e روی Web3100 / hr005-32d45f524f9da7a2 فعال است؛ API4190 حفظ شده و سالم است. ۹۰ تست آژانس‌ها، lint/typecheck، Build چهل‌مسیره و چهار Gate سراسری CI موفق‌اند. تغییر صرفاً نمایشی است؛ بدون تغییر داده، API، Migration یا Merge. PR142 پیش‌نویس؛ جزئیات: [B2B-DOSSIER-SHORTCUTS-001](tasks/B2B-DOSSIER-SHORTCUTS-001.md).

## B2B-UNIFIED-PROFILE-001 — صفحه یکپارچه مشخصات و نقش‌ها

شناسه ملی شرکت در فرم اولیه مشخص‌تر شده و مشخصات، شعب آژانس، نمایندگان، امضاداران و مدیر حساب در یک صفحه با فرم‌های پاپ‌آپی قرار گرفته‌اند. امضاداران مدل و API مستقل با شخص همان سازمان، حدود اختیار، ارز، بازه اعتبار و نسخه مدرک دارند؛ ثبت بدون مدرک غیرفعال است. ویرایش و حذف نسخه‌دار با Audit اتمیک انجام می‌شود. ۶۶۳ تست هدفمند، lint/typecheck، Build چهل‌مسیره و چهار Gate سراسری CI موفق‌اند. Source 08d2107 روی Web3100 / hr005-885cff5dba39ac2b و API4190 فعال و سالم است. مهاجرت افزایشی پس از بازیابی آزمایشی و پشتیبان تازه، با حفظ داده‌های ۱۲۷ جدول و ۴۷ migration قبلی اعمال شد. PR141 پیش‌نویس است و Merge نشده؛ جزئیات: [B2B-UNIFIED-PROFILE-001](tasks/B2B-UNIFIED-PROFILE-001.md).

## B2B-PROFILE-CLARITY-001 — شعب آژانس و اطلاعات پرونده

طبق توضیح مالک، فهرست شعب از آدرس‌های خود آژانس طرف همکاری خوانده می‌شود و ثبت/ویرایش/حذف در همان کارت دارد. شعبه داخلی مسئول همکاری جداست؛ نقش مدیر حساب توضیح داده شده و بررسی وضعیت به قرارداد چارچوب وصل است. شناسه ملی اختیاری شرکت در اطلاعات پایه ذخیره، کنترل تکرار و در فرم ثبت/ویرایش و پرونده نمایش داده می‌شود. Source dbd7329 روی Web3100 / hr005-b0658359a760157c و API4190 فعال و سالم است. ۵۸۳ تست هدفمند، build/lint/typecheck و چهار Gate سراسری CI موفق‌اند. Migration افزایشی پس از backup و rehearsal با حفظ اطلاعات ۱۲۷ جدول و تاریخچه migrations اعمال شد. PR140 برای Review؛ Merge نشده. جزئیات: [B2B-PROFILE-CLARITY-001](tasks/B2B-PROFILE-CLARITY-001.md).

## B2B-DIRECTORY-ACTIONS-001 — نوار ثبت و اکسل صفحه آژانس‌ها

نوار ثبت صفحه اول آژانس‌ها مطابق نمونه بخش مشتریان با همان Card، Button و فونت نورا اضافه شد: بازکردن فرم چهارمرحله‌ای، ورود از Excel، دانلود مستقیم قالب خالی و خروجی با فیلترهای فعلی. کنترل مجوزها و پیش‌نمایش ورود موجود حفظ شده‌اند. ۸۹ آزمون سازمان‌ها، lint/typecheck، Build چهل‌مسیره، بررسی کامپوننت در مرورگر و چهار Gate مربوط به Push موفق‌اند. پس از تحویل تسک اجرای لوکال، source963978d روی Web3100 و API4190 سالم فعال است؛ دیتابیس و فایل‌های موجود حفظ شده‌اند. جزئیات: [گزارش نوار ثبت](tasks/B2B-DIRECTORY-ACTIONS-001.md).

## B2B-DOSSIER-SALES-REMOVAL-001 — حذف عملیات فروش از پرونده ۳۶۰

به درخواست مالک، کارت «عملیات فروش» و مسیرهای داخلی مسافران سازمانی، قراردادهای فروش و سفارش‌ها از پرونده مشترک آژانس و مشتری سازمانی حذف شد. شش بخش دیگر پرونده حفظ است. نسخه 4d49975 روی ۳۱۰۰ فعال است؛ ۸۹ آزمون سازمان‌ها، lint/typecheck، Build تولیدی ۴۰ مسیر، بررسی کامپوننت در مرورگر و چهار Gate مربوط به Push موفق‌اند. بدون تغییر API، داده، مجوز یا Migration و بدون Merge؛ جزئیات: [گزارش حذف بخش فروش](tasks/B2B-DOSSIER-SALES-REMOVAL-001.md).

## B2B-DOSSIER-ACCESS-001 — دسترسی کامل پرونده برای Nirvana

با درخواست صریح مالک برای همه بخش‌های پرونده ۳۶۰، هشت مجوز اصلی B2B که در کاتالوگ دیتابیس محلی وجود نداشت از Seed رسمی تکمیل شد. نقش اختصاصی `b2b-dossier-manager` با هر ده مجوز B2B فقط به Nirvana در شعبه مرکزی اضافه شد؛ نقش‌ها و شعب قبلی و دسترسی دیگر کاربران حفظ شدند. ۲۱ مجوز مرتبط اسناد/اطلاعات پایه از قبل موجود بود. خواندن واقعی پرونده، پروفایل، نرخ‌ها، قرارداد و آدرس چهار آژانس آزمایشی با مجوز مؤثر همین حساب موفق است و ۳۶ تست مجوز/گردش تأیید پاس شد. ثبت‌کننده همچنان درخواست خودش را تأیید نمی‌کند. نیاز به Refresh صفحه برای مجوزهای تازه؛ کد/Build/Migration و Runtime تغییر نکرد. این تخصیص محلی جایگزین وضعیت «منتظر انتخاب حساب» در گزارش‌های قبلی است. جزئیات: [B2B-DOSSIER-ACCESS-001](tasks/B2B-DOSSIER-ACCESS-001.md).

## B2B-DOSSIER-FORMS-001 — فرم‌ها و داده‌های آزمایشی پرونده ۳۶۰

فرم پاپ‌آپی شعب/آدرس، پروفایل و مدیر حساب، نرخ توافقی، تخفیف و پورسانت به پرونده متصل شد؛ ویرایش و حذف دائمی نسخه‌دار آدرس و شرایط تجاری با Audit اتمیک انجام می‌شود. صفحه ۳۶۰ خلاصه اطلاعات ثبت‌شده و میان‌بر فرم‌ها دارد. برای چهار آژانس آزمایشی ۸ آدرس، ۸ نماینده، ۱۲ شرط تجاری غیرفعال و ۴ قرارداد پیش‌نویس شامل سقف مستقل دو ارز و تضمین نمونه، پس از Backup ثبت شد؛ بررسی مجدد هیچ داده تکراری نساخت. ۱۷۶ تست API، ۱۴ تست PostgreSQL یک‌بارمصرف، ۸۹ تست Web و ۶۱ تست Contracts موفق‌اند. Migration/Dependency و IAM grant جدید ندارد. گردش قرارداد و اعتبار، تأیید مستقل را حفظ می‌کند؛ انتخاب حساب دارای مجوز B2B هنوز لازم است. Build چهل‌مسیره و چهار Gate نسخه aa964d6 موفق‌اند؛ همین نسخه روی Web3100 PID15740 با API4190 PID14320 سالم فعال است. فرم‌ها در مرورگر جداگانه با کامپوننت واقعی و بدون خطای Console بررسی شدند. PR134 پیش‌نویس و وابسته به PR132/133 است؛ Merge نشده. جزئیات: [B2B-DOSSIER-FORMS-001](tasks/B2B-DOSSIER-FORMS-001.md).

## B2B-BREADCRUMB-001 — مسیر یکپارچه و کلیک‌پذیر بالای صفحه

مسیر محلی تکراری آژانس‌ها و پرونده حذف و به نوار مسیر سراسری متصل شد: فضای کاری، فهرست آژانس‌ها، نام سازمان و بخش جاری. کلیک روی نام سازمان به نمای ۳۶۰ درجه و کلیک روی فهرست به همان فهرست با فیلترهای حفظ‌شده برمی‌گردد. پس از خروج، مسیر قبلی پاک می‌شود و مسیرهای سایر ماژول‌ها حفظ‌اند. ۱۳۷ تست هدفمند، lint/typecheck، Build چهل‌مسیره و چهار Gate نسخه 0aca6c1 موفق‌اند. همین نسخه روی Web3100 PID8140 فعال است؛ API4190 PID17316 سالم و بدون تغییر است. کلیک‌ها با کامپوننت‌های واقعی در مرورگر آزمایشی بررسی شدند؛ نشست اجرای اصلی به ورود مجدد نیاز دارد. بدون Migration، تغییر داده یا مجوز. جزئیات: [B2B-BREADCRUMB-001](tasks/B2B-BREADCRUMB-001.md).

## B2B-CONTRACT-CREDIT-001 — تکمیل فرم قرارداد و اعتبار

فرم Screenshot527 برای هر دو نقش آژانس و مشتری سازمانی، قرارداد/پرداخت/تسویه/SLA، سقف مستقل هر ارز و تضمین متصل به نسخه سند را ذخیره می‌کند. پرونده شامل ویرایش پیش‌نویس، ارسال و تأیید یا رد مستقل و تاریخچه نسخه‌هاست. پس از تحویل صریح Runtime از مسئول اسناد، نسخه a8c986d روی Web3100 با API4190 سالم فعال شد؛ اصلاح contrast اسناد و HR ادغام‌شده محفوظ‌اند. مهاجرت افزایشی پس از backup و rehearsal اعمال شد و داده‌های موجود و ۱۷۷ تخصیص نقش IAM حفظ شدند. چهار Gate نهایی GitHub و ۱۲ تست PostgreSQL موفق‌اند. نقش‌های فعلی مجوز B2B ندارند؛ انتخاب حساب ثبت‌کننده و تأییدکننده از مالک خواسته شده و grant خودکار انجام نشده است. بررسی تصویری احرازشده اجرای نهایی به ورود مجدد نیاز دارد؛ گردش فرم با کامپوننت واقعی و سرویس آزمایشی مستقل بررسی شده است. PR132 آماده Review است؛ Merge انجام نشده. جزئیات: [B2B-CONTRACT-CREDIT-001](tasks/B2B-CONTRACT-CREDIT-001.md).

## B2B-FONT-001 — یکسان‌سازی فونت آژانس‌ها

تعریف مستقل Tahoma از پوشش مشترک آژانس‌ها حذف شد و فهرست، پرونده و پاپ‌آپ‌ها روی ۳۱۰۰ فونت سراسری وزیرمتن نورا را دارند. فونت محاسبه‌شده عنوان، جدول، ورودی‌ها، انتخاب‌گرها و دکمه‌های پاپ‌آپ در مرورگر با بدنه برنامه یکسان است. Build تولیدی ۴۰ مسیر، ۸۷ آزمون سازمان‌ها و lint/typecheck موفق‌اند. اندازه و چیدمان قبلی حفظ است؛ بدون تغییر فونت سراسری، وابستگی، API یا داده. جزئیات: [B2B-FONT-001](tasks/B2B-FONT-001.md).

## B2B-FORM-RUNTIME-001 — فرم چهارمرحله‌ای روی ۳۱۰۰ فعال است

تصویر ۵۲۵ مربوط به اجرای قدیمی HR-011 بود. فرم چهارمرحله‌ای مرج‌شده در PR #113 با آخرین HR-010/011 ترکیب و پس از تحویل مسئول HR روی ۳۱۰۰/۴۱۹۰ فعال شد؛ کد هر دو ماژول مطابق منبع اصلی محفوظ است. هر چهار مرحله پاپ‌آپ، جست‌وجوی سازمان، نمای هفت‌بخشی آژانس، پنجره لوگو و ورود به منابع انسانی در مرورگر احرازشده بررسی شد. ۱۹۶ تست Web، ۱۰۸ تست API، lint/typecheck کامل و Build تولیدی موفق‌اند. بدون تغییر داده عملیاتی، اسناد، مجوز یا Migration؛ رزرو پیاده‌سازی آزاد است و تغییر بعدی Runtime نیازمند هماهنگی همین Task است. جزئیات: [گزارش اصلاح فرم](tasks/B2B-FORM-RUNTIME-001.md).

## DOCUMENTS-008A — اصلاح قطعی رنگ CTA آبی — آماده ادغام تأییدشده

- در اجرای واقعی مشخص شد قانون عمومی و بدون لایه `a { color: inherit }` کلاس Tailwind سفید PR #130 را بازنویسی می‌کند. `PC-B` رنگ سفید را فقط روی دو CTA آبی ارتباطات اسناد در سطح خود لینک تثبیت کرد؛ قانون عمومی لینک‌ها و سایر بخش‌های سامانه تغییر نکردند.
- ۵ تست قراردادی Documents، Web lint/typecheck و Production Build با ۴۰ Route موفق‌اند. نسخه تولیدی روی `3100` اجرا و با Browser بررسی شد: همه CTAهای ماژول‌ها متن و آیکن سفید `rgb(255, 255, 255)` روی آبی `rgb(21, 87, 184)` دارند. بدون Schema/Migration/API/Dependency/Data؛ CI نسخه دقیق شاخه شرط ادغام است.

## HR-PUBLISH-012 — انتشار تأییدشده منابع انسانی برای PC-A

مالک در 2026-09-09 پوش و مرج HR-010/011 را صریحاً تأیید کرد. PRهای ۱۲۵ و ۱۲۷ با حفظ تاریخچه و کد آزموده‌شده به develop جاری متصل می‌شوند؛ فقط تعارض‌های افزایشی اسناد وضعیت حل شد. CI نسخهٔ نهایی هر PR و develop شرط تکمیل انتشار است. سرویس‌های محلی و کار جاری آژانس‌ها تغییر نمی‌کنند. روش دریافت و کنترل نسخه روی PC-A در [راهنمای تحویل](tasks/HR-PUBLISH-012.md) ثبت شده؛ دریافت یا اجرای واقعی روی آن دستگاه بدون شواهد ادعا نمی‌شود.

## HR-011 — اتصال هزینه به مأموریت — آماده بررسی

انتخاب مأموریت مرجع از رکوردهای واقعی مأموریت، با کد، کارمند، مقصد و تاریخ سفر انجام می‌شود؛ شرکت و کارمند انتخاب‌شده محدوده فهرست را تعیین می‌کنند و مأموریت‌های قدیمی هم پشتیبانی می‌شوند. اتصال، تغییر و برداشتن مرجع در هزینه پیش‌نویس ذخیره می‌شود؛ کنترل مجوز، شرکت، کارمند، نسخه و وضعیت نهایی در API برقرار است. ۹۹ تست وب و ۸۰ تست API، شامل ۲۱ تست PostgreSQL، موفق‌اند. بدون Migration، تغییر داده عملیاتی یا Merge؛ جزئیات و راه‌اندازی نسخه 3100 در [HR-011](tasks/HR-011.md).

## HR-010 — دکمه‌های عملیات منابع انسانی — آماده بررسی

دکمه‌های ویرایش و حذف از منوی سه‌نقطه به عملیات مستقیم هر ردیف منتقل شدند؛ همان Button حاشیه‌دار کوچک، آیکن‌ها، فاصله و رنگ حذف اطلاعات پایه استفاده می‌شود. مشاهده فقط در محل‌های قبلی خود باقی است و تأیید حذف منطقی و مجوزها حفظ شده‌اند. ۹۷ تست موجود، lint و typecheck موفق‌اند؛ اتصال مرورگر برای آزمون تصویری برقرار نشد. تغییر فقط در UI منابع انسانی است؛ بدون Migration یا Merge. جزئیات: [HR-010](tasks/HR-010.md).

## DOCUMENTS-008 — سفیدشدن متن دکمه‌های آبی ارتباطات — آماده ادغام تأییدشده

- `PC-B` روی شاخه مستقل `codex/pc-b-documents-button-contrast` متن و آیکن CTAهای آبی «رفتن به بخش مربوطه» را در کارت‌های ارتباطات اسناد، در حالت عادی و Hover، سفید کرد. تغییر فقط Presentation است و رفتار لینک‌ها یا سایر دکمه‌های سامانه را عوض نمی‌کند.
- نسبت کنتراست سفید روی رنگ آبی اصلی `6.80:1` و مطابق WCAG AA است. ۵ تست قراردادی Documents، Web lint/typecheck و Production Build با ۴۰ Route موفق‌اند؛ Schema/Migration/API/Dependency/Data و Runtime تغییر نکرده‌اند. مالک محصول در 2026-09-09 Push و Merge با `develop` را تأیید کرد و CI نسخه دقیق شاخه شرط ادغام است.

## B2B-AGENCIES-001 — ادغام تأییدشده PR #113

- مالک صریحاً Merge و Push را تأیید کرد. `develop@0261b91` با Merge معمولی وارد شاخه همین کار شد؛ نسخه آژانس‌ها در develop با منبع کپی‌شده `fc573ac` یکسان بود و تغییرات جدید فرم، اکسل، پرونده، اسناد و لوگو حفظ شدند. تغییرات سایر ماژول‌ها و سوابق هر دو سمت باقی ماندند.
- ۹۷ تست هدفمند Web، ۵۴ تست B2B شامل پنج PostgreSQL یک‌بارمصرف، lint/typecheck کامل و Build تولیدی همه بسته‌ها با ۴۰ مسیر Web موفق‌اند؛ CI نسخه ترکیبی شرط Merge است. این تحویل تغییر اجرای ۳۱۰۰/۴۱۹۰، داده عملیاتی یا تکمیل تمام PRD را شامل نمی‌شود.

## B2B-AGENCIES-001 — لوگوی آژانس و مشتری سازمانی — آماده بررسی

- کنار نام در سربرگ مشترک پرونده، دکمه بارگذاری/تغییر لوگو و پنجره انتخاب تصویر با پیش‌نمایش، ذخیره و برداشتن لوگو اضافه شد؛ PNG/JPEG تا ۵ مگابایت پذیرفته می‌شود.
- ذخیره از مسیر موجود Master Data و Documents انجام می‌شود؛ هویت، نسخه و همه نقش‌های سازمان حفظ می‌شوند. مجوز نمایش، وضعیت اسکن و اعتبارسنجی دومرحله‌ای آرشیو رعایت می‌شوند؛ نتیجه ناقص پیام موفقیت دریافت نمی‌کند.
- ۹۷ تست هدفمند سازمان‌ها و Client مالک، lint، typecheck و Build موفق‌اند. انتخاب فایل نامعتبر/معتبر، نمایش پس از ذخیره و برداشتن لوگو در مرورگر با سرویس‌های صرفاً آزمایشی بررسی شد. فایل واقعی، داده عملیاتی، schema/API و اجرای مستقل ۳۱۰۰/۴۱۹۰ تغییر نکردند.

## B2B-AGENCIES-001 — نمای ۳۶۰ درجه آژانس — آماده بررسی

- مسیر «مشاهده پرونده» دسکتاپ و موبایل برای آژانس، مشتری سازمانی و نقش دوگانه به یک نمای مشترک با هر هفت کارت Screenshot (524) می‌رود. عنوان اختصاصی آژانس و بازگشت به ابتدای صفحه هنگام ورود/تغییر بخش اضافه شد؛ صفحه از محل اسکرول ردیف فهرست باز نمی‌ماند.
- رندر واقعی کامپوننت برای هر سه نقش، ۶۲ تست موجود سازمان‌ها، lint، typecheck و Build نهایی Web موفق‌اند. داده، API، نقش‌ها، هدر و اجرای مستقل ۳۱۰۰/۴۱۹۰ تغییر نکردند؛ این پیگیری به معنی تکمیل قابلیت‌های باقی‌مانده PRD نیست.

## B2B-AGENCIES-001 — تطبیق PRD و اتصال اسناد — آماده بررسی، پذیرش کامل باقی است

- کل سند ۴۵۱‌بندی بررسی و پوشش ۴۰ نیازمندی عملکردی در `docs/tasks/B2B-AGENCIES-001-PRD-COVERAGE.md` ثبت شد. کل PRD هنوز تکمیل نیست؛ گردش تأیید/نسخه immutable، پروفایل نقش‌محور، کاربران/مسافران سازمان و تولیدکننده مالی باقی‌اند.
- اتصال واقعی آرشیو سازمان، فیلتر انقضا و بارگذاری، انتخاب/اعتبارسنجی سند پیش‌نویس، نمایش دقیق اعتبار هم‌ارز و زمان/نسخه Finance و جلوگیری از تغییر lifecycle بدون تأیید اضافه شد. تصمیم مالک: سقف مستقل هر ارز، بدون FX خودکار؛ مدل چندسیاست ارزی هنوز migration نشده است.
- شاخه مستقل و Draft PR #113 حفظ می‌شوند. پایگاه داده عملیاتی، ۳۱۰۰/۴۱۹۰، schema/migration، مجوزها و ماژول‌های مالک تغییر نمی‌کنند. نتیجه نهایی بررسی‌ها در گزارش Task ثبت می‌شود.
- ۶۲ تست سازمان‌ها، ۴۹ تست B2B و پنج تست PostgreSQL، lint/typecheck و Build هر دو بخش موفق‌اند. آزمون ظاهری جدید به علت timeout اتصال مرورگر انجام نشد. رزرو پیاده‌سازی این پیگیری برای Review آزاد است؛ استقرار و تکمیل کل PRD انجام‌شده محسوب نمی‌شوند.

## CI-002-MULTI-COMPUTER — PC-B — READY_FOR_REVIEW

CI push and stacked-PR base filters now cover `codex/pc-*`, including PC-A/B/C/D and future IDs. Existing main/develop triggers, all four hosted jobs, read-only credentials, disposable PostgreSQL and event/head-branch isolation are retained. Five dependency-free regression tests cover triggers, concurrency and retained safety/quality gates. Contributor IDs and branch instructions are aligned without transferring module ownership or granting account access. No application, migration, dependency, database or runtime changes. Final-head PR CI and post-merge develop CI are required; details: [CI-002](tasks/CI-002-MULTI-COMPUTER.md).

## HEADER-TODAY-001 — PC-B — ready for review

The header displays today's Persian date and weekday using Persian digits and Asia/Tehran, independent of browser timezone and login time. A stable server placeholder prevents a stale build-date/hydration mismatch; minute-aligned updates and focus/visibility refresh handle midnight and sleeping tabs. A separate compact header row preserves existing controls and company colors. No API, database, dependency, user identity or permission changes. Source is current develop@130606d; PR #115 integration and runtime handoff are separately coordinated to retain current HR/Agencies and its database/storage.

Twelve focused tests, Web lint and production build passed. CI and final local runtime verification are required before completion; implementation scope is released for review.

## CONTRACT-OUTPUT-SUMMARY-0908 — COMPLETE_LOCAL

کارت‌های «پرداخت تأییدشده مالی» و «مانده» فقط از قالب مشترک چاپ/PDF قرارداد حذف شدند؛ مبلغ توافق‌شده باقی است. محاسبات مالی، داشبورد، Excel، قیمت مسافران و سایر بخش‌های قرارداد تغییر نکردند. 199 تست Web فروش، lint محدوده، typecheck و Build تولیدی 36 مسیر موفق‌اند. PDF مصنوعی با رندر واقعی و بازبینی تصویری یک‌صفحه‌ای تأیید شد؛ آزمون احرازشده قرارداد واقعی ادعا نمی‌شود.

نسخه روی Web3100 با PID14136 فعال است و API4000 بدون تغییر مانده؛ هر دو پاسخ200 دارند. نسخه قبلی وب در tmp/contract-output-summary-web-before-0908 حفظ شده است. PDFهای دانلودشده قبلی تغییر نمی‌کنند و باید دوباره خروجی گرفت. بدون Migration، تغییر داده/مجوز یا Push؛ رزرو همین کار آزاد شد.

## SALES-EXCEL-0908 — COMPLETE_LOCAL

دکمه خروجی Excel کنار فهرست قراردادها اضافه شد؛ همه نتایج جست‌وجو و وضعیت تسویه اعمال‌شده را با مجوز خروجی و محدوده دسترسی قبلی دریافت می‌کند. فایل واقعی XLSX با تیتر فارسی، تم سرمه‌ای، فیلتر و سربرگ ثابت، تاریخ قابل مرتب‌سازی و مبلغ عددی است. هر قرارداد/ارز یک ردیف دارد؛ مبلغ توافقی، پرداخت تأییدشده و مانده جدا هستند. سقف ۲۰۰۰ قرارداد با خطای صریح، بدون خروجی ناقص؛ سابقه دریافت فقط قالب/نسخه را ثبت می‌کند.

67 تست API فروش و 198 تست Web فروش، lint محدوده، typecheck و Build تولیدی API/Web (36 مسیر) موفق‌اند. فایل مصنوعی با دو خواننده مستقل و پیش‌نمایش بررسی شد؛ بررسی احرازشده قرارداد واقعی ادعا نمی‌شود. Web3100 (PID6036) و API4000 (PID20132) فعال، پاسخ سلامت و فایل جدید 200، خروجی بدون نشست401؛ داده، تنظیمات PDF/مدارک و همه قابلیت‌های تور قبلی محفوظ‌اند. بدون Migration/Seed/مجوز جدید/Push عمومی؛ قفل‌های همین کار آزاد شد. جزئیات: docs/tasks/SALES-EXCEL-0908.md.

## TOUR-PACKAGES-0908 — COMPLETE_LOCAL

PC-A added the real Tour definition/departure tab in Ticket Management. Templates contain route, destination hotel options, registered insurance and included transfer/visa services. Dated departures reference the same published ticket offers used in standalone Sales. Weekly repetition prefills new dates and the old flight details for explicit confirmation/editing; it never changes old tickets or copies reservations. Sales chooses the tour before individual service details, expands its services without a duplicate tour charge, and persists a public versioned departure reference validated by Ticket Catalog.

QA: 22 isolated PostgreSQL/domain tests passed including concurrent tour-versus-standalone capacity and concurrent idempotent departure creation; 58 targeted Sales/Master tests and 291 final affected Web tests passed. Full Web baseline: 900 passed, plus the new tour provenance test. Full API run: 948 passed, 83 optional skipped, one unrelated Customers hook timeout; all 13 tests in that file passed on isolated rerun. Contracts60 and Database73 tests passed; affected lint/typecheck and API/Web production builds passed (36 Web routes). Synthetic browser QA verifies themed selection, hotel city filtering, save, repeat prefill, Sales offer linkage and desktop/mobile width; no live authenticated business mutation is claimed.

All43 migrations passed on an empty DB and the new additive migration passed on a restored backup. After a fresh private backup, only 20260908150000_tour_packages was applied to local nora; existing record counts and historical migration checksums stayed unchanged. No live seed or permission change. Web3100/API4000 now serve the build; login/pages/health/new bundle HTTP200, protected tour routes401 without a session, credentialed CORS204. Existing Documents keys/storage and PDF browser/font environment preserved. Previous Web build and private backups remain under ignored tmp. Commits fd325c7 / 7844907 / 3949878; local-only, existing remote publication gate unchanged.

## SIDEBAR-LABELS-DOTS-0908 — COMPLETE_LOCAL

PC-A renamed the existing /sales navigation label to قرارداد and /tasks to میز کار per explicit owner request. Original routes, descriptions, content, permissions, compact behavior and group disclosure preserved. Added distinct static Tailwind group-dot colors aligned with reference3200, also visible on mobile. Final typecheck, scoped lint, 15 navigation/foundation tests and production build36 routes passed. Authenticated browser QA verifies new titles, seven rendered colored dots, group toggles, keyboard, compact17 links and mobile. Only verified Web1372 was replaced on3100 with the new integrated production build; existing PDF environment preserved, API/DB untouched. Local commit only, remote destination gate unchanged.

## SIDEBAR-GROUP-TOGGLE-0908 — COMPLETE_LOCAL

Independent accessible group buttons now run on integrated Web3100; whole-sidebar collapse and latest Sales preserved. Scoped lint/typecheck, 15 navigation/foundation tests, 36-route build and authenticated keyboard/desktop/mobile QA passed. Only Web restarted with existing PDF configuration; no API/data/migration change. See docs/tasks/SIDEBAR-GROUP-TOGGLE-0908.md. No remote push.

## SALES-RUNTIME-INTEGRATION-0908 — COMPLETE_LOCAL

User-approved normal local integration now serves latest Sales and both final grouped-sidebar changes, preserving current Customers, Notifications, branding and other CRM work. Source branches and old checkout remain intact. Branch codex/pc-a-sales-runtime-integration-0908, merges bd4fb50/a9223e0, active Web3100/API4000 from local-integration-0906. Production builds36 routes, source lint/typechecks and targeted integration tests pass; health200 and unauthenticated protected routes401. Existing DB has all42 migrations; no migration/seed/reset/data/permission/key change. Earlier SALES-FIRST-PASSENGER-ACQUAINTANCE-0908 activation-pending note is superseded by this activation. Historical migration checksum and index/default-name drift remain documented, not altered. No public push. See docs/tasks/SALES-RUNTIME-INTEGRATION-0908.md.

## SIDEBAR-REFERENCE-SIZE-0908 — منوی هم‌اندازه مرجع

PC-A follow-up on the approved sidebar: sidebar-icons.ts maps the existing 17 routes to outline Lucide symbols matching the3200 reference, without changing icons used elsewhere. Sidebar glyphs17px/stroke1.7, row text12px/semibold, minimum row40px with 3px gaps; group headings14px. All module names, routes, original widths/collapse/tooltips, mobile drawer and business pages preserved. Removed unintended row outlines during visual QA. Scoped lint, typecheck, 11 navigation tests, production build with 34 routes and authenticated browser collapse/expand/mobile checks passed. Final sidebar screenshot verified; final 390px viewport also measured390px without page overflow. Local-only on codex/pc-a-grouped-sidebar-0908; no runtime restart, migration, dependency, data or permissions. Handoff to separate Sales integration task required to retain this follow-up after its runtime cutover. Remote gate unchanged; no push attempted.

## GROUPED-SIDEBAR-0908 — COMPLETE_LOCAL

PC-A applied the owner-approved 7 sidebar groups to actual Web3100, retaining all 17 original names/routes/icons and existing 290/68px collapse, tooltips, mobile DrawerClose, header/branding/notifications/search/breadcrumb and module content. Expanded labels are 15px and headings 13px; labels can wrap and expanded navigation scrolls while footer remains reachable. No prototype pricing or synthetic pages transferred. 11 navigation tests, scoped lint, Web typecheck and production build with 34 routes passed. Authenticated Web3100 browser QA verified links/groups, collapse/expand, tooltips and mobile drawer; desktop screenshot reviewed. Drawer itself has no horizontal overflow; whole dashboard measured 398px at viewport390 after closing, so no claim to fix whole-page overflow. Branch codex/pc-a-grouped-sidebar-0908 from f2cc52a, active pc-b-sync-0908 checkout. No API/data/schema/dependency/permission changes or migration. Local commit only; remote push gate requires destination verification. Sales integration is separately coordinated and preserves this change.

## LOCAL-HR-AGENCIES-009 — آژانس‌ها و منابع انسانی در اجرای مشترک — آماده بررسی

- نسخه منتشرشده آژانس‌ها از `fc573ac` به شاخه مستقل `codex/pc-b-hr-agencies-local` بر پایه HR-008 اضافه شد؛ مسیرهای `/organizations` و `/hr` در همان برنامه پورت ۳۱۰۰ قرار دارند و کد منابع انسانی حفظ شده است.
- ۱۴ تست Web و ۲۸ تست API آژانس‌ها، شامل چهار سناریوی PostgreSQL، به همراه lint/typecheck و Build API موفق‌اند. هیچ Schema/Migration یا قرارداد مشترکی تغییر نکرده است؛ محدودیت‌های تأیید B2B حفظ شده‌اند. دستور اجرا و کنترل تحویل در `docs/tasks/LOCAL-HR-AGENCIES-009.md` ثبت است؛ بدون Merge.

## HR-008 — فرم‌های متصل و خروجی رکوردهای انتخاب‌شده — آماده بررسی

- گزینه‌های ارجاعی فرم‌ها از داده‌های مجاز ثبت‌شده خوانده می‌شوند؛ ورودی‌های تکراری کارمند/شرکت و فیلدهای اضافی شعبه، واحد، مصاحبه و تجهیز حذف شدند. جایگاه واحد در چارت با انتخاب شرکت، سطح و والد تنظیم می‌شود؛ ارتباط متقاضی و فرصت شغلی نیز پایدار و کنترل‌شده است.
- جدول‌ها انتخاب تکی/گروهی و خروجی واقعی Excel/PDF از انتخاب‌ها دارند. دکمه‌های مشاهده غیرضروری و آمار خروجی تکراری حذف شده‌اند؛ رسید هزینه واقعاً در اسناد بایگانی و به رکورد متصل می‌شود.
- ۹۴ تست HR Web، ۷۹ تست HR API شامل ۲۰ سناریوی PostgreSQL و ۲۲ تست Contracts موفق‌اند؛ lint/typecheck/build و آزمون مرورگری فرم‌ها، ذخیره متقاضی، خروجی انتخابی و بارگذاری رسید نیز موفق‌اند. نسخه بر پایه HR-007 روی ۳۱۰۰ و API۴۱۹۰ اجرا می‌شود؛ بدون Migration و بدون Merge. جزئیات در `docs/tasks/HR-008.md` است.

## HR-007 — منابع انسانی به‌روز روی ۳۱۰۰ — آماده بررسی

- `PC-B` روی `codex/pc-b-hr3100-current` و پایه `30d67ec`: پیاده‌سازی HR-005/HR-006 با نسخه فعلی نورا سازگار شد؛ چهار شرکت، هدر، پروفایل، اعلان‌های عمومی و امنیت اسناد حفظ شدند. زنگوله فقط یک پنجره دارد و اعلان‌های HR را از API خودش دریافت می‌کند.
- داده‌های موجود در کپی مستقل `nora_hr_current_20260908` و فایل‌های اسناد در Snapshot جدا حفظ شدند؛ API۴۰۰۰، کپی یکپارچه قبلی و دیتابیس اصلی HR تغییر نکردند. تمام ۳۵ Migration از قبل اعمال شده‌اند.
- نسخه جدید روی `localhost:3100/hr` با API۴۱۹۰ فعال است. ورود واقعی، چهار شرکت، پروفایل/MFA، زنگوله واحد، شش کارمند، هدایت آدرس قدیمی و بارگذاری مجدد روی هر دو میزبان `localhost` و `127.0.0.1` در پورت ۳۱۰۰ موفق‌اند.
- lint/typecheck/build، آزمون‌های Web/API/Contracts و ۱۹ سناریوی PostgreSQL موفق‌اند؛ ۱۴ مقصد HR، فرم‌ها، خروجی‌های واقعی و نمایش موبایل بررسی شدند. جزئیات و فرمان اجرای همین نسخه در `docs/tasks/HR-007.md` ثبت است. هیچ Merge انجام نشده است.

## MASTER-006 — حذف کانال ایجاد روش پرداخت و چیدمان چپ عملیات — آماده بررسی

- در فرم افزودن روش پرداخت، فیلد «کانال» از UI و ترتیب Focus حذف شد؛ مقدار خنثی `OTHER` برای سازگاری قرارداد فعلی فقط هنگام ایجاد در State داخلی ارسال می‌شود و کانال رکوردهای قبلی در مشاهده/ویرایش باقی است.
- گروه‌های دکمه و عملیات تمام Workspaceهای اطلاعات پایه در سمت چپ فیزیکی صفحه، از جمله چیدمان موبایل، هم‌تراز شدند. قرارداد/API/Schema/Migration، داده و Dependency تغییر نکردند.
- Contracts build، ۳۳۸ تست Master Data در ۴۲ فایل، Web lint/typecheck، Production Build با ۳۶ Route و `git diff --check` موفق‌اند.

## LEGAL-ENTITY-HEADER-003 — رنگ مستقل چهار شرکت و اجرای مشترک PC-A/PC-B

- آماده بررسی روی `codex/pc-b-company-header-colors`؛ نیایش سیر آبی، جهان باستان سورمه‌ای، قسطی رو سبز و جهان آکادمیا بنفش هستند.
- مجوز مالک برای اجرا و توسعه این قابلیت به هر دو کامپیوتر تعلق دارد. تنظیمات کاربران یا مجوزهای IAM گسترش نمی‌یابند؛ قرارداد چهارشرکتی موجود عمومی باقی می‌ماند.
- آماده‌سازی شرکت‌های مفقود به‌صورت فرمان محلی مستقل از Seed مشترک، بدون تغییر رکورد موجود و بدون Migration ارائه می‌شود.
- ۱۳ تست هدفمند، lint/typecheck و Build API/Web موفق‌اند. دو اجرای واقعی روی کپی دیتابیس، تکرارپذیری و فعال‌بودن چهار شرکت را تأیید کرد. Preview روی `http://127.0.0.1:3101` آماده ورود است؛ اجرای قدیمی HR روی 3100/4000 همچنان جدا باقی مانده است. دستور یکسان برای هر دو PC در `docs/tasks/LEGAL-ENTITY-HEADER-003.md` ثبت شد؛ رزرو موقت CSS آزاد است.

## MARKETING-001G — حذف معرفی Hub مارکتینگ — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-marketing-remove-section-intro` بلوک نمایشی شامل عنوان «بخش‌های مارکتینگ» و راهنمای انتخاب کارت را از Hub حذف کرد. فاصله اضافه Wrapper نیز حذف شد و Grid کارت‌ها مستقیماً نمایش داده می‌شود؛ نام دسترس‌پذیر Section بدون متن دیداری حفظ شده است.
- هیچ Backend، Schema/Migration/Seed، API/Contract، Dependency/Lockfile، داده یا فایل مرکزی UI تغییر نکرد. ۱۸ تست هدفمند، Contracts build، Web typecheck/lint و Production Build با ۳۴ Route موفق‌اند و نسخه جدید روی پورت ۳۱۰۰ فعال است.

## LEGAL-ENTITY-BRAND-HEADER-002 — هدر جهان باستان و اطلاعات ورود — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-jahan-bastan-header-identity` تم Header را به Context موجود شرکت فعال متصل کرد. با انتخاب «جهان باستان»، Header بدون تغییر فایل مرکزی درگیر PR #99 به طیف سورمه‌ای تغییر می‌کند و کنترل‌های انتخاب شرکت، جست‌وجو و عملیات Header خوانا می‌مانند؛ سایر Contextها ظاهر پیشین را حفظ می‌کنند.
- نام نمایشی کاربر و ساعت ورود در Header دسکتاپ نمایش داده می‌شود. داده فقط از پاسخ عمومی و احرازشده Login/Refresh می‌آید و در Session Storage همان Tab نگه‌داری می‌شود؛ شناسه کاربر، نام کاربری، Password، Token، Cookie یا PII اضافی ذخیره نمی‌شود.
- ۱۳ تست هدفمند Legal Entity/Auth/Header، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. Preview ایزوله روی پورت ۳۱۰۱ به Login سالم رسید؛ سرویس‌های فعال Task دیگر روی ۳۱۰۰/۴۰۰۰ متوقف یا تغییر داده نشدند. هیچ Backend، Schema/Migration/Seed، API/Contract، Dependency/Lockfile یا داده کاربر تغییر نکرد.
- Follow-up مالک: `legal-entities.v3` گزینه‌های فعال «جهان آکادمیا» و «قسطی رو» را با کدهای `JAHAN_ACADEMIA` و `GHESATI_RO` به قرارداد، API و انتخاب‌گر افزود؛ عنوان مدیران «همه شرکت‌ها» شد و برای شرکت‌های بدون لوگوی تحویلی نشان خنثی نمایش داده می‌شود. Schema/Migration و Dependency/Lockfile تغییر نکردند.
- به‌علت تغییر فعال `packages/database/prisma/seed.ts` در PR #90، Seed مشترک دست‌نخورده ماند. دیتابیس اصلی پورت ۵۵۴۳۲ و سرویس‌های ۳۱۰۰/۴۰۰۰ بدون شرکت جدید حفظ شدند؛ Clone ایزوله Backup روی ۵۵۴۳۳ هر چهار شرکت فعال را دارد و نسخه جدید روی `127.0.0.1:3101` و API آن روی `127.0.0.1:4001` اجرا می‌شود.
- ۲۷ تست هدفمند Contract/API/Web، lint و typecheck بسته‌های متاثر، Production Build API/Web با ۳۴ Route و `git diff --check` موفق‌اند. Web، Health API و CORS احرازشده Preview ایزوله نیز سالم‌اند.
- PR #106 با Merge Commit `10fc98b1dd0f6df7ed006dfc65e952cac1d421dd` وارد `develop` شد؛ هر ۸ Gate ثبت‌شده CI سبز هستند. نسخه Merge‌شده روی `localhost:3100` و API روی `localhost:4000` اجرا می‌شوند و دیتابیس ایزوله محلی PC-B هر چهار شرکت فعال را دارد. قفل قرارداد Legal Entities نیز `RELEASED / STABLE` است.

## NOTIFICATIONS-001 — مرکز اعلان تغییرات — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-global-change-notifications` زنگوله App Shell را به Notification Center سراسری Web تبدیل کرد. هر Mutation موفق `POST/PUT/PATCH/DELETE` به API تنظیم‌شده Nora پس از موفقیت Response، یک اعلان فارسی شامل نوع عملیات، بخش، زمان و لینک داخلی می‌سازد؛ عملیات ناموفق، Auth، Preview، Search، Validation و Export اعلان تغییر تولید نمی‌کنند.
- اعلان‌ها Payload درخواست یا PII نگه نمی‌دارند و در Browser Profile با سقف ۶۰ رکورد ذخیره می‌شوند. Badge خوانده‌نشده، فهرست RTL، Empty State، خواندن تکی/همه، پاک‌کردن خوانده‌شده‌ها، Sync بین Tabها و fallback امن Storage تکمیل است. اتصال DOCUMENTS-007، اعلان اسناد را از Backend پایدار می‌گیرد و برای آن مسیر اعلان مرورگری تکراری نمی‌سازد.
- PR #104 با همه Gateهای CI سبز روی `develop` ادغام شد. پیگیری DOCUMENTS-007 قرارداد، Persistence و API اعلان‌های اسناد را به همین مرکز اضافه می‌کند؛ Dependency/Lockfile تغییر نکرده است.

## DOCUMENTS-007 — اعتبارسنجی دومرحله‌ای نمایش اسناد — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-documents-step-up-security` دسترسی محدود IAM، Migration و Documents را برای همین Task گرفت؛ مالکیت Sales و PR #90 نزد PC-A دست‌نخورده ماند.
- فرم‌های بارگذاری اصلی و Customer گزینه «نیازمند اعتبارسنجی دومرحله‌ای» دارند. فعال‌سازی Authenticator با تأیید رمز جاری، TOTP واقعی، Secret رمز‌شده با کلید مستقل production، جلوگیری از Replay و قفل موقت تلاش‌های ناموفق انجام می‌شود.
- Preview/Download سند محافظت‌شده به Grant تصادفی و هش‌شده دو دقیقه‌ای محدود است که به همان User، Session، Document و Purpose متصل و اتمیک فقط یک بار مصرف می‌شود. کنترل Scan، Permission، Branch/Domain و Audit سمت Backend fail-closed است.
- پیش‌نمایش تصویر مجاز در Browser به PNG کم‌حجم واترمارک‌شده با نام سامانه، کد آرشیو و زمان تبدیل می‌شود و Headerهای امنیتی پاسخ/صفحه سخت‌تر شده‌اند؛ جلوگیری مطلق از Screenshot ممکن نیست.
- زنگوله مرکزی اکنون داده واقعی `notifications.v1` را نشان می‌دهد: Badge تعداد خوانده‌نشده، فهرست و Deep Link، خواندن تکی/همه و stateهای Loading/Empty/Error فعال‌اند. Upload، ویرایش، آرشیو، بازیابی، تغییر کامل/ناقص، عملیات گروهی و حذف دائمی سند در همان تراکنش تغییر، برای Actor و مالک سند اعلان پایدار و بدون گیرنده تکراری می‌سازند.
- ماژول مستقل Notifications مالک جدول و API است و همه List/Readها با User احراز‌شده Scope می‌شوند؛ Documents فقط Service عمومی ثبت را مصرف می‌کند. Migration افزایشی همراه Rollback و قرارداد عمومی نسخه‌دار اضافه شد و هیچ Dependency/Lockfile یا داده واقعی تغییر نکرد.
- Prisma، lint، typecheck و Production Build کامل با ۳۴ Route موفق است؛ `812` تست API و `633` تست Web سالم پاس شدند. Full Web فقط Assertion قدیمی و تغییرنیافته Customer وابسته به LF/CRLF را قرمز دارد. همه Migrationها روی PostgreSQL 18 خالی و ارتقای نمونه دارای User/Document موفق بود؛ Container موقت حذف شد و هیچ Secret واقعی در Git نیست.
- پیگیری اعلان با ۲۷ تست هدفمند API، ۸ تست هدفمند Web، Contract test و ۴ تست PostgreSQL واقعی Migration پاس شد؛ اجرای کامل API اکنون ۸۱۲ تست پاس و ۷۰ skip دارد.

## MARKETING-001F — اتصال مخاطب هدف پیشنهاد و تخفیف — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-marketing-offer-targets` فیلد اختیاری «مخاطب هدف» را به هر دو فرم «پیشنهاد ویژه» و «کد تخفیف» افزود. کاربر می‌تواند پیشنهاد را عمومی نگه دارد یا یک مشتری/آژانس مشخص را انتخاب کند؛ اگر نوع هدف را انتخاب کند، ذخیره بدون انتخاب رکورد مجاز نیست.
- گزینه‌های مشتری از Client عمومی Customers و فقط میان مشتریان فعال دارای رضایت جاری مارکتینگ دریافت می‌شوند. گزینه‌های آژانس از Client عمومی Master Data Organizations و فقط میان Organizationهای فعال با نقش canonical `AGENCY` می‌آیند. جست‌وجو، Loading/Empty/Error، Retry و لینک مستقیم به بخش مالک رکورد فعال است و Marketing هیچ Query مستقیم یا کپی داده هویتی ندارد.
- هیچ Schema/Migration/Seed، API/Shared Contract، Dependency/Lockfile، Permission یا فایل مرکزی UI تغییر نکرد. Web lint، typecheck، ۲۱ تست هدفمند و Production Build با ۳۴ Route موفق‌اند؛ نسخه متصل به API پورت ۴۰۰۰ جای اجرای قدیمی روی پورت ۳۱۰۰ فعال شد.

## MASTER-005 — خواندن، ثبت و نمایش نتیجه Excel — ادغام‌شده

- جریان موجود `HOTEL_IMPORT_V1` دوباره بررسی شد: Preview و اعتبارسنجی امنیتی قبل از Commit انجام می‌شوند و ثبت ردیف‌ها، ارتباطات مرجع و Audit در تراکنش اتمیک Backend باقی مانده است.
- نقص نمایش پس از ثبت برطرف شد؛ پس از Commit موفق، Workspace به فهرست هتل‌های همان کشور/شهر می‌رود، فیلتر وضعیت روی «همه» قرار می‌گیرد و شمارنده‌های ایجاد، به‌روزرسانی و ردشدن را نمایش می‌دهد.
- تست جدید سرویس، خواندن Workbook، ایجاد رکورد هتل در مقصد و ثبت Audit را پوشش می‌دهد. اجباری‌بودن فیلدهای Catalog اکنون علاوه بر ستارهٔ UI به semantics خود کنترل منتقل می‌شود و Backend نیز همان الزام‌ها را پیش از ثبت اعمال می‌کند. وعده/سرویس، نوع اتاق و امکانات هتل اختیاری‌اند و ثبت هتل بدون آن‌ها با تست سرویس تأیید شده است.
- Fixtureهای محلی و تست‌های فرم با قرارداد فعلی هم‌راستا شدند؛ کد خودکار خدمت در وابستگی تأمین‌کننده/کارگزار استفاده می‌شود و شرکت اتوبوس با سازمان مالک واقعی ثبت می‌شود. ۴۰۵ تست Master Data در API، ۳۳۶ تست Master Data در Web و ۶۶ تست یکپارچگی PostgreSQL، lint، typecheck و Build تولیدی هر دو بسته با ۳۴ Route موفق‌اند؛ Schema/Migration و Customer Import تغییر نکرده‌اند.

## TICKET-CATALOG-004 — حذف فضای خالی میان کارت‌های بلیت — آماده بررسی

- `PC-A` روی Branch مستقل `codex/pc-a-ticket-card-dense-layout` جای‌گذاری Grid کارت‌ها را Dense کرد؛ کارت‌های تک‌مسیر خانه‌های خالی کنار گروه‌های دو ستونه را پر می‌کنند و کارت‌های رفت‌وبرگشت همچنان در یک Wrapper و کنار هم می‌مانند.
- ۹۵/۹۵ تست Ticket Catalog Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. قانون Dense در CSS تولیدشده موجود است و نسخه جدید روی پورت ۳۱۰۰ پاسخ ۲۰۰ دارد. Browser QA خودکار به‌علت خطای ACL ابزار Windows ممکن نشد.
- هیچ Schema/Migration/Seed، API، Contract، Dependency/Lockfile یا ماژول دیگری تغییر نکرد.

## SALES-FIRST-PASSENGER-ACQUAINTANCE-0908 — COMPLETE_CODE / LOCAL_ACTIVATION_PENDING

New natural-person Sales contracts use passenger one as the customer, without a separate primary row or optional linkage checkbox. Agency customers remain independent. Each passenger has a themed registered acquaintance-method selector, persisted through public Customers create/update with existing permissions and optimistic versions. Legacy drafts and saved methods are preserved. 194 Sales tests, scoped lint/typecheck, synthetic browser QA and 36-route production build pass. Web3100/API4000 health is 200, but Web3100 runs the separate customer-direct-contact-0908 worktree; it was not replaced. Coordinate activation with that owner. No migration, IAM, real-data mutation or public push. See docs/tasks/SALES-FIRST-PASSENGER-ACQUAINTANCE-0908.md.

## SALES-PAYMENT-SEARCH-UPLOAD-0908 — COMPLETE_LOCAL

Tracking search in contract payments now opens the main server-backed search across authorized contracts rather than filtering only the current contract's payment rows. It clears old settlement filters/page and shows matching contracts under unchanged payment-read/ownership/branch gates. A prominent receipt section offers saved-payment selection and direct file upload/list/download through public Documents APIs; new payments select their saved ID automatically. Finance state, restricted confidentiality, scan/download and uncertain-upload guards are unchanged. 188 Web Sales and 5 API reference tests, scoped lint/typecheck, synthetic browser QA and 36-route build pass. Web3100 updated; Web/API health 200. No schema/API/IAM/real-data/public-push change. See docs/tasks/SALES-PAYMENT-SEARCH-UPLOAD-0908.md.

## SALES-INSURANCE-SELECTION-0908 — COMPLETE_LOCAL / ISSUANCE_DEFERRED

New Sales contracts select an active registered insurance plan from a themed dropdown instead of free-text description. Public Master Data lookup supports pagination, retry and empty/inactive states. Plan reference/name/record version and insurer selection metadata persist in the existing Sales service and version-1 reservation snapshot with passenger assignments; no issued-policy claim. User explicitly deferred insurer API connection to later Reservations/Integrations work. 185 Sales tests, scoped lint/typecheck, synthetic browser checks and 36-route Web production build pass. Web3100 updated; Web/API health 200. No schema, API, producer, IAM, real-data or public-push change. See docs/tasks/SALES-INSURANCE-SELECTION-0908.md.

## SALES-CONTRACT-ROOM-LOCATION-0908 — COMPLETE_LOCAL

User corrected room-total placement: saved single/double/extra-bed quantities now appear directly below the hotel table in Hotel Information (section 4), absent from Other Services. Passenger room column stays removed; calculations and all other fields unchanged. 34 focused tests, scoped lint/typecheck, 36-route build and all four synthetic PDF pages pass. Web3100 updated; Web/API 200. No schema/API/real-data/public-push change. See docs/tasks/SALES-CONTRACT-ROOM-LOCATION-0908.md.

## SALES-CONTRACT-ROOM-SUMMARY-0908 — COMPLETE_LOCAL

Removed per-passenger room labels from contract print/PDF and added saved purchased room counts (single, double, extra beds and total rooms) to Other Services, independently of passenger accommodation. Hotel Master Data product name, pricing/Finance rules, notices and QR remain unchanged. Older records with no breakdown are explicitly unrecorded, not inferred. 181 Sales tests, scoped lint/typecheck and 36-route Web build pass; all four synthetic PDF pages reviewed (six and agency-six one page, 42 two pages). Web3100 updated; Web/API 200. No schema, API, permissions, business-data or public-push change. See docs/tasks/SALES-CONTRACT-ROOM-SUMMARY-0908.md.

## SALES-CONTRACT-ONLY-FLIGHT-0907 — COMPLETE_LOCAL

Sales now supports a contract-only floating flight independently for outbound/return, alongside actual catalog offers. Version-1 details persist in existing Sales service metadata and the reservation request snapshot, not Ticket Management or inventory selections. Backend validates source exclusivity, route and timing; manual-only confirmation does not call the inventory reservation adapter. Print/PDF and Reservations ticket reopening include the pending-reservation flight. 59 public-contract, 54 API Sales and 181 Web Sales/Reservations tests, scoped lint/typechecks and API/36-route Web builds pass. Synthetic browser and both six-person one-page PDFs verified. Web3100/API4000 and existing database connectivity restored September 8. No migration, dependency, permissions, real records or public push changed. See docs/tasks/SALES-CONTRACT-ONLY-FLIGHT-0907.md.

## SALES-CONTRACT-QR-PLACEHOLDER-0907 — COMPLETE_LOCAL

User explicitly requested a non-working QR now. Print/PDF footer now has a sharp black/white QR at bottom right, with a small pending-server notice and existing contact details at left. QR contains only fixed pending-status text, no personal data, URL or access credential. It is not contract verification and existing copies will need regeneration after secure public-server viewing is implemented. 166 Sales tests, scoped lint/typecheck and 36-route build pass; all five synthetic PDF pages visually reviewed (six-person one-page layout retained). Web3100 updated; Web/API 200. No API, schema, dependency, IAM, real-data or public-push change. See docs/tasks/SALES-CONTRACT-QR-PLACEHOLDER-0907.md.

## SALES-PAYMENT-EVIDENCE-0907 — COMPLETE_LOCAL

Contract payments now accept optional tracking references in both creation and dashboard flows. Authorized dashboard search finds payment references within existing contract ownership/branch scope; payment rows can be filtered and show distinct Finance states. Saved payments expose receipt upload/list/download using public Documents APIs, registered FINANCE receipts, restricted confidentiality and unchanged scan/permission gates. Upload does not confirm payment; search is not a bank inquiry. 164 Web Sales tests, 62 API Sales/Documents tests, scoped lint/typechecks and API/Web production builds pass; synthetic browser workflow verified. Web3100/API4000 return 200; unauthenticated contract/document APIs return 401. No migration, grants, real-data upload or public push. See docs/tasks/SALES-PAYMENT-EVIDENCE-0907.md.

## SALES-CONTRACT-THEME-ROOM-0907 — COMPLETE_LOCAL

Hotel section now uses the selected room-type name from the existing public Master Data lookup, not passenger DBL/child accommodation labels. Updated reference-style Persian/navy header, left number badges, pale table headings, three-column financial summary, signatures and contact footer. User-requested phone/email apply only to Niyayesh issuer; prior terms, passenger/currency totals and finance logic are preserved. B Nazanin bold rendering corrected in print and PDF. 161 Sales tests, scoped lint/typecheck and 36-route build pass; all five final synthetic PDF pages inspected (2/6/agency-6: one page; 42: two). Web3100 updated; Web/API 200. QR remains deferred to server-hosted contract viewing. No migration/API/IAM/data change or public push. See docs/tasks/SALES-CONTRACT-THEME-ROOM-0907.md.

## SALES-CONTRACT-REFERENCE-THEME-0907 — THEME_COMPLETE_LOCAL / QR_DEFERRED_TO_SERVER

Contract print/PDF follows the supplied navy-header, teal-rule and soft-gray-table reference theme without changing fields, section order or business calculations. B Nazanin, English monetary digits, saved passenger amounts and notices remain. 159 Sales tests plus final 17 print tests, scoped lint/typecheck and 36-route production build pass; all five pages of four synthetic PDFs visually inspected (2/6/agency-6 passengers: one page; 42: two pages). Web3100 updated and Web/API health 200. User wants QR to open this specific contract online, like file viewing, after future server deployment. No public viewer/verification capability or QR is claimed or added now. No migration, API/IAM/data change or public push. See docs/tasks/SALES-CONTRACT-REFERENCE-THEME-0907.md.

## SALES-PAYMENT-CURRENCY-0907 — COMPLETE_LOCAL

Replaced the remaining free-text currency in saved-contract dashboard payments with a button-only themed registered-currency dropdown. Active references load across pages; failures/empty lists block submission with retry, and arbitrary codes cannot be entered. Existing new-contract currency selections remain unchanged. 158 Sales Web tests, scoped lint/typecheck and 36-route production build pass; synthetic actual-component browser tests cover retry, disabled submit, USD selection, inactive filtering and retention. Local Web3100 updated; API/database unchanged, no real payment created or public push. See docs/tasks/SALES-PAYMENT-CURRENCY-0907.md.

## RESERVATIONS-TICKET-ACCESS-0907 — COMPLETE_LOCAL

Reservations contract cards now reopen saved passenger ticket snapshots, select one passenger or print all (one A4 page each), and offer browser Save as PDF. Contract-number search and paging make requests older than the latest 100 accessible within existing permission/branch scope. Sales exposes a presentation-only public ticket entry; no live inventory reconstruction or private-module queries. 162 Web tests, 15 API tests, scoped lint/typechecks, API/Web production builds, synthetic interactive browser and both rendered PDF pages passed. Five unrelated PostgreSQL hotel-purchase tests skipped without their dedicated test database; an empty-authorized-scope history query was independently checked on local PostgreSQL without business-row access. Local Web3100/API4000 updated. Existing templates remain DRAFT/not issued; no direct ticket-PDF download endpoint or real issuance added. No migration/data/IAM/public push. See docs/tasks/RESERVATIONS-TICKET-ACCESS-0907.md.

## SALES-TICKET-THEME-0907 — COMPLETE_LOCAL

Passenger ticket preview/print uses contract blue, larger agency branding and no payment section. Recognized test flights show a test-airline icon plus explicitly sample-only e-ticket 7143/RLOC DEMO01; actual issuance remains blank and all copies remain DRAFT. 153 Sales tests plus seven final template/visual checks, scoped lint/typecheck/production build pass. Chromium screenshot verified; Web3100 active, Web/API 200. No schema/API/IAM/real-data changes or public push. See docs/tasks/SALES-TICKET-THEME-0907.md.

## SALES-OUTPUT-PAGINATION-0907 — COMPLETE_LOCAL

Contract print and PDF now fit standard 5–6 passenger examples (including agency, hotel, return flight and IRR/USD) on one A4 page. Wider room/currency columns and compact branding/section badges preserve legibility. All rows continue across pages with repeated headings, grouped totals and page counters; 42/100-person samples use 2/3 pages. Eight final pages visually checked, row/page counts verified, 150 Sales Web tests plus scoped lint/typecheck/production build pass. Web3100 active and Web/API health 200. No migration, API, IAM, real data change or public push; scoped locks released. See docs/tasks/SALES-OUTPUT-PAGINATION-0907.md.

## SALES-PEOPLE-CORRECTION-0907 — COMPLETE_LOCAL

Current national-ID corrections no longer require restoring an earlier attempted ID. Confirmation reads but never mutates the previous registration, then adopts/updates the accessible exact current-ID profile using existing permissions/version. Duplicate creates resolve on the same confirmation; blank optional entries preserve existing details. Optional Customers matchByNationalId retains strict legacy default, branch scope and sensitive-read audit. 249 Web + final 25 focused, 93 API Customers, 48 Contracts tests, scoped lint/typechecks and API/Web production builds passed. Local Web3100/API4000 updated and healthy; no migration/IAM/real-data walkthrough/public push. See docs/tasks/SALES-PEOPLE-CORRECTION-0907.md.

## SALES-PEOPLE-RECOVERY-0907 — COMPLETE_LOCAL

Sales people confirmation now separates definite rejection from unknown creation/contact outcomes. The same confirmation action recovers an exact existing identity or refreshes a known saved profile, preserving successful records/contact checkpoints. New public Customers registration lookup is POST-only, branch-scoped and sensitive-read permission/audit protected; no fuzzy identity binding or blind changed-national-ID retry. 243 combined Web + final 8 client tests, 91 Customers API + final 16 permission tests, 48 Contracts tests, scoped lint/typechecks and API/Web production builds pass. Local services updated; no migration/seed/IAM or real-customer walkthrough. See docs/tasks/SALES-PEOPLE-RECOVERY-0907.md.

## SALES-OUTPUT-TERMS-0907 — COMPLETE_LOCAL

Three user-supplied notices (similar hotel substitution, cashier receipt requirement, and overseas contract-conditions acceptance statement) are displayed below signatures and above Nystkt.ir in print/PDF. Persian spacing/spelling normalized without added terms; no legal review or automated consent/receipt-state change. Fourteen focused tests, scoped lint and production TypeScript/build passed. One-page normal and three-page large samples visually checked. Local Web3100 updated; API/database unchanged. No public push. See docs/tasks/SALES-OUTPUT-TERMS-0907.md.

## SALES-OUTPUT-HOTEL-CURRENCY-0907 — COMPLETE_LOCAL

Contract print/PDF now shows Nystkt.ir, hotel Latin name and website from public Master Data, explicit guest accommodation categories, separate IRR and foreign amount columns, and exact passenger-summed totals per currency. Existing missing data remains unrecorded, not inferred. Additive Sales passenger accommodation migration is live locally after empty/seed-twice and backup-restore gates; old records/history preserved. 132 Web Sales / 45 API Sales / 48 Contracts tests, scoped lint/typechecks and production builds passed. All four synthetic PDF pages inspected. Web3100/API4000 return 200; authenticated real-customer walkthrough not performed. Local-only; scoped ownership released. See docs/tasks/SALES-OUTPUT-HOTEL-CURRENCY-0907.md.

## SALES-OUTPUT-CLEANUP-0907 — COMPLETE_LOCAL

Removed the user-marked operator notes under signatures and technical generation footer from customer print/PDF, preserving company/signatures and all amounts. Operator disclosures and browser header/footer instructions remain in the preview dialog. Eleven tests, scoped lint and Web production TypeScript/build passed; all four synthetic PDF pages inspected. Web3100 restarted; API/database unchanged. Local-only; scoped locks released. See docs/tasks/SALES-OUTPUT-CLEANUP-0907.md.

## SALES-CUSTOMER-PRICING-0907 — COMPLETE_LOCAL — 2026-09-07

Individual agreed package totals per passenger/currency are persisted with exact reconciliation, without inferred age allocation. Direct PDF download is beside Print; amounts use English digits while Persian prose retains B Nazanin. Latest local Web3100/API4000 are active. 129 Web Sales / 44 API Sales / 47 Contracts tests, scoped lint, typechecks and production builds passed. Additive migration passed empty/seed-twice and backup-restore gates; operational historical checksums/business counts unchanged. No historical rebaseline, IAM grant, producer modification or public push. Legacy per-passenger amounts remain unrecorded; no fabrication. Task-specific locks released. Details: docs/tasks/SALES-CUSTOMER-PRICING-0907.md.

## رنگ خروجی و ویرایش مشتری از فروش — 2026-09-07 — تحویل جزئی در لوکال

- آبی جدول‌ها و کارت‌های خروجی قرارداد به آبی تیره هماهنگ شد؛ ب‌نازنین و جمع مالی قبلی حفظ شدند و همه صفحات PDF آزمایشی بازبینی شدند.
- انتخاب شخص موجود، اطلاعات مجاز را در جدول باز می‌کند و فوکوس به ردیف قابل ویرایش می‌رود. اصلاح نام، هویت، تولد، پاسپورت و تماس با API عمومی مشتریان، مجوزهای قبلی و کنترل نسخه ذخیره می‌شود. مقادیر ماسک‌شده دست‌نخورده ارسال نمی‌شوند؛ تماس قبلی حذف نمی‌شود و مشتری همان مسافر اول همگام می‌ماند.
- ۲۳۶ تست وب و ۱۴ تست نهایی مدل افراد، lint، typecheck و Build تولیدی ۳۶ مسیر موفق‌اند. آزمون تعاملی داده مصنوعی با CSS نهایی موفق؛ وب۳۱۰۰ فعال، ورود و سلامت API۲۰۰ و حفاظت فرم۳۰۷ است. بررسی احرازشده یا تغییر داده واقعی انجام نشد.
- بخش مبلغ هر مسافر هنوز انجام نشده: انتخاب ورود قیمت روز/توافقی بر اساس رده سنی یا فردی در انتظار پاسخ است. هیچ تقسیم فرضی جمع یا تخفیف سنی ساختگی اضافه نشده. بدون Migration، تغییر API/مجوز یا Push عمومی؛ جزئیات: docs/tasks/SALES-CUSTOMER-PRICING-0907.md.

## خروجی قرارداد و اصلاح عرض فرم — 2026-09-07 — فعال در لوکال

- عنوان «قرارداد جدید» در راهنمای بالای صفحه تعریف شد؛ پیام «در دسترس نیست» ناشی از نبود عنوان مسیر بود، نه قطع سرور. ستون فرم از عرض حداقل جدول مستقل شد و پیمایش افقی داخل جدول می‌ماند.
- پس از تأیید قرارداد و در داشبورد، «خروجی قرارداد / PDF» اطلاعات ذخیره‌شده را در قالب شش‌بخشی با ب‌نازنین نشان می‌دهد. دریافت فایل با «چاپ / ذخیره PDF» مرورگر است، نه دانلود خودکار یا ارسال به مشتری. مبلغ توافق‌شده و پرداخت تأییدشده مالی مصرف می‌شوند؛ قیمت خرید/پیشنهاد و کمیسیون فرضی وارد جمع نمی‌شوند.
- این نسخه کپی اطلاعات قرارداد است، نه رسید پرداخت، فاکتور مالیاتی یا صدور رسمی بایگانی‌شده. نام شرکت از شرکت فعال هنگام تهیه خروجی است و این محدودیت صریح نمایش داده می‌شود. سیاست صدور رسمی Legal Entity همچنان بدون تغییر است.
- ۲۳۳ تست وب، ۴۴ تست API فروش، ۴۱ تست قرارداد عمومی، lint محدوده، typecheck و Build وب/API موفق‌اند. پیش‌نمایش و چاپ در iframe و عرض فرم دسکتاپ/موبایل با داده مصنوعی آزموده شد؛ PDF نمونه عادی یک صفحه و ۴۲ مسافر سه صفحه است. ۳۱۰۰/۴۰۰۰ فعال و حفاظت ورود برقرار؛ بررسی احرازشده روی قرارداد واقعی ادعا نمی‌شود.
- بدون Migration، تغییر مجوز، داده واقعی آزمایشی یا انتشار عمومی. جزئیات و محدودیت‌ها: docs/tasks/SALES-OUTPUT-LAYOUT-0907.md.

## تقویم مستقیم جدول مشتری و مسافر — 2026-09-06 — فعال در لوکال

- پنجرهٔ واسط تاریخ حذف شد؛ تقویم هم‌تم مستقیم کنار خانهٔ تاریخ تولد یا انقضای پاسپورت باز می‌شود. سوییچ شمسی/میلادی داخل تقویم است و فرم اصلی با Escape بسته نمی‌شود. همین جدول در فروش نیز مصرف می‌شود؛ مقدار ISO، ردیف‌ها و قواعد ویرایش حفظ شدند.
- ۲۲۲ تست هدفمند وب، lint، typecheck و Build تولیدی ۳۶ مسیر موفق‌اند. آزمون تعاملی با دادهٔ مصنوعی و CSS نهایی، انتخاب سال/ماه/روز، حفظ فرم، کلیک بیرون، فوکوس، انقضای مستقل و محدودهٔ موبایل را تأیید کرد. وب۳۱۰۰ و API۴۰۰۰ پاسخ موفق دارند؛ بررسی احرازشده و تغییر دادهٔ واقعی انجام نشد.
- بدون تغییر API، دیتابیس، مجوز، وابستگی یا انتشار عمومی؛ نسخهٔ قبلی وب محفوظ است. جزئیات: docs/tasks/CUSTOMER-INLINE-CALENDAR-0906.md.

## اتصال مشتری به مسافر اول و انقضای پاسپورت — 2026-09-06 — فعال در لوکال

- تیک «این مشتری مسافر اول هم هست» اطلاعات مشتری را بدون افزایش تعداد در ردیف اول قرار می‌دهد؛ ویرایش‌ها همگام می‌مانند و برداشتن تیک ردیف قبلی را بازمی‌گرداند. جایگزینی ردیف پُر نیازمند تأیید است و مشتری حقوقی مسافر نمی‌شود.
- شماره و تاریخ انقضای پاسپورت از جدول قرارداد در پرونده Customers ذخیره می‌شوند. شماره همچنان رمزنگاری/ماسک می‌شود و خواندن اطلاعات حساس مجوز و Audit قبلی را دارد. انقضا ستون nullable از نوع Date با قرارداد اختیاری سازگار است؛ اطلاعات خام وارد localStorage فروش نمی‌شود.
- ۲۱۱ تست مشترک Web و ۱۱ تست نهایی مدل افراد، ۸۸ تست API مشتریان، ۴۱ Contracts و ۷۱ Database، lint/typecheck و Build وب/API موفق‌اند. ۳۸ Migration و Seed دوبار روی دیتابیس خالی، ارتقای نسخه بکاپ و تست ذخیره واقعی/نسخه/شعبه موفق بودند. پس از بکاپ جدید، تنها Migration افزایشی روی لوکال اعمال شد؛ شمار داده‌های قبلی و checksumهای تاریخی حفظ شدند.
- وب ۳۱۰۰ و API۴۰۰۰ فعال‌اند؛ پاسخ ورود، فایل جدید و سلامت API برابر ۲۰۰ و منع دسترسی بدون ورود برقرار است. بدون تغییر مجوز، Seed عملیاتی یا انتشار عمومی؛ بررسی بصری احرازشده انجام نشده است. جزئیات: docs/tasks/SALES-PASSPORT-EXPIRY-0906.md.

## جدول مشترک مشتری و مسافر در فروش — 2026-09-06 — فعال در لوکال

- مرحله افراد قرارداد از همان جدول افزودن مشتریان استفاده می‌کند؛ تمام ردیف‌های مسافر مطابق تعداد مرحله اول یکجا باز می‌شوند. فقط افزودن نوزاد در این مرحله ممکن است و تعداد بزرگسال/کودک از مرحله اول تغییر می‌کند. مشتری حقوقی و «مشتری همان مسافر اول» حفظ شدند.
- اعتبارسنجی همه ردیف‌ها پیش از ثبت انجام می‌شود؛ پرونده‌های موجود دوباره ساخته نمی‌شوند و نتیجه نامطمئن ثبت نیازمند بررسی است. اطلاعات خام ورودی در حافظه فرم است، نه پیش‌نویس localStorage. مرز عمومی مشتریان، کنترل شعبه/مجوز، ظرفیت و قواعد مالی حفظ شدند.
- ۲۰۸ تست مشترک فروش/مشتریان و ۷ تست نهایی جدول مشترک، lint محدوده، typecheck و Build تولیدی ۳۶ مسیر موفق‌اند. وب ۳۱۰۰ و فایل جدید پاسخ ۲۰۰ دارند؛ API بدون تغییر سالم است. بدون Migration، تغییر مجوز، داده واقعی آزمایشی یا انتشار عمومی. بررسی بصری احرازشده انجام نشده؛ جزئیات در docs/tasks/SALES-PEOPLE-SHEET-0906.md.

## یکسان‌سازی تم داشبورد فروش — 2026-09-06 — فعال در لوکال

- چهار کارت شاخص فروش با گرادیان، تایپوگرافی و فاصله‌گذاری بخش مشتریان/مسافران هماهنگ شد؛ اعداد و محاسبات قبلی حفظ شدند. منوی وضعیت تسویه، روش پرداخت، بانک چک و مسافر پیش‌نمایش بلیت از Select آماده برنامه با پشتیبانی RTL و کیبورد استفاده می‌کنند.
- ۹۹ تست فروش، lint محدوده، typecheck وب و Build تولیدی ۳۶ مسیر موفق بود. نسخه روی ۳۱۰۰ فعال؛ فایل جدید و ورود پاسخ ۲۰۰، حفاظت ورود داشبورد پاسخ ۳۰۷ و سرور پاسخ سلامت ۲۰۰ دارند. بدون تغییر API، پایگاه داده، مجوز یا انتشار عمومی؛ بررسی بصری احرازشده ادعا نمی‌شود.

## بازطراحی برنامه پرداخت قرارداد — 2026-09-06 — فعال در لوکال

- کارت‌های فشرده و شماره‌دار، تعداد پرداخت و چک، عنوان مستقل مبلغ/ارز/روش/سررسید، اطلاعات چک در بخش مشخص و حذف با تأیید اضافه شد. داده چک پیش‌نویس در ورودی‌های کنترل‌شده نمایش داده می‌شود؛ تغییر روش به غیرچک، داده غیرفعال چک را از درخواست حذف می‌کند تا اعتبارسنجی فعلی سرور حفظ شود.
- ۹۶ تست فروش، lint محدوده، typecheck نهایی و Build تولیدی ۳۶ مسیر پاس شدند. پنج تست جزء جدید پس از اصلاح نوع فیلد اختیاری چک تکرار و موفق شدند. نسخه روی ۳۱۰۰ فعال و پاسخ صفحه ورود و فایل جدید ۲۰۰ است. API، پایگاه داده، مجوزها و قواعد تأیید مالی تغییر نکرده‌اند. نسخه قبلی در tmp/payment-layout-web-before-0906 نگهداری شد؛ بدون انتشار عمومی یا ادعای بررسی بصری احرازشده.

## ارز و ترانسفر همراه قرارداد — 2026-09-06 — فعال در لوکال

- ارز قیمت خدمات و پرداخت‌ها از فهرست فعال اطلاعات پایه با جست‌وجو انتخاب می‌شود؛ منوی روش پرداخت و مراجع فرم با تم برنامه یکسان شد. ارز نامعتبر یا غیرفعال در فرم جدید پذیرفته نمی‌شود.
- ترانسفر رفت/برگشت در قرارداد جدید خدمت همراه بدون هزینه اضافه است؛ ردیف قیمت ندارد، سرور قیمت اضافه برای آن را رد می‌کند و جهت آن در خروجی بلیت و اطلاعات تحویل رزرواسیون باقی می‌ماند. قیمت قراردادهای قدیمی، محاسبه هتل و تسویه بر اساس تأیید Finance تغییر نکرد.
- ۴۱ تست Contracts، ۹۱ تست Sales Web، ۴۴ تست API فروش/رزرواسیون، همه ۱۱ بررسی lint/typecheck و وابستگی، Build سرور و Build وب با ۳۶ مسیر پاس شدند؛ ۵ تست اختیاری دیتابیس اجرا نشدند. نسخه جدید روی ۳۱۰۰/۴۰۰۰ فعال است و پاسخ HTTP و فایل نسخه جدید تأیید شد. بدون Migration، تغییر مجوز یا انتشار عمومی؛ بررسی بصری احرازشده ادعا نمی‌شود. جزئیات: docs/tasks/SALES-CURRENCY-INCLUDED-TRANSFER-0906.md.

## ورودی عددی تعداد مسافر — 2026-09-06

- منوهای تعداد بزرگسال، کودک و نوزاد در قرارداد جدید با ورودی مستقیم عدد صحیح جایگزین شدند؛ انتخاب مقدار با کلیک، پاک‌کردن/تایپ مجدد و واحد «نفر» حفظ است. عدد منفی/اعشاری رد می‌شود و محدودیت منوی ۰ تا ۳۰ حذف شده؛ منطق ظرفیت صندلی و ترکیب سنی تغییر نکرد.
- ۸۵ تست فروش، lint محدوده، typecheck وب و Build تولیدی ۳۶ مسیر پاس شدند. نسخه جدید روی ۳۱۰۰ فعال و وب/API پاسخ موفق دارند. تغییر فقط Web است؛ بدون Migration، تغییر مجوز یا انتشار عمومی. بررسی بصری احرازشده ادعا نمی‌شود.

## قیمت‌گذاری فروش و خرید هتل — 2026-09-06 — فعال در لوکال

- پیگیری با تأیید کاربر: ادغام معمولی e31b8d1 سه تغییر فروش تا 3d3095e را با قیمت‌گذاری ترکیب کرد؛ هر دو تاریخچه و Handoff حفظ شدند. شاخه مالک، main/develop و ریموت تغییر نکردند. نسخه مستقل هزینه خرید و چیدمان در یک پاسخ عمومی بازمی‌گردند و Snapshot قرارداد ثابت می‌ماند.
- بررسی ترکیبی: ۷۳۳ تست Web، ۸۸۳ تست API، ۳۸ تست Contracts، ۷۱ تست Database، lint/typecheck و Build وب/API موفق؛ ۳۷ Migration روی دیتابیس تازه، Seed دوگانه و ۴۶ تست واقعی دامنه/ظرفیت/رزرواسیون پاس شدند. اجرای اولیه Seed زیر بار هم‌زمان timeout شد؛ تکرار مستقل دوگانه موفق بود.
- ارتقا روی نسخه بازیابی‌شده بکاپ و سپس دیتابیس اصلی با بکاپ تازه موفق شد؛ فقط Migration افزایشی قیمت‌گذاری اعمال شد و شمار داده‌های قبلی و checksumهای تاریخی ثابت ماندند. نسخه کامل اکنون روی ۳۱۰۰ و API۴۰۰۰ فعال است؛ پاسخ وب/سرور، CORS، منع ثبت بدون ورود و دسترسی مؤثر خواندن/ثبت خرید هتل برای Ramtin تأیید شدند. هیچ Seed عملیاتی، مجوز اضافی یا ثبت قرارداد واقعی برای آزمایش انجام نشد.
- بندهای توقف اولیه در ادامه، سابقه پیش از این ادغام موفق‌اند و دیگر مانع فعال‌سازی نیستند. بررسی تصویری احرازشده ادعا نمی‌شود.

- قیمت روز فروش و مبلغ توافقی هر خدمت/ارز جدا شده‌اند؛ ورودی مبلغ سه‌رقمی، قیمت هر شب/کل اقامت با حفظ جمع دقیق و تخفیف خودکار فروشنده پیاده شد. ثبت هزینه خرید هتل در رزرواسیون نسخه‌دار و دارای کنترل شعبه، مجوز اختصاصی، ثبت تکرارپذیر و سابقه تغییرات است. مانده مالی همچنان فقط بر اساس پرداخت تأییدشده محاسبه می‌شود.
- lint/typecheck، ۷۲۷ تست Web و ۳ تست نهایی پنل قیمت، ۸۸۲ تست API، ۳۸ تست Contracts، ۷۱ تست Database و Build وب/API پاس شدند. ۳۵ Migration روی دیتابیس خالی، Seed دوگانه و ۳۷ تست هدفمند دامنه/ذخیره واقعی موفق بودند؛ ۷۸ تست اختیاری API اجرا نشدند.
- پیش‌بررسی عملیاتی دو Migration تازه ظرفیت بلیت و چیدمان رزرواسیون از شاخه فروش را یافت که در این پایه یکپارچه نیستند؛ هیچ Migration قیمت‌گذاری یا تعویض API انجام نشد. نسخه قبلی وب روی ۳۱۰۰ بازگردانده شد و API۴۰۰۰ در دسترس است. فعال‌سازی نیازمند هماهنگی و یکپارچه‌سازی با کار مالک آن شاخه است؛ بدون Push عمومی یا ادعای بررسی تصویری احرازشده.
- طبق تأیید صریح کاربر، فقط مجوز ثبت خرید هتل به Ramtin با نقش اختصاصی اضافه شد؛ بکاپ و Audit ثبت و عدم تغییر سایر کاربران/نقش‌های مشترک کنترل شد. جزئیات: docs/tasks/HOTEL-SALES-PRICING-0906.md.

## ورود جدولی مشتری و مسافران — 2026-09-06

- فرم ایجاد شخص در Customer 360 به جدول قابل ویرایش تبدیل شد؛ مدارک هر ردیف جدا باز می‌شوند. اعتبارسنجی نام خالی و کد ملی تکراری پیش از ثبت، تأیید حذف/تغییر شخص و تقویم سلولی اضافه شد. اتصال عمومی Customers/Documents و حفاظت اطلاعات محفوظ است؛ API و دیتابیس تغییر نکردند.
- روی شاخه مستقل codex/pc-a-customer-entry-sheet-0906: ۱۰۰ تست مشتریان، همه ۷۲۵ تست Web، lint بخش مشتریان، typecheck و Build تولیدی ۳۶ مسیر پاس شدند. وب جدید ۳۱۰۰ و API۴۰۰۰ پاسخ موفق دارند؛ بررسی احرازشده تصویری و ثبت مشتری واقعی ادعا نمی‌شود. جزئیات: docs/tasks/CUSTOMER-ENTRY-SHEET-0906.md.

## فعال‌شدن نسخه یکپارچه محلی — 2026-09-06

- ارتقا روی کپی بازیابی‌شده بکاپ موفق بود؛ پس از بکاپ تازه، فقط Migration افزایشی آژانس‌ها روی nora اجرا شد. checksumهای قبلی و شمار مشتری/کاربر/مدرک حفظ شدند؛ هیچ reset یا Seed عملیاتی انجام نشد.
- وب ۳۱۰۰ و API۴۰۰۰ اکنون از شاخه یکپارچه اجرا می‌شوند و پاسخ HTTP موفق دارند. کلید و مسیر مدارک قبلی محفوظ است. ریشه تاریخی اختلاف checksum همچنان ثبت است، اما آزمون ارتقای کپی مانع اجرای محلی را رفع کرد.

## یکپارچه‌سازی محلی — 2026-09-06

- نسخه آخر فروش، develop، آژانس، مارکتینگ، منابع انسانی، تقویم و بازیابی پاسپورت در شاخه مستقل codex/pc-a-local-integration-0906 ترکیب شدند. شاخه‌های اصلی، main/develop و ریموت تغییر نکردند.
- lint، typecheck، تست کامل و Build موفق؛ ۳۴ Migration روی دیتابیس خالی و Seed دوگانه موفق. جزئیات و آزمون‌های اجرا‌نشده در docs/tasks/LOCAL-INTEGRATION-0906.md ثبت است.
- اجرای نسخه جدید متوقف است: دو checksum قدیمی در دیتابیس nora با تاریخچه Git تطبیق ندارند. بکاپ محلی تهیه شد؛ Migration عملیاتی، Seed یا جابه‌جایی سرور انجام نشده و نسخه جاری محفوظ است.

## ترکیب مسافر و چیدمان نسخه‌دار هتل — 2026-09-06

- شمارنده‌های بزرگسال، کودک و نوزاد در فروش جمع‌وجور هستند؛ تعداد اتاق، یک‌تخته، دوتخته و تخت اضافه با ورودی عددی مستقیم نمایش داده می‌شوند. واحد اتاق «باب» و تخت اضافه «نفر» است و خلاصه پایین ترکیب بزرگسال، کودک و نوزاد را نشان می‌دهد. تعداد مسافر پیش از انتخاب بلیت تعیین می‌شود و نوزاد صندلی مصرف نمی‌کند؛ کنترل ظرفیت اتمیک قبلی حفظ شده است.
- پس از ثبت قرارداد، رزرواسیون می‌تواند چیدمان اجرایی هتل و اعضای اقامت را فقط از میان مسافران همان Snapshot و با دلیل تغییر ثبت کند. هر تغییر یک Revision افزایشی با کنترل نسخه هم‌زمانی می‌سازد و Snapshot فروش بازنویسی نمی‌شود. افزودن/تعویض مسافر یا افزایش صندلی همچنان از اصلاح قرارداد فروش و کنترل ظرفیت می‌گذرد.
- ستون‌های چیدمان برای قراردادهای تاریخی nullable هستند تا هیچ مقدار فرضی روی داده قبلی نوشته نشود؛ قراردادهای جدید مقادیر واقعی را ذخیره می‌کنند. Migration `20260906113000_reservation_arrangements` پس از pg_dump روی دیتابیس لوکال اعمال شد و هر ۳۴ Migration روی PostgreSQL خالی موفق بود.
- ۶۸۰ تست Web، ۸۲۳ تست API با ۷۶ skip اختیاری و ۱۸ تست Contracts موفق؛ lint، typecheck و Production Build وب/API و تست یکپارچه چیدمان رزرواسیون موفق‌اند. تعریف مجوز جدید آماده است، اما تخصیص آن به نقش‌ها به تأیید صریح امنیتی نیاز دارد. بررسی بصری احراز‌شده ادعا نمی‌شود.

## ظرفیت مسافر بلیت و اعضای هتل — 2026-09-06

- ترکیب بزرگسال، کودک و نوزاد پیش از انتخاب بلیت ثبت می‌شود؛ فقط بزرگسال و کودک صندلی مصرف می‌کنند و وجود نوزاد بدون بزرگسال رد می‌شود. کارت پیشنهاد ظرفیت کل و مانده را نشان می‌دهد و پیشنهاد ناکافی قابل انتخاب نیست.
- تأیید قرارداد، ظرفیت هر جهت را با قفل ردیفی PostgreSQL و کلید قرارداد/جهت اتمیک رزرو می‌کند؛ اجرای هم‌زمان از بیش‌فروشی جلوگیری می‌کند و لغو قرارداد ظرفیت را آزاد می‌کند. Migration افزایشی `20260906095000_ticket_offer_capacity_allocations` روی دیتابیس خالی با هر ۳۳ Migration موفق بود.
- برای هتل، تعداد اتاق جداست و اعضای اقامت از میان مسافران قرارداد انتخاب می‌شوند؛ occupancy از همان اعضا ساخته و در Snapshot رزرواسیون ثبت می‌شود. موجودی قطعی هتل همچنان نیازمند تأیید رزرواسیون است و موجودی ساختگی تولید نمی‌شود.
- کل تست‌ها: ۶۷۸ تست Web و ۸۲۳ تست API موفق (۷۵ تست اختیاری API skip)؛ ۴۶ تست هدفمند Web و ۳۱ تست هدفمند API نیز مستقل موفق؛ lint، typecheck و Production Build وب/API و تست PostgreSQL مستقل جلوگیری از بیش‌فروشی موفق‌اند. تست هم‌زمانی قدیمی Reservations در اجرای کامل PostgreSQL یک خطای race در upsert خود Reservations نشان داد که خارج از این تغییر است؛ تست ظرفیت مستقل دوباره موفق شد. پس از پشتیبان‌گیری داخل کانتینر، Migration لوکال اعمال شد و Web 3100، API 4000 و CORS به‌ترتیب 200/200/204 پاسخ دادند. بررسی بصری احراز‌شده به‌دلیل خطای ACL ابزار مرورگر ادعا نمی‌شود.

## بازطراحی داشبورد فروش — 2026-09-05

- سربرگ و کارت‌های خلاصه بازطراحی شدند؛ مانده ارزها جدا، پیگیری مالی/رزرواسیون و مسیر ثبت اولین قرارداد مشخص‌اند. فهرست دارای جست‌وجوی واقعی شماره/مشتری، فیلتر تسویه، صفحه‌بندی و برچسب‌های فارسی است.
- ارقام فارسی بدون تبدیل Decimal به Number؛ آمار کل از فهرست فیلترشده مستقل و کنترل دسترسی و مانده تأییدشده Finance بدون تغییر است. ۷۲ تست فروش، lint محدوده، typecheck و Production Build وب موفق‌اند.
- تحویل محلی روی ۳۱۰۰؛ بدون Migration، تغییر مجوز، Push یا Merge. تست بصری احراز‌شده ادعا نمی‌شود.

## بازطراحی مشتری و مسافران فروش — 2026-09-05

- دو بخش شماره‌دار مشتری قرارداد و مسافران، سه انتخاب خریدار (شخص/آژانس/مسافر اول)، کارت مختصر مشتری انتخاب‌شده و تغییر صریح آن. جست‌وجوی نقش‌محور و صفحه‌بندی‌شده مشتری/مسافر جداست؛ نتایج جمع‌وجور و محدود به ارتفاع‌اند و کد ملی/تماس فقط Masked نمایش داده می‌شود. UUID و role انگلیسی از این بخش حذف شد. در هر بخش فقط جست‌وجو یا ثبت باز است؛ ردیف‌های اضافه مسافر در صف جمع‌وجور ثبت می‌شوند و علت غیرفعال‌بودن «بعدی» مشخص است.
- کد ملی مشتری حقیقی هم مطابق Backend اجباری شد. Backend فروش در ایجاد/ویرایش/تأیید از Public masked API مشتریان دسترسی و وضعیت هر مسافر را کنترل می‌کند؛ مسافر باید شخص فعال دارای نقش مسافر باشد. مشتری غیرفعال و مسافر تکراری رد می‌شوند. هیچ Query مستقیم یا تغییر Customers/Schema انجام نشد.
- ۶۹ تست Web فروش و ۳۵ تست API فروش، lint و typecheck و Build هر دو موفق؛ وب ۳۱۰۰ و API۴۰۰۰ به‌روزرسانی شدند. بررسی بصری احراز‌شده و ایجاد شخص واقعی انجام نشده؛ انتشار عمومی هنوز مجاز نشده است.

## تاریخ خواناتر کارت بلیت فروش

- تاریخ حرکت و رسیدن در کارت بلیت رفت و برگشت از ۱۱px کم‌رنگ به ۱۴px موبایل/۱۶px دسکتاپ، پررنگ و با کنتراست کامل تغییر کرد؛ متن قابلیت شکستن خط دارد. منطق زمان تهران و انتخاب بلیت ثابت است. ۶۶ تست فروش، lint، typecheck و Build وب موفق؛ تغییر محلی و بدون Push عمومی.

## SALES-ORGANIZATION-CUSTOMER-0905 — اتصال مشتری حقوقی/آژانس

- ۶۴ تست فروش، lint، typecheck و Production Build وب با ۳۵ مسیر موفق؛ نسخه جدید روی پورت ۳۱۰۰ اجرا شد. تغییرات فقط محلی ثبت می‌شوند؛ انتشار عمومی فروش هنوز تأیید نشده است.

- فرم فروش نوع مشتری حقیقی یا حقوقی/آژانس دارد. سازمان‌های فعال از Public API اطلاعات پایه با جست‌وجو انتخاب می‌شوند؛ پرونده مشتری حقوقی قابل‌دسترسی از API مشتریان، با صفحه‌بندی کامل، دوباره استفاده می‌شود. اگر پرونده موجود نباشد، دکمه صریح ثبت فقط Customer از نوع organization با همان organizationId می‌سازد؛ MasterOrganization جدید ساخته نمی‌شود.
- پرونده غیرفعال یا بدون نقش مشتری دوباره ساخته نمی‌شود و برای اصلاح به مشتریان ارجاع داده می‌شود. Permission/Branch scope همان APIهای مالک است. مشتری حقوقی با customerId واقعی به Sales وصل می‌شود؛ مسافران مستقل‌اند و گزینه مشتری‌بودن مسافر اول در حالت حقوقی غیرفعال است. تغییر سازمان، انتخاب مشتری قبلی را پاک می‌کند تا تأیید دوباره انجام شود.
- این اتصال از مدل موجود استفاده می‌کند و به معنی تکمیل endpointهای Agency agreed-rates یا credit-summary نیست. بدون Schema/Migration/API مشترک یا تغییر ماژول‌های دیگر؛ ثبت واقعی سازمان/شخص در تست انجام نشده است.

## SALES-PASSENGER-ROWS-0905 — تعداد مسافران و مشتری همراه

- ۵۸ تست فروش، lint محدوده، typecheck و Production Build وب با ۳۵ مسیر موفق؛ نسخه جدید وب روی ۳۱۰۰ اجرا شد. PR #90 همچنان Draft است و قفل‌ها آزاد نشدند.

- در مرحله مشتری و مسافران، ردیف‌های مستقل به تعداد موردنیاز اضافه/حذف می‌شوند؛ شمارنده ثبت‌شده و در حال ورود و شماره هر مسافر نمایش داده می‌شود. ردیف‌های جدید به ترتیب از Public API مشتریان ثبت می‌شوند و ردیف ناقص اجازه ادامه قرارداد نمی‌دهد. حذف از قرارداد، پرونده مشتری را حذف نمی‌کند.
- کد ملی مسافر جدید الزامی و دقیقاً ۱۰رقمی است؛ ارقام فارسی/عربی به انگلیسی تبدیل و صفر ابتدایی حفظ می‌شود. رقم کنترل و یکتایی همچنان توسط ماژول Customers بررسی می‌شوند. کد خام فقط در حافظه فرم ورود است و وارد localStorage یا payload فروش نمی‌شود؛ اشخاص موجود از جست‌وجوی قبلی قابل انتخاب‌اند.
- گزینه «مسافر اول، مشتری قرارداد هم هست» به همان شخص اشاره می‌کند و با حذف نفر اول، نفر بعدی را انتخاب می‌کند؛ در نبود مسافر، مشتری خالی می‌شود. ایجاد مسافر اول با این گزینه هر دو نقش را در API مشتریان درخواست می‌کند. بدون تغییر API/Schema/Migration/Permission یا شاخه‌های دیگر.

## جداسازی تغییرات خارج از فروش — 2026-09-05

- با اجازه مالک، تمام ۲۷ فایل Customers/Documents/Passport/Button در شاخه محلی codex/pc-a-customer-passport-preservation-0905 با Commit 75afc50 و پشتیبان خام مستقل محفوظ شدند. تطبیق SHA256 هر فایل در مبدا، پشتیبان و Worktree بازیابی موفق بود؛ فروش به وضعیت تمیز برگشت.
- ۱۲ فایل با شاخه فعال مشتریان برابر است و ۱۵ فایل به تطبیق توسط مالک نیاز دارد؛ هیچ نسخه‌ای روی شاخه فعال مشتریان بازنویسی نشد. انتشار پشتیبان بررسی‌نشده توسط کنترل ایمنی متوقف شد؛ فقط محلی است. PR جدید، Merge، اجرای Migration یا آزادسازی قفل انجام نشد.
- مانع فایل محلی Prisma رفع شد؛ این کار به معنی تکمیل ویرایش رزرواسیون، قراردادهای Agency یا رفع Conflict کلی PR #90 نیست. بررسی این مرحله صحت بازیابی و جداسازی فایل‌هاست، نه تأیید عملکرد کد پشتیبان.

## SALES-CONTRACTS-001 — بلیت و هتل در یک بخش

- جزئیات بلیت و هتل در یک زیرمرحله، بلیت بالا و هتل پایین، نمایش داده می‌شوند. انتخاب هتل با جست‌وجوی یکپارچه نام/کد و فقط مراجع شهر مقصد از Public API اطلاعات پایه است.
- ورود پیشنهادی روز بعد از پرواز رفت و خروج روز قبل از پرواز برگشت، مطابق تاریخ نمایشی تهران، است. تاریخ دستی محفوظ می‌ماند؛ بازنشانی از بلیت ممکن است و بازه نامعتبر اجازه ادامه نمی‌دهد. تاریخ‌های نهایی از قرارداد عمومی فعلی به رزرواسیون ارسال می‌شوند.
- تغییر چیدمان اجرایی هتل اکنون در رزرواسیون با Revision نسخه‌دار انجام می‌شود؛ Snapshot فروش immutable می‌ماند و اصلاح مسافر/ظرفیت همچنان از Sales عبور می‌کند.
- ۵۰ تست فروش، lint محدوده فروش، typecheck وب و Production Build با ۳۵ مسیر موفق‌اند. بدون تغییر Schema/Migration/Dependency و بدون دست‌کاری تغییرات محلی کار دیگر؛ بررسی بصری احراز‌شده انجام نشده است.

## SALES-CONTRACTS-001 — دو ستون مسیر و میلادی انگلیسی

- کشور مبدأ بالای شهر مبدأ و کشور مقصد بالای شهر مقصد قرار گرفت؛ دو گروه در دسکتاپ کنار هم و در موبایل زیر هم‌اند.
- تمام DatePickerهای فروش (هتل، تولد، خدمات و پرداخت‌ها) از گزینه اختیاری انگلیسی میلادی استفاده می‌کنند؛ بازه پرواز نیز هماهنگ شد. نام ماه/روز، ارقام و متن‌های پنجره میلادی انگلیسی و چیدمان LTR است؛ شمسی و پیش‌فرض سایر بخش‌ها فارسی می‌ماند. مقدار ISO تغییر نکرده است.
- ۴۸ تست فروش/تقویم مشترک، lint/typecheck و Production Build وب موفق؛ تغییر مشترک افزایشی و opt-in است. بررسی بصری احراز‌شده ادعا نمی‌شود.

## SALES-CONTRACTS-001 — تقویم هماهنگ و کارت بلیت خواناتر

- فیلتر بازه با ظاهر تقویم مشترک، کلید شمسی/میلادی و شبکه انتخاب ماه و سال هماهنگ شد؛ همچنان یک تقویم اختیاری است. پنجره بر اساس فضای موجود بالا/پایین باز می‌شود و ارتفاع قابل اسکرول دارد. فایل تقویم مشترک تغییر نکرده است.
- کارت بلیت نام شرکت/شماره، شهرهای مسیر، ساعت و تاریخ جداگانه حرکت/رسیدن، مدت سفر، کلاس واقعی و ظرفیت کل را نشان می‌دهد. ساعت بدون ثانیه و با برچسب وقت تهران نمایش داده می‌شود؛ انتخاب آبی و دارای علامت است. قیمت یا ظرفیت باقی‌مانده ساختگی درج نشده است.
- ۳۹ تست فروش وب و lint/typecheck موفق‌اند. فیلتر اختیاری و جست‌وجوی برگشت بدون سقف بازه رفت حفظ شدند؛ Schema/API/مجوزها دست‌نخورده‌اند. بررسی بصری احراز‌شده ادعا نمی‌شود.

## SALES-CONTRACTS-001 — مشتری و مسافران در یک مرحله

- مراحل از شش به پنج رسید: جست‌وجو/انتخاب مشتری، افزودن مسافر و تاریخ تولد/رده سنی در یک مرحله مشترک هستند. تغییر مشتری مسافران قبلی را پاک نمی‌کند و انتخاب تکراری مسافر رکورد جدید نمی‌سازد.
- دکمه‌های مشتری جدید و مسافر جدید، فرم کوچک داخل همان صفحه باز می‌کنند؛ نام، نام خانوادگی، تاریخ تولد و کد ملی اختیاری از Customers API موجود ثبت می‌شوند. مشتری می‌تواند هم‌زمان نقش مسافر داشته باشد. فرد فقط پس از موفقیت API به قرارداد انتخاب می‌شود؛ ثبت شخص مستقل از ثبت نهایی قرارداد است.
- ۳۵ تست فروش وب، lint/typecheck و Production Build موفق؛ Schema، مجوزها و کد ماژول مشتریان تغییر نکرده‌اند. ایجاد فرد واقعی/آزمون احراز‌شده در مرورگر انجام نشده است.

## SALES-CONTRACTS-001 — فرم جمع‌وجور و رفع اتصال داشبورد

- فرم تمام‌صفحه با عرض محدود، عنوان/مراحل کوچک‌تر، چهار فیلد کشور/شهر در یک ردیف دسکتاپ، گزینه‌های خدمات کم‌ارتفاع و نوار دکمه‌های در دسترس بازطراحی شد. موبایل همچنان چیدمان واکنش‌گرا دارد.
- علت تأییدشده اتصال: bundle تولیدی قبلی بدون NEXT_PUBLIC_API_BASE_URL ساخته شده بود. مقدار عمومی localhost:4000/api/v1 در فایل محلی ignored تنظیم و بیلد مجدد شد؛ هیچ Secret یا تنظیم محیط محلی وارد Git نمی‌شود. Queryهای داشبورد و فهرست در scope بدون رکورد موفق‌اند و API، CORS پورت 3100 را مجاز می‌داند.
- آمار و فهرست مستقل بارگذاری می‌شوند؛ خطای یکی داده سالم دیگری را حذف نمی‌کند. خطاهای واقعی اتصال/نشست پنهان یا با داده جعلی جایگزین نمی‌شوند. ۲۷ تست فروش وب، lint، typecheck و Production Build موفق؛ بررسی بصری احراز‌شده به‌دلیل خطای ابزار ویندوز انجام نشده است.

## SALES-CONTRACTS-001 — خدمات ساده و فیلتر اختیاری بلیت

- انتخاب پرواز، قطار و اتوبوس را حذف/غیرفعال می‌کند؛ API نیز ترکیب نامعتبر را رد می‌کند. ترانسفر فقط علامت رفت/برگشت است، مرحله جزئیات ندارد و در پیش‌نمایش بلیت درج می‌شود.
- تاریخ از مرحله مسیر حذف شد؛ جست‌وجو به‌صورت پیش‌فرض بلیت‌های آینده با ترتیب نزدیک‌ترین تاریخ است. شروع/پایان بازه در یک تقویم شمسی/میلادی اختیاری انتخاب و فیلتر قابل پاک‌کردن است. سقف بازه رفت به برگشت اعمال نمی‌شود.
- تاریخ معتبر قرارداد از بلیت انتخاب‌شده یا ورود هتل گرفته می‌شود؛ برای خدمت بدون این تاریخ‌ها فقط در مرحله مسافر جهت محاسبه سن درخواست می‌شود. این تغییر جایگزین توضیحات قدیمی جزئیات ترانسفر در پایین سند است. Schema/Migration و ماژول‌های دیگر تغییر نکرده‌اند.

## SALES-CONTRACTS-001 — رفت/برگشت کنار هم و پیش‌نمایش بلیت

- انتخاب هر دو جهت در یک مرحله و دو ستون انجام می‌شود؛ تیک بیزینس فقط برچسب خروجی است و کلاس واقعی موجودی/بازاعتبارسنجی را عوض نمی‌کند.
- چهار پیشنهاد کاملاً آزمایشی تهران/آنتالیا روی شعبه HQ برای تست قرارداد منتشر و از جست‌وجوی عمومی تأیید شدند: دو رفت در 2026-09-10 و برگشت در 2026-09-17 و 2026-09-20. هر پیشنهاد ظرفیت ۲۰ دارد و انتشار دوباره تکراری نمی‌سازد.
- قالب پیش‌نمایش چاپی بر اساس تصویر کاربر، با رنگ سرمه‌ای/فیروزه‌ای، اطلاعات سفر و برچسب BUSINESS آماده شد. پیش‌نمایش عمداً فاقد اعتبار سفر است؛ شماره بلیت، PNR و اطلاعات صدور/پرداخت واقعی جعل نمی‌شوند. صدور و آزادسازی واقعی همچنان در مالکیت رزرواسیون/مالی/اسناد است.
- ۱۵ تست فروش وب موفق؛ جزئیات کیفیت و محدودیت بررسی بصری در سند Task ثبت است. Schema/Migration و کد ماژول‌های دیگر دست‌نخورده‌اند.

## SALES-CONTRACTS-001 — ثبت مرجع ترکیه/آنتالیا و حذف پنل بلیت زمان‌دار

- مانع ثبت مرجع رفع شد: ترکیه با کد TR، استان لازم آنتالیا و شهر آنتالیا در دیتابیس محلی از سرویس مالک اطلاعات پایه ثبت شدند؛ وضعیت فعال و ارتباط کشور/استان بررسی شد. اجرای دوباره هر سه رکورد را بازاستفاده کرد و داده تکراری نساخت. هیچ مجوز، نشست، کاربر یا شعبه IAM تغییر نکرد؛ Audit با انتساب شفاف نگهداری آفلاین ثبت شد.
- فقط نمایش پنل «ثبت بلیت زمان‌دار برای فروش» از مدیریت بلیت حذف شد؛ دکمه تکرار هفتگی/ماهانه، رکوردهای قبلی و API بلیت دست‌نخورده‌اند. این تغییر تکرار بلیت محلی را به انتشار پیشنهاد فروش متصل نمی‌کند.
- ۹۶ تست Ticket Catalog موفق؛ تغییرات هم‌زمان Customers/Documents و Prisma در کامیت این کار وارد نمی‌شوند.

## SALES-CONTRACTS-001 — انتخاب خدمت و بازگشت داشبورد

- انتخاب خودِ بلیت یا ترانسفر، هر دو جهت را فعال می‌کند؛ تیک‌های رفت/برگشت زیر همان خدمت باز می‌شوند و مستقل قابل تغییرند. فرم جدید لینک بازگشت به `/sales` دارد؛ ورودی فروش همان داشبورد قراردادهاست.
- ۱۲ تست فروش وب، lint فروش و typecheck وب موفق؛ Schema/Migration و Backend تغییر نکرده‌اند.
- ثبت کشور ترکیه و شهر آنتالیا هنوز انجام یا تأیید نشده: ابزار مرورگر خطای ACL ویندوز و ابزار کنترل کامپیوتر خطای Runtime داد؛ API عمومی بدون نشست ورود پاسخ 401 داد. ثبت از رابط عمومی احراز‌شده باقی مانده و هیچ جدول خصوصی مستقیم تغییر نکرده است.

## SALES-CONTRACTS-001 — جست‌وجوی مسیر و خدمات جهت‌دار — آماده بررسی

- انتخاب کشور و شهر مبدأ/مقصد جست‌وجوپذیر، RTL، گرد و هم‌تم شد؛ شهرها به کشور انتخابی محدودند. پیش‌فرض فرم جدید از رکورد واقعی ایران/تهران و ترکیه/آنتالیا پیدا می‌شود؛ Draft موجود بازنویسی و داده مرجع ساختگی ایجاد نمی‌شود.
- بلیت و ترانسفر رفت و برگشت چهار تیک مستقل‌اند. جزئیات فقط برای خدمات انتخاب‌شده و به‌ترتیب نمایش داده می‌شود؛ ترانسفر تاریخ، محل سوارشدن و پیاده‌شدن دارد. بلیت برگشت مسیر معکوس را از تاریخ بلیت رفت به بعد و بدون سقف تاریخ جست‌وجو می‌کند؛ برگشت قبل از رسیدن رفت قابل تأیید نیست.
- جهت خدمت در metadata موجود Sales v1 ذخیره و به Snapshot رزرواسیون منتقل می‌شود؛ اعتبارسنجی قدیمی بدون direction سازگار باقی ماند. Schema/Migration، Dependency، مجوزها و ماژول‌های دیگر در این Follow-up تغییر نکردند.
- ۹ تست Web Sales و ۲۶ تست API Sales، شامل هر ۱۵ ترکیب غیرخالی چهار تیک، موفق؛ typecheck وب/API، lint فروش و Production Build وب/API موفق (۳۵ Route). سرور نسخه جدید روی پورت 3100 اجرا شد. بررسی بصری/ورود احراز‌شده ادعا نمی‌شود.
- مانع مجوزِ گزارش قبلی با تأیید صریح کاربر رفع شد: چهار ارتباط نقش‌ـ‌مجوز در دیتابیس محلی ثبت و Audit شدند؛ عضویت شعبه‌ها ثابت ماند. همان Branch و Draft PR #90 ادامه دارد؛ تغییرات هم‌زمان Customers/Documents در کامیت فروش قرار نمی‌گیرند.

## SALES-CONTRACTS-001 — ادامه اجرایی 2026-09-05 — IN_PROGRESS

- با اجازه صریح کاربر، Public API واقعی انتشار/جست‌وجو/بازاعتبارسنجی پیشنهاد بلیت و صندوق دریافت نسخه‌دار Reservations اضافه شد؛ ارتباط Sales فقط از سرویس عمومی ماژول‌هاست.
- فرم تمام‌صفحه شش‌مرحله‌ای با مسیر/خدمات در ابتدا، انتخاب آبی بلیت، برگشت مستقل بدون سقف تاریخ، جست‌وجوی هتل مقصد، ویزای مقصد، کلاس پرواز و رده سنی مسافر پیاده شد. قیمت توافقی ریالی/ارزی و اقساط/چک به API متصل‌اند؛ مانده فقط با تأیید Finance کاهش می‌یابد و اضافه‌پرداخت یک ارز، بدهی ارز دیگر را تسویه نمی‌کند.
- Migration افزایشی `20260905070000_travel_runtime_intake`؛ هر ۳۲ Migration روی PostgreSQL 18 خالی و Seed دو بار موفق. پنج تست اختصاصی شامل چهار تست واقعی PostgreSQL موفق؛ Full test/typecheck/lint و Production Build موفق‌اند. بررسی کامل محلی شامل تغییرات هم‌زمان و کامیت‌نشده Customers/Documents نیز بوده؛ آن فایل‌ها در کامیت‌های فروش قرار نگرفته‌اند.
- پیشنهادهای منتشرشده پایدار از تعریف‌های قدیمی محلی Ticket Catalog جدا هستند؛ مهاجرت خودکار داده قدیمی یا داده عملیاتی ساختگی نداریم. Reservations فعلاً دریافت پایدار/تکرارناپذیر و صف بررسی است، نه Hold ظرفیت یا صدور بلیت.
- وب پورت 3100 و Health API پورت 4000 پاسخ 200 دادند؛ بررسی تعاملی مرورگر به‌علت خطای ACL ابزار ممکن نشد. اعطای مجوزهای جدید روی دیتابیس عملیاتی اجرا نشده: بررسی خودکار مجوز، تأیید صریح نقش/دسترسی/محدوده را لازم دانست. فعال‌سازی تا این تأیید باز می‌ماند.
- همان Branch و Draft PR #90 ادامه دارد؛ Rebase، Force Push، Merge و تغییر main/develop انجام نشده است. گزارش قبلی زیر، سابقه Slice پیش از این ادامه است.

## CUSTOMER-CONNECTIONS-0905 — local integration ready for review

- Customer Documents and master-data reference refresh are integrated and validated (163 tests; lint/typecheck/build successful). Independent local runtime: Web 3101 / API 4101. Existing 3 pending additive migrations were applied to localhost:5432; no reset, new migration or seed. Persistent protected local Documents key is configured. Authenticated user upload/download has not been manually exercised in this session.

- Customer Documents and master-data session retry are integrated in an isolated checkout based on committed Sales. The following historical entries retain their original scope; this task does not change Ticket Catalog.

## CUSTOMER-MASTERDATA-RETRY — بازیابی اطلاعات پایه پس از تمدید نشست

- `PC-A` روی Branch مستقل `codex/pc-a-customer-masterdata-retry` خطای هم‌زمانی
  بارگذاری Public Master Data در فرم Customers را اصلاح کرد. پاسخ 401 اکنون از همان
  Refresh مشترک نشست استفاده می‌کند و درخواست Organization، نحوه آشنایی، کشور یا شهر
  فقط یک بار تکرار می‌شود؛ سایر خطاها رفتار صریح قبلی را حفظ می‌کنند.
- همه قابلیت‌های ادغام‌شده CUSTOMER-002B، نمایش/خروجی تماس و اتصال امن Documents در
  همین مبنا موجودند. Passport/Visa ساختاری به‌دلیل بازبودن `DEC-OPEN-006` فعال نشده و
  هیچ داده ساختگی جایگزین نشده است. ۵۶۵ تست Web، lint، typecheck و Production Build
  موفق‌اند. جزئیات در `docs/tasks/CUSTOMER-MASTERDATA-RETRY.md`.

## TICKET-CATALOG-EDIT-COMPLETENESS — نمایش کامل اطلاعات هنگام ویرایش

- PC-A is validating PR #85 Customer Documents against committed Sales plus the existing master-data session-refresh retry. Separate worktree preserves active Sales changes; prior test results below do not establish validation of this integration.

## SALES-CONTRACTS-001 — Vertical Slice فروش — آماده بررسی

- PR #91 با Merge Commit `b69b7fa` قفل‌های Migration، Central Docs و Sales shared-contract/root export را به `PC-A/SALES-CONTRACTS-001` منتقل کرد؛ Merge معمولی `8d3b89d` این Handoff را وارد Branch فروش کرد. آخرین `origin/develop@85204a4` نیز با Merge معمولی `dbaf450` وارد و تعارض اسناد با حفظ هر دو Handoff حل شد.
- Branch `codex/pc-a-sales-contracts` و Draft PR #90 مالک Prisma/Migration افزایشی Sales، Permission Seed، قرارداد عمومی، Backend، UI و تست‌های این Slice هستند؛ Dependency/Lockfile تغییر نمی‌کند.
- تمام ارتباط‌های Customers، Ticket Catalog، Master Data، Finance، Reservations، Documents و Legal Entity فقط از Public Contract/Port انجام می‌شود و هیچ Query مستقیم جدول خصوصی مجاز نیست.
- PR #85 و خروجی PC-B دست‌نخورده‌اند؛ `main`/`develop` مستقیم تغییر نمی‌کنند و Merge/Rebase/Force Push انجام نمی‌شود.
- Slice واقعی تکمیل است: قرارداد عمومی Sales v1، ۱۱ جدول مالک Sales با Migration افزایشی، Permission Seed، Repository/API، Scope مالک/شعبه، Audit، Optimistic Lock، Idempotency، صف نسخه‌دار ReservationRequest و داشبورد/فرم تمام‌صفحه قرارداد تحویل شد.
- مانده فقط از پرداخت `FINANCE_CONFIRMED` کم می‌شود؛ پرداخت pending/scheduled اثر ندارد. تأیید Offer بلیت تا انتشار Public API اجرایی Ticket Management fail-closed است و پاسخ ساختگی ساخته نمی‌شود.
- Gate نهایی پس از آخرین Merge: Prisma معتبر، ۳۱ Migration روی PostgreSQL 18 خالی، Seed دوباره‌پذیر، Full lint/typecheck، ۱٬۴۸۵ تست و Full Production Build با ۳۵ صفحه موفق است. Draft PR #90 همان PR جاری باقی می‌ماند.

## AGENCY-B2B-INTEGRATIONS-001 — اتصال عملیاتی و تجاری آژانس — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-agency-b2b-integrations` و PR [#98](https://github.com/nirvanamahlou/Rubi/pull/98) مانع ثبت‌شده در PR #90 را پس از اعلام رفع قفل از سوی مالک محصول تکمیل کرد. هویت آژانس همان `MasterOrganization` دارای نقش `AGENCY` باقی می‌ماند و هیچ موجودیت موازی یا Query مستقیم Sales/Finance ساخته نشده است.
- آدرس پایه سازمان با FK واقعی کشور/شهر، پروفایل عملیاتی شعبه‌ای، قرارداد B2B، سیاست اعتبار، نرخ توافقی و Audit افزایشی پیاده‌سازی شدند. قراردادهای عمومی نسخه‌دار، Permissionهای deny-by-default، Branch scope و Optimistic Version در API اعمال می‌شوند.
- Popup موجود آژانس اطلاعات واقعی آدرس، تماس ماسک‌شده، پروفایل، قرارداد، اعتبار و نرخ را از APIهای عمومی می‌گیرد. تاریخ‌ها از تقویم مشترک شمسی/میلادی استفاده می‌کنند و Finance exposure تا انتشار Adapter مالک Finance صریحاً ناموجود است؛ مقدار صفر ساختگی تولید نمی‌شود.
- Migrationها روی PostgreSQL موقت خالی از ابتدا تا انتها اجرا و ۶ جدول و ۲۲ Index جدید بررسی شدند. Prisma، lint، typecheck، ۲۱ تست هدفمند و Production Build وب با ۳۴ Route موفق‌اند. Full Test فقط روی assertion قدیمی و تغییرنیافته Customer که در Checkout ویندوز LF را با CRLF مقایسه می‌کند قرمز است.
- قفل‌های محدود Migration، قرارداد عمومی B2B و Central Docs تا پایان Review نزد همین Task می‌مانند؛ Branchهای PC-A و PR #90 دست‌نخورده‌اند و Merge خودکار انجام نمی‌شود.

## MARKETING-001E — بازگردانی ارتباطات مارکتینگ — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-marketing-communications-restore` بخش «ارتباطات» را به Hub، Route مستقیم و Breadcrumb پویا برگرداند. چهار تب «ارسال پیام»، «ارسال‌های زمان‌بندی‌شده»، «تاریخچه ارسال‌ها» و «قالب‌های پیام» فعال‌اند و «عملکرد کانال‌ها» مطابق درخواست قبلی حذف باقی مانده است.
- فرم ارسال با انتخاب کمپین، مخاطب، قالب، کانال، روش و تاریخ ارسال کار می‌کند و ورودی‌های لازم را اعتبارسنجی می‌کند. Action «ارسال پیام» فقط در تب ارسال و Action «قالب جدید» فقط در تب قالب‌ها دیده می‌شود. جدول‌ها داده آزمایشی مستقل، فیلتر تاریخ Nora، خروجی Excel و عملیات رکورد دارند؛ هیچ ارسال واقعی یا نگهداری PII انجام نمی‌شود.
- Follow-up مالک تکمیل شد: «سناریو جدید» با فیلدهای واقعی و ثبت فوری، ویرایش مشخصات اتوماسیون و افزودن مرحله در سازنده فعال‌اند. دکمه‌های افزودن مخاطب کمپین، منبع ورود، کد تخفیف و پیشنهاد ویژه کنار خروجی Excel هم‌راستا شده‌اند.
- فرم محتوای جدید و Upload متصل به Documents اکنون ده نوع محتوای مارکتینگ و دو انتخاب «نیایش سیر سحر» و «جهان باستان» دارد؛ شناسه‌های مجاز نوع سند/دسته/مالک/شعبه همچنان از Options احراز‌شده Documents گرفته می‌شوند و هیچ قرارداد یا Schema تغییر نکرده است.
- ۱۸/۱۸ تست هدفمند مارکتینگ، lint کامل Web، typecheck کامل Web و Production Build با ۳۴ Route پاس شدند. Smoke لوکال Hub و مسیر ارتباطات پاسخ ۲۰۰ و محتوای مورد انتظار را تأیید کرد. یک تست قدیمی Customer به‌علت تطبیق متن LF روی Checkout ویندوز در اجرای کامل محلی شکست دارد و خارج از محدوده این Task دست‌نخورده مانده است.

## MARKETING-001D — پالایش ناوبری و فرم مارکتینگ — آماده بررسی

- Follow-up 2026-09-05: کلیک Breadcrumb والد اکنون با کلید Route، Workspace را از آدرس تازه بازسازی می‌کند؛ «ارتباطات»، دکمه بازگشت داخلی، منوی سه‌نقطه عملیات و تب مستقل «قوانین استفاده» حذف شدند. فرم‌های عملیاتی «مخاطبان کمپین» و «منابع ورود» با اعتبارسنجی و افزودن فوری رکورد ساخته شدند و قواعد استفاده به فیلدهای کد تخفیف/پیشنهاد ویژه منتقل شد.
- بارگذاری کتابخانه محتوا به Client عمومی موجود Documents متصل است: نوع `BRAND_ASSET_TEMPLATE`، دسته `BRAND_ASSETS`، شعبه و مالک از گزینه‌های احراز‌شده دریافت می‌شوند و Relation امن `marketing/content-asset` همراه فایل ثبت می‌شود. فایل ثبت‌شده در کارت محتوا ظاهر می‌شود و با همان شناسه در `/documents?document=...` باز می‌شود؛ هیچ API، Repository، Shared Contract، Schema/Migration/Seed یا Dependency تغییر نکرد.
- اعتبارسنجی نهایی این Follow-up: `603/603` تست Web، lint بدون هشدار، typecheck و Production Build با ۳۴ Route موفق‌اند. Smoke مستقیم همه مسیرهای audiences/content/offers و مسیر حذف‌شده communications پاسخ `200` و متن/نبود متن مورد انتظار را تأیید کرد؛ Web/API همین Worktree روی پورت‌های ۳۱۰۰/۴۰۰۰ فعال‌اند.
- Follow-up مالک روی Branch `codex/pc-b-marketing-workspace-completion`: گزارش‌ها، عضویت‌های تبلیغاتی، عملکرد کانال‌ها و خروجی داشبورد کامل حذف شدند؛ کمپین‌ها RTL و Breadcrumb مارکتینگ با نام سکشن انتخاب‌شده پویا است.
- سگمنت‌ساز اکنون سه Dropdown کامل، افزودن/حذف قانون و فرم سگمنت جدیدِ محدود به همان تب دارد. قانون‌های امتیازدهی سرنخ، قالب جدید، محتوای جدید، فرم‌های لازم و سناریوهای آماده نیز باز و ذخیره محلی می‌شوند و Actionهای نابجا فقط در تب مرتبط نمایش داده می‌شوند.
- همه فهرست‌های مارکتینگ فیلتر بازه تاریخ با DatePicker مشترک Grid ماه/سال، داده‌های آزمایشی متناسب با نوع تب، دکمه پاور قرمز و در محل لازم خروجی واقعی Excel امن دارند. پیاده‌سازی API/Persistence مارکتینگ، Schema/Migration/Seed، Dependency/Lockfile و Shared Contract تغییر نکرده است؛ فقط Client موجود Documents برای بارگذاری فایل مصرف می‌شود.
- Web typecheck، lint، همه `603/603` تست Web و Production Build با ۳۴ Route موفق‌اند. نسخه Branch روی پورت `3100` فعال است؛ بررسی مرورگر آزمایشی به‌دلیل جدا بودن نشست Login از Chrome بدون دست‌کاری حساب متوقف شد.
- Follow-up تصویر 486: Breadcrumb مسیر مستقیم کمپین با Router رسمی Next کامل شد و Server Page پارامتر `section` را پیش از رندر به Workspace می‌دهد؛ بنابراین عنوان مسیر و محتوای کمپین از همان پاسخ اولیه هماهنگ‌اند. نسخه مورد انتظار فرم، عبارت انگلیسی ویرایش، تب A/B و دکمه تکراری ایجاد کمپین حذف و فقط «افزودن کمپین جدید» فعال باقی ماند. کش اجرای قدیمی ایزوله شد؛ `603/603` تست، lint، typecheck و Build موفق‌اند و Web/API همین Worktree روی ۳۱۰۰/۴۰۰۰ پاسخ `200` می‌دهند.
- `PC-B` روی Branch مستقل `codex/pc-b-marketing-navigation-polish` اعلان‌ها و شناسه‌های فنی Preview، Eyebrow آبی `CRM / Marketing` و توضیحات نمایشی داشبورد را حذف کرد. صفحه اصلی مارکتینگ اکنون همان رنگ، Glow و حرکت کارت‌های Hub اطلاعات پایه را دارد.
- انتخاب هر سکشن در History مرورگر ثبت می‌شود؛ Back مرورگر واقعاً به نمای قبلی برمی‌گردد. تمام Workspace، جدول‌ها، تب‌ها و Dialog کمپین RTL و راست‌چین‌اند و بازخورد دکمه‌ها بدون نوار اولیه مزاحم، بعد از عمل نمایش داده می‌شود.
- داشبورد دیگر دکمه «ایجاد کمپین» ندارد و نمودار ۳۰روزه دو سری مستقل و قابل‌تشخیص «سرنخ جدید» و «فروش منتسب» با خط، نقطه و راهنما نمایش می‌دهد.
- فرم کمپین هشت‌مرحله‌ای است: مرحله پیشنهاد حذف شد؛ عبارت UTC، اعلان حریم خصوصی، Badge امن Preview و توضیحات زیر فیلدها/سکشن‌ها حذف شدند. DatePicker، اعتبارسنجی و مسیرهای Create/Edit/View فعال باقی مانده‌اند.
- Web lint، typecheck، Production Build با ۳۴ Route و همه `602/602` تست Web موفق‌اند. Browser QA دسکتاپ و موبایل `390×844`، Back واقعی، RTL، دو سری نمودار و نبود متن‌های حذف‌شده را تأیید کرد. هیچ API، Persistence، Schema/Migration/Seed، Dependency/Lockfile، Shared Contract، UI مرکزی یا داده واقعی تغییر نکرد.

## DOCUMENTS-004-HANDOFF — انتقال اتمیک قفل‌ها به Sales — آماده بررسی

- PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شده است؛ `DOCUMENTS-004-OPERATIONS` اکنون `DONE/MERGED` است.
- قفل‌های Documents با این وضعیت پایان می‌یابند: Documents shared-contract و Shared Calendar برابر `RELEASED / STABLE` و Dependency/Lockfile برابر `RELEASED`.
- انتقال اتمیک برای ادامه کار: Migration، Central Docs و Sales shared-contract/root export به `PC-A/SALES-CONTRACTS-001` رزرو می‌شوند. Dependency/Lockfile برای Sales آزاد می‌ماند و فقط پس از اثبات نیاز واقعی و رزرو جداگانه قابل تغییر است.
- Documents فقط مالک نگهداری، نسخه‌بندی و دسترسی فایل است. Sales فقط قرارداد عمومی Documents را مصرف می‌کند و حق Query مستقیم جدول‌ها یا استفاده از Repository/زیرساخت داخلی Documents را ندارد.
- این Handoff فقط چهار فایل مستنداتی را تغییر می‌دهد؛ PR #90، Branch فروش، `main`، کد، Schema، Migration، Seed، Dependency، Lockfile و فایل‌های ماژولی دست‌نخورده می‌مانند. جزئیات: `docs/tasks/DOCUMENTS-004-HANDOFF.md`.

## DOCUMENTS-004 — عملیات واقعی اسناد و آرشیو — ادغام‌شده

- `PC-B` روی Branch مستقل `codex/pc-b-documents-workflows` جزئیات سند را ساده و فارسی کرد؛ مسیر پیشنهادی، SHA/MIME و توضیح فنی منبع از UI حذف و نوع فایل به شکل پسوندی مانند `.PNG` نمایش داده می‌شود.
- فهرست‌های عملیاتی و اشتراک‌گذاری تا انتخاب فیلتر خالی می‌مانند. اشتراک‌گذاری جست‌وجو و فیلتر فشرده دارد؛ پاک‌سازی با آیکون سطل قرمز انجام می‌شود و Export رابط حذف شده است.
- ویرایش، حذف دائمی، ناقص/کامل، آرشیو/بازیابی و عملیات گروهی به API و Persistence واقعی متصل‌اند. حذف دائمی با مجوز، دلیل، تأیید کد، کنترل نسخه و رد Legal Hold انجام می‌شود و تمام رکوردهای وابسته و فایل ذخیره‌شده را پاک می‌کند.
- مدیریت آرشیو به چهار مسیر واقعی مدارک ناقص، اسناد تحت مسئولیت کاربر، نگهداری/انقضا و بازیابی اسناد آرشیوشده محدود شد. «پیگیری» نمای کلی و همه نماهای شخصی نیز به Queryهای واقعی وصل‌اند.
- تقویم فرم‌های اسناد دیگر Dropdown ماه/سال ندارد: ماه‌ها و سال‌ها در شبکه‌های ۱۲تایی هم‌تم Nora انتخاب می‌شوند و پیمایش بازه سال، شمسی/میلادی و ذخیره Gregorian ISO حفظ شده است. ۵۹۸ تست Web، lint، typecheck و Production Build موفق و انتخاب واقعی `۱۴۰۶ / مهر / ۱` در مرورگر تأیید شد.
- Migration افزایشی `20260903110000_documents_incomplete_status` روی PostgreSQL خالی و دیتابیس محلی اعمال شد. ۷ Fixture تصویری آماده مشاهده‌اند؛ Full lint/typecheck/build و ۱٬۴۷۰ تست موفق است و ۷۰ تست PostgreSQL اختیاری skip شدند. Smoke مرورگر بدون تغییر داده تمام رفتارهای اصلی را تأیید کرد.
- PR [#89](https://github.com/nirvanamahlou/Rubi/pull/89) با Merge Commit `1e5c55e3b2d9dcc58c407d0ca205abed86b4c605` وارد `develop` شد؛ `main` دست‌نخورده ماند و Task برابر `DONE/MERGED` است. جزئیات: `docs/tasks/DOCUMENTS-004-OPERATIONS.md`.

## TICKET-CATALOG-003 — نمایش ظرفیت باقی‌مانده روی کارت بلیت — آماده بررسی

- `PC-A` روی Branch مستقل `codex/pc-a-ticket-card-remaining-capacity` کارت بلیت را به مدل موجودی Ticket Catalog متصل کرد؛ کارت اکنون ظرفیت کل و مانده را کنار هم و با تفکیک دیداری روشن نمایش می‌دهد.
- مانده با تابع دامنه `inventoryTotals` محاسبه می‌شود و تخصیص‌های `held` و `confirmed` را کسر می‌کند. Workspace مرورگر فعلی تا اتصال قرارداد عمومی Reservations تخصیص ساختگی ایجاد نمی‌کند، بنابراین در داده‌های فعلی مانده با کل برابر است.
- هر ۹۵ تست Ticket Catalog Web، Web lint، Web typecheck و Production Build با ۳۴ Route موفق‌اند. هیچ Schema/Migration/Seed، Dependency/Lockfile، قرارداد عمومی، IAM یا فایل ماژول Reservations تغییر نکرد.

## MARKETING-001C — تکمیل صفحات داخلی مارکتینگ — ادغام‌شده

- `PC-B` روی `codex/pc-b-marketing-inner-pages-parity` صفحات عمومی داخل سکشن‌ها را با
  ۴۵ زیرصفحه تخصصی همان مرجع جایگزین کرد؛ داشبورد کامل، ۹ تب جزئیات کمپین و همه داده‌های
  آزمایشی مرجع نیز وارد Workspace واقعی Nora شدند.
- جست‌وجو، فیلتر، صفحه‌بندی، سگمنت‌ساز، پیش‌نمایش زنده پیام، کتابخانه محتوا، پیشنهادها،
  سفر مشتری، گزارش‌های ده‌گانه و تنظیمات تعاملی‌اند. تقویم و فیلترها فقط از کامپوننت‌های
  مشترک Nora استفاده می‌کنند و هیچ Persistence، API، ارسال واقعی یا اثر مالی ندارند.
- Web lint و `599/599` تست، Full lint با ۶ Task و Full test با `1,464` تست موفق و ۷۰
  تست PostgreSQL اختیاری skip شدند. Browser QA همه تب‌ها، فرم ۹مرحله‌ای و Mobile
  `390×844` را بدون Overflow یا Console warning/error تأیید کرد.
- Typecheck محلی بدون کش و هر چهار Job تمیز CI شامل Full Typecheck، Full Production
  Build، Full Test و PostgreSQL 18/Migration/Seed موفق‌اند. خطای موقت `observedAt` فقط
  از کش افزایشی قدیمی محلی بود و فایل Master Data در این Task تغییر نکرد.
- PR [#86](https://github.com/nirvanamahlou/Rubi/pull/86) با Merge Commit `4ea7b27`
  وارد `develop` شد؛ اجرای کامل CI پس از ادغام روی خود `develop` نیز سبز است.

## CUSTOMER-DOCUMENTS-001 — مدارک واقعی در Customer 360 — آماده بررسی

- `PC-A` وضعیت «در انتظار زیرساخت مدارک» را با پنل واقعی فهرست و بارگذاری فایل جایگزین کرد. هر مشتری اکنون تعداد، کد آرشیو، نوع، نسخه، تاریخ اعتبار و وضعیت اسکن مدارک خودش را می‌بیند و می‌تواند از همان پرونده فایل جدید اضافه کند.
- قرارداد عمومی Documents به‌صورت backward-compatible فیلتر exact source گرفت. Backend مرجع سه‌بخشی را کامل اعتبارسنجی و همراه Branch/Domain/Permission scope روی Relation اصلی اعمال می‌کند؛ پاسخ هیچ source id خامی افشا نمی‌کند.
- Customers فقط مصرف‌کننده Public Contract/API است و هیچ دسترسی مستقیم به Repository یا جدول Documents ندارد. UI باز PR #80 و فایل‌های تقویم/اسناد PC-B نیز تغییر نکرده‌اند.
- ذخیره ساخت‌یافته شماره پاسپورت، کشور صادرکننده و شماره ویزا همچنان تا تصمیم `DEC-OPEN-006` مسدود است؛ ولی خود فایل‌ها اکنون با قرنطینه، نسخه و کنترل دسترسی فعلی Documents عملیاتی‌اند.
- Full lint/typecheck/build پاس و `1470` تست Monorepo موفق است؛ `70` تست PostgreSQL اختیاری skip شدند. Migration، Schema، Seed، Dependency و Lockfile تغییر نکرده‌اند. جزئیات: `docs/tasks/CUSTOMER-DOCUMENTS-001.md`.

## MASTER-004-FORM-ALIGNMENT — هم‌ترازی فرم‌های اطلاعات پایه — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-master-data-form-alignment` تجربه جغرافیا را در یک نمای شهر/استان یکپارچه و فرم شهر را به انتخاب اجباری کشور و سپس استان وابسته کرد؛ Schema مستقل Region/City و FK واقعی آن‌ها حفظ شده است.
- ترتیب نمایش به همه فرم‌های اطلاعات پایه افزوده شد؛ وضعیت پیش‌فرض فعال است، اعداد طولانی در ورودی سه‌رقمی گروه‌بندی می‌شوند و DatePicker مشترک انتخاب مستقیم ماه/سال و رقم انگلیسی در تقویم میلادی دارد.
- فرم‌های ارز، گردش نرخ، سازمان/تأمین‌کننده/کارگزار، هتل، حمل‌ونقل، ویزا و مراجع فروش مطابق درخواست مالک ساده شدند. Exportهای Excel ارز، روش پرداخت و جغرافیا حذف و لوگوی شرکت‌ها/سازمان‌ها از مسیر عمومی Documents در همان فرم قابل بارگذاری است.
- Migration افزایشی `20260902173500_master_data_form_alignment` فقط ستون یا default سازگار اضافه و چند FK/فیلد را اختیاری می‌کند؛ هیچ ستون قدیمی حذف نشده است. Migration روی PostgreSQL محلی اعمال و Prisma validate موفق شد.
- Web با `586/586` تست و API با `776/776` تست موفق است؛ lint، typecheck، قرارداد مشترک، API build و Web production build پاس شدند. هشدارهای CSS قدیمی build مانع تولید خروجی نشدند.
- قفل‌های Migration، Master Data Contract، Shared Calendar و Central Docs تا پایان Review نزد `PC-B/MASTER-004-FORM-ALIGNMENT` می‌مانند. Merge خودکار به `develop` انجام نمی‌شود و PC-A باید پس از Review، Branch/PR تحویلی و Migration جدید را مصرف کند.

## TICKET-CATALOG-002 — حذف الزام زمان از تعریف بلیت — آماده بررسی

- `PC-A` روی Branch مستقل `codex/pc-a-ticket-catalog-optional-schedule` تاریخ حرکت/رسیدن و شروع/پایان اعتبار نرخ را از فرم تعریف بلیت حذف کرد. ثبت بلیت جدید دیگر مقدار زمانی ساختگی تولید نمی‌کند و مقادیر زمان‌بندی‌شده قبلی هنگام ویرایش دست‌نخورده باقی می‌مانند.
- اعتبارسنجی Web و API جفت‌های زمانی کاملاً خالی را می‌پذیرد و فقط ورود ناقص یا ناسازگار را رد می‌کند. فهرست و جزئیات برای بلیت بدون تاریخ عبارت «بدون زمان‌بندی» نشان می‌دهند و فیلتر تاریخ رکورد بدون زمان‌بندی را به‌اشتباه برنمی‌گرداند.
- Follow-up مدیریت فروش بلیت نیز آماده است: توقف فروش با دکمه واضح، فیلتر مبدأ/مقصد، شمارش موجودی تعریف‌شده هر مسیر و تب فقط‌خواندنی «بلیت‌های صادرشده مسافران» با فیلتر قرارداد، مسافر، شماره بلیت/PNR، مسیر، ایرلاین، وضعیت و بازه صدور.
- همه کارت‌ها کنترل آیکونی پاور دارند: قرمز برای توقف فروش، سبز برای فعال‌سازی و خاکستری غیرفعال برای بلیت لغوشده؛ متن دیداری حذف شده و عنوان راهنما و aria-label باقی مانده‌اند. ویرایش در پیش‌نویس، فعال، متوقف و لغوشده قابل انجام است؛ وضعیت خود بلیت هنگام ویرایش حفظ می‌شود و بلیت لغوشده همچنان مستقیماً قابل فعال‌سازی نیست.
- فعال‌سازی مجدد دیگر به بازه اعتبار نرخ خرید وابسته نیست؛ این بازه قدیمی یا منقضی مانع فروش نمی‌شود، چون قیمت فروش در Sales تعیین می‌شود. ظرفیت مثبت و اعتبار اطلاعات اصلی بلیت حفظ شده‌اند.
- تعریف بلیت ترکیبی نیز اضافه شد: یک بلیت می‌تواند ۲ تا ۸ قطعه متصل هم‌نوع داشته باشد؛ فرم قطعه‌ها را اضافه/حذف/ویرایش می‌کند، اتصال شهر/فرودگاه و ترتیب زمانی در Web و API اعتبارسنجی می‌شود و فهرست، جزئیات، جست‌وجو، فیلتر و تکرار از اولین مبدأ تا آخرین مقصد کار می‌کنند. نمونه مشهد–تهران–شیراز برای بازبینی رابط آماده است.
- صدور/استرداد و رکورد مسافر همچنان متعلق به Reservations است؛ تب جدید تا انتشار قرارداد عمومی آن ماژول هیچ داده ساختگی یا Persistence ایجاد نمی‌کند. ۹۵ تست Ticket Web و ۴۷ تست Ticket API، lint و typecheck کامل، ۱٬۴۵۹ تست Monorepo و Production Build کامل با ۳۴ Route موفق است. هیچ Prisma، Migration، Seed، Dependency، Lockfile یا قرارداد عمومی تغییر نکرد.

## DOCUMENTS-003F — انتخاب پرونده جست‌وجویی در بارگذاری سند — ادغام‌شده

- PR #81 با Merge Commit `ad6ff5d` پس از موفقیت کامل CI وارد `develop` شد. `PC-B` چهار ورودی فنی ارتباط سند را با یک Dropdown جست‌وجویی «پرونده مربوطه» جایگزین کرد؛ کاربر اکنون نام پرونده را می‌بیند و دیگر ماژول، نوع رکورد یا شناسه مبدأ را دستی وارد نمی‌کند.
- Endpoint افزایشی `case-options` فقط Relationهای موجود Documents را در شعبه انتخاب‌شده، Domain مجاز و سطح محرمانگی قابل مشاهده جست‌وجو می‌کند. پاسخ فقط شناسه داخلی انتخاب و عنوان نمایشی دارد و شناسه واقعی رکورد مبدأ را افشا نمی‌کند.
- Upload، Relation انتخاب‌شده را دوباره سمت سرور و با همان Scope کنترل می‌کند و مقادیر canonical را استفاده می‌کند؛ بنابراین تغییر دستی درخواست نمی‌تواند سند را به پرونده حذف‌شده، محرمانه غیرمجاز یا شعبه دیگر متصل کند. فیلدهای قدیمی API فقط برای سازگاری مصرف‌کننده‌های قبلی باقی مانده‌اند.
- هیچ Schema/Migration/Seed، Permission، Dependency/Lockfile یا Query مستقیم جدول ماژول دیگر اضافه نشد. اتصال پرونده کاملاً داخل مرز Documents باقی می‌ماند.
- Full lint/typecheck/build موفق و ۱٬۳۹۵ تست موفق‌اند؛ ۷۰ تست PostgreSQL اختیاری طبق Suite معمول skip شدند. Smoke واقعی روی دیتابیس محلی، نمایش ۱۴ گزینه، جست‌وجوی دو نتیجه‌ای «قرارداد» و انتخاب موفق را بدون ثبت داده تأیید کرد. جزئیات: `docs/tasks/DOCUMENTS-003F-RELATED-CASE-PICKER.md`.

## LEGAL-ENTITY-BRAND-LOGO-001 — لوگوی پویا برای شرکت فعال — آماده بررسی

- `PC-B` روی Branch مستقل `codex/pc-b-jahan-bastan-logo`، نمایش برند App Shell را به شرکت فعال متصل می‌کند تا با انتخاب «جهان باستان»، لوگوی افقی ارسالی جای برند نیایش سیر نمایش داده شود.
- این Slice فقط Web UI، Asset و تست هدفمند را دربر می‌گیرد و هیچ تغییر Database، Migration، Seed، Backend، Contract، Dependency/Lockfile، Permission یا داده کاربر ندارد.
- پیاده‌سازی تکمیل شد: Brand داخل Provider، تغییر Context را بلافاصله دریافت می‌کند؛ لوگو، نام و متن جایگزین برای جهان باستان پویا هستند و نیایش سیر بدون تغییر باقی می‌ماند. فایل خروجی با تصویر ورودی SHA-256 یکسان دارد.
- پیش از Integration هر ۵۵۲ تست Web و Smoke لوکال API/Web/Asset موفق بود. پس از ادغام بدون Conflict تغییرات PC-A از `origin/develop@f78e70e`، Full lint/typecheck/build و ۱٬۳۸۳ تست Workspace موفق شدند؛ Web هر ۵۶۵ تست را گذراند و ۷۰ تست PostgreSQL اختیاری طبق Suite معمول skip ماندند. قفل‌های این کار آزاد شدند.

## DOCUMENTS-003D — تعاملات آرشیو، فرم پایدار و راه‌اندازی PC-A — ادغام‌شده

- PR #78 با Merge Commit `869a043` وارد `develop` شد؛ `main` تغییر نکرده است. PC-A پس
  از Pull همین `develop` و اجرای فرمان محلی مستندشده، دیتابیس و Storage آزمایشی خودش را
  می‌سازد.
- `PC-B` کارت‌های مدیریت آرشیو را از نمایش‌های بی‌عمل به دکمه‌های قابل دسترس تبدیل کرد؛
  هر کارت اکنون نمای مرتبط اسناد را با فیلتر یا مرتب‌سازی مشخص باز می‌کند و بازخورد روشن
  می‌دهد.
- گزینه‌های فرم بارگذاری، کاربر جاری و شعبه‌های مجاز اکنون با یک پاسخ Documents دریافت
  می‌شوند. خطای تمدید مستقل نشست IAM دیگر Dropdownهای سالم را خالی نمی‌کند؛ مقدارهای
  اولیه داخل فرم ثبت، ورودی‌های غیر Native صریح اعتبارسنجی و منوی Select بالاتر از Dialog
  نمایش داده می‌شود. خطای Upload نیز دیگر فایل و فیلدهای واردشده را پاک نمی‌کند.
- فرمان `documents:demo:apply` برای هر دستگاه یک مسیر آماده‌سازی کامل دارد: تولید Client،
  اعمال Migrationهای موجود، Seed معمول، Build و ساخت idempotent هفت سند محلی. پایان موفق
  فقط وقتی اعلام می‌شود که هر هفت رکورد واقعاً `CLEAN` و قابل مشاهده باشند. Git همچنان
  فقط کد و Fixture ساختگی را منتقل می‌کند، نه دیتابیس یا Secret محلی.
- هیچ Schema/Migration، Permission، Dependency/Lockfile یا Seed عمومی تغییر نکرده است؛
  Runner فقط خطای گذرای Seed اتمیک و idempotent محلی را یک‌بار تکرار می‌کند.
  جزئیات و دستور PC-A در `docs/tasks/DOCUMENTS-003D-LOCAL-INTERACTIONS.md` ثبت شده است.
- lint، typecheck و Build کامل Monorepo موفق‌اند؛ ۱٬۳۹۰ تست موفق و ۷۰ تست PostgreSQL
  اختیاری skip شدند. Apply واقعی و تکراری پس از Backup خصوصی هر هفت سند را با
  `readyForViewing=true` و `verifiedRecords=7` تأیید کرد.

## CI-001 — CI مشترک PC-A و PC-B — آماده بررسی

- `PC-B` روی Branch و Worktree مستقل `codex/pc-b-ci-foundation` یک GitHub Actions
  مشترک برای Push و PRهای `codex/pc-a-*`، `codex/pc-b-*`، `develop` و `main` آماده
  کرده است. این Workflow فقط Checkout خواندنی دارد و هیچ Commit، Push، Merge یا Deploy
  انجام نمی‌دهد.
- Concurrency با ترکیب نوع رخداد و Head Branch جدا می‌شود؛ اجرای PC-A و PC-B مستقل است،
  Push و PR یکدیگر را لغو نمی‌کنند و فقط اجرای قدیمی همان رخداد روی همان Branch متوقف
  می‌شود. PostgreSQL 18 و تمام داده‌های آزمون داخل runner موقت و synthetic هستند.
- Gateها شامل نصب frozen با Node/pnpm دقیق Repository، Prisma format/validate/generate،
  Prettier فایل‌های تغییرکرده، Full Monorepo lint/typecheck/test/build و اجرای هر ۲۸
  Migration به‌همراه Seed دوگانه است. Prettier فقط تغییرات جدید را کنترل می‌کند تا بدهی
  قالب‌بندی ۵۰۷ فایل قدیمی باعث توقف Branchهای جاری نشود.
- اعتبارسنجی محلی: lint، typecheck، همه تست‌ها و Production Build موفق؛ ۲۸ Migration روی
  PostgreSQL 18 خالی اعمال شد و Seed دوبار موفق بود. هیچ Schema، Migration، Dependency،
  Lockfile، کد ماژول، دیتابیس توسعه یا سرور PC-A/PC-B تغییر نکرد. جزئیات:
  `docs/tasks/CI-001.md`.

## DOCUMENTS-003C — بسته داده نمایشی قابل اجرای اسناد — ادغام‌شده

- `PC-B` بسته صریح و محلی ساخت هفت سند نمونه را با PR #72 و Merge Commit `a2b5b9e`
  وارد `develop` کرد. Git فقط تعریف‌های ساختگی و مولد تصویر را نگه می‌دارد؛ هر دستگاه
  رکوردها و فایل‌های رمزگذاری‌شده را روی PostgreSQL و Storage محلی خودش می‌سازد.
- دامنه‌های هویت مشتری، فروش، سفر، خرید و منابع انسانی پوشش داده شده‌اند. دو سند نزدیک
  انقضا و یک سند منقضی وجود دارد و هر هفت فایل PNG واقعی پس از Scan پاک قابل Preview
  هستند. هیچ نام/شماره هویتی، مسافر، مبلغ، حساب، رمز یا فایل واقعی در بسته نیست.
- Preview بدون Write، Apply با Microsoft Defender واقعی، اجرای مجدد بدون Duplicate و
  مشاهده هفت سند و یک Preview PNG از API زنده موفق بود. تست PostgreSQL مستقل، تست‌های
  عمومی و Build API نیز موفق‌اند. راه‌اندازی PC-A در
  `docs/tasks/DOCUMENTS-003C-DEMO-BOOTSTRAP.md` ثبت شده است.
- Follow-up یکپارچه‌سازی CI، تشخیص Windows drive root و UNC را روی Windows/Linux یکسان
  و fail-closed کرد؛ مسیرهای scoped معتبر حفظ و ۱۴ تست Fixture موفق شدند.

## IAM-003 — پایداری ورود و نشست چندتب — ادغام‌شده

- `PC-B` با درخواست صریح مالک روی `codex/pc-b-iam-login-stability`، Hotfix محدود IAM را
  پیاده کرد و PR #68 با Merge Commit `bba6cc0` در `develop` ادغام شد. اجرای مجدد Bootstrap دیگر رمز، وضعیت یا شمارنده
  ورود کاربر موجود را بازنویسی نمی‌کند و فقط اتصال idempotent نقش مدیر/شعبه را تضمین می‌کند.
- Rotation نشست اکنون با claim اتمیک انجام می‌شود. Token منطبق که حداکثر پنج ثانیه قبل
  توسط تب دیگر Rotate شده، پاسخ conflict قابل‌بازیابی می‌گیرد و خانواده Session را revoke
  نمی‌کند؛ Token نامنطبق یا reuse خارج از grace همچنان fail-closed است. Customers و
  Documents از helper و Web Lock مشترک استفاده می‌کنند.
- صفحه Login فقط پاسخ 401 را «نام کاربری یا رمز نادرست» نشان می‌دهد؛ Validation، محدودیت
  تلاش، خطای سرور و قطع ارتباط پیام‌های مستقل دارند.
- ۷۱۷ تست API و ۵۴۴ تست Web، lint، typecheck و Build کامل API/Web موفق‌اند. نسخه جدید
  روی API4000/Web3100 فعال است؛ Health/Login برابر ۲۰۰ و Validation خالی برابر ۴۰۰ است.
  پس از Merge و با درخواست صریح مالک، بازیابی محلی رمز `nirvana` روی PC-B با Backup، لغو نشست‌های
  قدیمی و ورود/خروج واقعی ۲۰۰/۲۰۴ انجام شد؛ هیچ Secretی وارد Git نشد. جزئیات:
  `docs/tasks/IAM-003-LOGIN-STABILITY.md`.

## DOCUMENTS-003B — پیش‌نمایش امن تصویر — آماده بررسی

- `PC-B` روی شاخه فرزند `codex/pc-b-documents-image-preview` و Draft PR #67 پیش‌نمایش
  واقعی JPEG/PNG را به تب جزئیات سند افزود. فایل فقط پس از Scan واقعی `CLEAN`، مجوز
  مشاهده، Scope شعبه و کنترل محرمانگی تحویل می‌شود؛ URL عمومی یا ذخیره پایدار در مرورگر
  ساخته نمی‌شود.
- مسیر inline احراز‌شده، Audit مستقل `documents.file.preview`، دلیل مشاهده سند محرمانه
  و کدگذاری امن متن فارسی تکمیل شدند. Blob URL با Abort و cleanup آزاد می‌شود؛ فایل‌های
  غیرتصویری همچنان از دانلود مجاز استفاده می‌کنند.
- API و Web: lint/typecheck/build موفق؛ ۷۰۸ تست API موفق با ۶۶ skip اختیاری و ۵۱۶ تست
  Web موفق. نسخه جدید روی API4000 و Web3100 لوکال فعال است. جزئیات:
  `docs/tasks/DOCUMENTS-003B.md`.

## DOCUMENTS-003A — تجربه کامل لوکال و اسکن واقعی — آماده بررسی

- `PC-B` روی شاخه مستقل `codex/pc-b-documents-usability`، فرزند
  `codex/pc-b-documents-vertical-slice@37558aa`، Draft PR #65 را آماده کرد. نمای مستقل
  فعالیت حذف و Timeline فقط داخل جزئیات فایل حفظ شد. این Slice به `develop` Merge نشده و
  والدها را تغییر نمی‌دهد.
- اشتراک‌گذاری داخلی اکنون برای تمام اسناد لینک مستقیم قابل کپی دارد؛ لینک ورود و مجوز
  همان سند را الزام می‌کند و هیچ دسترسی عمومی یا دانلود بدون Scan نمی‌سازد.
- چهار نمای شخصی فعال‌اند: مالکیت و بارگذاری از Backend، اخیراً دیده‌شده از Audit همان
  کاربر و علاقه‌مندی‌ها به‌صورت شناسه‌های تفکیک‌شده کاربر در مرورگر. رابط و منوی داخلی با
  رنگ آبی روشن، Active state، سایه و Hover یکدست شده‌اند.
- Microsoft Defender واقعی روی PC-B به صف پردازش متصل شد. تطبیق SHA-256 قبل از اسکن و
  رفتار fail-closed حفظ شده است. هر ۶ فایل آزمایشی لوکال واقعاً `CLEAN`، Jobها `COMPLETED`
  و قرنطینه‌ها `RELEASED` شدند؛ Backup خصوصی پیش از پردازش تهیه شد.
- lint/typecheck/build API، Web و Contracts موفق؛ ۱٬۲۳۴ تست موفق و ۶۶ تست اختیاری skip.
  Smoke مرورگر احراز‌شده تمام مسیرهای شخصی، لینک، جزئیات، Timeline و وضعیت اسکن را پوشش داد.
  جزئیات: `docs/tasks/DOCUMENTS-003A.md`.

## DOCUMENTS-002 — Vertical Slice واقعی و Stacked — آماده بررسی

- `PC-B` یک Slice مستقل روی `codex/pc-b-documents-vertical-slice` و والد
  `codex/pc-b-documents-foundation@05b09e8` آماده کرده است. Phase A همچنان Draft PR #61
  و ادغام‌نشده است؛ Draft PR #64 مستقیماً به `develop` نمی‌رود و تا Merge والد همان
  Branch والد را هدف می‌گیرد.
- Persistence افزایشی Documents، قرارداد `documents.v1`، ۲۸ Permission، ۱۹ نوع سند،
  ۹ دسته، REST API واقعی، Storage محلی رمزگذاری‌شده، `/documents` متصل، Dialog بارگذاری
  و جزئیات شش‌تب تکمیل شدند. Binary در Database نیست و دانلود تا Scan پاک fail-closed است.
- نقش‌های Archive/Sales/Finance/HR از هم جدا هستند؛ Finance و HR به محتوای خارج از Domain
  خود دسترسی ندارند و Archive محتوای حساس را Mask‌شده و بدون دانلود می‌بیند.
- ۲۸ Migration از صفر و Seed دوگانه روی PostgreSQL 18، lint/typecheck/build کامل و
  ۱٬۲۹۶ تست عمومی پاس شدند. Smoke واقعی مرورگر بارگذاری، تاریخ شمسی/میلادی، دسترسی چهار
  نقش و Desktop/Mobile را پوشش داد؛ تمام داده‌ها و زیرساخت Synthetic پس از تست حذف شدند.
- Adapter تولیدی S3/MinIO، Antivirus Worker، retention قطعی، اشتراک امن، Export و اتصال
  producerها Deferred هستند. جزئیات: `docs/tasks/DOCUMENTS-002.md`.

## یکدست‌سازی اکشن‌های فیلتر اطلاعات پایه — 2026-08-31

- `MASTER-003-FILTER-ACTIONS` روی شاخه `codex/pc-b-master-data-filter-actions` به‌صورت Stacked روی تحویل حذف نوارهای قفل‌دار آماده Review است. تمام Workspaceهای تخصصی و fallback عمومی از کامپوننت مشترک «پاک‌کردن / تازه‌سازی» استفاده می‌کنند.
- اکشن‌ها در ردیف پایینی تمام‌عرض FilterBar و سمت چپ چیدمان RTL قرار دارند؛ هر دو Button دارای Border، پس‌زمینه، آیکون و حالت‌های Hover/Focus هستند. منطق فیلترها، داده، مجوز، صفحه‌بندی و API تغییر نکرده است.
- ۵۳۴ تست Web، Typecheck، lint کامل Web و Production Build موفق‌اند. بررسی زنده روی `localhost:3101/master-data/geography` چیدمان، فیلتر تاریخ و نبود نوار قفل را تأیید کرد. سرور PC-A روی پورت ۳۱۰۰ و Checkout آن دست‌نخورده‌اند.

## تثبیت حذف نوارهای قفل‌دار زیر KPI اطلاعات پایه — 2026-08-31

- `MASTER-003-REMOVE-LOCK-NOTES` روی شاخه `codex/pc-b-master-data-remove-lock-notes` و به‌صورت Stacked روی تحویل فیلتر تاریخ آماده Review است. هر هشت Workspace تخصصی و fallback عمومی مستقیماً از KPI به فیلترها می‌رسند و نوار ثابت قفل/قاعده میان آن‌ها ندارند.
- آزمون رگرسیون از تطبیق ۱۸۰ نویسه‌ای به بررسی کامل محتوای بین `MasterDataKpiGrid` و `FilterBar` ارتقا یافت؛ `Alert`، `Card`، آیکون‌های قفل/قاعده و عنوان‌های «قاعده یکپارچگی/مرز دامنه» در این محل رد می‌شوند. پیام‌های دسترسی، نتیجه عملیات و منطق حذف امن حفظ شده‌اند.
- ۵۲۳ تست Web، Typecheck، lint کامل Web و Production Build موفق‌اند. بررسی Process نشان داد `localhost:3100` از Checkout مستقل PC-A در `C:\Users\admin\Rubi-documents-vertical-slice` اجرا می‌شود؛ به همین علت نسخه قدیمی هنوز در آن پورت دیده می‌شود. Checkout و پردازش PC-A تغییر یا متوقف نشدند.

## فیلتر بازه تاریخ اطلاعات پایه — 2026-08-31

- `MASTER-003-DATE-RANGE-FILTERS` روی شاخه `codex/pc-b-master-data-date-filters` به‌صورت Stacked روی نسخه حذف نوارهای KPI آماده Review است؛ `develop`، Checkout و Web پورت ۳۱۰۰ متعلق به PC-A تغییر نکردند.
- در مالی و پولی، جغرافیا، سازمان‌ها و تأمین‌کنندگان، اقامت، حمل‌ونقل، بیمه، تور و خدمات سفر، مراجع فروش و fallback عمومی یک گروه جمع‌وجور «از تاریخ / تا تاریخ» افزوده شد. تقویم مشترک داخل Popup کلید شمسی/میلادی دارد، تاریخ پایدار Gregorian ISO نگهداری می‌شود و بازه مستقل یا همراه پاک‌کردن همه فیلترها قابل حذف است.
- Query افزایشی `createdFrom`/`createdTo` روی `createdAt` پیش از Pagination و Export اعمال می‌شود؛ روز پایان inclusive است. تاریخچه نرخ ارز همین کنترل را روی `observedAt` می‌گیرد. ورودی نامعتبر یا بازه معکوس در API رد می‌شود؛ نبود تاریخ دقیقاً رفتار قبلی را حفظ می‌کند. بدون Schema/Migration، Calendar، Customers، Dependency یا تغییر داده.
- ۵۲۳ تست Web و ۶۷۱ تست API موفق؛ Typecheck، lint محدوده و Production Build Web/API/Contract پاس شدند. بررسی بصری روی پورت موقت ۳۱۰۱ چیدمان فشرده، برچسب‌ها و هر دو تقویم را تأیید کرد؛ سرور موقت سپس بسته شد.

## حذف نوارهای توضیحی زیر KPI اطلاعات پایه — 2026-08-31

- `MASTER-003-REMOVE-KPI-NOTES` روی شاخه `codex/pc-b-master-data-remove-kpi-notes` از `origin/develop@03e4c43` آماده Review است.
- نوارهای قاعده/مرز دامنه بلافاصله زیر کارت‌های KPI در هفت Workspace جغرافیا، سازمان‌ها و تأمین‌کنندگان، اقامت، حمل‌ونقل، بیمه، خدمات سفر و مراجع فروش حذف شدند. صفحه مالی و پولی چنین نوار مستقلی نداشت؛ KPIها، تب‌ها، فیلترها، جدول‌ها، Popupها و پیام‌های عملیاتی حفظ شدند.
- تغییر فقط در Presentation و آزمون Web است؛ Customers، Calendar، API/Contract، Schema/Migration، Seed، Dependency/Lockfile و داده محلی تغییر نکردند. یک آزمون سراسری از بازگشت Alert/Card توضیحی بلافاصله پس از KPI جلوگیری می‌کند.
- ۵۱۱ تست Web، Typecheck، lint فایل‌های متاثر و Production Build موفق‌اند. API روی پورت ۴۰۰۰ پاسخ ۲۰۰ دارد و Web روی ۳۱۰۰ فعال است؛ مسیر اطلاعات پایه بدون Session مطابق قرارداد ۳۰۷ به Login هدایت می‌شود.

## انتشار قابل اجرای داده نمایشی برای PC-A — 2026-08-31

- پس از Merge #60، تعریف ۷۸ Fixture در `develop` موجود است اما رکوردهای PostgreSQL میان کامپیوترها با Git منتقل نمی‌شوند. `MASTER-003-DEMO-BOOTSTRAP` یک فرمان استاندارد Root برای Preview و Apply همان Fixture روی دیتابیس لوکال هر توسعه‌دهنده اضافه می‌کند.
- محافظ‌های محیط/مقصد، تراکنش، Audit، تکرارپذیری و عدم بازنویسی داده کاربر حفظ می‌شوند. این کار Seed عمومی یا Startup را تغییر نمی‌دهد و هیچ داده نمایشی را وارد Production نمی‌کند.
- فرمان Preview روی DB لوکال هر ۷۸ Fixture را بدون ساخت تکراری بازیابی و Rollback کرد؛ ۹ آزمون PostgreSQL روی DB مستقل و حذف‌شونده موفق بودند. ۱٬۲۵۹ تست عمومی، lint، typecheck و Production Build کامل نیز پاس شدند. Dependency/Lockfile، Migration و داده کاربردی تغییر نکردند.

## ادغام تکمیلی اطلاعات پایه با develop — 2026-08-31

- با تأیید صریح مالک برای Push و Merge، شاخه `codex/pc-b-master-data-develop-integration` از `origin/develop@e25f288` (#58 ادغام‌شده) ساخته شد و تاریخچه دقیق #59 / `b04c2bd` شامل #57 را دریافت کرد. والد #55/#54 و حمل‌ونقل جداگانه #47 قبلاً در #58 حضور دارند؛ تغییرات PC-A و اصلاح امنیتی XLSX/Calendar حفظ شدند.
- نسخه ترکیبی: نصب frozen، lint و typecheck کامل، Production Build، ۱٬۲۵۷ تست عمومی و ۶۶ آزمون واقعی PostgreSQL موفق. ۲۷ Migration از صفر و Seed دوگانه روی دیتابیس مستقل پاس شدند. تنها Migration تازه نسبت به develop همان ترتیب کشور است؛ هیچ Migration تاریخی تغییر نکرده است.
- Smoke احراز‌شده: فهرست هر ۴۵ کاتالوگ، ثبت/نمایش/فیلتر، پاور وضعیت و خطای نسخه قدیمی، وابستگی‌ها و Excel واقعی؛ همچنین ۱۱ مسیر Production فارسی RTL شامل اطلاعات پایه، Customers و Ticket Catalog موفق. این بررسی HTTP است و ادعای تست تعاملی مرورگر ندارد.
- گزارش ابزار OpenAPI تغییر ناسازگار جدیدی نیافت؛ کمبود مستندات Swagger قبلی با امتیاز یکسان F باقی است و «بازبینی کامل و پاک API» ادعا نمی‌شود. جزئیات و خروجی‌های بررسی در `docs/tasks/MASTER-003-DEVELOP-INTEGRATION.md` ثبت شده‌اند.
- Merge نهایی فقط با نتیجه تأییدشده PR گزارش می‌شود. Checkout و سرورهای اصلی، داده و کلیدهای محلی، شاخه‌های منبع و قفل‌های توسعه PC-B دست‌نخورده‌اند؛ تنها دیتابیس‌ها/کانتینرهای آزمایشی همین اجرا پس از آزمون حذف شدند. گزارش‌های زیر تاریخچه Snapshotهای قبلی‌اند.

## نسخه مشترک دو کامپیوتر — SHARED-INTEGRATION-0831 — در حال اعتبارسنجی

- هدف مالک محصول یک نسخه مشترک در develop است: اطلاعات پایه PC-B تا PR #55، مشتریان PC-A تا PR #56 و بلیت PC-A تا PR #46.
- سه Snapshot منتشرشده ترکیب و تعارض‌ها با حفظ اصلاح امنیتی Excel و گزارش‌های دو طرف حل شدند؛ Merge نهایی به develop و همگام‌سازی PC-B هنوز انجام نشده است.
- ۲۶ Migration با حفظ بایت‌های تاریخی روی PostgreSQL آزمایشی خالی اعمال شدند. داده کاربردی، کلیدها، Volumeها و Branchهای منبع دست‌نخورده‌اند.
- نصب frozen، lint، typecheck، ۱۲۲۱ تست عمومی، ۵۷ تست واقعی PostgreSQL، Seed دوگانه، Build کامل و Smoke احراز‌شده مشترک پاس شدند. Dependency/Lockfile تغییر نکرده است. اختلاف قدیمی نام Constraint/Indexها و Default لیدر در گزارش Task ثبت شده؛ هیچ Migration تاریخی بازنویسی نشد.
- بلیت همچنان Phase A/Preview است. قیمت نهایی فروش متعلق به Sales است؛ صدور و Manifest در Reservations می‌مانند. تغییر رمز IAM موجود در PR #46 برابر حداقل ۱۰ نویسه همراه همه شروط نوع نویسه است؛ این Task حسابی ایجاد نمی‌کند.
- گزارش‌های پایین تاریخی‌اند. قفل‌های توسعه اطلاعات پایه نزد PC-B باقی می‌مانند و این ادغام قفل توسعه جدیدی منتقل نمی‌کند.

آخرین به‌روزرسانی: 2026-08-31 — اصلاح نمایش فهرست مالی و جغرافیا پس از ثبت فرم

آخرین به‌روزرسانی: 2026-08-31 — کنترل وضعیت، فیلترها و تکمیل فهرست‌های اطلاعات پایه

## اصلاح کاربردپذیری کاتالوگ‌ها — 2026-08-31

- `MASTER-003-CATALOG-USABILITY` روی شاخه مستقل `codex/pc-b-master-data-catalog-usability` از #57 / `6abd960` آماده Review است. نسخه‌های تحویلی/والدها و PC-A دست‌نخورده‌اند. در بررسی نهایی #58 در `origin/develop@e25f288` ادغام شده بود؛ تغییرات این درخواست هنوز جزو آن Snapshot نیستند.
- دکمه Power برای وضعیت واقعی با نسخه و Permission، دو فیلتر ستونی قابل پاک‌کردن در هر کاتالوگ و ستون‌های ماکاپ حمل‌ونقل/هتل/جغرافیا تکمیل شد. تعداد وابستگی‌ها از FKهای واقعی Master Data است. داده بیرون از مالکیت ماژول بدون قرارداد جعل نمی‌شود؛ نرخ‌ها تابع گردش اختصاصی خود هستند، نه Power عمومی.
- Migration افزایشی `20260831140000_master_country_display_order` ترتیب کشور را با پیش‌فرض صفر و قید 0..100000 اضافه می‌کند. روی PostgreSQL 18 خالی همراه ۲۴ Migration قبلی و سپس روی لوکال پس از Backup اجرا شد. هیچ Customer، Calendar، Dependency یا داده عملیاتی دیگر تغییر نکرد.
- فقط ۷۸ Fixture قابل انتساب و بدون ویرایش کاربر به نام‌های طبیعی‌تر تغییر یافتند؛ ID/FK محفوظ و اجرای دوم صفر تغییر داشت. کسب‌وکارها نمایشی‌اند؛ اطلاعات تماس واقعی، نرخ ارز، حساب، کارت، کلید یا Connection ساختگی افزوده نشد.
- ۹۹۴ تست عمومی، ۹ تست یکپارچه مستقل، Typecheck و Build API/Web موفق؛ lint محدوده موفق، lint عمومی Web تنها خطای قبلی DatePicker را دارد. API health و Login برابر 200؛ درخواست بدون ورود به اطلاعات پایه 307 و API محافظت‌شده 401 است. تست کلیک احراز‌شده معلق به ورود کاربر است؛ ادعای Smoke کامل وجود ندارد.
- [گزارش تحویل](tasks/MASTER-003-CATALOG-USABILITY.md) شامل Scope، سازگاری قرارداد، Migration، داده نمایشی، آزمون و استثناهای مالکیت است. هیچ Merge یا Force Push توسط این Task انجام نشده است.

## داده آزمایشی تمام بخش‌های اطلاعات پایه — 2026-08-31

- `MASTER-003-LOCAL-DEMO-DATA` روی `codex/pc-b-master-data-demo-fixtures` از `241308e` / PR #55: ۷۸ رکورد با برچسب «آزمایشی» در ۴۰ کاتالوگ هشت بخش اصلی روی لوکال ثبت شد. داده‌ها FK واقعی دارند؛ هیچ نرخ ارز، حساب/کارت، PII واقعی یا اتصال خارجی ساختگی ساخته نشد.
- اجرای صریح ابزار مستقل، محدود به DB مشخص لوکال و محیط development/test است؛ از Service و اعتبارسنجی موجود استفاده می‌کند. تراکنش واحد، قفل اجرای هم‌زمان و Audit marker مانع ثبت ناقص، بازنویسی داده موجود و تکرار نمونه‌ها می‌شوند. Seed عمومی، IAM، Customers، Schema، Migration و Dependency تغییر نکردند.
- پیش از اجرا Backup خصوصی گرفته شد. Preview کامل Rollback شد؛ اجرای اول ۷۸ Create و اجرای دوم صفر Create / ۷۸ Reuse داشت. تمام نمونه‌ها از List با جست‌وجوی «آزمایشی» و Detail در DB محلی بازیابی شدند.
- ۵۴۶ تست API موفق، شامل ۹ تست واحد و ۴ آزمون واقعی PostgreSQL 18 جدید با تمام Migrationها؛ ۵۷ آزمون اختیاری دیگر skip شدند. lint، Typecheck و Build API موفق‌اند. API `/api/v1/health` و Login پاسخ ۲۰۰؛ مرورگر بدون Session به Login هدایت می‌شود و Smoke احراز‌شده ادعا نمی‌شود.
- ابزار فقط به‌صورت دستی اجرا می‌شود و هنگام Startup/Seed عمومی فعال نیست. سرورها، داده قبلی و شاخه‌های والد/PC-A/main/develop محفوظ‌اند؛ قفل‌های PC-B/MASTER-003 تغییر نکردند. گزارش و دستور اجرا: `docs/tasks/MASTER-003-LOCAL-DEMO-DATA.md`.

## اصلاح نمایش فهرست پس از ثبت فرم — 2026-08-31

- `MASTER-003-LIST-VISIBILITY` روی `codex/pc-b-master-data-list-visibility` از نسخه تجمیعی `790c20a`: درخواست‌های KPI مالی و جغرافیا از pageSize نامعتبر 1 به helper مشترک با اندازه معتبر 10 منتقل شدند؛ فهرست اصلی، فیلترها، مجوزها و قرارداد Backend بدون تغییرند.
- ثبت فرودگاه در Audit محلی موجود بود؛ داده حذف نشده بود و خطای درخواست KPI باعث شکست بارگذاری فهرست می‌شد. هیچ Migration، Reset، Seed یا ویرایش داده کاربردی انجام نشد.
- ۹۵۸ تست عمومی موفق، از جمله سه تست Web جدید و نه تست HTTP اعتبارسنجی برای منابع مالی/جغرافیا؛ ۵۷ تست اختیاری PostgreSQL در اجرای عمومی skip شدند. این اصلاح Schema یا Repository را تغییر نمی‌دهد.
- Typecheck و Production Build موفق؛ lint محدوده موفق و lint کل همان خطا/هشدار DatePicker مشترک را دارد. API4000 و Login3100 پاسخ ۲۰۰؛ Web نسخه اصلاح‌شده را اجرا می‌کند. مرورگر تست به Login هدایت شد و Smoke با حساب کاربر انجام نشده است.
- کاربر درخواست Merge به develop داده است؛ PRهای والد هنوز Draft و بدون Review هستند. بررسی غیرمخرب Merge نیز در WORK_ASSIGNMENTS، PROJECT_STATUS و master-data.xlsx تعارض یافت. هیچ Merge یا تغییر شاخه والد/PC-A/main/develop انجام نشده است. گزارش نهایی: `docs/tasks/MASTER-003-LIST-VISIBILITY.md`.

## انتشار و فعال‌سازی تمام تغییرات محلی — 2026-08-31

- کاربر انتشار همه اصلاحات موجود و فعال‌سازی محلی را تأیید کرد. تغییرات در شش Slice سربرگ، وضعیت همکاری، حذف امن، فرم‌های سفر، ترمینال و وعده/سرویس در Draft PRهای #48 تا #53 منتشر شدند؛ حمل‌ونقل #47 نیز در نسخه تجمیعی حضور دارد. گزارش‌های «محلی/بدون Push» پایین، تاریخچه مرحله پیاده‌سازی هستند.
- از داده‌های کاربردی Backup خصوصی گرفته شد. چهار Migration سفر/ترمینال/حمل‌ونقل/وعده با موفقیت Deploy شدند؛ دیتابیس محلی با ۲۴ Migration به‌روز است. هیچ Reset، حذف داده یا Seed کاربردی انجام نشد.
- API4000 پاسخ Health سالم دارد؛ Web3100 و Login پاسخ ۲۰۰ می‌دهند. مسیرهای محافظت‌شده بدون Session به Login هدایت می‌شوند؛ Smoke احراز‌شده ادعا نمی‌شود. اتصال ابزار مرورگر داخلی در این اجرا در دسترس نبود.
- کل پروژه: API ۵۲۴، Web ۳۴۶، Contract ۱۴، Database ۵۹ و Config/Worker سه تست موفق؛ Typecheck و Production Build موفق. lint محدوده Master Data و API موفق؛ lint کلی فقط خطا/هشدار قدیمی DatePicker مشترک را دارد.
- آزمون واقعی مستقل PostgreSQL 18: حذف امن ۷، فرم‌های سفر ۱۳ و وعده ۸ موفق؛ در نسخه تجمیعی نهایی ترمینال ۱۵ و حمل‌ونقل ۱۰ آزمون موفق با تمام Migrationها و Seed دوگانه. مشکل Fixture قدیمی ترمینال برطرف شد؛ اجرای نخست Seed هم‌زمان با تست کل پروژه به Timeout خورد و اجرای مستقل مجدد موفق بود.
- Customers، Dependency/Lockfile و شاخه‌های والد/PC-A محفوظ‌اند؛ سه قفل PC-B/MASTER-003 فعال می‌مانند. گزارش انتشار و محدودیت‌های تأیید: `docs/tasks/MASTER-003-LOCAL-PUBLISH.md`.

### `MASTER-003-LOCAL-MEAL-SERVICE-FORM` — PC-B — آماده بررسی؛ فعال‌سازی محلی معلق

- فرم Popup وعده/سرویس: کد قابل تعریف با پیشنهاد RO/BB/HB/FB/ALL/UALL/BRN، عنوان فارسی/انگلیسی، دسته، انتخاب چندگانه وعده‌ها و پاک‌کردن، تعداد واقعی هتل مرتبط فقط‌خواندنی و فعال/غیرفعال/در حال بررسی.
- وضعیت و محتوا با مجوز، Version و Audit در تراکنش واحد ثبت می‌شوند. فیلتر و Excel وضعیت بررسی را مستقل نمایش می‌دهند؛ مصرف‌کننده قدیمی آن را inactive می‌بیند. کدهای خودکار قدیمی و وعده‌های سفارشی بدون بازنویسی حفظ می‌شوند.
- Migration افزایشی `20260831130000_master_data_meal_service_forms` و همه Migrationهای نسخه محلی روی PostgreSQL 18 خالی اجرا شدند؛ Seed دوبار و ۸ آزمون واقعی ذخیره/Audit/فیلتر/Export/FK/Constraint موفق. آزمون‌های API/Web/Contract/Database، Typecheck و Build جداگانه موفق‌اند؛ خطای lint کلی Web همان DatePicker قبلی است.
- تغییرات محلی کاربر، سه قفل PC-B/MASTER-003 و Branch جاری محفوظ‌اند؛ Customers/Dependency/Seed، دیتابیس کاربردی و Client سرور تغییر نکردند. API4000 در کنترل نهایی در دسترس نبود؛ Smoke احراز‌شده ادعا نمی‌شود. فعال‌سازی نیازمند هماهنگی Migrationهای محلی معلق است. گزارش: `docs/tasks/MASTER-003-LOCAL-MEAL-SERVICE-FORM.md`.

گزارش‌های مرحله‌ای پایین تاریخی هستند؛ فعال‌سازی و تجمیع حمل‌ونقل PR #47 اکنون با تأیید صریح کاربر در `MASTER-003-LOCAL-PUBLISH` انجام می‌شود.

## خلاصه

### CUSTOMER-CHAIN-REVIEW-001 — 2026-08-31

- با تأیید صریح مالک، فقط زنجیره مشتریان #26 → #27 → #34 → #41 در حال بررسی و ادغام ترتیبی است.
- PR #26 پس از ۳۴۴ تست و Smoke واقعی روی مبنای ادغام‌شده، با Commit `a470d06` ادغام شد.
- PR #27 پس از حل تعارض، انتقال زودتر کنترل‌های امنیتی XLSX، ۳۹۹ تست و Smoke واقعی با Commit `eb2fe1e` ادغام شد.
- PR #34 پس از Migration افزایشی رفع CHECK با مقدار NULL، حفظ تاریخ تولد در ویرایش نامرتبط، ۴۲۰ تست، ۱۱ Migration از صفر و ۱۱ کنترل HTTP/Database ساختگی با Commit `b5f06a2` ادغام شد.
- PR #41 روی develop شامل والدها بازبینی شد: ۴۲۵ تست در ۸۱ فایل، lint/typecheck/build کامل و ۱۷ کنترل HTTP/Database موفق؛ آماده ادغام همین Slice است. قفل‌های Customer طبق Handoff صریح WORK_ASSIGNMENTS بلافاصله پس از Merge #41 آزاد می‌شوند.
- کل CUSTOMER-002B هنوز Partial است: هویت خارجی، پاسپورت، Documents امن، نگهداری/حذف، Import اتمیک و Merge مشتریان تکمیل‌شده اعلام نمی‌شوند. مرحله محصول بعدی مورد درخواست مالک «مدیریت و تعریف بلیت‌ها» است؛ صدور و Manifest در رزرواسیون باقی می‌مانند.
- هیچ PR کامپیوتر B، کلید، داده واقعی یا سرویس لوکال اصلی تغییر نکرده است؛ تصمیم‌های باز امنیتی خودکار پذیرفته نمی‌شوند.

### CUSTOMER-002B — پیگیری نمایش شماره و تماس (2026-08-31)

- روی همان Branch مشتریان و Preview اصلی؛ میان‌بر تماس برای هر مشتری یا مسافر اضافه شد.
- شماره کامل فقط با دلیل مجاز و Permission/Audit موجود نمایش داده می‌شود؛ لینک تماس پس از Reveal و پنهان‌کردن دستی در دسترس است.
- ۱۲۳ تست Web، ۸۱ تست API Customers، lint، typecheck و Production Build وب پاس شدند؛ هیچ تغییر Database یا داده مشتریان انجام نشد.

### `CUSTOMER-002A.1` — PC-A — `READY_FOR_REVIEW`

- Branch فرزند `codex/pc-a-customer-next` از Remote Parent
  `codex/pc-a-customer-operations@5e9503d0b09560ed266aeaaa800d2fe701d1f712` ساخته شد؛ Parent PR #26 و Branch آن تغییر نکردند.
- فیلترهای مدل فعلی، Status History، Customers-only Activity Timeline، Audit API حداقلی، Privacy UX و Deep Link امن Customer 360 تکمیل شدند.
- قرارداد `customers.v2` به‌صورت additive/backward-compatible باقی ماند و هیچ فایل Customer Affairs یا Master Data تغییر نکرد.
- Migration Lock نزد `PC-B/MASTER-003` باقی ماند؛ Prisma/Migration/Seed/Dependency/Lockfile بدون تغییر هستند.
- ۵۲ تست API Customers، ۱۴ تست Web Customers، ۱۵ تست Contract و ۲۶۹ تست کامل پاس شدند؛ lint، typecheck، Production Build و Smoke احراز‌شده `/customers` نیز پاس شدند.
- نام لاتین، جنسیت، note، business code، idempotency persistence، Address Masking کامل، cross-module timeline و Merge واقعی در `BLOCKED_FOR_CUSTOMER_002B` باقی ماندند.
- Draft Stacked PR #27 با Base اولیه `codex/pc-a-customer-operations` باز شد؛ به #26 وابسته است، پیش از Parent Merge نمی‌شود و پس از Merge والد Base آن به `develop` تغییر می‌کند.

- مرحله جاری: **Advanced Master Data Management Full-Stack**
- وضعیت: **انتشار اصلاحات محلی در Sliceهای مستقل و تجمیع نسخه اجرایی کامل**
- Repository: `Nora`، Remote با نام `origin`
- Baseline: `origin/develop@b6da5d6300716a189958bc37d31ca195f0304dc5` شامل Merge PR #24
- شاخه جاری: `codex/pc-b-master-data-demo-fixtures` از `codex/pc-b-master-data-list-visibility`، شامل نسخه تجمیعی و اصلاح نمایش فهرست؛ Runtime برنامه تغییر نکرده و داده آزمایشی به DB لوکال اضافه شده است.
- Work Item جاری: `MASTER-003-LOCAL-DEMO-DATA` روی والد PR #55؛ نسخه تجمیعی و Sliceهای انتشار قبلی حفظ شده‌اند.
- محیط مسئول: `COMPUTER_ID=PC-B`؛ داده‌های Checkout اصلی محفوظ‌اند؛ API4000 و Web3100 محل اجرای نسخه تجمیعی هستند.
- نوع تغییر: Master Data Database/API/Contract/Web/Test/Docs؛ بدون تغییر Seed، Customers،
  UI مشترک، Dependency یا Lockfile.

### `MASTER-003R-TRANSPORT-FORMS` — PC-B — `READY_FOR_REVIEW`

- پوشش تصاویر ۴۳۹ تا ۴۴۵ در هفت فرم ایرلاین، هواپیما، قواعد بار، شرکت ریلی، قطار، شرکت اتوبوس و نوع اتوبوس بررسی و تکمیل شد. فیلدهای نام فارسی/انگلیسی، کشور/سازمان، سازنده/مدل و دسته‌های موجود حفظ شدند؛ وضعیت بررسی، مشخصات سیستمی فقط‌خواندنی و تاریخچه واقعی داخل پروفایل Popup اضافه شد.
- امکانات قطار به رابطه چندبه‌چند واقعی Facility متصل است؛ امکانات متنی قدیمی باقی می‌ماند. فیلتر وضعیت قبل از Pagination و در خروجی Excel اعمال می‌شود. تغییر وضعیت مجوز اختصاصی می‌خواهد و همراه Version/Audit در همان تراکنش ثبت می‌شود.
- Migration افزایشی `20260831120000_master_data_transport_forms`: هفت پرچم بررسی با Constraint و جدول ارتباطی قطار/امکانات با FK محدودکننده؛ هر ۲۱ Migration روی PostgreSQL 18 موقت، Seed دوبار و ۹ آزمون واقعی موفق شدند. فقط دیتابیس موقت آزمون حذف شد؛ دیتابیس اصلی Deploy نشد.
- کنترل کیفیت: API ۲۶۵، Web ۲۰۳، Contracts ۱۴ و Database ۵۵ تست موفق؛ Prisma format/validate/generate، typecheck و Production Build API/Web موفق. lint API/Database و کل ماژول Master Data وب موفق؛ lint سراسری Web فقط خطا/هشدار قبلی DatePicker مشترک را دارد و آن فایل دست‌نخورده است.
- اتصال واقعی Documents/Integrations، شمارش انواع ناوگان و ظرفیت عملیاتی همچنان منتظر قرارداد مالک هستند. مرجع لوگوی قبلی فقط‌خواندنی نمایش داده می‌شود؛ UUID جدید تاییدنشده پذیرفته نمی‌شود. مقدار، Connection، Secret یا داده ساختگی ماکاپ Seed نشد.
- Checkout مستقل `C:/Users/admin/Nora-transport-forms` از `2088010` برای حفظ تغییرات محلی حذف امن، فرم ترمینال/تور/سفر و سایر کارهای هم‌زمان استفاده شد. Health API و Login نسخه اصلی ۲۰۰ هستند؛ Smoke مرورگر احراز‌شده نسخه جدید ادعا نمی‌شود. ادغام در Checkout مشترک و Deploy محلی نیازمند هماهنگی جداست.
- سه قفل Migration/Contract/Docs زیر `PC-B/MASTER-003` فعال باقی می‌مانند؛ والد #45 و کل زنجیره Stacked، Customers، Seed و Dependency/Lockfile تغییر نکردند. قبل از والدها Merge نشود. گزارش و جدول فیلدها: `docs/tasks/MASTER-003R-TRANSPORT-FORMS.md`.

### `MASTER-003Q-PARTNER-FORMS` — PC-B — `READY_FOR_REVIEW`

- نام انگلیسی مستقل Supplier/Broker، نوع حقیقی/حقوقی Organization، تماس اصلی فعال همان سازمان و انتخاب چندگانه خدمات واقعی اضافه شدند؛ فرم‌های مرتبط Popup هستند و در فهرست/پروفایل فقط Mask تماس نمایش داده می‌شود.
- FK مرکب مانع اتصال مخاطب سازمان دیگر، جابه‌جایی هویت و حذف مخاطب استفاده‌شده است. PATCH مقادیر غایب را حفظ و فیلدهای اختیاری صریحاً خالی را پاک می‌کند؛ مجوز، Version و Audit موجود حفظ شدند.
- Migration افزایشی `20260831090000_master_data_partner_forms` روی PostgreSQL 18 خالی و دیتابیس محلی اجرا شد؛ Seed دوبار فقط در DB موقت، چهار آزمون واقعی FK/رمزنگاری/ذخیره/Audit موفق‌اند. DB موقت آزمون حذف شد؛ داده عملیاتی حذف نشد.
- نسخه جداشده از سایر تغییرات محلی: API ۲۵۴ تست، Web ۱۸۶ تست (شامل ۶ تست SSR فرم واقعی)، typecheck و Production Build API/Web موفق. نسخه مشترک نیز API ۳۸۴، Web ۲۴۸، Contract ۱۴ و Database ۵۳ تست موفق دارد (شامل کارهای هم‌زمان دیگر).
- lint API و فایل‌های Web متاثر موفق؛ lint کلی Web فقط خطا/هشدار قبلی DatePicker مشترک را دارد. مرورگر به Login هدایت شد؛ Smoke احراز‌شده ادعا نمی‌شود. API روی ۴۰۰۰ و Web روی ۳۱۰۰ روشن‌اند.
- قرارداد و سقف خرید تا Public Service واقعی B2B/Procurement و اتصال Provider تا سرویس Integrations، Deferred هستند؛ عدد، قرارداد یا اتصال جعلی ثبت نشد. سه قفل PC-B/MASTER-003 ثابت و تغییرات محلی حذف امن، همکاری و اصلاحات جانبی محفوظ و خارج از Commit این Slice هستند.
- والد #44 دست‌نخورده است؛ [Draft PR #45](https://github.com/nirvanamahlou/Rubi/pull/45) روی آن Stacked است و پیش از والدها Merge نمی‌شود. گزارش: `docs/tasks/MASTER-003Q-PARTNER-FORMS.md`.

### `MASTER-003-LOCAL-TRAVEL-FORMS` — PC-B — آماده بررسی محلی؛ فعال‌سازی معلق

- فرم Popup نوع ترانسفر: کد خودکار فقط‌خواندنی، عنوان فارسی/انگلیسی، وسیله، شیوه سرویس، حداقل/حداکثر ظرفیت، شرح، ترتیب و وضعیت. استفاده فقط‌خواندنی و تا اتصال رزرو فاقد عدد ساختگی است.
- فرم Popup ویزا: کد، عنوان‌ها، کشور مقصد، نوع ویزا، Provider، اعتبار روزشمار یا تا پایان پاسپورت، شناسه مدارک راهنمای عمومی، شرح، ترتیب و وضعیت؛ بدون اطلاعات متقاضی/پاسپورت.
- دو ستون و سه CHECK افزایشی در `20260831100000_master_data_travel_reference_forms`؛ ذخیره وضعیت/مشخصات اتمیک با مجوز، کنترل نسخه و Audit. رکوردهای قدیمی محفوظ‌اند.
- ۷۰ تست هدفمند API، ۲۸ تست Web، ۱۳ آزمون واقعی PostgreSQL 18 و دو تست ساختار Migration موفق؛ Web typecheck، lint فایل‌های همین تغییر و Build جداگانه API/Web موفق‌اند. آزمون گسترده‌تر، خطاهای خارج از Scope در فرم ترمینال را نشان داد؛ جزئیات و مراحل فعال‌سازی در `docs/tasks/MASTER-003-LOCAL-TRAVEL-FORMS.md`.
- Migration و Prisma Client جدید فقط در محیط آزمایشی جدا بررسی شدند؛ دیتابیس کاربردی، سرورها، Branch و Git staging/Commit/Push تغییر نکردند. تغییرات هم‌زمان محفوظ‌اند.

### `MASTER-003-LOCAL-TERMINAL-FORM` — PC-B — آماده بررسی محلی

- فرم و فهرست ترمینال مطابق فیلدهای تصویر تکمیل شد: نوع داخلی/بین‌المللی/مشترک/VIP، گیت، ساعت ۲۴ساعته یا بازه محلی با پشتیبانی از 24:00 و عبور از نیمه‌شب، فعال/غیرفعال/تعمیرات. مشاهده و ویرایش Popup است؛ کد، شهر و کدهای فرودگاه و آخرین تغییر فقط‌خواندنی‌اند.
- Migration افزایشی `20260831110000_master_data_terminal_details` با CHECKهای واقعی و بدون تغییر رکوردهای قبلی؛ وضعیت و مشخصات در یک تراکنش مجوزدار با Version/Audit ذخیره می‌شوند. تعمیرات برای مصرف‌کننده قدیمی غیرفعال محسوب می‌شود.
- ۴۱ تست جدید API، ۲۸ تست Web و ۱۵ آزمون PostgreSQL 18 موفق. مجموعه جاری API: ۴۶۳ موفق، Web: ۳۰۴ موفق، Contract: ۱۴ موفق؛ lint محدوده، typecheck با Source قرارداد جاری، Prisma format/validate/generate و Production Build جداگانه API/Web موفق.
- Seed دوبار در دیتابیس موقت و با مهلت بیشتر فقط در Client آزمایشی اجرا شد؛ مهلت پیش‌فرض Seed در این محیط تمام می‌شد. DB آزمایشی حذف شد. Migration کاربردی، Client سرور مشترک، سرورها، Branch و Git staging/Commit/Push تغییر نکردند؛ Smoke احراز‌شده ادعا نمی‌شود. قفل‌های PC-B/MASTER-003 ثابت‌اند. گزارش و فعال‌سازی: `docs/tasks/MASTER-003-LOCAL-TERMINAL-FORM.md`.

### `MASTER-003-LOCAL-TOUR-FORM` — PC-B — آماده بررسی محلی

- فرم Popup نوع تور با کد خودکار، عنوان فارسی/انگلیسی، دامنه، شرح، ترتیب و وضعیت تکمیل شد؛ کد، استفاده و آخرین تغییر فقط‌خواندنی‌اند. ذخیره وضعیت و مشخصات اتمیک، مجوزدار و دارای کنترل نسخه/Audit است.
- نمایش نام تغییر‌دهنده از API عمومی مجوزدار IAM است؛ شمارش محصولات تا قرارداد مالک مربوط در وضعیت «در انتظار اتصال محصولات» باقی می‌ماند.
- ۵۸ آزمون جدید؛ Web جاری ۲۴۲ موفق، API جاری ۳۸۴ موفق/۱۱ skipped، typecheck، lint فایل‌های متاثر و Build جدا از سرور موفق. Smoke احراز‌شده انجام نشد.
- تغییر محلی بدون Commit/Push، تغییر Branch، Schema/Migration/Seed، Dependency یا دست‌زدن به سرورها؛ تغییرات هم‌زمان حفظ شدند. گزارش: `docs/tasks/MASTER-003-LOCAL-TOUR-FORM.md`.

### `MASTER-003P-CLEAR-FIELDS` — PC-B — `READY_FOR_REVIEW`

- دکمه «×» برای انتخاب‌های ساده، مرجع اجباری/اختیاری، چندانتخابی و تاریخ در فرم‌های
  ایجاد/ویرایش Master Data، فرم ارز/نرخ، Preview و ورود گروهی هتل اضافه شد.
- دکمه نام فارسی دسترس‌پذیر و فضای لمس ۴۴ پیکسل دارد؛ Submit نیست و پس از پاک‌کردن،
  فوکوس به همان فیلد برمی‌گردد. در حالت خالی، فقط‌خواندنی و ذخیره نمایش داده نمی‌شود.
- پاک‌کردن فقط state همان فیلد را تغییر می‌دهد؛ انتخاب اجباری تا انتخاب دوباره قابل ذخیره
  نیست. در ورود گروهی هتل، پاک‌کردن کشور، شهر و Preview وابسته را نیز خالی می‌کند.
- آزمون واقعی TSX با پیکربندی Vitest محلی Web فعال شد؛ تنظیمات Next و Dependency ثابت‌اند.
- کنترل کیفیت روی checkout مستقل `687a183` برای جداسازی از تغییرات هم‌زمان Workspace:
  Frozen install، `175/175` تست Web (۲۰ تست جدید)، typecheck، lint فایل‌های متاثر و Production Build موفق.
- lint کل Web همچنان فقط ایراد قبلی DatePicker مشترک در خطوط ۶۷ و ۹۹ را گزارش می‌کند؛
  آن فایل خارج از Scope و دست‌نخورده است. `git diff --check` و Scope/Secret-pattern scan موفق‌اند.
- Health API و Login پاسخ ۲۰۰ دارند؛ بدون Session مسیر `/master-data` به Login می‌رود.
  Smoke احراز‌شده ادعا نمی‌شود. سرورهای محلی روشن و تغییرات محلی دیگر حفظ شده‌اند.
- Parent #43 / `b78d0a9` و سه قفل `PC-B/MASTER-003` ثابت‌اند؛ Draft روی شاخه والد،
  وابسته به #43 و زنجیره #25؛ بدون Merge خودکار. گزارش: `docs/tasks/MASTER-003P-CLEAR-FIELDS.md`.

### `MASTER-003O-PAYMENT-FORM` — PC-B — `READY_FOR_REVIEW`

- ورودی «کد روش» و «نام انگلیسی» فقط از فرم ایجاد/ویرایش/مشاهده روش‌های پرداخت حذف شدند؛
  سایر فرم‌ها، Catalog مرجع و ستون‌های Export بدون تغییر باقی می‌مانند.
- فهرست فیلدهای فرم از Catalog جدا شد؛ دو فیلد حذف‌شده در state یا payload ویرایش خالی
  نمی‌شوند، بنابراین کد و نام انگلیسی ذخیره‌شده قبلی حفظ می‌شوند.
- ایجاد روش پرداخت بدون code از تولیدکننده موجود کد یکتای Backend استفاده می‌کند؛ کد
  صریح مصرف‌کننده قدیمی همچنان پذیرفته/اعتبارسنجی می‌شود و شکل پاسخ تغییر نکرده است.
- تغییر الزامی‌بودن code سازگار و افزایشی است؛ producer/consumer و رفتار Update در
  `WORK_ASSIGNMENTS.md` ثبت شده‌اند. Schema/Migration/Seed و داده‌های موجود تغییر نکردند.
- Web: `155/155` و API: `245/245` تست موفق؛ شامل نبود دو فیلد، حفظ Export و سایر فرم‌ها،
  ایجاد بدون کد، رفع برخورد نام/کد، سازگاری کد صریح و حفظ مقادیر قبلی هنگام ویرایش.
- typecheck و Production Build هر دو برنامه، lint فایل‌های Web متاثر و کل API موفق؛
  `git diff --check` و Scope/Secret-pattern scan موفق‌اند. ایراد پیشین DatePicker مشترک خارج از Scope است.
- API محلی پس از تغییر Source توسط watcher راه‌اندازی مجدد شده و Health پاسخ ۲۰۰ می‌دهد؛
  Web بدون Session به Login سالم با پاسخ ۲۰۰ می‌رود. Smoke احراز‌شده ادعا نمی‌شود؛ سرورها روشن‌اند.
- Parent #42 / `495af50` و قفل‌های `PC-B/MASTER-003` ثابت‌اند؛ Draft PR روی
  `codex/pc-b-master-data-clean-labels` و وابسته به #42 و زنجیره #25 است؛ پیش از والد Merge نشود.

### `MASTER-003N-CLEAN-LABELS` — PC-B — `READY_FOR_REVIEW`

- متن فنی اعتبارسنجی Backend/Audit از بالای فرم‌های واقعی و نشان نسخه قرارداد از
  فرم‌های واقعی/Preview حذف شد؛ اعتبارسنجی، ذخیره‌سازی، Audit و Contract تغییر نکردند.
- نشان «Backend واقعی · مشترک بین شرکت‌ها» در مالی و جغرافیا و نمونه جداگانه نشان
  Backend/توضیح scope در نمای عمومی Master Data حذف شدند؛ سایر ماژول‌ها دست‌نخورده‌اند.
- عنوان دسترس‌پذیر Dialog، توضیح نمای فقط‌خواندنی، نسخه رکورد و هشدار Preview حفظ شدند؛
  فرم بدون توضیح به شناسه توضیح ناموجود ارجاع نمی‌دهد و نوار خالی نشان‌ها باقی نمی‌ماند.
- Web tests: `151/151` و typecheck موفق؛ تست بازگشت، همه کامپوننت‌های Master Data را پوشش می‌دهد.
- lint هر شش فایل تغییرکرده و Production Build موفق؛ هر هشت HTML زیرمجموعه اطلاعات پایه
  بدون متن/برچسب‌های حذف‌شده ساخته شدند. `git diff --check` و Scope/Secret-pattern scan موفق‌اند.
- API Health پاسخ ۲۰۰ و Web بدون Session به Login سالم پاسخ ۲۰۰ می‌دهد؛ سرورها روشن‌اند.
  Smoke احراز‌شده انجام نشد؛ ایراد قدیمی lint تقویم مشترک خارج از محدوده این اصلاح باقی است.
- والد #40 / `808ca13` و قفل‌های `PC-B/MASTER-003` ثابت‌اند؛ PR باید Draft و روی شاخه
  `codex/pc-b-master-data-currency-form` باشد و پیش از والد #40 و زنجیره #25 Merge نشود.

### `MASTER-003M-CURRENCY-FORM` — PC-B — `READY_FOR_REVIEW`

- فرم اختصاصی ارز: نام فارسی/انگلیسی، ISO، نماد، تعداد اعشار و وضعیت؛ سیاست نمایش از
  فرم و پروفایل حذف شد، ولی مقدار ذخیره‌شده قبلی و پیش‌فرض Database حفظ می‌شوند.
- ثبت نرخ خرید/فروش، ارز مقابل، منبع، تاریخ/ساعت و بازه اعتبار در همان Popup؛ تاریخچه
  مستقل باقی می‌ماند. ارز پایه فقط‌خواندنی و در انتظار قرارداد واقعی Finance است.
- endpoint افزایشی `/api/v1/master-data/currency-rates/quotes` نرخ‌های ارسالی و Audit را
  در یک تراکنش ثبت می‌کند؛ Decimal تا ۱۰ اعشار، UTC، مجوز، DRAFT و `isAuthoritative=false`.
- ثبت‌کننده از Session تعیین می‌شود؛ وضعیت تأیید از فرم قابل تحمیل نیست. نام نمایشی
  کاربر تا اتصال قرارداد عمومی هویت موجود نیست و نتیجه ثبت، شناسه واقعی کاربر را نشان می‌دهد.
- تست‌ها، محدودیت Smoke احراز‌شده و خطای پیشین lint مشترک در گزارش همین کار ثبت شده‌اند.
- والد #39 و سه قفل فعال `PC-B/MASTER-003` دست‌نخورده‌اند؛ Dependency/Lockfile آزاد است.
- جزئیات: `docs/tasks/MASTER-003M-CURRENCY-FORM.md`.

### `MASTER-003L-SECTION-CLEANUP` — PC-B — `READY_FOR_REVIEW`

- شرکت اتوبوس، نوع اتوبوس و CIP از رابط تور و خدمات سفر حذف شدند؛ چهار تب لیدرها،
  نوع تور، نوع ترانسفر و ویزا باقی ماندند. اتوبوس فقط در حمل‌ونقل نمایش داده می‌شود.
- نوع مشتری، منبع سرنخ و نوع کمپین از مراجع فروش حذف شدند؛ نحوه آشنایی، کانال فروش،
  دلیل از دست رفتن و Tag باقی ماندند. متن و شمارنده کارت‌های Hub هماهنگ شدند.
- داده‌ها و قرارداد هر ۴۵ منبع حفظ شده‌اند؛ موارد بدون ورودی ناوبری صریحاً ثبت شده‌اند.
- Web tests: `133/133`، typecheck، lint فایل‌های تغییرکرده و Production Build موفق؛
  خروجی HTML ساخته‌شده دقیقاً چهار تب و چهار زیرمجموعه در هر یک از دو بخش دارد.
- Full Web lint فقط همان خطا/هشدار پیشین `date-picker.tsx` را گزارش می‌کند؛ فایل تغییر نکرد.
  مرورگر بدون Session به Login می‌رود؛ Smoke احراز‌شده در این اصلاح ادعا نمی‌شود.
- سه قفل فعال `PC-B/MASTER-003` و وضعیت آزاد Dependency/Lockfile تغییر نکرده‌اند.
- جزئیات: `docs/tasks/MASTER-003L-SECTION-CLEANUP.md`.

### `MODULES-FOUNDATION-001` — PC-A — `READY_FOR_REVIEW`

- ۱۲ Workspace باقی‌مانده با UI مشترک فارسی، RTL، Responsive، KPI، navigation داخلی،
  جست‌وجو، فیلتر، sort، pagination، Preview CRUD، stateها، permission، audit و reference
  بین‌ماژولی تکمیل شد؛ Customers، Customer Affairs، Finance، Master Data و IAM حفظ شدند.
- Dashboard برای صف‌های فروش، رزرواسیون، ظرفیت، مالی و مدیریت تکمیل و Sidebar در برابر
  overflow افقی و محوشدن عنوان سخت‌سازی شد.
- lint، typecheck، test و production build کل Monorepo پاس شدند؛ ۱۷۸ تست Web/API
  و ۲۵ تست package/worker پاس شدند. هر ۱۷ route در HTTP smoke پاسخ 200 و HTML معتبر داد.
- QA مرورگر داخلی به‌علت خروج ناگهانی trusted browser process ممکن نشد؛ build و HTTP
  smoke مطابق قرارداد Task جایگزین شدند.
- Prisma/Migration/Seed، Dependency/Lockfile، Persistence، Secret/PII و artifact جعلی
  تغییری نکردند؛ اتصال واقعی Provider/Worker/Documents/Reporting همچنان Deferred است.

### `MASTER-002` — PC-B — `DONE`

- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` وارد
  `origin/develop` شد.
- Persistence، REST، قرارداد عمومی و UI واقعی Master Data تحویل شدند.
- چهار قفل Migration، Dependency/Lockfile، Master shared-contract و اسناد مرکزی آزاد شدند.

### `CUSTOMER-001` — PC-A — `DONE/MERGED`

- PR شماره ۱۹ با Source HEAD `19cb597cd9c4137021bc53e3f85d4cd682de51de` و
  Merge Commit `7d0a4f42e978b468263efdc83f780fa656fbd613` وارد `develop` شد.
- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  به‌صورت `DONE/MERGED` وارد `origin/develop` شد.
- فاز B از baseline قطعی `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb` روی شاخه
  `codex/pc-a-customer-persistence` تکمیل شد؛ اصلاحات Review در Commitهای `c85de3d`،
  `004b9cb` و `6e6df8c` روی همان Draft PR شماره ۱۹ قرار دارند.
- Migration اصلی `20260824093000_customer_persistence` byte-for-byte دست‌نخورده ماند؛
  Migration افزایشی `20260824113000_customer_contact_encryption_hardening` ستون‌ها،
  constraintها و indexهای رمزنگاری Contact را بدون عملیات مخرب اضافه کرد.
- Contact با AES-256-GCM و کلید نسخه‌دار ذخیره می‌شود؛ fingerprint از HMAC-SHA-256 با
  کلید مستقل ساخته می‌شود. reveal فقط با `customers.sensitive.read` و Audit مستقل است.
- Auditهای Customer/Contact/Address/Consent/Companion/Duplicate فقط snapshot allowlist دارند؛
  duplicate query نیز branch-scoped، index-backed و محدود به ۵۰ کاندید است.
- قرارداد عمومی به `customers.v2` ارتقا یافت. migration deploy/status، Seed دوگانه، lint،
  typecheck، build و ۱۲۰ تست Monorepo پاس شدند؛ Dependency/Lockfile تغییری نکرد.
- سه تنظیم blank-only در `.env.example`، `apps/api/.env.example` و validation رزرو و ثبت شدند:
  `CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64`، `CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64` و
  `CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION`. Fixtureها کاملاً ساختگی هستند.
- `DEC-OPEN-006` و `DEC-OPEN-011` باز می‌مانند. نگهداری مدرک حساس، auto-merge و
  merge واقعی ممنوع‌اند؛ فقط Candidate Detection و Review دستی ثبت و Audit می‌شوند.
- نرخ ارز authoritative و تولید واقعی Excel/PDF خارج از این Handoff باقی می‌مانند.

### `CUSTOMER001-FINANCE-HANDOFF-001` — PC-A — `DONE`

- PR شماره ۲۰ با Merge Commit `11fc875` وارد `origin/develop` شد.
- چهار قفل Migration، Dependency/Lockfile، Customer shared-contract/export و اسناد مرکزی
  پس از Merge PR #19 از CUSTOMER-001 آزاد می‌شوند.
- Migration Owner، Dependency/Lockfile Owner مشروط، Finance shared-contract/export و اسناد
  مرکزی برای PC-A/FINANCE-001 رزرو می‌شوند؛ هیچ قفلی به PC-B منتقل نشده است.
- `FINANCE-001` با Foundation و حل تصمیم‌ها آغاز می‌شود. `DEC-OPEN-001/004/005/016`
  Gate قطعی هر Schema، Migration، posting model، FX/tax و approval workflow هستند.
- Finance فقط قرارداد عمومی ماژول‌های دیگر را مصرف می‌کند؛ query مستقیم جدول‌های Customers،
  Sales، Reservations، Procurement یا HR ممنوع است.
- این Handoff فقط مستندات است و هیچ dependency، lockfile، Schema یا Migration تغییر نمی‌دهد.

### FINANCE-001 — PC-A — DONE/MERGED

- PR شماره ۲۱ با Merge Commit `45c107e471d53d1c724303de02ba01a5e0e16b2a` وارد `origin/develop` شد.
- هیچ `FINANCE-002`، PR باز Finance یا Branch فعال Finance Persistence وجود ندارد.
- Migration، Dependency/Lockfile و اسناد مرکزی stale آن آزاد شدند؛ Dependency/Lockfile
  تخصیص‌نیافته ماند و Migration/اسناد مرکزی به `LEGAL-ENTITY-CONTEXT-001` منتقل شدند.
- مالک محصول و کسب‌وکار در 2026-08-24 هر چهار Decision مالی `DEC-OPEN-001/004/005/016`
  را رسماً پذیرفت؛ این موارد دیگر تصمیم باز نیستند.
- پذیرش Decisionها Scope Phase A را توسعه نمی‌دهد: Prisma Schema، Migration، Repository،
  Persistence، Dependency و Lockfile همچنان در این PR بدون تغییر می‌مانند.
- پس از Merge PR #21، ایجاد Schema و Migration افزایشی مالی فقط در Task مستقل Phase B،
  با رزرو مجدد قفل‌ها و اجرای Migration gate کامل، مجاز خواهد بود.
- قرارداد عمومی finance.v1-proposal، producer/consumer eventهای versioned، Permission
  Matrix و Domain/Application Port بدون Controller یا Persistence تکمیل شدند.
- Money/Decimal، rounding، Journal balance، Check lifecycle، Maker/Checker، Release policy،
  optimistic concurrency و idempotency با تست پوشش داده شدند.
- مسیر /finance اکنون Workspace فارسی/RTL/Responsive با Dashboard، ۳۰ قابلیت قابل جست‌وجو،
  فیلتر، sort، pagination، فرم‌های Preview، stateهای کامل و route خروجی Excel/PDF است.
- lint، typecheck و build کل Monorepo پاس شدند؛ ۱۷۲ تست در ۵۱ فایل پاس شد و /finance در
  Production Build تولید شد.
- Dependency/Lockfile، Prisma، Migration و Seed تغییر نکردند. داده‌ها فقط synthetic هستند.
- QA مرورگر داخلی به‌دلیل خطای ACL ابزار Windows و redirect احراز هویت انجام نشد؛ HTTP
  redirect و Production Build route تایید شدند و dev server موقت متوقف شد.

### `LEGAL-ENTITY-CONTEXT-001` — PC-A — `DONE/MERGED`

- PR #24 با Source HEAD `6f475c03eebc6379fc8be47a48eb0751d58f2d89` و Merge Commit
  `b6da5d6300716a189958bc37d31ca195f0304dc5` وارد `origin/develop` شد.
- Migration، Legal Entity shared-contract/root export و اسناد مرکزی با دلیل
  `DONE/MERGED via PR #24` آزاد شدند؛ Dependency/Lockfile از قبل آزاد بود.

### `MASTER-003 Phase A` — PC-B — `DONE / READY_FOR_REVIEW`

- Branch مستقیماً از `origin/develop@b6da5d6` ساخته شد و Frozen Install بدون تغییر Lockfile پاس شد.
- Migration Owner، Master Data shared-contract/root export و اسناد مرکزی برای MASTER-003 رزرو شدند.
- `fflate@0.8.3` پس از اثبات نیاز، Pin و با فایل واقعی بدروم آزموده شد؛ قفل Dependency/Lockfile سپس آزاد شد.
- Import واقعی هتل با قالب `HOTEL_IMPORT_V1`، Preview Token، Idempotency، Commit اتمیک،
  کاتالوگ Meal/Room/Facility و UI متصل پیاده‌سازی شد.
- فایل واقعی `hotel-data-بدروم.xlsx` روی PostgreSQL 18.1 با نتیجه ۲۲ ایجاد، صفر خطا
  و صفر تکراری آزموده شد؛ دیتابیس موقت پس از آزمون حذف شد.
- Review رسمی PR #25 روی همان Draft/Branch اعمال شد: اعتبارسنجی runtime DTO، رد کامل
  External Relationship/Data در OOXML و منع update/status عمومی نرخ ارز سخت‌سازی شدند.
- پذیرش production-like و session واقعی: Preview فایل ۲۲ ردیفی، Commit اول ۲۲ ایجاد،
  فایل دوم ۲۲ Skip، rollback اتمیک، تعارض هم‌زمان ۲۰۱/۴۰۹ و `/master-data` با پاسخ ۲۰۰.
- ورود دستی کد یکتا از تمام فرم‌های اطلاعات پایه حذف شد؛ Backend کد داخلی یکتا را
  از نام رکورد تولید می‌کند و ویرایش آن ممنوع است. در Import هتل نیز شناسه خالی
  به‌صورت خودکار تولید می‌شود و فایل‌های قدیمی دارای شناسه سازگار باقی مانده‌اند.
- توضیح فرعی PageHeader و Alert فنی Persistence از بالای صفحه اطلاعات پایه حذف شدند
  تا کاربر مستقیماً کاتالوگ بخش‌ها را ببیند.
- فرم‌های Create/View/Edit اطلاعات پایه از Drawer کناری به Dialog وسط صفحه منتقل شدند؛
  فیلد و selector سازمان هتل نیز از فرم هتل حذف شد.
- خروجی واقعی XLSX برای همه منابع اطلاعات پایه با فیلتر و مرتب‌سازی جاری، چیدمان RTL،
  سقف ۱۰٬۰۰۰ ردیف، کنترل مجوز و Audit فعال شد؛ PDF آرشیوی همچنان منتظر Documents/Worker است.
- Scanner مستقل آنتی‌ویروس و Documents برای تصاویر هنوز متصل نیستند و وضعیت آن‌ها
  صریحاً `UNAVAILABLE`/در انتظار گزارش می‌شود.
- Scope توسعه افزایشی MASTER-002 شامل Master Data مشترک دو شرکت، نرخ مرجع غیر authoritative،
  کاتالوگ‌های پیشرفته، Import امن Excel، UI واقعی و تست کامل است.
- این وضعیت فقط Phase A شامل نرخ ارز پیشرفته، Import امن هتل، کاتالوگ‌های موجود و UI
  فعلی را می‌بندد؛ کل اطلاعات پایه Complete نیست و ادامه در `MASTER-004` برابر `PLANNED` است.
- مانع lint مربوط به `no-control-regex` بدون Disable/Suppress و با بررسی صریح code point
  رفع شد؛ C0های ممنوع حذف و TAB/CR/LF و DEL طبق Policy قبلی حفظ می‌شوند.
- ادامه Suppliers روی Branch مستقل وارد PR #25 نمی‌شود و با وضعیت
  `PAUSED_FOR_CUSTOMER_002B_MIGRATION_HANDOFF` باقی می‌ماند.
- Migration و Central Docs برای `PC-A/CUSTOMER-002B` رزرو شده‌اند، اما فقط پس از Merge
  ترتیبی PRهای #25، #26 و #27 و Handoff نهایی فعال می‌شوند. Customer shared-contract/root
  export نیز با همین Gate رزرو است؛ Master shared-contract پس از Merge #25 پایدار و
  `RELEASED` و Dependency/Lockfile همچنان `RELEASED` خواهد بود.
- مرجع Handoff: [MASTER-003-HANDOFF.md](tasks/MASTER-003-HANDOFF.md). برنامه ادامه:
  [MASTER-004.md](tasks/MASTER-004.md).

### `MASTER-003B-GEO` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-next` دقیقاً از Remote Parent
  `origin/codex/pc-b-master-data-advanced@f0d3b8c4` ساخته شد و Parent Branch
- Draft PR #28 با Base `codex/pc-b-master-data-advanced` ایجاد شد و تا Merge
  PR #25 نباید ادغام شود؛ سپس Base آن به `develop` تغییر می‌کند.
  دست‌نخورده ماند.
- Migration افزایشی `20260827090000_master_data_geography` مدل‌های Region، Airport
  و Terminal و توسعهٔ غیرمخرب City را اضافه می‌کند؛ ISO/IATA/ICAO، مختصات،
  same-country hierarchy و delete restrict در PostgreSQL enforce می‌شوند.
- Contract عمومی به `master-data.v5` ارتقا یافت و Backend/Frontend واقعی پنج منبع
  جغرافیا با Search/Filter/Sort/Pagination، Create/View/Edit، Status، Optimistic Lock،
  Audit، Permission و UI فارسی RTL responsive تکمیل شد.
- داده جغرافیا global است؛ هیچ Legal Entity filter یا branch ownership روی رکوردها
  اعمال نمی‌شود و branch فقط در Audit metadata ثبت می‌گردد.
- همه ۱۰ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه، constraint test و smoke
  احراز‌شده login + پنج API + `/master-data` با HTTP 200 پاس شدند؛ دیتابیس موقت
  پس از آزمون حذف شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده است. این Slice زیر
  همان سه قفل فعال `PC-B/MASTER-003` باقی می‌ماند و PR آن باید Draft و stacked روی
  PR #25 باشد.
- full typecheck، ۳۱۶ تست در ۷۷ فایل و production build کل Monorepo پاس شدند؛ lint
  همه فایل‌های Slice نیز پاس است. full lint فقط روی DatePicker بدون تغییر Parent
  متوقف می‌شود و برای حفظ Vertical Slice وارد این PR نشده است.

### `MASTER-003C-FINANCIAL` — PC-B — `READY_FOR_REVIEW`

- «مالی و پولی» زیرمجموعه Master Data در `/master-data/finance` است و شش نمای واقعی
  ارزها، تاریخچه نرخ، گردش تأیید، بانک‌ها، شعب بانک و روش‌های پرداخت مرجع دارد.
- Migration افزایشی `20260829100000_master_data_financial_reference` سیاست نمایش ارز،
  نام انگلیسی/SWIFT بانک، شعبه مستقل و روش پرداخت مرجع را بدون عملیات مخرب اضافه می‌کند.
- نرخ‌ها همچنان تاریخچه مستقل، Decimal مثبت با حداکثر ۱۰ اعشار، Maker/Checker، Audit،
  Optimistic Lock و `isAuthoritative=false` دارند؛ Seed نرخ عمداً خالی است.
- حساب، شبا، کارت، CVV، مانده، تسویه، تراکنش و پیکربندی درگاه وارد Master Data نشده‌اند
  و هیچ Query مستقیمی به جداول Finance وجود ندارد.
- همه ۱۱ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و Constraintهای SWIFT، کد
  شعبه، ترتیب روش پرداخت و خالی‌بودن Seed نرخ با موفقیت آزموده شدند.
- هیچ فایل Customers، manifest یا lockfile تغییر نکرده است؛ آیکن/لوگوی بانک تا قرارداد
  رسمی Documents به‌صورت upload جعلی پیاده‌سازی نشده است.
- Branch `codex/pc-b-master-data-financial` دقیقاً روی
  `origin/codex/pc-b-master-data-next@e0e3a5f` پشته شده است؛ Draft PR #29 با Base همین
  Branch ایجاد شد و قبل از Merge والدهای #28 و #25 نباید ادغام یا به `develop` منتقل شود.

### `MASTER-003D-UI-POLISH` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-ui-polish` از
  `origin/codex/pc-b-master-data-financial@e7e6180` ساخته شد و PR مالی #29 را تغییر
  نمی‌دهد.
- Draft PR #30 با Base همان Branch مالی ایجاد شد و تا Merge والدهای #29، #28 و #25
  نباید ادغام شود.
- کارت KPI مشترک با شش رنگ پاستلی، آیکن معنایی، Dark Mode و چینش Responsive به همه
  Workspaceهای اطلاعات پایه اضافه شد.
- KPIهای شش نمای مالی و پنج نمای جغرافیا دقیقاً با نام‌های ماکاپ نمایش داده می‌شوند؛
  مقادیر فاقد قرارداد واقعی Finance/Aggregate با `—` مشخص‌اند و عدد ساختگی ندارند.
- جغرافیا اکنون پنج تب کشور، استان/ناحیه، شهر، فرودگاه و ترمینال، فیلترهای رابطه‌ای،
  جدول تخصصی، قاعده یکپارچگی، عملیات واقعی و Export دارد.
- خط رنگی پایین کارت‌های Hub در Hover حذف شد؛ حرکت و Focus Ring دسترس‌پذیر حفظ شدند.
- تست کامل Repository برابر ۳۳۵ تست، Typecheck کل Monorepo و Production Build موفق
  است. Lint فایل‌های تغییرکرده موفق است؛ Full Web Lint فقط روی ایراد قدیمی و دست‌نخورده
  `apps/web/src/components/ui/date-picker.tsx` متوقف می‌شود.
- Database، Migration، Backend، Contract، Customers، Dependency و Lockfile در این
  Slice تغییر نکردند.

### `MASTER-003E-SUPPLIERS` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-suppliers` از
  `origin/codex/pc-b-master-data-ui-polish@920328e` ساخته شد و PR والد #30 را تغییر
  نمی‌دهد.
- Draft PR #31 با Base همان Branch والد ساخته شد و پیش از Merge زنجیره
  #30 ← #29 ← #28 ← #25 نباید ادغام شود.
- شش نمای دقیق تأمین‌کنندگان، پروفایل تأمین‌کننده، کارگزاران، پروفایل کارگزار،
  اطلاعات تماس و وضعیت همکاری در `/master-data/organizations-suppliers` پیاده‌سازی شدند.
- Migration افزایشی `20260829133000_master_data_suppliers` پروفایل Supplier، خدمات
  رابطه‌ای Supplier/Broker و مخاطبان چندگانه را با FK محدودکننده اضافه می‌کند.
- Contactهای سازمانی فقط رمز‌شده/Mask/Fingerprint ذخیره می‌شوند؛ Unmask مجوز مستقل،
  Audit و Mask مجدد خودکار دارد و plaintext وارد List، Excel یا Audit نمی‌شود.
- KPIها با نام و آیکن ماکاپ از Summary واقعی Backend تغذیه می‌شوند؛ تعداد قرارداد که
  متعلق به Procurement است بدون جعل قرارداد با `—` نمایش داده می‌شود.
- همه ۱۲ Migration روی PostgreSQL 18 خالی، Seed دوگانه و رد زنده داده Contact نامعتبر
  موفق بودند؛ Seed هیچ Supplier، Contact، Contract یا Provider ساختگی اضافه نمی‌کند.
- Lint، Typecheck، Production Build و همه `349/349` تست Repository موفق هستند و مسیر
  `/master-data/organizations-suppliers` در خروجی SSG ساخته می‌شود.
- هیچ Query مستقیمی به Procurement، Finance یا Integrations و هیچ تغییری در Customers،
  dependency manifest یا lockfile وجود ندارد.

### `MASTER-003F-ACCOMMODATION` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-accommodation` از
  `origin/codex/pc-b-master-data-suppliers@02d4101` ساخته شد و PR والد #31 را تغییر
  نمی‌دهد.
- Draft PR #32 با Base `codex/pc-b-master-data-suppliers` ایجاد شد و پیش از Merge
  زنجیره #31 ← #30 ← #29 ← #28 ← #25 نباید ادغام شود.
- هفت نمای کاتالوگ اقامت شامل هتل‌ها، زنجیره، نوع اتاق، وعده/سرویس، امکانات، ورود
  گروهی Excel و هتل ترکیبی در `/master-data/accommodation` به Backend واقعی متصل
  هستند؛ پروفایل هتل طبق MASTER-003G از فهرست در Popup باز می‌شود.
- Migration افزایشی `20260829150000_master_data_accommodation` زنجیره هتل، روابط
  چندبه‌چند Meal/Room/Facility و هتل ترکیبی/اعضا را اضافه و مشخصات هتل را با وب‌سایت،
  زمان ورود/خروج، مختصات و لوگوی مرجع توسعه می‌دهد.
- Check Constraintهای زمان، جفت و بازه مختصات، ترتیب نمایش و اولویت عضو و همه FKهای
  جدید با `ON DELETE RESTRICT` در PostgreSQL اعمال می‌شوند؛ Migration دادهٔ قدیمی
  Meal/Room را بدون حذف به روابط جدید backfill می‌کند.
- Contract عمومی `master-data.v8` شامل ۲۵ منبع و Summary واقعی اقامت است. KPIهای
  هر شش کاتالوگ دقیقاً با نام و آیکن ماکاپ از Aggregate واقعی Backend تغذیه می‌شوند.
- قرارداد، نرخ خرید، موجودی، Voucher و تخصیص مسافر جعل نشده‌اند؛ این داده‌ها در
  Procurement/Reservations باقی می‌مانند و مرجع Documents تا قرارداد رسمی با `—`
  یا وضعیت در انتظار نمایش داده می‌شود.
- همه ۱۳ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و Constraintهای زنده زمان،
  مختصات، ترتیب و اولویت موفق‌اند؛ Seed هیچ Hotel/Chain/Composite یا قرارداد ساختگی
  اضافه نمی‌کند.
- Frozen install، Prisma format/validate/generate، Lint فایل‌های Slice، Typecheck و
  Production Build و هر `366/366` تست Repository موفق‌اند. Full Web Lint فقط روی
  ایراد قدیمی و خارج از Slice در
  `apps/web/src/components/ui/date-picker.tsx` متوقف می‌شود.
- هیچ فایل Customers، dependency manifest یا lockfile و هیچ جدول عملیاتی ماژول دیگر
  تغییر نکرده است.

### `MASTER-003G-UX-CONSOLIDATION` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-ux-consolidation` از HEAD تأییدشده PR #32
  ساخته شد و شاخه‌های والد یا PC-A را تغییر نمی‌دهد.
- Draft PR #33 با Base `codex/pc-b-master-data-accommodation` ایجاد شد و پیش از PR
  #32 یا سایر والدهای پشته Merge نمی‌شود.
- تاریخچه و نمودار نرخ داخل Popup جزئیات ارز قرار گرفت و با انتخاب ارز، جفت/نوع نرخ
  و بازه زمانی از Backend واقعی خوانده می‌شود؛ تب مستقل تاریخچه حذف شد.
- شهر و استان/ناحیه در یک تب بالادستی تجمیع شدند و نوع رکورد در همان صفحه انتخاب
  می‌شود؛ Schema و FKهای مستقل بدون تغییر باقی ماندند.
- پروفایل هتل، تأمین‌کننده و کارگزار با کلیک نام/مشاهده در Dialog مشترک باز می‌شود؛
  تب‌های پروفایل و نمای مستقل اطلاعات تماس از رابط حذف شدند.
- برچسب `MASTER-003 · PC-B` از Header صفحه اصلی حذف و شمارنده‌های Hub با نماهای
  قابل مشاهده هماهنگ شدند.
- ESLint تمام فایل‌های Slice، Typecheck و Production Build موفق‌اند؛ هر `366/366`
  تست Repository پاس شد. API Health پاسخ ۲۰۰ و Routeهای محافظت‌شده پاسخ ۳۰۷ به Login
  می‌دهند.
- Full Web Lint فقط به‌علت خطای قدیمی `react-hooks/set-state-in-effect` و هشدار
  `aria-required` در `apps/web/src/components/ui/date-picker.tsx` خارج از این Slice
  متوقف می‌شود.
- هیچ فایل Customers، Prisma/Migration/Seed، API/Contract، Dependency/Lockfile،
  Secret یا PII تغییر نکرده است.

### `MASTER-003H-TRANSPORT` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-transport` از
  `origin/codex/pc-b-master-data-ux-consolidation@70d97ea` ساخته شد و هیچ شاخه والد
  یا متعلق به PC-A را تغییر نمی‌دهد.
- Draft PR #35 با Base `codex/pc-b-master-data-ux-consolidation` ساخته شد و پیش از
  Merge PR #33 نباید ادغام شود؛ پس از Merge والد Base آن به `develop` تغییر می‌کند.
- Migration افزایشی `20260829170000_master_data_transport` مشخصات دوزبانه ایرلاین،
  نوع هواپیما، کلاس پروازی، قاعده بار، قالب Manifest، شرکت/نوع قطار و شرکت/نوع
  اتوبوس را با FK محدودکننده، Optimistic Lock و Constraintهای واقعی اضافه می‌کند.
- Contract عمومی به `master-data.v9` ارتقا یافت و هر ۹ منبع حمل‌ونقل به Backend واقعی
  Search/Sort/Pagination، Create/Edit، Active/Inactive، Audit، Permission و Export
  متصل شدند.
- Workspace فارسی RTL Responsive مطابق ماکاپ ۹ تب و KPIهای پاستلی هم‌نام دارد؛ تب
  مستقل پروفایل ایرلاین وجود ندارد و پروفایل همه ردیف‌ها از نام یا دکمه مشاهده در
  Popup باز می‌شود.
- Credential/Secret اتصال Provider، موجودی/قیمت/رزرو، قرارداد/تسویه و Manifest مسافر
  وارد Master Data نشده‌اند؛ Connection یا Documents فاقد قرارداد با `—`/وضعیت
  در انتظار نمایش داده می‌شود و Seed حمل‌ونقل عمداً خالی است.
- تمام ۱۴ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migration روی
  دیتابیس محلی Deploy و Seed دو بار بدون ایجاد داده ساختگی اجرا شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده و سه قفل فعال
  Migration/Contract/Docs همچنان زیر `PC-B/MASTER-003` باقی می‌مانند.

### `MASTER-003I-SALES-REFERENCES` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-sales-references` از
  `origin/codex/pc-b-master-data-transport@1049928` ساخته شد و روی Draft PR #35 پشته
  می‌شود؛ هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Draft PR #36 با Base `codex/pc-b-master-data-transport` ساخته شد و پیش از Merge
  PR #35 و تمام والدهای آن نباید ادغام شود؛ پس از Merge والد، Base مطابق زنجیره به
  `develop` تغییر می‌کند.
- Migration افزایشی `20260829190000_master_data_sales_references` شش کاتالوگ جدید
  Lead Source، Sales Channel، Lost Reason، Customer Type، Tag و Campaign Type را
  اضافه و کاتالوگ موجود Acquaintance Method را با نام انگلیسی و ترتیب نمایش تکمیل
  می‌کند؛ Check واقعی ترتیب نامنفی و رنگ Hex Tag و Unique Code فعال است.
- Contract عمومی به `master-data.v10` ارتقا یافت و هر هفت مرجع به Backend واقعی
  Search/Sort/Pagination، Create/Edit، Active/Inactive، Optimistic Lock، Audit،
  Permission و Export متصل شدند.
- Workspace فارسی RTL Responsive مطابق ماکاپ هفت تب و چهار KPI پاستلی هم‌نام دارد.
  هیچ تب پروفایل مستقلی وجود ندارد و جزئیات هر ردیف از نام یا دکمه مشاهده در Popup
  مشترک باز می‌شود.
- شمارنده استفاده به‌دلیل مالکیت آن توسط Consumer Aggregate و ممنوعیت Query مستقیم
  Customers/Sales صادقانه با `—` نمایش داده می‌شود؛ پس از قرارداد عمومی نسخه‌دار قابل
  اتصال است. Seed این Slice عمداً هیچ مرجع ساختگی اضافه نمی‌کند.
- تمام ۱۵ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migration روی
  دیتابیس محلی Deploy و Seed دو بار اجرا شد. هیچ فایل Customers، dependency manifest
  یا lockfile تغییر نکرده و سه قفل MASTER-003 فعال می‌مانند.
- Full Test شامل API `204/204`، Web `120/120`، Database `42/42`، Contracts `14/14`
  و سه تست سایر بسته‌ها موفق بود؛ Full Typecheck و Production Build نیز پاس شدند.
  Smoke احراز‌شده API و `/master-data/sales-references` هر دو پاسخ ۲۰۰ دادند. Lint
  فایل‌های دو Workspace حمل‌ونقل و مراجع فروش موفق است؛ Full lint فقط به‌دلیل ایراد
  قدیمی DatePicker خارج از این Slice متوقف می‌شود.

### `MASTER-003J-INSURANCE` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-insurance` از
  `origin/codex/pc-b-master-data-sales-references@fbc423d` ساخته شد و روی Draft PR
  #36 پشته می‌شود؛ هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Draft PR #37 با Base `codex/pc-b-master-data-sales-references` ساخته شد و پیش از
  Merge PR #36 و تمام والدهای آن نباید ادغام شود؛ پس از Merge والد، Base مطابق
  زنجیره به `develop` تغییر می‌کند.
- دو Migration افزایشی بیمه، Insurer را با Country و نام انگلیسی تکمیل و مدل‌های
  Insurance Plan، Coverage و رابطه چندبه‌چند آنها را با FK محدودکننده، Check مبلغ،
  سن، اعتبار و Version اضافه می‌کنند؛ عملیات مخرب وجود ندارد.
- Contract عمومی به `master-data.v11` و ۴۱ Resource ارتقا یافت. سه کاتالوگ شرکت‌های
  بیمه، طرح‌ها و پوشش‌ها به API واقعی، Permission، Audit، Optimistic Lock، Export،
  Search/Filter/Sort/Pagination و Summary واقعی متصل‌اند.
- Workspace فارسی RTL Responsive مطابق ماکاپ سه تب و KPIهای پاستلی هم‌نام دارد؛
  مشاهده جزئیات فقط Popup است و هیچ صفحه مستقل پروفایل ساخته نشده است.
- Pricing، Policy، Passenger، Reservation، Provider و Documents در مالکیت ماژول‌های
  مربوط باقی مانده‌اند؛ Query مستقیم بین‌ماژولی و Seed عملیاتی/ساختگی اضافه نشده است.
- تمام ۱۷ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migrationها
  روی دیتابیس محلی Deploy شدند. هیچ فایل Customers، dependency manifest یا lockfile
  تغییر نکرده و سه قفل MASTER-003 فعال می‌مانند.
- Full Test شامل API `211/211`، Web `124/124`، Database `46/46`، Contracts `14/14`
  و سه تست سایر بسته‌ها موفق بود؛ Full Typecheck و Production Build نیز پاس شدند.
  Lint تمام فایل‌های این Slice موفق است؛ Full lint فقط به‌دلیل ایراد قدیمی DatePicker
  خارج از این Slice متوقف می‌شود.

### `MASTER-003K-TRAVEL-SERVICES` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-travel-services` از
  `origin/codex/pc-b-master-data-insurance@1a94fca` ساخته شد و روی Draft PR #37
  پشته می‌شود؛ Draft PR #38 ایجاد شد و هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Migrationهای افزایشی `20260829220000_master_data_travel_services` و
  `20260829221000_master_data_travel_bus_connections` چهار کاتالوگ Tour
  Type، Transfer Type، CIP Service و Visa Service را اضافه و Leader را با Location،
  نام انگلیسی، مقصد و تماس رمزنگاری/ماسک‌شده تکمیل می‌کند؛ FK محدودکننده و Check
  ظرفیت، اعتبار، ترتیب و Version فعال است. Bus Company دقیقاً به یک Organization
  یا Provider متصل و Facilityهای Bus Type با رابطه M:N نگهداری می‌شوند.
- Contract عمومی به `master-data.v12` و ۴۵ Resource ارتقا یافت. هفت تب ماکاپ به API
  واقعی، Permission، Audit بدون Ciphertext، Optimistic Lock، Export و Summary واقعی
  متصل‌اند؛ شرکت و نوع اتوبوس در سطح Hub به این بخش تخصیص یکتای UI دارند.
- Workspace فارسی RTL Responsive KPIهای پاستلی هم‌نام و ستون‌های دقیق ماکاپ دارد؛
  مشاهده همه جزئیات، به‌ویژه پروفایل لیدر، فقط Popup است و مسیر مستقل ساخته نشده است.
- اسناد/آدرس/بانک/دستمزد لیدر، پرونده و سند مسافر، قیمت، ظرفیت، Reservation، Voucher،
  قرارداد و Settlement وارد Master Data نشده‌اند؛ شمارنده بدون Public Contract با
  `—` نمایش داده می‌شود و Seed این Slice عمداً خالی است.
- تمام ۱۹ Migration روی PostgreSQL 18 خالی، Constraintهای زنده و Seed دوگانه موفق
  بودند؛ همان Migration روی دیتابیس محلی Deploy و Seed دو بار اجرا شد. هیچ فایل
  Customers، dependency manifest یا lockfile تغییر نکرده است.
- Full Test شامل API `218/218`، Web `129/129`، Database `51/51`، Contracts `14/14`
  و سه تست سایر بسته‌ها، در مجموع `415/415` موفق بود؛ Full Typecheck و Production
  Build نیز پاس شدند. Lint فایل‌های Slice موفق است؛ Full lint فقط به‌دلیل ایراد قدیمی
  DatePicker خارج از این Slice متوقف می‌شود.

### `CALENDAR-001` — PC-B — `READY_FOR_REVIEW`

- کامپوننت مشترک DatePicker با تم آبی و سوییچ بالای تقویم برای شمسی/میلادی ایجاد شد.
- همه ورودی‌های خام `date` و `datetime-local` در Customers، Customer Affairs، Finance
  و Master Data با کامپوننت مشترک جایگزین شدند.
- مقدار ارسالی و ذخیره‌شده همچنان ISO Gregorian است و سوییچ فقط نمایش/انتخاب را تغییر می‌دهد.
- انتخاب ساعت برای فیلدهای datetime حفظ شد؛ ناوبری ماه، امروز، تاریخ انتخاب‌شده،
  بستن با Escape و کلیک بیرون و ویژگی‌های دسترس‌پذیری پوشش داده شدند.
- Web Typecheck، Lint و ۸۵ تست پاس شدند و چهار route متاثر روی dev server پاسخ ۲۰۰ دادند.
- Production build به‌دلیل dev server فعال و قفل `.next` هم‌زمان اجرا نشد؛ dev compilation موفق بود.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده `codex/pc-b-customer-affairs-foundation` و هدف آن Foundation مستقل
  امور مشتریان برای Lead/پیش‌فروش و پشتیبانی پس از فروش است.
- فاز A فقط Frontend فارسی/RTL/Responsive، Domain/Application design، قراردادهای
  ماژول‌محلی و تست‌های هدفمند را شامل می‌شود.
- محدوده آینده PC-B به ماژول/route `customer-affairs` در Web،
  `apps/api/src/customer-affairs/**` بدون Controller فعال یا Repository واقعی و
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` محدود است.
- درخواست مشتری، Lead source، Qualification، نیاز سفر/بودجه، فعالیت/Follow-up،
  Ticket/SLA/Escalation، شکایت، اصلاح، کنسلی/استرداد و رضایت‌سنجی در Scope طراحی
  قرار دارند؛ اتصال Customers/Sales/Reservation فقط proposal ماژول‌محلی است.
- Persistence، Prisma، Migration، Seed، Dependency/Lockfile، قرارداد مشترک و PII
  واقعی ممنوع‌اند.
- قفل‌های مشترک CUSTOMER-001 با Merge `7d0a4f4` آزاد و برای PC-A/`FINANCE-001`
  رزرو شده‌اند؛ PC-B حق تغییر Database، IAM، Master Data، Customers داخلی، Finance
  contract یا اسناد مرکزی را در Task خودش ندارد.

### `IAM-002` — PC-A — `DONE`

- قرارداد عمومی IAM به نسخه ۲ ارتقا یافت و ۵ Permission برای Master Data و ۶ Permission
  برای Customers منتشر شد؛ ۶ Permission قبلی IAM بدون تغییر حفظ شدند.
- Seed دو بار متوالی روی PostgreSQL 18 موفق بود؛ هر ۱۷ Permission یکتا و به نقش
  `administrator` متصل هستند.
- Prisma validate/generate، lint، typecheck، ۴۳ تست در ۱۹ فایل و build تولیدی کل
  Monorepo پاس شدند.
- Schema، Migration، Dependency و Lockfile تغییر نکردند. PR شماره ۱۱ با Merge Commit
  `d1f1133` ادغام و قفل IAM shared-contract آزاد شد.
- PC-B مجاز است `MASTER-002` را Full-Stack آغاز کند و تنها Migration و
  Dependency/Lockfile Owner باشد. PC-A هم‌زمان فقط فاز A بدون Persistence
  `CUSTOMER-001` را آغاز می‌کند.
- Handoff با PR شماره ۱۲ و Merge Commit `0af31c2` وارد `develop` شد.

## برنامه اجرایی Sprint دوم

### `SPRINT2-PLANNING-001` — PC-A — `DONE`

- سه Task آغاز Sprint شامل `IAM-002`، `MASTER-002` و `CUSTOMER-001` با Branch و مرز فایل
  مستقل ثبت شدند.
- `IAM-002` پیش‌نیاز کوتاه انتشار Permission Code و Seed عمومی برای دو دامنه است و هیچ
  Schema، Migration یا Dependency تغییر نمی‌دهد.
- پس از Handoff IAM-002، `MASTER-002` تنها Migration و Dependency/Lockfile Owner می‌شود.
- `CUSTOMER-001` فاز A بدون Persistence موازی است؛ فاز B فقط پس از Merge Master و Handoff
  صریح قفل Migration مجاز خواهد بود.
- نرخ ارز authoritative با `DEC-OPEN-004`، PII حساس با `DEC-OPEN-006` و auto-merge با
  `DEC-OPEN-011` تا تصمیم محصول/امنیت خارج از Scope قطعی هستند.
- مرجع دقیق: `docs/tasks/SPRINT-2-PLANNING.md`.
- PR شماره ۱۰ با Merge Commit `9efb37c` وارد `develop` شد.
- Scoped Prettier، لینک‌های Markdown، تعادل Fence، Scope/Secret scan و
  `git diff --check` پاس شدند؛ هیچ تست یا Build نرم‌افزاری لازم نبود چون Task فقط مستندات است.

## نتیجه نهایی Sprint اول

|  PR | Work Item     | Merge Commit                               | نتیجه                                             |
| --: | ------------- | ------------------------------------------ | ------------------------------------------------- |
|  #5 | `IAM-001`     | `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` | IAM Full-Stack و قرارداد عمومی ادغام شد           |
|  #6 | `MASTER-001`  | `cda0f9a67589974458a4261b753152a796fa1d0b` | Foundation بدون Persistence اطلاعات پایه ادغام شد |
|  #7 | `ARCH-001`    | `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` | معماری تاییدشده گردش سفر و منوی ۱۷ بخشی ادغام شد  |
|  #8 | `UI-ARCH-001` | `543f6e2b2f55833a2d1ae02440a9495f1510a112` | Frontend معماری و دسترسی عملی IAM ادغام شد        |

- منوی اصلی دقیقاً ۱۷ بخش دارد و «مدیریت سیستم» تنها آیتم اصلی IAM/Settings است.
- صفحه `/system` دسترسی عملی به رابط موجود `/users` و مسیر `/settings` فراهم می‌کند؛
  هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند.
- مرحله Foundation بسته شده است؛ Persistence واقعی Master Data قابلیت تکمیل‌شده محسوب
  نمی‌شود و در `MASTER-002` برنامه‌ریزی خواهد شد.

## برنامه Sprint اول

### `UI-ARCH-001` — PC-A — `DONE`

- Merge Commit: `543f6e2b2f55833a2d1ae02440a9495f1510a112` روی `origin/develop`

- منوی اصلی مطابق معماری ۱۷ بخشی تاییدشده بازچینی شد؛ Customer Affairs قبل/بعد،
  Reservation، Ticket Management، Sales و System Management مرز مستقل و روشن دارند.
- نمای معماری ماژول‌های فروش، رزرواسیون، خرید و مالی همراه زنجیره تحویل اطلاعات ایجاد شد.
- صفحات مستقل امور مشتریان، تعریف بلیت و مدیریت سیستم افزوده شدند؛ مسیر قدیمی خدمات مشتریان
  به Customer Affairs هدایت می‌شود.
- صفحه مدیریت سیستم اکنون ورودی عملی به رابط موجود IAM در `/users` و تنظیمات در
  `/settings` دارد؛ هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند و منوی اصلی ۱۷ بخشی
  بدون آیتم مستقل جدید حفظ شده است.
- تغییر فقط در Frontend و اسناد Task است؛ Prisma، Migration، Dependency/Lockfile، IAM و
  فایل‌های `MASTER-001` تغییر نمی‌کنند.
- نصب frozen، ESLint کل Web، Typecheck، نه فایل تست با ۲۶ تست و Production Build پاس شدند.
- خروجی Build شامل ۲۴ Route قابل اجرا است و Smoke احراز‌شده هر ده مسیر اصلی روی پورت ۳۱۰۰
  با HTTP 200 و محتوای مورد انتظار پاس شد؛ `git diff --check` نیز پاس است.

### `ARCH-001` — PC-A — `DONE`

- Merge Commit: `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` روی `origin/develop`
- ساختار ۱۷ بخشی شامل «مدیریت و تعریف بلیت‌ها» و «مدیریت سیستم» ثبت شده است.
- Customer Affairs مالک Lead/Support؛ Sales مالک قرارداد و تخصیص passenger/service؛
  Reservations مالک استعلام/Hold/صدور/Manifest؛ Procurement مالک خرید و Finance مالک
  financial release است.
- رزرواسیون Purchase Request را با قرارداد/service/supplier و قیمت/تخفیف کارگزار ایجاد
  می‌کند؛ Procurement approval/net purchase را مالک و margin از داده approved محاسبه می‌شود.
- مرجع جزئیات: `docs/TRAVEL_WORKFLOW_ARCHITECTURE.md`.
- این Work Item فقط اسناد است و هیچ Schema، Migration، Dependency یا Lockfile تغییر نمی‌دهد.
- Prettier، لینک‌های Markdown، تعادل fenceها، secret/scope scan و `git diff --check` پاس شدند.

### `IAM-001` — PC-A — `DONE`

- Merge Commit: `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` روی `origin/develop`
- ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend/Frontend و Audit امنیتی را Full-Stack پوشش می‌دهد.
- PC-A در طول `IAM-001` مالک انحصاری Migration، Dependency/Lockfile و قراردادهای مشترک IAM بود.
- معیار تحویل شامل Database، API، Frontend، تست‌های permission/security و Handoff
  قرارداد عمومی IAM به مصرف‌کنندگان است.
- Migration `20260822120000_iam_foundation` روی PostgreSQL توسعه اعمال شد؛ Seed دو بار
  متوالی بدون duplicate پاس شد و `prisma migrate status` دیتابیس را up-to-date اعلام کرد.
- Migration غیرمخرب `20260822150000_username_login` ورود case-insensitive با نام کاربری
  اختصاص‌یافته مدیر و ایمیل اختیاری را اضافه کرد و روی PostgreSQL لوکال پاس شد.
- Merge انجام شده و قفل‌های Migration، Dependency/Lockfile و IAM shared-contract در
  2026-08-23 با `SPRINT1-HANDOFF-001` رسماً آزاد شدند.

### `MASTER-001` — PC-B — `DONE`

- Branch: `codex/pc-b-master-data-foundation`
- Merge Commit: `cda0f9a67589974458a4261b753152a796fa1d0b` روی `origin/develop`
- Catalog دوازده‌گانه، UI فارسی/RTL responsive، فرم‌های Create/View/Edit، search/filter/
  sort/pagination و Stateهای Loading/Empty/Error/Permission/Preview تکمیل شد.
- Contractهای ماژول‌محلی list/detail/mutation/status و async Excel/PDF همراه validation،
  error envelope، Permission Matrix و ۲۰ تست پاس‌شده در `develop` قرار دارند.
- Prisma schema/Migration/repository، Backend پایدار، mutation واقعی، نرخ ارز authoritative
  و export artifact تکمیل نشده‌اند و در `MASTER-002` برنامه‌ریزی شده‌اند؛ هنوز هیچ قفل
  Migration یا Dependency به آن Task تخصیص ندارد.
- هیچ manifest، lockfile، Prisma، Migration یا فایل IAM تغییر نکرده است.
- Consumer requirementهای IAM در `docs/tasks/MASTER-001.md` ثبت شده‌اند؛ مصرف
  `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` اکنون از قرارداد عمومی
  `@nora/contracts` انجام می‌شود.

## وضعیت Baseline مشترک

- Technical Bootstrap با Merge Commit `bdb5461` روی `develop` قرار دارد.
- مالکیت Full-Stack ماژول‌ها و Human Resources با Merge Commit `b5b7c5d` ثبت شده است.
- Frontend Foundation و طراحی Dashboard با Merge Commit `c4f8bde` روی `develop` قرار دارد.
- Prisma baseline شامل مدل‌های IAM، branch reference، Session و Audit و دو Migration غیرمخرب
  با Merge Commit `50eacca` وارد `develop` شده است.
- Master Data Foundation بدون persistence با Merge Commit `cda0f9a` وارد `develop` شده است.

## تکمیل‌شده در DOCS-002

- مدل همکاری به Full-Stack برای هر دو PC تغییر کرد؛ تقسیم ثابت Backend/Frontend حذف شد.
- مالکیت نهایی ماژول‌ها و تفکیک Backend/UI گزارش‌ها در `MODULE_OWNERSHIP.md` ثبت شد.
- قفل هم‌زمان Migration Owner، Dependency/Lockfile Owner، فایل مرکزی و API/Event Contract ثبت شد.
- منابع انسانی به منوی اصلی ۱۷ بخشی اضافه و دامنه، مرز، مدل مفهومی، امنیت و گزارش آن مستند شد.
- Employee از Customer/Passenger مستقل و ارتباط HR → Finance به payroll input تاییدشده محدود شد.
- حقوق و دستمزد قانونی و کامل در نسخه اولیه خارج از محدوده باقی ماند.

## تکمیل‌شده در Technical Bootstrap

- pnpm 11 workspace و Turborepo با Node 24، TypeScript strict، ESLint flat config و Prettier
- `apps/web`: Next.js App Router، Tailwind، فارسی/RTL، صفحه اجرا و `/status`
- `apps/api`: NestJS REST، prefix `/api/v1`، Swagger، ValidationPipe، error envelope، request ID،
  CORS قابل تنظیم، logging و graceful shutdown
- endpoint پایه `GET /api/v1/health` با قرارداد مشترک `packages/contracts`
- `apps/worker`: Nest standalone، BullMQ/ioredis، startup Redis health و graceful shutdown
- `packages/database`: Prisma 7، PostgreSQL datasource، Client factory و scriptهای
  format/validate/generate بدون model مصنوعی
- Compose محلی PostgreSQL 18، Redis 8 و MinIO با health check، volume نام‌دار و ساخت bucket
- lockfile pin‌شده و scriptهای root برای dev/build/lint/typecheck/test/database/infrastructure

## وضعیت تاریخی هنگام `DOCS-003`

- در زمان آن Task، قابلیت IAM یا Master Data هنوز پیاده‌سازی نشده و وضعیت هر دو `PLANNED` بود؛
  وضعیت جاری آن‌ها در بخش Sprint اول ثبت شده است.
- خود Commit مستنداتی `DOCS-003` هیچ فایل نرم‌افزاری، Prisma schema، Migration، Seed،
  Dependency یا Lockfile را تغییر نداد.
- Nginx، CI و deployment محیط غیرمحلی هنوز ساخته نشده‌اند.
- تصمیم‌های P0 بازِ `docs/DECISIONS.md` همچنان مانع schema دامنه/مالی و adapter واقعی هستند.

## کنترل کیفیت Technical Bootstrap

- نصب dependency و lockfile supply-chain policy: پاس
- Prisma format، validate و generate روی schema بدون model: پاس
- peer dependency check، ESLint، TypeScript typecheck و Prettier check: پاس
- Vitest: ۷ تست در ۶ suite، همگی پاس
- production build: Web، API، Worker و packageهای buildable پاس؛ routeهای `/` و `/status` static
- Compose config: پاس؛ PostgreSQL/Redis/MinIO healthy و MinIO init با exit 0
- smoke: API health، Swagger JSON، Web status/RTL، MinIO live و Worker→Redis/BullMQ پاس
- `git diff --check` و secret scan در gate نهایی پیش از commit تکرار می‌شوند.

## کنترل کیفیت IAM-001

- Prisma format/validate/generate پاس؛ Migration deploy و status روی PostgreSQL 18 پاس.
- Seed فقط permission، نقش سیستمی و شعبه مرکزی را می‌سازد و اجرای تکراری آن پاس است.
- lint کل Monorepo پاس؛ typecheck کل Monorepo پاس.
- Vitest: ۱۸ تست در ۱۱ suite شامل login HTTP contract، refresh cookie، validation،
  password policy و permission guard همگی پاس.
- Build تولیدی API، Worker، Web و packageهای مشترک پاس؛ `/login` و `/users` در خروجی Web هستند.
- `git diff --check`، بررسی Secret و Markdown links در gate نهایی تکرار می‌شوند.

## Handoff نهایی Sprint اول

1. PR شماره ۵ با Merge Commit `50eacca` وارد `develop` شده و قرارداد عمومی IAM در دسترس است.
2. قرارداد `@nora/contracts` و جزئیات مصرف در `docs/IAM.md` مبنای PC-B است؛ دسترسی مستقیم
   به جدول‌ها یا repository داخلی IAM ممنوع می‌ماند.
3. PR شماره ۶ با Merge Commit `cda0f9a` وارد `develop` شده است؛ Foundation بدون
   Persistence تکمیل و Persistence واقعی به `MASTER-002` منتقل شده است.
4. PRهای شماره ۷ و ۸ با Merge Commitهای `99dd1cf` و `543f6e2` معماری تاییدشده و
   Frontend منوی ۱۷ بخشی را وارد `develop` کرده‌اند.
5. قفل‌های Migration، Dependency/Lockfile و shared-contract متعلق به `IAM-001` و قفل
   اسناد مرکزی متعلق به `ARCH-001` در 2026-08-23 آزاد شدند.
6. قرارداد عمومی IAM از `@nora/contracts` مصرف می‌شود؛ `BranchReference`،
   `AuthenticatedActor` و `IamPermissionCode` (از جمله `iam.audit.read`) عمومی‌اند و
   Audit با actor context عمومی ثبت می‌شود. مدل/Repository داخلی IAM یا Audit قابل
   دسترسی مستقیم برای Master Data نیست.
7. آزادشدن قفل‌ها مجوز اجرای هم‌زمان نیست. `MASTER-002` و `CUSTOMER-001` پیش از هر
   تغییر Prisma، Migration یا Dependency باید قفل مستقل رزرو کنند و در هر لحظه فقط یک
   Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## برنامه اولیه Sprint دوم

- `MASTER-002` — PC-B — `DONE`: Merge `ddfebb3`؛ Persistence، REST، قرارداد عمومی،
  UI واقعی و async export request تکمیل و چهار قفل آزاد شدند. نرخ ارز authoritative و
  تولید artifact واقعی Documents/Worker همچنان خارج از Scope است.
- `CUSTOMER-001` — PC-A — `DONE/MERGED`: PR #19 با Merge `7d0a4f4` ادغام و چهار قفل آن در Handoff مستقل آزاد شدند.
- `FINANCE-001` — PC-A — `READY_FOR_REVIEW`: چهار Decision مالی ACCEPTED؛ Phase B مستقل برای Schema/Migration فقط پس از Merge PR #21 مجاز است.
- `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`: Phase A مستقل بدون Persistence؛
  فقط Frontend، طراحی دامنه/Application، Contract ماژول‌محلی و تست در مسیرهای
  `customer-affairs`. این Task هیچ قفل مشترکی دریافت نمی‌کند و Backend Persistence
  آن تا Handoff آینده Migration مسدود است.

## ریسک‌ها و تصمیم‌های باز

- دامنه Sub-ledger عملیاتی و مرز integration حسابداری قانونی با DEC-OPEN-001 نهایی شد.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست ارز، rounding، FX و Tax/Recognition با DEC-OPEN-004 پذیرفته شد؛ شماره‌گذاری اسناد همچنان باز است.
- schema و نرخ authoritative فقط در Task مستقل Phase B پس از Merge PR #21 و Migration gate مجاز است.
- ذخیره PII حساس و مدارک هویتی تا تصمیم قطعی retention/رمزنگاری ممنوع می‌ماند.
- اجرای Persistence مالی فقط در Task مستقل Phase B پس از Merge PR #21 و با قفل یگانه Migration/Dependency مجاز است؛ تاریخچه Migration یا داده محلی نباید دستی دست‌کاری شود.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.

## LOCAL-UNIFIED-3100-0909 — PC-A — READY_FOR_REVIEW

Port 3100 composes Sales 385efaa (includes 3d3095e), sidebar efe6287 and Reservations 0946bdd. Main reservations route uses colored queue; original processing retained at /reservations/processing. Source worktrees preserved. API/Web builds, 41 navigation/reservation tests and targeted lint passed. Existing DB 55432 restarted; private pre-update pg_dump retained inside container; 14 existing non-destructive migrations applied. Official Sales/Reservations permissions synchronized to existing administrator. Stored local login and both API lists returned 200. No new migration/dependency or production deployment.

### Local database correction — 2026-09-09

The 55432 preview database was the wrong dataset for the user's current work (2 customers, 0 contracts). Runtime now uses the original root .env database localhost:5432/nora, with its matching contact keys explicitly loaded. Read-only verification found 350 customers and 5 contracts; all 43 migrations already applied, no main-database migration or data changes. Contact integrity check: 542 valid, 4 failed; those records remain unchanged. API remains loopback-only. Previous preview database and its backup are preserved. Login may need renewal after the database/session change.

## RESERVATIONS-ACTION-PANEL-003 — PC-A

Implemented the selected option 3 on the isolated local branch: twenty buttons grouped in a sticky right panel; all disabled until an authorized contract is selected. Each opens the standard accessible Dialog with selected-contract context. Changing selection/access unmounts the previous dialogs. Available overview/passenger/customer projections are read-only; unspecified forms explicitly remain pending with no write controls. Small screens stack the panel above the list. No API, credentials, database or migration changes. 34 reservation tests passed.

Final verification: targeted lint and production Web build/TypeScript passed (39 routes). Local Web 3100 restarted; no API restart or database switch.

## NAV-FINANCE-TICKET-LABELS-0909 — PC-A

Purchases now appears in the Finance sidebar group; route and permissions are unchanged. Visible Web copy uses the requested Persian spelling بلیط, with existing fixture/test text updated consistently. 57 relevant tests passed; no backend, data, migration or dependency change.

Final validation: Web lint, TypeScript and production build passed (40 routes); local Web3100 refreshed. API and original database unchanged.

## NEUTRAL-DARK-MODE-0909 — PC-A — READY_FOR_REVIEW

Replaced navy dark theme surfaces with neutral charcoal tokens; desktop sidebar and company header now follow dark mode. Reservations queue, filters and action panel use shared theme tokens, with distinct pink, light/dark gray and red status palettes. Foreground and secondary text meet 4.5:1 contrast on base surfaces; input boundaries and focus rings meet 3:1. These checks cover declared token pairs, not every composed screen. Light palette and Finance/ticket label changes are preserved. Web lint, TypeScript, 66 relevant tests and production build (40 routes) passed. Web 3100 restarted; API/main database unchanged. Browser visual review unavailable due to browser tool startup failure. No migration, dependency, backend or production deployment changes.

## HR-DARK-NAVIGATION-0909 — PC-A

Fixed Navigation collapse state resetting whenever pathname changed. Group toggles now remain independent across route navigation in the persistent application layout. Added dark overrides for HR and Frappe landing cards, tables, controls, organization chart, payroll and portalled dialogs; light styles remain unchanged. Semantic success/warning/error indicators and keyboard focus remain distinct. 87 scoped tests, Web lint and standalone TypeScript passed. No migration, dependency, API or data changes. Browser visual QA is not claimed.
Final validation: production build (40 routes) passed and local Web 3100 refreshed; login returned HTTP 200. Scoped reservations released.

## PUBLISH-DARK-HR-0909 — PC-A — READY_FOR_REVIEW

User explicitly authorized merge to develop. PR #120 now contains the full stack from #117/#119/#120: Finance purchase grouping, بلیط spelling, neutral dark shell and Reservations, dark HR legacy surfaces and persistent collapsed navigation. Integrated develop 679e516 while preserving PC-B connected HR/agencies and responsive Tehran-date header. Resolved the header conflict by retaining both responsive grid and dark border. Updated three mirrored API ticket validation strings to match Web; existing parity assertion retained. 23 focused integration tests passed. Final combined GitHub quality, tests, build and PostgreSQL gates must all pass before merge. No local database migration or API/Web restart during this publication task. Other computers must pull develop using the existing workflow and apply the already-merged HR migrations through their normal release procedure. Scoped integration reservation ends on successful PR #120 merge; PRs #117 and #119 are superseded by the complete stack.

## RESERVATIONS-THEMED-FILTERS-0909 — PC-A

Replaced the queue's four native selects (status, service, ordering and date basis) with the existing shared Radix Select. RTL direction, accessible names, keyboard interaction and theme-token popovers come from the shared controls; query values and reset behavior remain unchanged. Portalled menus have bounded scroll height, and trigger borders remain readable in both themes. 34 existing foundation tests passed. No API, migration, dependency or shared-control change. Browser visual QA is not claimed.
Final validation: Web lint, production TypeScript and build (40 routes) passed; local Web3100 refreshed and login HTTP 200. No API/database restart or migration.

## CONTRACT-TERMS-SELECTION-0909 — PC-A

The selected contract's مفاد action downloads the same user-provided one-page PDF for every contract. Original bytes preserved at apps/web/public/contracts/terms.pdf; SHA256 D5954B99DAD891A728602C6248109F8DD9F8FDF98609C760842BDFE76B671A1B matches the source. Source rendered for visual identification; no legal/text/layout edits. Action stays disabled without a selection. The existing selection button now has a full-card hit area, pressed state and card focus outline, preserving keyboard operation and list/grid structure. Foundation tests passed after updating the dialog expectation for direct download. No API, migration, dependency or database changes.
Final validation: Web lint, TypeScript and production build (40 routes) passed. Web3100 restarted; login HTTP 200. Authenticated browser interaction was not verified; PDF bytes were verified identical.

## RESERVATIONS-PAGE-CLEANUP-0909 — PC-A

Removed the screenshot-marked processing link, manual refresh control, polling explanation and Tickets/Hotels/Vouchers/Insurance/Costs navigation tabs. Dashboard, inbox, Manifest, timeline, per-contract actions and periodic polling remain. The processing route is retained. 34 foundation tests passed; no backend/data changes. Ticket approval financial-release clarification remains pending separately.
Final: scoped lint, production TypeScript and 40-route build passed; Web3100 refreshed, login HTTP 200. No authenticated visual QA claimed.

## PAYMENT-DIALOGS-0909 — PC-A

Sales contract payments open in a history dialog. A separate nested add dialog preserves the saved fields and enables the existing receipt uploader directly below the tracking reference after successful payment creation. Each history entry can expand its own documents. Returning refreshes history without closing the parent. Existing finance confirmation and Documents checks remain. 10 targeted tests, scoped lint/typecheck, 40-route build and isolated Playwright flow with synthetic API responses passed (one creation, new-payment receipt association, both history entries retained). Local Web3100 refreshed with PDF environment preserved; no database/API changes.

## CONFIRM-VOUCHER-0909 — PC-A

Supplier confirmation atomically issues the hotel voucher and notifies the Sales owner; insurance acknowledgement and Finance delivery gate remain. Legacy confirmed-only issuance supported. Separate confirmed filter/legend removed; issued voucher dark gray; new card identity column alone #FFC0C0; MANIFEST uppercase. 12 API/34 Web tests, scoped lint, both typechecks/builds and light/dark computed-style checks passed. Local API4000/Web3100 refreshed and health 200, original data/PDF environment preserved. No migration or grants. Publication blocked by approval review: origin is currently public; explicit approval pending.

## RESERVATION-COMPACT-ENGLISH-0909 — PC-A

Reservations displays registered English hotel names in the queue, details, hotel operations and documents through public Master Data access; snapshot fallback retained. Queue calendars default Gregorian with English dates and retain calendar switching; other consumers remain Persian by default. Reduced row padding/gaps preserve whole-card selection and 44px identity target. No backend, migration, data writes or permission changes. Public push remains pending earlier authorization. See docs/tasks/RESERVATION-COMPACT-ENGLISH-0909.md.

RESERVATION-COMPACT-ENGLISH-0909 validation complete: 60 Reservations/calendar tests plus 16 default-calendar/workspace checks, scoped lint/typecheck and 40-route build passed. Web3100 refreshed; API unchanged. Scope released for local review.

## SEARCH-SHORTCUT-CONTRAST-0909 — PC-A

Global search kbd now has explicit paired foreground/surface colors, readable semibold Ctrl + K and nonshrinking LTR layout. Visible from sm rather than lg. Shared theme and keyboard behavior unchanged. 25 layout tests passed; scoped lint/typecheck passed. Production 40-route build passed; Web3100 refreshed. No publication to public origin.

## SYNC-DEVELOP-0909 — PC-A

Integrated reviewed develop e07c0c6 into the local feature stack: agencies PR113, HR PR125/127 and Documents CTA PR130/131. No code conflicts; additive status conflict preserves both sides. Local Reservations/Sales/calendar/header files verified unchanged against d68a65f. 270 Web tests passed (one timeout rerun separately), 120 API tests passed, 26 database tests skipped. Web lint, scoped API lint, both typechecks/builds passed. API4000/Web3100 refreshed with original environment and PDF settings; no migration, data or grants. Draft132 excluded. Local merge only; public-origin publication approval remains pending.

## RESERVATION-TABLE-EXPORT-0909 — PC-A

Reservations inbox now uses a compact RTL table with real room counts, hotel action flags and arrangement dates. All authorized API pages feed the same filters/sort for table and XLSX; registered English hotel/city projection shared. Export includes every matched row across UI pages, frozen RTL header and autofilter; literal cells prevent formula execution. No separate suite source exists, so SUIT stays missing. 39 tests, lint/typecheck/build and synthetic browser/independent XLSX read passed. See docs/tasks/RESERVATION-TABLE-EXPORT-0909.md. Local Web3100 refresh only, no backend/data/grants or public publication.

## HOTEL-GROUP-RATES-0910 — PC-A — LOCAL_IMPLEMENTED / WEB_START_BLOCKED

Added group hotel purchase-rate register and sidebar entry with real Master Data references, date ranges, per-row broker/base/six coefficients, exact Decimal computation, atomic idempotent persistence/audit, branch authorization and filtered history. Additive migration rehearsed and applied locally. User-approved HR migrations and seven dedicated Ramtin permissions enabled; actual HR bootstrap passed. 28 targeted tests, typechecks/builds and PostgreSQL/browser checks passed; source artifacts and runtime limitation in docs/tasks/HOTEL-GROUP-RATES-0910.md. API4000 active; Web3100 restart rejected by tool policy twice, including after explicit reconfirmation. No public push or merge.

## FINANCE-DELIVERY-CONFIRM-0910 — PC-A — LOCAL_COMPLETE_PENDING_RESTART

Per-contract financial approval dialog replaces disabled buttons dependent on a global reason. Existing authorization/version/audit preserved. 9 tests, browser QA, lint/typecheck and build passed. No real approvals. Web restart awaits user terminal due tool policy; see task report.

## RESERVATION-EXTRA-COLUMNS-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Five requested columns added to Reservations and filtered XLSX; real permission-scoped names, meal-service lookup and persisted arrangement notes.13 API/41 Web tests, lint/typechecks/builds passed. API refreshed; Web awaits manual restart. No data/migration/grants. See tasks/RESERVATION-EXTRA-COLUMNS-0910.md.

## RESERVATION-TABLE-ACTIONS-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Hotel table checkboxes open existing request/voucher workflow. Sent requests light gray; hotel confirmation checkbox and dark gray require issued voucher. Finance/insurance/version gates preserved.46 Web/7 API tests, browser QA, lint/typecheck/build passed. Web awaits user terminal restart; no API/data changes. See tasks/RESERVATION-TABLE-ACTIONS-0910.md.

## CONTRACT-HOTEL-MEAL-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

Reservations service column now uses meal codes from the selected hotel's existing master-data response when the contract has no explicit service. ROYAL WINGS UALL verified read-only. Same value flows to XLSX without additional requests or contract writes.49 tests, scoped lint/typecheck and build passed; Web restart pending. See tasks/CONTRACT-HOTEL-MEAL-0910.md.

## RESERVATION-FORM-PREVIEW-0910 — PC-A — LOCAL_COMPLETE_PENDING_WEB_RESTART

A4 reservation preview fits RTL modal without clipping; native print size retained. Multi-page lazy-logo hang fixed; fonts/images ready before PDF print.7 tests and build passed;3-page synthetic PDF visually checked. Save as PDF remains browser destination. Web restart pending. See tasks/RESERVATION-FORM-PREVIEW-0910.md.

## RESERVATION-DIRECT-PDF-0910 — PC-A — LOCAL_COMPLETE

Direct authenticated reservation PDF download added alongside print. Uses saved workflow branding and scoped public references, including hotel meal fallback; finance delivery approval is not required for Reservations output. API error.message is surfaced and missing operation reason/reference is validated before submission.13 targeted tests, scoped lint and production build/typecheck passed; real Chrome synthetic23-passenger PDF has3 A4 pages, all visually checked. Live3100 unauthenticated request redirects to login as expected. No actual workflow mutation, schema or grants. User-started Next dev applies Web edits automatically. Public publication hold remains.

## RESERVATION-PANEL-TRIM-0910 — PC-A

Removed six owner-marked buttons from the selected-contract panel: Confirmation, attachment, add note, email, SMS and contract party. Remaining notes group renamed accordingly. Existing hotel confirmation table action and Documents entry remain functional. Eight existing panel/hotel-action tests and scoped lint passed. No API, migration, data, permission or operational changes. Local dev3100 reloads the source update; public publication hold retained.
Final Web build and TypeScript passed (41 pages); local implementation complete.

## SUPPLIER-SUBMIT-FEEDBACK-0910 — PC-A

The supplier registration button previously rejected a blank note and displayed the reason above the long PDF preview. Request registration now supplies an explicit audit description when optional details are omitted. Pending, registered and error feedback is visible beside the action. Cancellation/confirmation reasons, branding, optimistic version, authorization and Finance gates are unchanged. No real request registered or external message sent during QA. Six targeted tests passed; local dev runtime retained and public publication hold remains.
Final scoped lint, TypeScript and Web build passed; implementation complete locally.

## RESERVATION-ROOM-LAYOUT-0910 — PC-A

Hotel attributes remain in the main table; stay dates and room quantities now have distinct captioned blocks with spacing. DBL/SGL/extra-bed quantities use emphasized values and expanded labels. Same layout in preview, print and direct PDF; existing values unchanged. Twelve targeted tests passed and synthetic3-page A4 PDF visually checked on every page. No API/schema/data changes. Public publication hold retained; local dev auto reload.
Final scoped lint, TypeScript and production build passed; local implementation complete.

## RESERVATION-PENDING-GRAY-0910 — PC-A — LOCAL_COMPLETE

Pending-supplier light-theme background changed from #f1f2f4 to #dedee2 for clearer visibility. Issued/dark-mode colors and text remain unchanged. Formatting, diff check, TypeScript and Web build passed. CSS-only; no migration or operational data. Local dev update; public publication hold retained.

## RESERVATION-CONTRACT-HEADER-0910 — PC-A — LOCAL_COMPLETE

Reservation sheet now follows Sales contract navy gradient/teal rule and centered grouped white own-company logo/name. OWN Niayesh reservation logo uses the contract niyayesh.png asset; uploaded agency logo retains its color treatment. Preview/print/direct-PDF HTML updated together; voucher unchanged.12 tests, scoped lint, TypeScript and build passed. Synthetic23-passenger PDF rendered through Playwright Edge and all3 A4 pages visually verified. The isolated CLI Chrome/Edge renderer returned without a PDF during this turn; authenticated direct-download success is not asserted. No renderer/runtime configuration changed. Public publication hold retained.

## RESERVATION-COMPACT-HEADER-0910 — PC-A

Removed the extra company-name and agency-caption text beneath the reservation header logo in preview and PDF HTML. Header reduced from27mm to22mm minimum height and vertical padding halved. Footer identity/alt text remain intact. Eight tests passed; three-page synthetic PDF generated through Playwright Edge and every page visually checked. Existing direct CLI renderer limitation remains unchanged. No data/API changes; public publication hold retained.
Final scoped lint, TypeScript and Web build passed; local implementation complete.

## HOTEL-VOUCHER-THEME-0910 — PC-A

Replaced plain voucher print article with shared A4 reservation-sheet voucher variant. Compact contract-themed logo/header, booking and supplier reference, flights, hotel/service/stay dates, separate room quantities, transfer/leader/excursion, passenger columns and notice/stamp follow the supplied one-page layout. No passenger data from the reference copied. Unavailable per-passenger sex/room type remain dash because snapshots do not supply them; transfer indicates only saved service inclusion. Original branding/voucherIssued/cancelled gates and Finance release unchanged. Eight tests passed and synthetic23-passenger3-page PDF rendered with Playwright Edge and all pages inspected. Output remains existing print/Save as PDF; no direct download route/runtime changes. Public publication hold retained.
Final scoped lint, TypeScript and production build passed. Local implementation complete.

## SALES-RESERVATION-NOTES-0910 — PC-A — LOCAL_COMPLETE

Sales final submission step accepts an optional500-character reservation note. It is preserved once in existing service metadata and transported through the existing public Sales outbox snapshot. Reservation notes dialog shows sales/service notes separately and appends operational-team notes through versioned workflow NOTE commands. Notes remain through issuance/cancellation and do not replace workflow action reason;100-entry cap. Selected-contract Notes button receives amber styling and descriptive accessible label when either source has notes. Existing branch/permission/version/audit rules retained; no migration or real data changes.45 Web tests and8 API tests, scoped lint, Contracts/API/Web builds and TypeScript passed. Synthetic browser verified sales-note display, blank disable, two successive persisted-response appends and version progression. Local API refreshed; public publication hold retained.

## VOUCHER-SETTINGS-0910 — PC-A — LOCAL_COMPLETE

Fixed voucher dialog issuance from REQUESTED via CONFIRM_SUPPLIER; NEW remains blocked. Supplier reference, action reason, missing-insurance acknowledgment and Finance release gates retained. One logical voucher supports corrections using existing immutable workflow revisions, latest100 history entries with historical preview/print. Validated output settings cover letterhead, hotel/stay/meal/rooms, service flags, broker/guide/transfer/flights, remarks and selected passenger metadata. Settings are voucher-specific; no canonical customer or Sales snapshot edits. Unsaved edits disable issuance; cancelled requests cannot edit settings. Attachments reuse Documents linking and load on demand.
Validation:10 API tests and9 Web model/output tests, scoped lint, TypeScript and Contracts/API/Web builds; synthetic browser verified missing-insurance gate, unsaved settings/save/confirm sequence and NEW block. Four synthetic A4 output pages visually checked. No real voucher issuance or external send in QA. No migration/grants; local API refreshed with existing env. Existing direct CLI PDF renderer limitation remains; browser print PDF QA succeeded. Public-publication hold retained; local commit only.

## SUPPLIER-FORM-ISOLATION-0910 — PC-A

Implemented independent supplier form editing with explicit No/Yes destination choice. No updates only supplier draft; explicit send/re-send freezes buying context. Yes atomically records a Sales operational amendment with audit/version and updates voucher settings. Purchase action now opens the real hotel cost form, showing sent hotel/room/service/date context. Confirmation, insurance and Finance release protections retained. Contract commercial amounts and reference/customer records are not rewritten. API current-version stamp handles the outbox acknowledgment version increment and concurrent edits. No migration, grants, real operational writes or external sends in QA.
Validation:12 API and35 Web tests; synthetic browser exercised both choices and send action. Four supplier A4 pages and two amended-contract pages visually verified using synthetic data. Scoped lint/typecheck passed; final production builds pending completion. Public publication hold retained.
Final production builds passed; API4000 refreshed and health200, Web3100 login200. Local implementation complete. Canonical monetary/reference data remain unchanged by the operational amendment; direct CLI PDF renderer limitation from earlier task is unchanged.

## VOUCHER-STATUS-CONTRAST-0910 — PC-A — LOCAL_COMPLETE

Issued light-theme rows now #62626b with white text; dark pending rows #585861 with white text and dark issued rows #1d1d21 with #fafafa text. Distinct legend edges retained. Synthetic browser computed all four row text contrasts above4.5:1 and verified pending/issued separation; visual QA, formatting and Web TypeScript/build passed. CSS-only, no migration or API changes. Local-only publication hold retained.

## RESERVATION-GENERAL-DETAILS-0912 — PC-A — LOCAL_COMPLETE

The selected-contract «مشخصات کلی» action now loads the canonical Reservations workflow snapshot and presents separate groups for contract/customer, route/services, hotel/rooms, flight, recorded service prices and operational notes/status. Customer phone is read through the Customer public API and remains masked; missing permission leaves it unavailable. Debt and exchange-rate values are explicitly marked unavailable because they are not part of the Reservations intake, preventing invented financial data. Eleven targeted tests, scoped lint, TypeScript and the Web production build passed. Local Web3100 responds 200 and hot reload is active. No API, schema, grant or operational-data changes; public-publication hold retained.

## RESERVATION-CONTRACT-PDF-0912 — PC-A — LOCAL_COMPLETE

The Reservations selected-contract «مشاهده» action now displays the existing authenticated Sales contract PDF in-place. The live-feed adapter retains the canonical contractId separately from the Reservations intake id, preventing cross-record or wrong-id output. The dialog includes PDF download, retry and safe server error feedback. Thirty-two focused tests, scoped lint, TypeScript and the Web production build passed; Local Web3100 responds 200 with hot reload active. Existing Sales output permissions and audit remain authoritative. No API, schema, grant or operational-data changes; public-publication hold retained.

## RESERVATION-PASSENGER-IDENTITY-0912 — PC-A — LOCAL_COMPLETE

Reservations passenger names now display in a compact scrollable table with editable canonical names plus age category, gender, birth date, national ID, passport number, passport expiry and passport issue place. Age comes from the immutable Sales intake; identity fields come from the Customer public service. Existing customers.sensitive.read controls full birth/identity values and every full read uses the audited customer-verification reason. Without that permission the endpoint returns only masked identity and a protected birth-date indicator. Gender and passport issue place explicitly remain unavailable because the current Customer schema does not store them. Nine focused API tests, scoped API/Web lint, both typechecks and production builds passed. API4000 and Web3100 both respond 200. No migration, permission grant or operational-data change; public-publication hold retained.

## RESERVATION-RECEIPTS-0912 — PC-A — LOCAL_COMPLETE

The selected-contract «دریافت‌ها» action now reads the existing Sales-owned payment history and displays payment method/status, amount and currency, Finance-confirmed transfer date, due date, registering user, registration date, bank, tracking reference and description in a horizontally scrollable table. The Sales detail output resolves the stored creator user ID to its current display name only for actors who already have payment-read access. Historical active/inactive bank records are included; absent bank or confirmation data remains explicitly «ثبت نشده». Twelve focused API/Web tests, scoped lint, Contracts/API/Web typechecks and production builds passed. API4000 was refreshed and both API4000 and Web3100 respond 200. No schema, migration, permission grant or payment mutation; public-publication hold retained.

## HOTEL-RATE-CALENDAR-0912 — PC-A — LOCAL_COMPLETE

Hotel group-rate stay dates now use the shared project DatePicker instead of browser-native date controls. Both check-in and check-out open the same dual Persian/Gregorian calendar used elsewhere in Reservations, default to Gregorian-English display and continue to store ISO civil dates. Existing positive-night validation, calculation and API payload are unchanged. Twelve focused date/rate tests, scoped lint, Web TypeScript and production build passed. No API, schema or data changes; isolated local handoff commit and public-publication hold retained.

## RESERVATION-PARTY-DETAILS-0912 — PC-A — LOCAL_COMPLETE

Reservations general details now gives the contract party a distinct highlighted group containing recorded name, customer kind/status, primary and additional phone numbers, email and address. Full contacts are requested only through the Customers sensitive-detail public API with fixed `support-request` reason; existing `customers.sensitive.read`, branch checks and Backend Audit remain authoritative. If sensitive access is unavailable, the same view continues with masked contact data. Eight targeted tests, scoped lint, Web TypeScript and production build passed. No API, schema, grant or operational-data change; isolated local handoff commit and public-publication hold retained.

## 2026-09-11 — B2B connection audit (PC-B)

Source9b1c33c connects directory account manager and active-contract count to existing public APIs with branch/role authorization, pagination, partial failure and cancellation. Corporate dossier summary now uses its actual role.111 tests, lint and typecheck passed. Detailed implemented versus missing connections and owner handoffs: docs/tasks/B2B-CONNECTIONS-AUDIT-001.md. No financial producer, Sales pricing integration or external sync is claimed. Combined Web build9d05cd6 preserves7bae2a4; API unchanged.
Runtime QA complete: Web3100 source9d05cd62d57c8d5b888cd9ff8aa77580a76ddea5 / hr005-b155b1d5a8c561d8 / PID20144, combined43-route production build passed. Authenticated browser shows Nirvana/fixture managers onHQ, changes to unassigned onAcademia,0 approved-active contracts for draft-only records; corporate-only dossier summary loads withCORPORATE_CUSTOMER and no agency-only calls. No writes performed during QA; API untouched. Draft PR176.

WORKBENCH-012: build تولیدی و بررسی مرورگر با حساب واقعی موفق؛ انتخاب واحد، درج قالب و حفظ متن قبلی تأیید و متن آزمایشی پاک شد. Web3100 source7bae2a4 / PID26140؛ API بدون تغییر. Draft PR175؛ بدون merge.

## WORKBENCH-013 — بازچینی و پیش‌نویس‌ها

تنظیمات دو بخشی، تب‌های بزرگ و وسط‌چین، KPI رنگی، حذف shortcut اسناد داخل میزکار، نمای دو ستونی پیام‌ها، فرم اولیه درخواست و چک‌لیست تیک‌زدنی یادداشت اجرا شد. ذخیره/ارسال واقعی به‌دلیل قفل Migration و نبود سرویس همچنان مسدود است؛ چند یادداشت واقعی ایجاد نشد. ۳۷ تست، lint/typecheck/build موفق؛ مرورگر تنظیمات و انتخاب قالب/تیک/خط‌خوردن را تأیید کرد. Web3100 source8492a36/PID22916؛ API بدون تغییر و health200. مرجع: tasks/WORKBENCH-013-INTERACTIONS.md.

WORKBENCH-014 نهایی: build۴۳route و بررسی مرورگر سه کارت، تیک/خط‌خوردن، اعمال ویرایش و حفظ آن پس از بستن فرم موفق بود. Web3100 source1e295db/PID20512/manifesthr005-3938c4fc437ae857؛ تغییر تاریخچه آژانس1995e16 حفظ شد. API4190 بدون تغییر/health200. نمونه آزمایشی با reload بازنشانی شد. PR180 پیش‌نویس، بدون merge.

WORKBENCH-016 heading follow-up: scoped lint and43-route production build/TypeScript passed. Web3100 source534de0e/PID24904/manifesthr005-03a688ca8958bf45 preserves B2B boundary-note removal3528efe. API unchanged.

## 2026-09-11 — B2B browser navigation (PC-B)

User clarified native browser Back. Sourcea753d86 records directory/dossier/section/tab transitions in browser history, preserves Next metadata, restores Back/Forward and avoids duplicate entries on refresh of contacts. In-page return also targets same dossier from subsections.113 Organizations tests and scoped lint/typecheck passed; combined build1995e16 from8492a36. No API/dependency changes.
Runtime confirmed: source1995e160afb1fd59b47832199d524a4d883a341c / hr005-de87fc5eb9722975 / WebPID5516,43-route build pass. Actual browser Back: contract to same ORG_A38P8LPLQXLB360 to directory; Forward restores same dossier and contract. Credit tab Back restores framework tab.113 tests passed; API unchanged. Draft PR179; Web returned to workbench owner.

## 2026-09-11 — B2B directory subtitle (PC-B)

Sourcee03afcf removes requested explanatory paragraph below the directory heading. Scoped lint/typecheck and113 tests passed. Combined runtime buildd59b860 preserves1e295db and native browser history fix. No data/API changes.
WORKBENCH-014 نهایی: build۴۳route و بررسی مرورگر سه کارت، تیک/خط‌خوردن، اعمال ویرایش و حفظ آن پس از بستن فرم موفق بود. Web3100 source1e295db/PID20512/manifesthr005-3938c4fc437ae857؛ تغییر تاریخچه آژانس1995e16 حفظ شد. API4190 بدون تغییر/health200. نمونه آزمایشی با reload بازنشانی شد. PR180 پیش‌نویس، بدون merge.

Runtime d59b860 / hr005-785b78ad01bbc39f / WebPID22512 verified: heading remains and requested subtitle absent in browser DOM.43-route build passed; API unchanged. Draft PR181; Web handed back to workbench owner.

## 2026-09-11 — B2B contract filter alignment (PC-B)

cc3027d+d1160ed fix flex cascade overriding dossier grid; date, branch and action controls align in6/3/1 responsive columns.113 tests/typecheck passed. Runtimebuildfe0ae53 preserves12c7c41; no API or data change.

## 2026-09-12 — B2B compact export actions (PC-B)

Source7acd39f moves exports next to create actions in commercial headers and uses33px buttons with short labels and accessible names. Filters retain their own responsive grid.121 tests/lint/typecheck passed. Combined9dceb66 building; no API/data changes.
Final runtimec8164fc/hr005-da948517ea153e3e/PID27312 verified: desktop contract create/Excel/PDF share identicaly438px and33px height; mobile390px rates create/Excel/PDF share identicaly851px and33px height with no document overflow. Combined46-route build passes. API unchanged; Web remains with workbench owner. Draft PR193.

## 2026-09-12 — Agency360 finance HR footer (PC-B)

Source8ff2da8 hides the supplementary HR connections panel only while the agency dossier finance screen is mounted. Shared provider cleanup restores other pages; HR permissions unchanged. Scoped lint, Web typecheck and125 tests pass. Runtime build/verification pending owner cutover.

Runtime ab4d12c/hr005-82286e6ac8efeb1f/WebPID8940 preserves ce2ca88.46-route webpack production build passed. Browser finance heading present, HR panel absent; native Back restores home panel and Forward suppresses it again. API unchanged. Draft PR196.

## 2026-09-12 — Agency logo controls in edit form (PC-B)

Source4786181 removes header camera, upload/change action, archive link and separate editor. Existing edit form logo field and save pathway remain authoritative.121 tests, lint/typecheck passed. Combined runtime build preserves3bd4f5b.

Runtimeeb22c43/hr005-3e8178627325af68/PID8872:46-route production build passed; browser confirms header logo image retained with zero change/upload buttons and edit dialog has logo file selector, saved badge, remove and save actions. No data changed. PR198.

## 2026-09-12 — Agency access pencil button (PC-B)

Sourcea64ea2f replaces edit-access text with pencil icon, accessible name and tooltip. Scoped lint/typecheck passed; no API/data changes. Runtime build preserving37b72b8 underway.

Runtime610170e/hr005-e828cafc8da400a3/PID16592 preserves37b72b8.46-route production build passed. Current QA agency has no users, so no live row click verified; editor handler/permission unchanged. API untouched. PR200.

## 2026-09-12 — Agency directory HR footer (PC-B)

Source d73d6bb suppresses the supplementary HR requests panel on the Organizations directory using the existing public visibility hook. Existing finance suppression preserved. Lint and Web typecheck passed; runtime verification pending.

Runtime3397f2b/hr005-1ba72d053599fc53/PID11368 preserves96b6d2d.46-route build passes. Browser directory renders8organizations and pagination with zero HR connections panels. API unchanged. PR206.

## 2026-09-12 — Agency360 subtitle removal (PC-B)

Source f03d34c removes the requested home360 subtitle without leaving an empty paragraph. Subsection descriptions unchanged. Scoped lint/typecheck passed; combined runtime build coordinated.

Combined runtime1bf840b/PID8604/hr005-ef61a0178f542c46 built by Workbench owner. Browser confirms360heading present and requestedsubtitle absent. NoAPI/data change. PR209.

## 2026-09-13 — Reporting preview / export column parity (PC-C)

The Web Reporting adapter now preserves all existing Travel projection measures in the preview response: order, passenger and ticket counts plus sales, purchase, gross-profit, refund and settlement-balance amounts. The configuration form's result table renders every measure that is actually present in the response, alongside the existing dimensions and currency, so it is no longer limited to the prior five-column summary. Existing server-backed sort headers remain available for the supported fields; no client-side fabricated values, API, schema, migration, seed or operational data were added. Nineteen focused Reports tests, scoped lint and Web TypeScript validation passed.

## 2026-09-14 — Unified Dashboard + Reports local runtime (PC-C)

پورت `3000` به‌صورت قراردادی به Worktree یکپارچهٔ `codex/pc-c-dashboard-reporting-latest` با commit پایهٔ `879b84fb` اختصاص یافت تا تغییر یک ماژول نسخهٔ ماژول دیگر را روی LocalHost بازنویسی نکند. Launcher در `scripts/start-unified-local-runtime.ps1` شاخه و فایل‌های هر دو ماژول را بررسی می‌کند، در صورت اشغال بودن پورت متوقف می‌شود و فقط با `-Restart` و بررسی PID سرور قبلی را جایگزین می‌کند. دستور `pnpm dev:local-unified` ثبت شد؛ کش Next در صورت نیاز خارج از پروژه آرشیو می‌شود. تغییرات Dashboard/Reports و اصلاحات build/login در همین Worktree نگه‌داری شده‌اند؛ API، Schema، Migration، Seed و دادهٔ نمونه تغییر نکرده‌اند. بررسی parser اسکریپت، `tsc --noEmit` و تست مدل Dashboard موفق است و Web روی پورت 3000 فعال است.

## 2026-09-14 — Auditable KPI definition drawer (PC-C)

عمل «جزئیات تعریف شاخص» در Dashboard اکنون به‌جای Card پایین صفحه، یک Drawer سمت راست و قابل‌دسترسی باز می‌کند. پنل برای هر KPI شناسه و نام فنی، نقش، تعریف کسب‌وکار، فرمول/قاعده محاسبه، lineage منابع، Grain، مبنای زمانی، سیاست ارز، مبنای مقایسه، حذف‌ها و محدودیت‌ها، Permission و تصمیم باز را نمایش می‌دهد و در صورت وجود نگاشت کاتالوگ، کاربر را به فرم پیکربندی گزارش مرتبط می‌برد. هیچ مقدار KPI، منبع، فرمول یا مجوزی ساخته نشده و رجیستری موجود منبع حقیقت باقی مانده است. ۱۳۸۸ تست Web، lint، typecheck و build تولیدی ۴۶ مسیر موفق‌اند؛ صفحه Dashboard در مرورگر داخلی به‌درستی به login هدایت شد و بررسی تعاملی Drawer نیازمند نشست احرازشده کاربر است.

پیگیری UI: متن تکراری «جزئیات تعریف شاخص» از انتهای همه کارت‌های KPI حذف شد؛ کارت‌ها فقط با کلیک، پنل تعریف را باز می‌کنند. تست هدفمند Dashboard، lint محدوده و Web typecheck موفق‌اند.

پیگیری فیلتر تاریخ Dashboard: DatePicker مشترک اکنون به‌شکل افزایشی از `calendarSystem` کنترل‌شده پشتیبانی می‌کند. «از تاریخ» و «تا تاریخ» یک state تقویم دارند؛ انتخاب شمسی یا میلادی در هر ورودی، ورودی دیگر را بدون تغییر مقدار ISO/Gregorian همگام می‌سازد. ۱۳ تست DatePicker/Dashboard و lint محدوده موفق‌اند. typecheck سراسری در این Worktree فقط به خطای هم‌زمان `reportingClient` تعریف‌نشده در `reports/model/client.spec.ts` متوقف است؛ تغییر مربوطه خارج از این واحد کار حفظ شده است.

## 2026-09-14 — All-column report sorting and local demo data (PC-C)

تمام ستون‌های قابل‌نمایش جدول نتیجه Reports، شامل ابعاد، ارز، تعداد سفارش/مسافر/بلیت و مبالغ فروش، خرید، سود ناخالص، استرداد و مانده تسویه، اکنون فلش مرتب‌سازی سرستون دارند و Sort پیش از Pagination در API اجرا می‌شود. ماژول Backend گزارش با endpointهای Preview، Workspace و CSV/XLSX/PDF به Runtime نهایی افزوده شد. ۴۸ fact واقعی‌نمای قبلی از fixture ignored خارج از Worktree، به‌صورت idempotent فقط در PostgreSQL محلی وارد شدند؛ فایل داده، PII واقعی و Seed عمومی وارد Git نشده‌اند. Prisma validate/generate، API و Web typecheck و مجموعه کامل تست‌ها موفق‌اند؛ Web روی 3000 و API روی 4000 از Worktree canonical فعال‌اند.

# وضعیت 2026-09-22 — کارت فشردهٔ انتخاب بلیط در فروش

- PC-A روی Branch مستقل `codex/pc-a-compact-ticket-offer-cards-0922` از `origin/develop@fdbd65d3` فقط چیدمان کارت انتخاب بلیط قرارداد جدید را فشرده می‌کند: فاصله‌های عمودی و اندازه ساعت کاهش می‌یابد و تاریخ حرکت/رسیدن با وزن و اندازه بیشتر نمایش داده می‌شود. منطق زمان، ظرفیت، قیمت، انتخاب، API و داده تغییر نمی‌کند.
- پیاده‌سازی آمادهٔ Review است: تاریخ‌ها در هر دو حالت انتخاب‌شده و عادی برجسته‌اند، ساعت‌ها کوچک و هم‌ردیف تاریخ‌اند و ارتفاع کلی کارت با کاهش فاصله‌های عمودی کم شده است. ۷ تست کامپوننت، lint محدوده، typecheck و build تولیدی ۵۰ route موفق‌اند.

# وضعیت 2026-09-14 — اشتراک‌گذاری مستقیم گزارش‌ها

- 2026-09-16 Package Pricing commission follow-up: drafts/publications now support percent or fixed commission with an explicit currency. Fixed commission is deducted once from the matching currency profit bucket and never changes sale; historical rows default to percent. Additive migration was applied only to isolated `rubi_pricing_flow_0916`. Tour demo 1 published version 3 with fixed EUR 15 while tour demo 2 remains percent.
- دکمه اشتراک‌گذاری به فرم پیکربندی و عملیات «گزارش‌های من» اضافه شد؛ انتخاب گیرنده
  جست‌وجوپذیر و چندانتخابی است و بازخورد موفق/خطا دارد.
- Backend فقط به مالک دارای `reporting.share` اجازه تغییر grant می‌دهد و گیرندگان را
  بر اساس فعال‌بودن، مجوز گزارش و در صورت لزوم شعبه مشترک محدود می‌کند.
- جدول و دو Migration افزایشی `reporting_saved_report_shares` و `reporting.share` روی
  PostgreSQL محلی اجرا و در تاریخچه Prisma ثبت شدند؛ Migrationهای pending سایر تیم‌ها
  اعمال نشدند.
- API/Web TypeScript، Lint، Build و ۳۷ تست هدفمند Reports موفق‌اند. Runtime یکپارچه
  Web روی 3000 و API روی 4000 فعال و health هر دو برابر 200 است.

# وضعیت دیتای دموی Dashboard و Reports — 2026-09-15

- 2026-09-16 Package Pricing commission follow-up: drafts/publications now support percent or fixed commission with an explicit currency. Fixed commission is deducted once from the matching currency profit bucket and never changes sale; historical rows default to percent. Additive migration was applied only to isolated `rubi_pricing_flow_0916`. Tour demo 1 published version 3 with fixed EUR 15 while tour demo 2 remains percent.
- Dashboard اکنون از Projection عمومی و نسخه‌دار `reporting.dashboard.travel.v1`
  استفاده می‌کند و KPIها و نمودارهای هر صفحه را از `reporting.travel.facts.v1`
  دریافت می‌کند.
- برای ارائهٔ محلی، ۱۸۰ رخداد سفر واقعی‌نما با پیشوند
  `LOCAL_DEMO_DASHBOARD_REPORTING_` در PostgreSQL ساخته شده‌اند. این داده‌ها در
  Git/Seed عمومی ثبت نشده‌اند و فقط با `pnpm reporting:demo:clear` حذف می‌شوند.
- فقط کارت‌های سفر دارای Projection معتبر در محیط دمو Preview و Export دارند.
  گزارش‌های حوزه‌های دیگر تا انتشار Producer اختصاصی خود Pending باقی می‌مانند.

## 2026-09-12 — قالب XLSX منیفست و فرم ساده فرودگاه (PC-B)

قالب Manifest اکنون با انتخاب ایرلاین و مقصد و بارگذاری مستقیم فایل XLSX ایجاد می‌شود؛
نام، فرمت، نسخه و وضعیت Draft در Backend تعیین و شناسه فایل از API عمومی Documents روی
رکورد Master Data ثبت می‌شود. مقصد FK واقعی شهر است و ذخیره فایل یا Query مستقیم جدول
Documents در Master Data انجام نمی‌شود. فرم ایجاد فرودگاه دیگر ICAO، Timezone IANA و طول/
عرض جغرافیایی را نمی‌خواهد؛ این مشخصات برای سازگاری داده‌های قبلی اختیاری و در Edit/View
قابل دسترس‌اند. Migration افزایشی و غیرمخرب است و Manifest اجرایی همچنان در مالکیت
Reservations باقی می‌ماند.

اعتبارسنجی نهایی شامل ۳۳ تست هدفمند API، ۳۸ تست Web و ۲ تست Migration، lint محدوده،
Prisma validate/format و typecheck/build دیتابیس، API و Web موفق است.

## 2026-09-14 — بازیابی پنل عملیات رزرواسیون (PC-A)

شاخه `codex/pc-a-reservation-action-panel-recovery-0914` پس از بررسی overlap روی `origin/develop@7a6cc53e`
آخرین چیدمان تأییدشدهٔ پنل قرارداد را بازیابی می‌کند. دکمهٔ تکی «دریافت» حذف شده،
«دریافت‌ها» فقط در عملیات قرارداد است و «ویرایش» فرم کامل اصلاح قرارداد با شماره
قرارداد، نه بخش عملیاتی و فرمان نسخه‌دار لغو ابطال را باز می‌کند. نسخهٔ جدید develop
در conflictهای اسناد و قرارداد عمومی حفظ شد و import فرم با namespace فعلی Nora منطبق شد. ۱۷ تست هدفمند، lint، typecheck
Contracts/API/Web و build تولیدی API/Web موفق‌اند؛ هیچ Migration یا تغییر داده‌ای
وجود ندارد. localhost مشترک تا ادغام PR روی develop جابه‌جا نشده است.

## LOCAL-ALL-SECTIONS-3100-0913 — ACTIVE

Combined develop, latest published Customer Affairs forms/reports, Workbench performance and Finance inbox are active at Web3100/API4191. Code/launcher commit 2fd10a9f, Web build LYH1PTQ_i1saQILyrG74V. 98 targeted tests, scoped lint, sequential API typecheck, full build and final HTTP smoke passed. Existing database and storage retained; no migration/seed/role assignment. Port4190 was replaced because Fetch restricts it. See tasks/LOCAL-ALL-SECTIONS-3100-0913.md.

## 2026-09-14 — کارت بلیط و قالب مقصد در MANIFEST (PC-A)

در بخش MANIFEST، جست‌وجوی بازه همهٔ بلیط‌های رفت و برگشت موجود در آخرین نسخهٔ قراردادهای رزواسیون را به شکل کارت نمایش می‌دهد. هر کارت ایرلاین، شماره پرواز، مسیر، زمان، تعداد قرارداد و مسافر و وضعیت قالب را دارد. قالب فعال XLSX با ایرلاین، مقصد و تاریخ اعتبار تطبیق داده می‌شود؛ کارت بدون قالب دلیل عدم امکان خروجی را نشان می‌دهد و غیرفعال است. خروجی کارت پشتیبانی‌شده فقط مسافران همان بلیط را در فایل مرجع ذخیره‌شده در Documents قرار می‌دهد و شرط تأیید مالی و انتخاب «فقط جدید/همه» حفظ شده است.

Reservations از API عمومی Master Data برای تطبیق قالب و از مرز عمومی و auditشدهٔ Documents برای خواندن فایل CLEAN استفاده می‌کند. هشت تست هدفمند API و یک تست Web، lint محدوده، typecheck Contracts/API/Web و build تولیدی API/Web موفق‌اند. Migration، Seed، تغییر دادهٔ مسافر، dependency یا جابه‌جایی localhost انجام نشده است.

## 2026-09-15 — قالب جدید PDF بلیط پرواز (PC-A)

خروجی PDF بلیط، فرم A4 بر اساس نمونه کاربر دارد: نام و لوگوی ایرلاین از رکورد فعال اطلاعات پایه و فایل مجاز Documents، لوگوی شرکت صادرکننده از سربرگ ثبت‌شده، مسیر و ساعت از داده پرواز قرارداد، و عنوان MR/MRS/CHD/INF از رده سن و جنسیت پرونده مسافر. نام لاتین گذرنامه بر نمایش اولویت دارد. هشدار حضور سه ساعت پیش از پرواز به انگلیسی و فارسی درج می‌شود. در نبود لوگوی ایرلاین، نام آن می‌آید و داده ناموجود بار مجاز/QR یا شماره رسمی بلیط ساخته نمی‌شود. خروجی نمونه با دو مسیر، یک صفحه A4 است؛ ۱۵ تست هدفمند، lint و typecheck Web موفق‌اند. PR #283 هنوز باز است و هنگام ادغام باید اشتراک route/model PDF بلیط با این تغییر بررسی شود. localhost یکپارچه تغییر نکرده است.

- build تولیدی Web نیز با ۴۶ route موفق شد؛ خروجی نمونهٔ PDF با Chrome/Poppler یک صفحه A4 دارد. تغییر عمومی API/Database و جابه‌جایی localhost انجام نشد.
  پیگیری 2026-09-15: نام و کد شهر در هر مسیر رفت/برگشت روی سایهٔ روشن شهری قرار گرفتند. PDF واقعی با Chrome تولید و صفحهٔ A4 به تصویر رندر و بررسی شد.

## 2026-09-19 — RESERVATION-SERVICE-PURCHASE-PICKER-0919 — PC-A — READY_FOR_REVIEW

پنجرهٔ خرید رزرواسیون برای انتخاب خدمت هتل/ترانسفر، ثبت کارگزار و مبلغ/ارز و ارسال نسخهٔ خرید به کارتابل مالی در حال تکمیل است. این واحد از قرارداد عمومی موجود استفاده می‌کند و Migration یا دادهٔ عملیاتی ندارد.

نتیجه: انتخاب خدمت هتل/ترانسفر، کارگزار، مبلغ و ارز به پنجرهٔ خرید افزوده شد. ثبت از قرارداد عمومی نسخه‌دار رزواسیون استفاده می‌کند و وضعیت پرداخت در Finance باقی می‌ماند. قراردادهای قدیمی دارای hotelSelection نیز قابل خرید هستند. تست هدفمند، lint، Prettier و typecheck API/Web موفق‌اند؛ Migration، dependency و دادهٔ عملیاتی تغییر نکرده است.

## 2026-09-19 — DASHBOARD-TREND-FILTER-UX-0919 — READY_FOR_REVIEW

کادر انتخاب تقویم محور X نمودار روند از نظر ارتفاع و عرض کمی بزرگ‌تر شد تا آیکون
و متن «تاریخ شمسی/میلادی» داخل کادر باقی بمانند. آیتم‌های بازهٔ زمانی نیز با
عرض کامل، راست‌چین و هم‌تراز با سمت راست کادر نمایش داده می‌شوند. تست هدفمند
Dashboard، lint، typecheck و build تولیدی Web موفق‌اند؛ API، Schema/Migration،
Permission، دادهٔ عملیاتی و Dependency/Lockfile تغییر نکردند.

## 2026-09-19 — DASHBOARD-RANGE-OPTION-ALIGNMENT-0919 — READY_FOR_REVIEW

متن گزینه‌های فیلتر «بازه زمانی» داخل آیتمی تمام‌عرض قرار گرفت تا هنگام بازشدن
فهرست، مقدارهایی مانند «امروز»، «این هفته» و «این ماه» در سمت راست کادر نمایش
داده شوند. تست Dashboard، lint، typecheck و build تولیدی Web موفق‌اند و Web/API
روی پورت‌های ۳۰۰۰/۴۰۰۰ پاسخ ۲۰۰ دارند.

## 2026-09-28 — DASHBOARD-REPORTING-FINAL-VISUAL-INTEGRATION — LOCAL_COMPLETE

علت نمایش طراحی قدیمی نمودارها، عقب‌ماندن شاخهٔ runtime مشترک از تغییرات Dashboard در develop بود. طراحی نهایی قیف تصمیم، نمایش درصدی KPI/نمودار، روند جذب به تفکیک کانال، اصلاح برچسب‌های محور، جزئیات نمودار و انتقال فیلترها به فرم گزارش مرتبط همراه با aggregationهای اختصاصی Dashboard در همین Worktree وارد شدند. تغییرات تازهٔ Reports، تصاویر Light/Dark و ناوبری فعلی حفظ شدند. Typecheck و build تولیدی Web/API، ۴۴ تست هدفمند Web و ۳۸ تست هدفمند API موفق‌اند؛ Web3000 و API4000 پاسخ ۲۰۰ دارند. مشاهدهٔ احرازشدهٔ صفحه به‌دلیل ماندن مرورگر روی Login هنوز انجام نشده است. داده و Migration تغییر نکردند.

در گام انتشارِ تأییدشده، `origin/develop@f52a567b` در شاخهٔ `codex/pc-c-dashboard-reporting-latest` ادغام شد. تنظیم نسخه‌دار سقف و انقضای خروجی گزارش از develop و طراحی نهایی Dashboard/Reports همین شاخه حفظ شدند. پس از تولید مجدد Prisma Client و build قراردادها، ۴۷ تست Web و ۲۴ تست API، lint، typecheck و build Web/API موفق شدند؛ هر دو سرویس ۳۰۰۰/۴۰۰۰ پاسخ ۲۰۰ دارند. دادهٔ نمونهٔ محلی در Git وارد نشد.

## 2026-09-21 — SYSTEM-MANAGEMENT-LIVE-CONSUMERS-004 (PC-B)

مرکز مدیریت سیستم اکنون Resolver مشترک دامنه‌محور دارد و تنظیمات منتشرشده را در
مصرف‌کننده‌های واقعی امور مشتریان، Documents، Procurement و Workbench اعمال می‌کند.
SLA تیکت با نسخهٔ تنظیم Snapshot می‌شود، سقف فایل Documents در options و upload
اعمال می‌شود، سیاست فعال خرید Overrideهای مجاز را می‌خواند و اولویت پیش‌فرض رویداد
میزکار از تنظیمات گرفته می‌شود. UI نیز Global را برای Scope شرکت به‌صورت ارثی نشان
می‌دهد و Override مستقل ایجاد می‌کند. بدون Migration، Secret، دادهٔ عملیاتی یا
تغییر قرارداد عمومی PC-A. کل تست API `1535 passed | 168 skipped`، typecheck/lint و
Build هر دو workspace موفق‌اند.

## 2026-09-19 — Sales/Ticket Catalog source synchronization (PC-A, in progress)

Ticket Management local-only definitions and Sales offer selection are being unified on the existing Ticket Catalog public source. No schema, migration, dependency lock, operational data, or direct cross-module table access is in scope.

Result: Ticket Management now publishes new flight definitions to the existing Ticket Catalog offer source before closing the form, and exposes the branch-scoped published offer list used by Sales contracts. Round-trip and repetition publish independent flight offers. Focused Web (1) and API (3) tests, lint, Prettier and API/Web typecheck passed. No migration, dependency lock, or operational data changed.

## 2026-09-20 — انقضای خودکار و تکمیل نمایش بلیط قرارداد — READY_FOR_REVIEW

PC-A روی شاخهٔ مستقل `codex/pc-a-ticket-expiry-sales-visibility-0920` منبع عمومی Ticket Catalog را اصلاح می‌کند تا پروازهای گذشته از وضعیت فعال خارج شوند و تعریف‌های معتبر چندقطعه‌ای مدیریت بلیط نیز به انتخاب قرارداد جدید برسند. دادهٔ نمونهٔ صرفاً مرورگری دیگر به‌عنوان بلیط واقعی مدیریت نمایش داده نمی‌شود. این واحد Schema/Migration، Dependency/Lockfile، دادهٔ عملیاتی و localhost را تغییر نمی‌دهد.

پیاده‌سازی کامل است: انقضا به‌صورت `ACTIVE` → `PAUSED` همراه افزایش نسخه و Audit انجام می‌شود، جست‌وجوی فروش از لحظهٔ جاری عقب‌تر نمی‌رود، پرواز چندقطعه‌ای از اولین مبدأ تا آخرین مقصد در منبع مشترک منتشر می‌شود و کارت‌های نمونهٔ محلی از صفحهٔ عملیاتی حذف شدند. کارت‌های ذخیره‌شدهٔ منقضی هنگام بارگذاری متوقف و فهرست Backend هر دقیقه تازه می‌شود. ۲۳ تست هدفمند، lint، typecheck API/Web، build API و build تولیدی Web با ۵۰ route موفق‌اند؛ Webpack برای build این worktree استفاده شد چون Turbopack junction وابستگی بیرون از ریشهٔ worktree را رد می‌کند.

## 2026-09-21 — PROCUREMENT-DRAFT-SAVE-AND-SUBMISSION-0921 — PC-B — READY_FOR_REVIEW

فرم درخواست خرید اکنون پیش از ثبت، انتخاب «درخواست‌کننده» از کارکنان فعال را در همان محل روشن می‌کند؛ تلاش برای ثبت بدون انتخاب، کنترل مربوط را به کادر دید و فوکوس می‌آورد و خطا کنار دکمهٔ ثبت هم دیده می‌شود. مسدودسازی ایستای رابط برای ارسال حذف شد، بنابراین پس از تعریف سیاست معتبر، درخواست کامل به Backend ارسال می‌شود. Backend همچنان بدون سیاست نسخه‌دار و تأییدکنندهٔ مستقل، انتشار را fail-closed رد می‌کند. ۸ تست مستقیم فرم، lint و typecheck Web و پاسخ HTTP 200 روی Web3100 موفق‌اند.

## 2026-09-21 — پاک‌شدن خطای فرم پس از اصلاح ورودی — READY_FOR_REVIEW

در تعریف و ویرایش بلیط، هر تغییر در مشخصات رفت، برگشت، مسیر ترکیبی، ظرفیت، نرخ و دلیل ویرایش، پیام اعتبارسنجی قبلی را همان لحظه پاک می‌کند. فرم‌های تکرار بلیط، رزرو موقت ظرفیت و تغییر وضعیت نیز همین رفتار را دارند؛ اگر مقدار هنوز نامعتبر باشد، پیام در ثبت بعدی دوباره نمایش داده می‌شود. ۱۰۵ تست Ticket Catalog، lint، typecheck و build تولیدی Web با ۵۰ route موفق‌اند؛ API، داده و Schema تغییر نکرده‌اند.

## 2026-09-21 — اتصال گزارش بلیط‌های صادرشده به رزرواسیون — READY_FOR_REVIEW

صفحهٔ فقط‌خواندنی مدیریت بلیط از قرارداد عمومی موجود رزرواسیون و محدودهٔ شعبهٔ کاربر استفاده خواهد کرد. projection فقط از قراردادهای دارای تخصیص مسافر و پرواز ساخته می‌شود؛ نام مسیر از اطلاعات پایه می‌آید و مقدار PNR/شماره بلیطِ ثبت‌نشده ساخته نمی‌شود. این تغییر فقط Web است و عملیات صدور، استرداد یا دادهٔ عملیاتی ایجاد نمی‌کند.

اتصال کامل شد: loading/error واقعی، خواندن صفحه‌بندی‌شدهٔ درخواست‌های رزرواسیون، projection مسافر/پرواز، نام مسیر، وضعیت ابطال، فیلترها و صفحه‌بندی گزارش فعال‌اند. ۱۰ تست هدفمند، lint محدوده، typecheck کامل Web و build تولیدی موفق‌اند؛ API، Schema/Migration، Dependency/Lockfile و دادهٔ عملیاتی تغییر نکرده‌اند.

## 2026-09-21 — قیمت فروش تکی بلیط — READY_FOR_REVIEW

هر `TicketPublishedOffer` تاریخچه قیمت فروش تکی مستقل با مبلغ Decimal، ارز و نسخه دارد. جدول مدیریت بلیط مبلغ و ارز هر مسیر را مستقیم ویرایش می‌کند؛ بنابراین دو بلیط رفت و برگشت می‌توانند جداگانه فروخته و جداگانه قیمت‌گذاری شوند. در قرارداد بدون هتل/تور، انتخاب هر مسیر قیمت همان پیشنهاد را برای تعداد مسافران دارای صندلی محاسبه می‌کند و snapshot مبلغ هر مسیر را می‌فرستد. قیمت پکیج/تور از مسیر مدیریت قیمت موجود مستقل است. رزرو قرارداد همچنان از تخصیص ظرفیت مشترک Ticket Catalog استفاده می‌کند. ستون حرکت فارسی، راست‌چین و با ارقام پایدار نمایش داده می‌شود.

اعتبارسنجی Prisma، lint، typecheck و build بسته‌های درگیر موفق است؛ تست‌های Database، API و Web نیز موفق‌اند. Migration افزایشی همراه PR ارائه شده و هنوز روی دیتابیس مشترک اجرا نشده است.

## 2026-09-21 — DASHBOARD-SCROLL-STABILITY-0921 — READY_FOR_REVIEW

پرش اسکرول Dashboard برطرف شد. ریشه، ورود و خروج یک ردیف Skeleton سراسری بالای صفحه در هر page/filter query و focus پیش‌فرض ورودی جست‌وجوی فیلتر بود. Loading اکنون با ارتفاع ثابت در خود KPI Cardها و Visualها نمایش داده می‌شود؛ موقعیت viewport در تغییر URL، refetch و پایان دریافت داده حفظ می‌شود، browser scroll anchoring برای workspace خاموش است و focus فیلتر با `preventScroll` انجام می‌شود. ۲۴ تست Dashboard با یک skip موجود، lint و typecheck Web موفق‌اند و Web3000/API4000 پاسخ ۲۰۰ دارند. بررسی تعاملی احرازشده در مرورگر داخلی به‌دلیل redirect به login در دسترس نبود. API، Schema/Migration، داده، Permission و Dependency/Lockfile تغییر نکردند.

## 2026-09-21 — DASHBOARD-FUNNEL-INSIGHT-CLARITY-0921 — READY_FOR_REVIEW

معنای عدد افتِ بخش «بینش» برای همهٔ قیف‌های تصمیم روشن شد: این عدد تعداد موردهایی را نشان می‌دهد که در گذار میان دو مرحله از قیف به مرحلهٔ بعدی نرسیده‌اند، نه یک امتیاز یا درصد مبهم. متن بینش اکنون همان تفسیر را کنار مقدار می‌آورد و یک راهنمای ثابت نیز دارد. ۲۱ تست Dashboard با یک skip موجود و lint فایل تغییرکرده موفق‌اند. API، Schema/Migration، داده، Permission، Dependency/Lockfile و منطق محاسبه تغییر نکردند.

## 2026-09-21 — DASHBOARD-TREND-AXIS-LABEL-OVERLAP-0921 — READY_FOR_REVIEW

هم‌پوشانی انتهای محور X نمودار روند اصلاح شد. علت، نمایش هم‌زمان برچسب دوره‌ای و برچسب اجباری آخرین نقطه با فاصلهٔ ناکافی بود؛ helper مستقل اکنون در این حالت برچسب نزدیکِ قبلی را با آخرین تاریخ جایگزین می‌کند. بنابراین برای روند ۳۰روزه، «شهریور ۳۰» نمایش داده می‌شود و «شهریور ۲۹» که با آن برخورد داشت حذف می‌شود. ۳ تست helper و ۱۸ تست Dashboard با یک skip موجود موفق‌اند و Web3000/API4000 پاسخ ۲۰۰ دارند. Typecheck کامل Web فقط به خطاهای خارج از این Scope در Ticket Catalog/Sales برای قرارداد منتشرنشدهٔ `standaloneSalePrice` متوقف است. API، Schema/Migration، داده، Permission و Dependency/Lockfile تغییر نکردند.

## 2026-09-21 — DASHBOARD-ACQUISITION-TREND-FIX-0920 — READY_FOR_REVIEW

نمودار «روند جذب مشتری به تفکیک کانال» از مسیر trendهای مالی جدا شد؛ علت تکرار خروجی فروش این بود که شناسهٔ آن `salesAmount` را بر حسب زمان جمع می‌زد. اکنون برای هر کانال جذبِ مشخص، یک سری زمانی مستقل از تعداد مشتری یکتا در هر bucket و راهنمای کانال‌ها نمایش داده می‌شود و سری ارز برای این Visual تولید نمی‌شود. تست API ۸/۸، تست Web ۱۸/۱۸ با یک skip موجود و typecheck API/Web موفق‌اند.

## 2026-09-20 — DASHBOARD-DESTINATION-ORDER-KPI-ALIGNMENT-0920 — READY_FOR_REVIEW

KPI «مقصدهای مورد تقاضای مشتریان» به «سفارش‌های دارای مقصد» تغییر یافت. Backend فقط سفارش‌های معتبر دارای مقصد را به‌صورت یکتا می‌شمارد (`orderNumber` و در نبود آن شناسهٔ fact)؛ بنابراین سطرهای متعدد یک سفارش مقدار KPI، مقایسه و روند را تکراری افزایش نمی‌دهند.

## 2026-09-20 — DASHBOARD-VISUAL-DETAIL-OUTPUT-REMOVAL-0920 — READY_FOR_REVIEW

بخش عمومی «خروجی در بازهٔ انتخابی» از Drawer جزئیات تمام نمودارهای Dashboard حذف شد؛ تعریف کسب‌وکار، قاعدهٔ نمایش مبتنی بر Projection، lineage فیچرها، محدودیت‌ها و اقدام گزارش مرتبط باقی مانده‌اند.

## 2026-09-20 — DASHBOARD-REPORT-FILTER-INHERITANCE-0920 — READY_FOR_REVIEW

بازکردن «گزارش مرتبط» از KPI Card یا نمودار Dashboard دامنهٔ فعال Dashboard را به فرم پیکربندی گزارش منتقل می‌کند و فرم فقط فیلترهای تعریف‌شده در کاتالوگ همان گزارش را نگه می‌دارد.

## 2026-09-20 — DASHBOARD-PERCENTAGE-SPARKLINES-0920 — READY_FOR_REVIEW

KPIهای درصدی Dashboard برای هر bucket زمانی روند دریافت می‌کنند و `lead-growth-rate` bucketهای متناظر دورهٔ قبل را مقایسه می‌کند. Schema/Migration، داده، Permission و Dependency/Lockfile تغییری نکردند.

## 2026-09-21 — TOUR-SINGLE-SCREEN-0921 — PC-A

Tour definition uses four-column desktop identity fields and compact controls. Introduction, transport, itinerary and image are same-page tabs with a bounded scrolling content area; the save action remains outside that area. All detail panels remain mounted to preserve in-progress input. Definition only; no pricing, departure, API or database changes.

## 2026-09-21 — PROFILE-AVATAR-UPLOAD-0921 — PC-B — READY_FOR_REVIEW

عکس پروفایل تنظیمات شخصی از مرز اختصاصی Workbench/Documents بارگذاری می‌شود؛ سرور مالک،
شعبه، نوع سند و reference پروفایل را تعیین می‌کند و دریافت فایل فقط برای صاحب همان حساب
ممکن است. شناسه عکس با public service موجود IAM ماندگار و تصویر در فرم تنظیمات و آواتار
مشترک سربرگ نمایش داده می‌شود. فرمت‌ها با پشتیبانی واقعی Documents به PNG/JPEG و سقف
۵ مگابایت محدود شدند. ۱۹ تست هدفمند، lint محدوده، typecheck API/Web و build تولیدی هر دو
برنامه موفق‌اند؛ Schema/Migration/Seed، Permission، Dependency و داده عملیاتی تغییر نکرده‌اند.

## 2026-09-27 — WORKBENCH-CRM-CONTACTS-0927 — PC-B — READY_FOR_REVIEW

دکمهٔ «پیام جدید» میزکار، پیام‌رسان را مستقیم با تب «مخاطبان» باز می‌کند؛ modal انتخاب
واحد به‌عنوان گیرنده حذف شده است. مخاطبان فقط از projection موجود IAM برای حساب‌های فعال
داخلی CRM با شعبهٔ مشترک خوانده می‌شوند و نام کاربری و شعبهٔ هر حساب در رابط نمایش دارد.
واحدها تنها برای قالب متن هستند. هیچ API، Schema/Migration، Permission، Dependency یا دادهٔ
عملیاتی تغییر نکرده است. typecheck و ESLint Web و آزمون‌های متمرکز API/Web پیام‌رسان موفق‌اند.

## 2026-09-27 — WORKBENCH-MESSAGE-TEMPLATE-OVERFLOW-0927 — PC-B — READY_FOR_REVIEW

پیام‌های بلند و قالب‌های چندخطی در حباب گفت‌وگو باقی می‌مانند. حباب حداقل عرض صفر و
سرریز پنهان دارد؛ متن با حفظ line breakهای قالب و شکستن عبارت‌های بدون فاصله نمایش داده
می‌شود. نام فرستنده در صورت نیاز کوتاه و زمان ثابت می‌ماند. API، Schema/Migration، مجوز،
Dependency و دادهٔ عملیاتی تغییر نکرده‌اند. ESLint و typecheck Web و ۳ آزمون متمرکز client
پیام‌رسان موفق‌اند.

## 2026-09-27 — WORKBENCH-MESSAGING-ATTACHMENTS-0927 — PC-B — READY_FOR_REVIEW

پیوست‌های PDF، JPEG و PNG پیام‌رسان داخلی میزکار از endpoint محدود گفت‌وگو بارگذاری
می‌شوند و دیگر به مجوز عمومی `documents.upload` وابسته نیستند. Backend پیش از ذخیره، عضویت
فرستنده در گفت‌وگو و شعبه را کنترل می‌کند و سند را فقط با مالک نشست و reference ثابت
`MESSAGING/MessagingMessage/<clientRequestId>` ثبت می‌کند؛ شناسه‌های همین reference هنگام
ارسال پیام دوباره کنترل می‌شوند. حداکثر حجم هر فایل ۱۰ مگابایت است. ۱۳ آزمون متمرکز API و
۴ آزمون Web، lint و typecheck API/Web و build API موفق‌اند؛ Schema/Migration، Permission،
Dependency و دادهٔ عملیاتی تغییری نکرده‌اند.

## 2026-09-27 — PROFILE-SESSION-LOG-LIMIT-0927 — PC-B — READY_FOR_REVIEW

بخش «لاگ نشست‌ها» حداکثر ۱۰۰ نشست جدیدتر همان حساب را نشان می‌دهد. IAM query را با
ترتیب ایجاد نزولی و `take: 100` اجرا می‌کند؛ client نیز پاسخ‌های قدیمی یا نامحدود را
پس از اعتبارسنجی به همین سقف محدود می‌سازد. ۳ تست API و ۹ تست Web، lint و typecheck
API/Web موفق‌اند؛ Schema/Migration، Permission، Dependency و دادهٔ عملیاتی تغییر نکرده‌اند.

## 2026-09-27 — PROFILE-SESSION-IP-0927 — PC-B — READY_FOR_REVIEW

ستون «IP نشست» کنار وضعیت و زمان‌های هر نشست در Profile نمایش داده می‌شود. فقط IP ثبت‌شده
برای نشست‌های خود کاربر از endpoint موجود IAM استفاده می‌شود و مقدار غایب «ثبت نشده» است.
۹ تست Web، lint و typecheck Web موفق‌اند؛ API، Schema/Migration، Permission، Dependency و
دادهٔ عملیاتی تغییر نکرده‌اند.

## 2026-09-27 — WORKBENCH-REQUEST-PRIORITY-FA-0927 — PC-B — READY_FOR_REVIEW

نمایش اولویت درخواست‌های کارتابل میزکار فارسی شد: «پایین»، «عادی»، «بالا» و «فوری».
مقدار داخلی API تغییر نمی‌کند و مقدار ناشناخته «تعیین نشده» است. ۵ آزمون متمرکز، lint و
typecheck Web موفق‌اند. شرح ذخیره‌شدهٔ هر درخواست نیز از endpoint کارتابل بازمی‌گردد و
در modal جزئیات با حفظ خط‌ها نمایش داده می‌شود؛ یک آزمون API، ۵ آزمون Web، lint و typecheck
API/Web موفق‌اند.

در فهرست و modal کارتابل، برچسب `NEW` فقط برای آخرین درخواست نمایش داده می‌شود؛ وضعیت‌های
دیگر برای همهٔ ردیف‌ها حفظ شده‌اند.

## 2026-09-27 — WORKBENCH-MESSAGE-LAYOUT-0927 — READY_FOR_REVIEW

چیدمان گفت‌وگوی داخلی برای پیام‌های بلند اصلاح شد: ستون‌ها و ناحیهٔ پیام overflow افقی
ندارند، عرض حباب به کوچک‌ترینِ ۸۵٪ پنل یا ۴۲rem محدود است و متن بلند درون حباب با اسکرول
عمودی دیده می‌شود. ۹ آزمون متمرکز Web، ESLint فایل، typecheck Web، build تولیدی Web با ۵۲
مسیر و `git diff --check` موفق‌اند. API، Schema/Migration، Permission، Dependency و دادهٔ
عملیاتی در این واحد تغییر نکرده‌اند.

## 2026-09-27 — WORKBENCH-REQUESTS-FRONTEND-CLEANUP-0927 — READY_FOR_REVIEW

کامپوننت رابط ارجاعات امور مشتریان حذف شد و کارتابل میزکار فقط درخواست‌های ثبت‌شدهٔ کاربر
و جزئیات داخلی همان درخواست‌ها را نگه می‌دارد. ۷ آزمون متمرکز Web، typecheck، build تولیدی
Web با ۵۲ مسیر و `git diff --check` موفق‌اند؛ ثبت و گردش درخواست در backend تغییر نکرده است.

## 2026-09-27 — WORKBENCH-REQUESTS-PRESENTATION-0927 — READY_FOR_REVIEW

کارت‌های کارتابل میزکار با شمایل درخواست، شمارهٔ پیگیری، پیش‌نمایش شرح، واحد مقصد و فوریت
فارسی بازطراحی شدند. دکمهٔ جزئیات popup با متن کامل شرح، وضعیت فارسی و موعد اقدام باز می‌کند.
۸ آزمون متمرکز Web، ESLint فایل‌های متاثر، typecheck، build تولیدی Web و `git diff --check`
موفق‌اند؛ API و دادهٔ درخواست تغییر نکرده‌اند.

## 2026-09-27 — WORKBENCH-MESSAGE-CONTAINMENT-0927 — READY_FOR_REVIEW

حباب پیام در دسکتاپ حداکثر ۷۵٪ ستون گفت‌وگو و در نمایش کوچک حداکثر عرض همان ستون است.
متن بلند در بدنهٔ ۷rem با اسکرول مستقل دیده می‌شود و پنل پیام نیز ارتفاع ثابت و اسکرول عمودی
دارد؛ عنوان گفت‌وگو و نام فایل پیوست از محدوده بیرون نمی‌زنند. ESLint فایل، typecheck، build
تولیدی Web و `git diff --check` موفق‌اند؛ API و دادهٔ پیام‌رسان تغییر نکرده‌اند.

## 2026-09-21 — TICKET-STATUS-SYNC-0921 — READY_FOR_REVIEW

دکمهٔ وضعیت مدیریت بلیت به رکورد منتشرشدهٔ Backend متصل شد؛ فعال/متوقف‌کردن نسخه‌دار است، جدول پس از ثبت تازه می‌شود و بلیت فعال آینده در قرارداد جدید قابل انتخاب خواهد بود. بلیت گذشته با عنوان «منقضی» نمایش داده می‌شود و قابل فعال‌سازی نیست. ۱۹ تست هدفمند، lint، typecheck و build تولیدی API/Web با ۵۰ route موفق‌اند. شاخه: `codex/pc-a-ticket-status-sync-0921`؛ بدون Migration یا تغییر داده عملیاتی.

## 2026-09-22 — SALES-HOTEL-ROOM-TYPES-0922 — READY_FOR_REVIEW

فرم قرارداد جدید نوع‌های اتاق متصل به هتل در اطلاعات پایه را مستقل از وجود ضریب فعال همان بازه نمایش می‌دهد. نرخ و ظرفیت فعال همچنان از سرویس رزرواسیون خوانده و جداگانه اعلام می‌شود؛ API، Schema/Migration و دادهٔ عملیاتی تغییر نمی‌کنند.

اعتبارسنجی: ۹ تست هدفمند Sales، lint فایل‌های تغییرکرده، typecheck کامل Web و build تولیدی ۵۰ route موفق‌اند.

## 2026-09-22 — SALES-FRIENDLY-REFERENCE-LABELS-0922 — READY_FOR_REVIEW

انتخاب‌گرهای اطلاعات پایه در قرارداد و مدیریت بلیت اکنون فقط نام انسانی گزینه را نمایش می‌دهند و شناسه/کد فنی را برای جست‌وجو و ذخیرهٔ داخلی نگه می‌دارند. هتل، نوع اتاق، بیمه و قاعدهٔ بار پوشش داده شدند؛ کدهای عملیاتی ارز، شماره پرواز و مسیر حفظ شده‌اند. ۳۲۶ تست هدفمند، lint، typecheck کامل و build تولیدی Web با ۵۰ route موفق‌اند؛ API، داده، Migration و localhost تغییر نکرده‌اند. شاخه: `codex/pc-a-sales-friendly-labels-0922`.

## HOTEL-RATE-OCCUPANCY-COEFFICIENTS-0922 — PC-A — READY_FOR_REVIEW

- درخواست مالک در 2026-09-22: نوع اتاق و ظرفیت در جدول نرخ خرید هتل باقی بماند و شش ضریب چیدمان مسافر قبلی در یک ردیف برگردد؛ ضریب خالی به معنی نبود آن چیدمان است. شاخهٔ مستقل `codex/pc-a-hotel-rate-occupancy-coefficients-0922` از `origin/develop@910d1273`؛ محدوده فقط Web نرخ هتل، تست هدفمند و اسناد همین واحد است.
- نتیجه: ستون نوع اتاق به ظرفیت بزرگسال/کودک محدود شد و ضرایب دبل، سینگل، تریپل، دبل + ۱ بچه، دبل + ۲ بچه و فمیلی در یک ردیف مستقل بازگشتند. مقدار خالی ارسال نمی‌شود و در محاسبه قیمت نیز «ندارد» است. ۷ تست نرخ هتل، lint فایل‌های تغییرکرده، typecheck کامل و build تولیدی Web با ۵۰ route موفق‌اند.

## HOTEL-RATE-INDEPENDENT-CITY-WINDOW-0922 — PC-A — IN_PROGRESS

- با تأیید مالک، رفع تعارض اسناد با حفظ هر دو طرف انجام شد. همین PR ضرایب، نرخ مستقل شهر/بازه را نیز تکمیل می‌کند؛ انتخاب تور و بلیط فقط در مدیریت پکیج انجام می‌شود.
- محدوده توسعه‌یافته: Reservations Web/API validation/public projection، مصرف‌کننده Package Pricing و تست‌های مرتبط؛ قرارداد ورودی شهر به Port عمومی به‌صورت آرگومان اختیاری افزایشی است. بدون Schema/Migration/Dependency/Permission یا تغییر داده عملیاتی.
- UI: حذف انتخاب تور، فرم سه‌مرحله‌ای شهر/بازه، نرخ/ظرفیت و ذخیره؛ حفظ ضرایب و ظرفیت. PR و ادغام به develop پس از CI صریحاً توسط مالک تأیید شده است.

### HOTEL-RATE-INDEPENDENT-CITY-WINDOW-0922 — READY_FOR_REVIEW

- نرخ هتل بدون انتخاب تور/بلیط و با شهر/بازه ثبت می‌شود؛ مدیریت پکیج نرخ‌های مقصد و بازهٔ معتبر را از Public Port رزرواسیون دریافت می‌کند. محاسبه با تعداد شب سفر انجام می‌شود. ضرایب موجود در قیمت پکیج اعمال و چیدمان بدون ضریب حذف می‌شود؛ ظرفیت اتاق حفظ شده است.
- بررسی: ۲۸ تست هدفمند API، ۸ تست Web، lint و typecheck هر دو بخش، build API و build تولیدی Web با ۵۰ مسیر موفق‌اند. Schema/Migration و دادهٔ عملیاتی تغییر ندارند. رابط در مرورگر واردشده بررسی نشده است.

# SALES-OPTIONAL-HOTEL-RATE-0922 — READY_FOR_REVIEW

نبود ضریب فعال برای نوع اتاق انتخاب‌شده دیگر مانع ایجاد، ویرایش یا تأیید قرارداد نیست. کنترل ظرفیت برای نرخ‌هایی که ظرفیت معتبر دارند حفظ می‌شود و هشدار عبور از ظرفیت همان موقع انتخاب اتاق نمایش داده می‌شود. Schema، Migration، مجوز و داده عملیاتی تغییر نمی‌کنند؛ تست‌های هدفمند، lint، typecheck و build تولیدی API/Web موفق‌اند.

## 2026-09-22 — یکسان‌سازی طراحی خروجی بلیط — READY_FOR_REVIEW

قالب برنددار بلیط که در دانلود مستقیم PDF فعال بود، اکنون در پیش‌نمایش و چاپ مرورگر رزرواسیون نیز نمایش داده می‌شود. جدول قدیمی با سربرگ FLIGHT TICKET، هویت مسافر و قرارداد، کارت مسیر رفت/برگشت، سایه شهرها، ساعت‌ها، وضعیت صدور و هشدار حضور سه‌ساعته جایگزین شد. پیشوند MR/MRS/CHD/INF از همان داده ذخیره‌شده خوانده می‌شود و اطلاعات صدور ساخته نمی‌شود. بارکد Code 39 شماره قرارداد پایین هر دو خروجی قرار دارد. ۲۱ تست هدفمند، lint، typecheck و build تولیدی Web با ۵۰ route موفق‌اند؛ PDF ساختگی رفت‌وبرگشت یک صفحه A4 است و با Chrome/Poppler بررسی بصری شد.

## 2026-09-22 — SALES-TICKET-PRICES-0922 — READY_FOR_REVIEW

زیرماژول مستقل «قیمت بلیط» زیر فروش اضافه شد: فهرست آفرهای منتشرشده، نرخ نسخه‌دار یک‌طرفه و نرخ واحد جفت رفت‌وبرگشت را مدیریت می‌کند. قیمت‌گذاری از مدیریت بلیط حذف و آنجا فقط خواندنی شد. قرارداد یک‌طرفه آخرین نرخ همان آفر و قرارداد رفت‌وبرگشت نرخ دقیق جفت را snapshot می‌کند؛ نبود نرخ جفت fail-closed است. Schema/Migration افزایشی، API idempotent و optimistic، کنترل شعبه/مسیر معکوس و ناوبری تکمیل شد. Prisma validate/generate، typecheck و lint API/Web، ۵۲ تست هدفمند و build تولیدی Web با ۵۱ route و API موفق‌اند.

## 2026-09-22 — PACKAGE-PRICING-BANNER-001 — PC-B — READY_FOR_REVIEW

نسخه منتشرشده هر پکیج در مدیریت قیمت اکنون دکمه «ساخت بنر» دارد و به مسیر اختصاصی همان نوبت می‌رود. صفحه بنر داده واقعی تور، پرواز، هتل/اتاق قابل‌فروش، قیمت فروش و قالب فعال را می‌خواند، پیش‌نمایش HTML/CSS فارسی و RTL می‌سازد و با نبود مقصد، تاریخ، پرواز فعال، قیمت یا ضریب اتاق fail-closed است. اطلاعات خرید، کارگزار، کمیسیون و سود داخلی نمایش داده نمی‌شوند. خروجی تصویر/PDF تا انتشار Public Contract اسناد با پیام روشن غیرفعال است. ۱۷ تست ماژول، lint، typecheck و Production Build ۵۰ مسیر موفق‌اند؛ بدون Migration، قرارداد مشترک، Dependency یا تغییر Documents.

توسعه تکمیلی همین واحد، صفحه اصلی را به Hub دوکارتی «مدیریت قیمت» و «پک جنریتور» تبدیل کرد. صفحه فعلی قیمت‌گذاری در `/sales/pricing/management` حفظ شده است. بر اساس اصلاح صریح مالک در 2026-09-23، بازطراحی تقریبی Generator حذف و تمام ۱۱۸ فایل `Package_Template/1.rar` با مجموع ۳۳۰٬۴۹۴٬۹۴۰ بایت عیناً در ماژول قرار گرفتند. `/sales/pricing/generator` پس از کنترل deny-by-default هر دو مجوز، برنامه کامل مرجع را با سه حالت پکیج، بنر و استیکر، همه قالب‌ها، ورود XLSX/DOCX و خروجی‌های اصلی PNG/PDF/ZIP نمایش می‌دهد. تطبیق SHA-256، ۲۷ تست ماژول، Prettier، lint، typecheck، build تولیدی ۵۲ مسیر و QA بصری هر سه حالت موفق‌اند و کنسول مرورگر خطایی نداشت.

## 2026-09-22 — MASTER-HOTEL-INLINE-ROOM-TYPES-0922 — PC-B — READY_FOR_REVIEW

نوع اتاق دیگر سکشن یا فرم مستقل اطلاعات پایه نیست. در فرم هتل، نام هر نوع اتاق با یک ورودی ساده ایجاد و همان‌جا به انتخاب چندگانه هتل اضافه می‌شود؛ فیلدهای عنوان فارسی، ظرفیت استاندارد و توضیح استفاده از جریان ایجاد حذف شدند. مرجع داخلی و Public Boundary موجود حفظ شده‌اند تا Sales و Reservations بدون تغییر Schema/Contract همچنان شناسه و نام نوع اتاق را مصرف کنند. ۳۵۸ تست Master Data Web، ۵ تست API اقامت، lint، typecheck و build تولیدی Web با ۵۰ مسیر موفق‌اند.

## 2026-09-22 — MASTER-DATA-QA-REMEDIATION-0922 — PC-B — READY_FOR_REVIEW

هفت ایراد قطعی QA اطلاعات پایه رفع شدند: UI مستقل نوع اتاق با جریان inline هتل جایگزین شد؛ عرض فیلتر جغرافیا در breakpoint دسکتاپ به grid تطبیقی تغییر کرد؛ Dialogهای فرم و پروفایل فوکوس را به trigger برمی‌گردانند؛ اعتبارسنجی native انگلیسی با اعتبارسنجی فارسی موجود جایگزین و پیام خطا/راهنما به input، combobox و fieldset متصل شد؛ همه جدول‌های Master Data نام دسترس‌پذیر دارند؛ ستون سازمان و متن منسوخ از ایرلاین حذف شدند. ۳۶۲ تست Web و ۴۴۶ تست API، lint/typecheck Web، Prettier و build تولیدی ۵۰ مسیر موفق‌اند. اسکن a11y دیگر ایراد نام جدول گزارش نمی‌کند؛ دو هشدار باقی‌مانده Select مربوط به false-positive اسکنر روی Radix Root هستند و trigger هر دو نام صریح دارد. Runtime آزمایشی 3101 تا Login بالا آمد، اما نشست احراز‌شده منتقل نشد و هیچ credential یا داده عملیاتی برای دورزدن آن استفاده نشد.

## 2026-09-22 — رفع دانلود PDF قرارداد — READY_FOR_REVIEW

دانلود PDF قرارداد دیگر به تعریف دستی مسیر Chrome و B Nazanin وابسته نیست: runtime مسیر صریح را در اولویت نگه می‌دارد و در نبود آن Chrome/Edge و فونت را از مسیرهای استاندارد ویندوز پیدا می‌کند. نبود فونت اختیاری باعث توقف دانلود نمی‌شود و renderer پس از پایان Chrome تا نوشته‌شدن کامل فایل منتظر می‌ماند. ۲۶ تست هدفمند، lint، typecheck و build تولیدی Web موفق‌اند؛ smoke واقعی روی Windows یک فایل PDF معتبر ساخت. API، قالب قرارداد، Schema/Migration، Permission و داده عملیاتی تغییر نکردند.

## Search-first form lookups — 2026-09-27

- انتخاب‌گرهای جست‌وجوییِ فرم‌ها در Customer Affairs، Documents، HR، Master Data، Organizations، Procurement، Sales و Ticket Catalog پیش از واردکردن عبارت، گزینه یا فراخوانی فهرست ندارند. با اولین عبارت جست‌وجو، همان فیلتر، صفحه‌بندی و انتخاب قبلی حفظ می‌شود.
- این تغییر فهرست‌های ثابتِ فرم و جست‌وجوی صفحه‌های مدیریتی را تغییر نمی‌دهد. هیچ API، داده، سطح دسترسی، Migration، وابستگی یا runtime محلی تغییر نکرده است.

## 2026-09-27 — RESERVATION-MANIFEST-DOWNLOAD-DENSITY-0927 — READY_FOR_REVIEW

MANIFEST همچنان فقط پس از تأیید مالی تحویل مدارک ساخته می‌شود. کلید یکتای دانلود برای همان بلیط، بازه و دامنهٔ خروجی نگه داشته می‌شود تا اگر مرورگر فایل را در تلاش اول ذخیره نکرد، همان خروجی بدون از دست‌رفتن قراردادها دوباره دریافت شود؛ در حالت «فقط جدید» نیز اگر مورد تازه‌ای نبود، خروجی کامل همان بلیط خودکار بازیابی می‌شود. کارت‌های MANIFEST و ردیف‌های جدول رزواسیون فشرده‌تر شدند و ستون «مقصد» با حداقل عرض و وزن خواناتر تثبیت شد. آزمون‌های متمرکز API/Web، prettier و typecheck هر دو برنامه موفق‌اند؛ API، Schema/Migration، Permission و داده عملیاتی تغییر نکرده‌اند.

## 2026-09-27 — TICKET-DB-MIGRATION-RECONCILIATION-0927 — READY_FOR_REVIEW

تاریخچهٔ Prisma دیتابیس محلی چهار Migration ثبت‌شده را داشت که پوشه‌هایشان از `develop` حذف شده بود؛ به همین علت API مدیریت بلیت با schema ناقص خطای ۵۰۰ می‌داد. چهار فایل اصلی همان تاریخچهٔ Git بدون تغییر بازگردانده شدند و hash آن‌ها با blobهای مرجع تطبیق دارد. پس از backup کامل محلی، چهار Migration معوق افزایشی با موفقیت اعمال شد و `prisma migrate status` دیتابیس را up-to-date تأیید می‌کند. دادهٔ بلیت، قرارداد، پرداخت یا Seed حذف/بازنشانی نشده است؛ API و Web محلی به‌ترتیب روی پورت‌های ۴۰۰۰ و ۳۱۰۰ سالم‌اند.

## 2026-09-27 — TICKET-ROUNDTRIP-PRICE-CLEANUP-0927 — READY_FOR_REVIEW

فهرست مدیریت بلیط اکنون قیمت نسخه‌دار رفت‌وبرگشت را برای هر دو پای جفت نشان می‌دهد. حذف امن بلیطِ منقضی همچنان آفر و سوابق قرارداد، مالی، ظرفیت و audit را حفظ می‌کند، اما قیمت‌های فروش یک‌طرفه و تمام نسخه‌های قیمت جفتِ مرتبط را در همان تراکنش حذف می‌کند. صفحهٔ مستقل «قیمت بلیط» نیز با KPIهای رنگی، وضعیت نسخهٔ فعلی و ردیف‌های کارت‌مانند بازطراحی شد. Migration، Dependency/Lockfile و دادهٔ عملیاتی تغییر نکرده‌اند؛ تست متمرکز API و Web، lint فایل‌های جدید/تغییرکرده، build API و build تولیدی Web موفق‌اند. یک lint rule قدیمیِ `react-hooks/exhaustive-deps` در فایل Ticket Workspace در config موجود نیست و تنها مانع lint خود آن فایل است.

## 2026-09-27 — MONEY-INPUT-FORMAT-0927 — READY_FOR_REVIEW

ورودی مبلغ مشترک Web اکنون مقدار را هنگام تایپ با کامای سه‌رقمی نمایش می‌دهد،
اعداد فارسی و عربی را می‌پذیرد و Decimal خام بدون جداکننده را به state و API
می‌فرستد. قیمت فروش یک‌طرفه و رفت‌وبرگشت بلیت، قیمت‌های پکیج، خرید و پرداخت
مالی، نرخ پایه هتل، بودجه کمپین، فاکتور و برآورد خرید، نرخ ثابت کارگزار و سقف
اختیار امضا از این کنترل استفاده می‌کنند. درصد، ظرفیت و تاریخ بدون تغییر
مانده‌اند. Migration، API contract، dependency/lockfile و داده عملیاتی تغییر
ندارند. Prettier و `git diff --check` موفق‌اند؛ اجرای کامل lint/typecheck/test
به دلیل خطای EACCES محیط برای دریافت بسته‌های lockfile‌شده به CI واگذار شد.

## 2026-09-27 — MERGE-CI-SALES-REFERENCES-0927 — READY_FOR_REVIEW

در جریان آماده‌سازی ادغام میزکار، تعارض با آخرین `develop` باعث شده بود بارگذاری اطلاعات پایهٔ فرم قرارداد فروش به حالت all-or-nothing بازگردد و typecheck تولیدی را متوقف کند. بارگذاری دوباره مقاوم شد: هر منبع ناموفق، آرایهٔ خالی می‌گیرد و گزینه‌های موفق، از جمله هتل‌ها، قابل استفاده می‌مانند. سه fixture قدیمی تست فروش نیز صریحاً سرویس «پرواز» را اعلام می‌کنند تا با قاعدهٔ جاریِ الزام پاسپورت فقط برای پرواز خارجی منطبق باشند. API، Schema/Migration، قرارداد، Permission، وابستگی و دادهٔ عملیاتی تغییر نکرده‌اند.

## 2026-09-27 — WORKBENCH-MESSAGE-CARD-LAYOUT-0927 — READY_FOR_REVIEW

پیش‌نمایش طولانی در فهرست گفت‌وگوهای میزکار می‌توانست عرض ستون کناری را بزرگ کند و روی پنل پیام‌ها بیفتد. عرض فهرست و کارت‌ها محدود شد، متن پیش‌نمایش کوتاه می‌شود و پیام‌های بلند داخل کارت خود می‌شکنند؛ برای گفت‌وگو فقط اسکرول اصلی پنل باقی مانده است. lint و typecheck وب موفق‌اند. بررسی تصویری با حساب واقعی در مرورگر خودکار به‌دلیل نشست منقضی‌شده اجرا نشد. بدون API، Schema/Migration، قرارداد، Permission، Dependency/Lockfile یا دادهٔ عملیاتی.

## 2026-09-28 — TICKET-PAIR-PRICE-VISIBILITY-0928 — READY_FOR_REVIEW

ثبت‌شده‌های رفت‌وبرگشت در بالای صفحهٔ قیمت بلیط با جزئیات دو پرواز، ظرفیت، مبلغ و ویرایش نمایش داده می‌شوند. جست‌وجوی مسیر/ایرلاین/شماره پرواز و فیلتر بازهٔ تاریخ رفت اضافه شد. در قرارداد فقط بلیط، مبلغ فروش از نرخ ثبت‌شده خوانده و قفل می‌شود؛ مبلغ توافقی با همان نرخ آغاز و قابل اصلاح است. ۸ تست متمرکز، typecheck، ESLint مرتبط و build تولیدی Web با ۵۳ صفحه موفق‌اند. شاخهٔ جداگانه برای PR به develop آماده می‌شود؛ بدون تغییر API، دیتابیس، مجوز یا وابستگی.

## 2026-09-28 — EXPIRED-TICKET-CARDS-0928 — READY_FOR_REVIEW

بلیط‌های گذشته هنگام بارگذاری و سپس هر دقیقه از کارت‌های عملیاتی مدیریت بلیط کنار می‌روند؛ پاسخ فهرست مدیریتی API نیز فقط بلیط‌های آینده را بازمی‌گرداند. توقف خودکار فروش در API حفظ می‌شود و هیچ سابقهٔ قرارداد، مالی یا ظرفیت حذف نمی‌شود. دکمهٔ قرمز حذف، آیکون با کنتراست درست دارد. ۲۰ تست وب و ۸ تست API، lint هدفمند، typecheck و build تولیدی Web/API موفق‌اند. بدون Migration، تغییر قرارداد عمومی، مجوز یا وابستگی.

## 2026-09-28 — WORKBENCH-FEEDBACK-HR-LAYOUT-0928 — READY_FOR_REVIEW

نظرسنجی میزکار فقط برای منابع انسانی ارسال می‌شود. مقصد در فرم ثابت است و API نیز مقصد دیگری را برای ارسال جدید نمی‌پذیرد؛ نمایش نظرسنجی‌های قدیمی برای واحدهای دیگر حفظ شده است. ردیف پیوست و دکمهٔ حذف آن برای فاصله‌گذاری درست و نام فایل بلند بازطراحی شدند. ۶ تست سرویس، lint/typecheck و build وب و API موفق‌اند. بدون Schema/Migration، Dependency/Lockfile یا تغییر دادهٔ عملیاتی.

## 2026-09-28 — MESSAGING-DELIVERY-ATTACHMENTS-0928 — READY_FOR_REVIEW

پیوست پیام‌رسان اکنون با مرجع واقعی `MESSAGING` اعتبارسنجی می‌شود؛ خطای نادرست «متعلق به این رکورد نیست» برای فایل تازه‌بارگذاری‌شده رفع شد. متن و نام فایل برای اعضای گفت‌وگو نمایش داده می‌شوند، گیرنده فایل را از مسیر محدود به همان گفت‌وگو دریافت می‌کند و فهرست/پیام‌ها در تب فعال هر ۱۰ ثانیه تازه می‌شوند. لینک اعلان نیز گفت‌وگوی مربوط را باز می‌کند. ۲۲ آزمون API و ۵ آزمون Web، lint/typecheck و build API/Web موفق‌اند؛ آزمون دو حساب واقعی هنوز اجرا نشده است. بدون Schema/Migration، Dependency/Lockfile، Permission grant یا تغییر دادهٔ عملیاتی.

## 2026-09-28 — WORKBENCH-GROUP-CREATE-0928 — READY_FOR_REVIEW

فرم ساخت گروه پیام‌رسان فقط کاربران دارای شعبه مشترک را هم‌زمان انتخاب می‌کند و خطای ساخت را در همان پنجره نشان می‌دهد. دو آزمون هدفمند، lint فایل‌های تغییرکرده، typecheck و build تولیدی وب موفق‌اند. API، IAM، Schema/Migration و داده عملیاتی تغییر نکرده‌اند.

## 2026-09-28 — WORKBENCH-CHAT-DRAFT-RESET-0928 — READY_FOR_REVIEW

هنگام تغییر گفت‌وگو در پیام‌رسان میزکار، متن پیش‌نویس، پیوست انتخاب‌شده و پیام‌های گفت‌وگوی قبلی پیش از نمایش چت تازه پاک می‌شوند. چهار آزمون موجود پیام‌رسان، lint، typecheck و build تولیدی وب موفق‌اند. Backend، Schema/Migration و داده عملیاتی تغییر نکرده‌اند.

## 2026-09-28 — WORKBENCH-OPTIONAL-DOCUMENT-CASE-0928 — READY_FOR_REVIEW

بارگذاری سند از میزکار بدون انتخاب پرونده با مرجع شخصی محدود به کاربر آماده شد. انتخاب پرونده همچنان ممکن است و اعتبارسنجی دسترسی پرونده حفظ می‌شود. ۳۲ تست هدفمند، lint، typecheck و build وب/API موفق‌اند؛ بدون Migration و تغییر قرارداد API.

## 2026-09-28 — WORKBENCH-HR-DOCUMENT-BRANCHES-0928 — READY_FOR_REVIEW

گزینه‌های شعبه در فرم بارگذاری سند به نام‌های فعال ثبت‌شده در منابع انسانی متصل شدند؛ محدوده دسترسی و شناسهٔ اصلی شعبه ثابت ماند. ۲۹ تست API، lint، typecheck و build API/Web موفق‌اند. این تغییر به همان PR #413 افزوده می‌شود.

اصلاح تکمیلی: «جهان باستان» و «نیایش سیر» هر دو رکورد فعال منابع انسانی با یک شناسهٔ دسترسی مشترک‌اند. پاسخ گزینه‌های اسناد اکنون شناسهٔ مستقل هر رکورد سازمانی را به‌صورت فیلد افزوده و سازگار با نسخهٔ قبل ارائه می‌کند تا هر دو در منوی بارگذاری دیده شوند؛ شناسهٔ دسترسی برای مجوز و FK ثابت مانده است. تست رگرسیون، typecheck و build تولیدی API/Web موفق‌اند؛ نسخهٔ یکپارچه روی ۳۱۰۰ و API روی ۴۰۰۰ پاسخ ۲۰۰ می‌دهند.

## 2026-09-28 — DOCUMENT-DETAIL-HIDE-RELATIONS-VERSIONS-0928 — READY_FOR_REVIEW

تب‌ها و محتوای نمایشی «ارتباطات» و «نسخه‌ها» از جزئیات سند حذف شدند؛ داده‌های آرشیو و API دست‌نخورده ماندند. lint، typecheck و build Web موفق‌اند. تغییر در PR #413 برای بازبینی است.

اصلاح ظاهری بعدی: دکمهٔ حذف دائمی در جزئیات سند اکنون از رنگ‌بندی مخرب استاندارد با آیکن سفید استفاده می‌کند تا کنتراست آن روی پس‌زمینهٔ قرمز حفظ شود.

## 2026-09-28 — WORKBENCH-FILES-UPLOADED-ONLY-0928 — READY_FOR_REVIEW

تب «اسناد من» از فایل‌های میزکار حذف و «بارگذاری‌های من» نمای پیش‌فرض شد؛ فهرست اصلی اسناد تغییری نکرد. lint، typecheck و build Web موفق‌اند. تغییر در PR #413 برای بازبینی است.

## 2026-09-28 — WORKBENCH-NOTE-STARS-0928 — READY_FOR_REVIEW

قابلیت ستاره‌دار کردن یادداشت‌های ذخیره‌شده و نمایش آن‌ها در کنار اسناد ستاره‌دار پیاده شد. ذخیرهٔ وضعیت از فیلد پایدار موجود یادداشت استفاده می‌کند؛ Migration لازم نیست. ۱۳ تست هدفمند Web، lint، typecheck و build تولیدی Web موفق‌اند.

## 2026-09-28 — WORKBENCH-CALENDAR-FILTER-0928 — READY_FOR_REVIEW

فیلتر اولویت از نمای «تقویم من» حذف شد. اولویت ثبت‌شدهٔ رویدادها و سایر فیلترها حفظ می‌شوند. ۷ آزمون تقویم، lint، typecheck و build تولیدی Web موفق‌اند.

## 2026-09-28 — TICKET-ROUTE-TIME-FUTURE-0928 — READY_FOR_REVIEW

مسیرهای بلیط به‌جای کد داخلی شهر، نام اطلاعات پایه را بازخوانی می‌کنند؛ تا زمان بازیابی نیز کد فنی نمایش داده نمی‌شود. ویرایش زمان Published Offer دارای قرارداد فقط در صورت ثابت‌ماندن مسیر، ایرلاین، شماره، کلاس و ظرفیت پذیرفته می‌شود؛ Snapshot قراردادهای قبلی دست‌نخورده است و رزرو موقت/تور همچنان مانع ویرایش‌اند. ۴۶ تست هدفمند، lint، typecheck و build Web/API موفق‌اند. تغییر Schema/Migration، قرارداد عمومی، Permission، Dependency/Lockfile و دادهٔ عملیاتی ندارد؛ پس از PR و Merge، runtime یکپارچهٔ develop باید به‌روز شود.

## Workbench calendar attachments — 2026-09-28

Calendar event creation now uses an authorized branch from the authenticated Workbench calendar response when active-company loading is unavailable. Event attachments accept PDF, PNG, and JPEG (up to 10 MB) through a scoped Documents service endpoint, with owner and event source reference checked on save. No migration or permission expansion. Targeted API/Web tests, lint, typechecks, and production builds passed.

## 2026-09-28 — TICKET-PAIR-DESTINATION-DATE-0928 — READY_FOR_REVIEW

مقصد سفر رفت‌وبرگشت هنگام تعریف بلیط و در فهرست قیمت‌های جفتی به‌روشنی نمایش داده می‌شود؛ تاریخ رفت و برگشت هر جفت نیز مشخص است. تاریخ و ساعت هر بلیط در کارت قیمت یک‌طرفه، در ستون چپ با اندازهٔ خواناتر قرار گرفت. تغییر صرفاً Web است و بر داده یا قراردادهای قبلی اثر ندارد.

## 2026-09-28 — PACKAGE-GENERATOR-THAILAND-XLSX-0928 — READY_FOR_REVIEW

Thailand Package Generator maps display-rate columns, hotel room/grade and footer details into the three Thailand layouts. The attached Pattaya workbook was read only; its 67 hotel rows fit without overflow on Pattaya (one page), Phuket (two) and Bangkok+Phuket (three). Eleven affected tests, Web typecheck and production build (53 routes) passed. No API, schema, dependency, permission or operational data changed. See `docs/tasks/PACKAGE-GENERATOR-THAILAND-XLSX-0928.md`.

## 2026-09-28 — PACKAGE-GENERATOR-READABLE-UI-0928 — READY_FOR_REVIEW

رابط پک‌جنریتور در حالت‌های پکیج، بنر و استیکر با فونت و کنترل‌های بزرگ‌تر و پنل پهن‌تر خواناتر شد. طرح‌های پیش‌نمایش و خروجی‌ها دست‌نخورده‌اند. QA دسکتاپ و موبایل، ۱۱ تست هدفمند، lint، typecheck و build تولیدی Web با ۵۳ مسیر موفق‌اند. تغییر فقط CSS رابط و نسخهٔ کش آن است؛ بدون API، داده، مجوز یا Migration.

پیگیری اسکرین‌شات مالک در همان شاخه و PR: نوشته‌های کمکی و کنترل‌های باقی‌مانده در هر سه حالت بزرگ‌تر شدند و چینش میانبرهای پنل برای جا گرفتن متن اصلاح شد. خروجی و تصویر قالب‌ها تغییری ندارند.

## 2026-09-28 — TOUR-MANAGEMENT-0928 — PC-A — READY_FOR_REVIEW

مدیریت تورها اکنون چهار KPI بر اساس فهرست قابل مشاهده، کارت‌های نوبت جاری/آینده با مسیر و تاریخ شمسی، ظرفیت باقی‌مانده واقعی بلیت، جست‌وجوی نام/مقصد و فیلتر وضعیت دارد. تورهای تعریف‌شده فرم ویرایش پیش‌پرشده دارند و PATCH نسخه‌دار تعریف را ذخیره می‌کند. مجوز و شعبه کنترل می‌شود و تغییر هم‌زمان پاسخ 409 دارد. مسیر، هتل‌های تعریف و خدمات مرتبطِ تور دارای هر نوبت ثبت‌شده تغییر نمی‌کند؛ نام و مشخصات توصیفی قابل اصلاح‌اند. ساخت نوبت و ویرایش تعریف برای جلوگیری از race روی همان ردیف تور قفل می‌گیرند؛ موجودی و قراردادهای قبلی حفظ می‌شوند.

تفکیک تعریف تور از مدیریت نوبت/قیمت پکیج و پیوند هتل‌های بازه در آخرین develop حفظ شد. شاخه مستقل `codex/pc-a-tour-management-0928` روی `origin/develop@e4eb048c`؛ checkout اصلی و runtime 3100 دست‌نخورده‌اند. ۵۳ تست API و ۱۱ تست Web، lint محدوده و typecheck کامل API/Web موفق‌اند. build تولیدی API و Web با ۵۳ route موفق‌اند. QA بصری/تعاملی با fixture مصنوعی در دسکتاپ و عرض موبایل انجام شد و overflow افقی ندارد؛ ذخیره واقعی روی دیتابیس عملیاتی آزمایش نشد. بدون Schema/Migration، Dependency/Lockfile، Seed، Permission یا تغییر داده عملیاتی. قفل محدود اسناد با commit نهایی آزاد می‌شود؛ PR به develop و بدون merge خودکار تحویل می‌شود.

## 2026-09-28 — WORKBENCH-TEMPLATE-STARS-0928 — READY_FOR_REVIEW

قالب‌های اولیهٔ یادداشت نیز دکمهٔ ستاره دارند. ستاره‌زدن، یک نسخهٔ پایدار از قالب در حساب کاربر ذخیره می‌کند و آن را در «ستاره‌دارها» نشان می‌دهد؛ قالب تکراری بعد از بارگذاری مجدد حذف می‌شود. API و دیتابیس تغییر نکرده‌اند.

## 2026-09-28 — WORKBENCH-CALENDAR-EDIT-0928 — READY_FOR_REVIEW

رویدادهای شخصی تقویم میزکار اکنون با فرم قابل ویرایش‌اند و وضعیت آن‌ها با گزینه‌های «برنامه‌ریزی‌شده»، «فعال»، «تکمیل‌شده» و «لغوشده» تغییر می‌کند. گزینه‌ها با فیلتر تقویم همسان‌اند؛ ذخیره با کنترل نسخهٔ موجود API انجام می‌شود. ۷ آزمون تقویم، lint، typecheck و build Web موفق‌اند؛ Migration یا تغییر قرارداد لازم نیست.

## 2026-09-28 — WORKBENCH-HOME-AVATAR-0928 — READY_FOR_REVIEW

قاب مربعی خوشامدگویی خانهٔ میزکار عکس پروفایل ذخیره‌شدهٔ کاربر را نمایش می‌دهد و پس از تغییر عکس در تنظیمات شخصی تازه می‌شود. در نبود عکس، حروف نام نمایش داده می‌شوند. typecheck، lint و build تولیدی Web موفق‌اند؛ API یا داده تغییر نکرده است.

## 2026-09-28 — WORKBENCH-PASSWORD-VISIBILITY-0928 — READY_FOR_REVIEW

فرم تغییر رمز میزکار برای رمز فعلی، رمز جدید و تکرار آن دکمهٔ مستقل نمایش/پنهان‌سازی دارد. مقدار فیلد با تغییر حالت حفظ می‌شود؛ API و قواعد رمز دست‌نخورده‌اند. lint، typecheck و build Web موفق‌اند.

## 2026-09-28 — WORKBENCH-FILES-COPY-0928 — READY_FOR_REVIEW

متن توضیحی زیر عنوان «فایل‌های من» حذف شد. نمایش و بارگذاری فایل‌ها بدون تغییر است.

## 2026-09-28 — WORKBENCH-HIDE-VERSION-NOTE-0928 — READY_FOR_REVIEW

فیلد «یادداشت نسخه» از فرم بارگذاری شخصی در «فایل‌های من» پنهان شد و در فرم اصلی اسناد باقی ماند. lint، typecheck و build Web موفق‌اند.

## 2026-09-28 — WORKBENCH-DOCUMENT-RETURN-0928 — READY_FOR_REVIEW

بازکردن سند از خانه، فایل‌های من، ستاره‌دارها یا تقویم میزکار و بستن جزئیات آن اکنون کاربر را به همان تب میزکار برمی‌گرداند. بازگشت به چهار مقصد مجاز محدود است. ۹ آزمون هدفمند، lint، typecheck و build Web موفق‌اند.

## 2026-09-28 — MASTER-DATA-COMPACT-FILTERS-0928 — PC-B — READY_FOR_REVIEW

چیدمان فیلترهای تمام صفحات اطلاعات پایه با یک نوار مشترک، کنترل‌های کوتاه‌تر و عرض منعطف یکدست شد. فیلدها در دسکتاپ در یک ردیف و در عرض‌های کوچک‌تر بدون سرریز بازچینی می‌شوند؛ دکمه‌های پاک‌کردن و تازه‌سازی در ردیف پایین باقی می‌مانند. ۳۶۲ تست اطلاعات پایه، lint، typecheck و build تولیدی Web با ۵۳ مسیر موفق‌اند. بدون Migration، API/Contract یا تغییر داده.

## 2026-09-28 — FINANCE-HISTORY-SEAT-PRICING-0928 — PC-A

Existing unpaid ticket invoices retain the seat/unit-price editor; count, unit cost and automatic total are visible. Persistent branch-scoped receipt/payment history shows each structured installment, transfer date, account/method/reference and remaining amount, including settled requests, with cursor pagination. Request details and the bottom inbox panel refresh after Finance actions. 23 API and 29 Web tests, strict typechecks, scoped lint and API/Web production builds (53 routes) passed. No migration/data/dependency change. See [handoff](tasks/FINANCE-HISTORY-SEAT-PRICING-0928.md). Bounded Finance contract/docs locks released; owner authorizes develop merge.

## 2026-09-28 — B2B-API-FUNCTIONAL-QA-0928 — PC-B

API unit/HTTP suite on latest develop: ۱۶۹۲ passed, ۱۷۵ environment-gated skipped. B2B after fix: ۱۲۷ passed, ۱۹ PostgreSQL skipped because Docker Desktop is stopped and cannot be started in this session. A replay of an old B2B agreement request ID after a newer version now returns a clear 409 instead of misreporting the newer contract as the old command result. Focused regression, lint, typecheck and API build passed. No live data, schema, migration, dependency or shared contract changed. See [task handoff](tasks/B2B-API-FUNCTIONAL-QA-0928.md).

## 2026-09-28 — MASTER-DATA-FINANCE-HEADING-SPACING-0928 — PC-B — READY_FOR_REVIEW

متن توضیحی زیر عنوان ارزها حذف و فاصلهٔ عمودی عنوان تا فیلترهای جست‌وجو فشرده شد. شش تست متمرکز، lint، typecheck و build تولیدی Web با ۵۳ مسیر موفق‌اند؛ محدوده فقط Web و تست‌های مربوط است.

## 2026-09-28 — MASTER-DATA-CURRENCY-CREATE-NO-QUOTE-0928 — PC-B — READY_FOR_REVIEW

بخش ثبت نرخ خرید و فروش از فرم تعریف ارز جدید حذف شد؛ فرم ویرایش ارز موجود و ثبت نرخ آن دست‌نخورده می‌ماند. ۱۷ تست مرتبط، lint، typecheck و build تولیدی Web با ۵۳ مسیر موفق‌اند؛ بدون تغییر API، داده یا Migration.

## 2026-09-28 — Master Data English titles (PC-B)

All English title fields in Master Data forms are optional. API required-field checks match the forms, cabin classes fall back to their booking code for the internal display name, and country/region/city/airport English-name columns become nullable through an additive migration. No live database migration or localhost runtime change was applied by this task.

## 2026-09-28 — Master Data logo display (PC-B)

The uploaded logo ID is now resolved through a narrow authenticated Master Data image endpoint, backed by Documents source-link, active-state, branch and clean-scan checks. Saved logos appear in Master Data forms, relevant lists and profiles; pending scans retry automatically. No live runtime or operational data was changed in this task.

## 2026-09-28 — Master Data heading helper copy (PC-B)

Static guidance immediately beneath titles was removed from the Master Data hub cards, workspace headings, form/profile dialogs and relevant rate/hotel panels. Record metadata, field labels, validation and actionable status messages remain. All 370 Master Data Web tests, scoped lint, Web typecheck and the 53-route production build pass. No API, migration, data or localhost runtime change.

## 2026-09-28 — MASTER-DATA-BANK-BRANCHES-IN-PROFILE-0928 — PC-B — READY_FOR_REVIEW

Bank branches now live in each bank's profile rather than a separate Finance tab. The profile reads branches by the selected bank's real `bankId`, pages results, and provides add/view/edit through the existing branch form with its bank fixed. Existing API/relations and operational records are unchanged. 373 Master Data Web tests, scoped lint, Web typecheck and a 53-route production build passed. No migration, contract, dependency or localhost update.

## 2026-09-28 — MASTER-DATA-API-FORM-QA-0928 — PC-B — READY_FOR_REVIEW

Functional QA across Master Data API/form paths found a real supplier-phone clear bug: an explicit empty value preserved encrypted/masked phone fields. Backend now clears all protected fields only on explicit clear; Web supplier edit omits untouched masked phone and provides an explicit clear action. The outdated PostgreSQL partner fixture was aligned to the standalone supplier contract. Full API: 1,688 pass/175 opt-in or environment skips; Master Data HTTP: 27 pass; isolated PostgreSQL: 57 unique pass; Master Data Web: 376 pass. API/Web typechecks, scoped lint and builds passed. Demo PostgreSQL suite remains unrun because its guard requires port 55432, currently owned by the live app DB; no guard bypass or operational DB write. Details: `docs/tasks/MASTER-DATA-API-FORM-QA-0928.md`.

## 2026-09-28 — CUSTOMER-AFFAIRS-API-FUNCTIONAL-QA-0928 — PC-B — READY_FOR_REVIEW

ثبت درخواست دستی با شناسهٔ منبع ثابت می‌توانست پس از برخورد یکتایی، پروندهٔ قبلی را به‌اشتباه به‌عنوان ثبت موفق برگرداند. فرم‌ها اکنون شناسه/کلید تکرار پایدار در هر ارسال دارند و بک‌اند فقط command یکسان را replay می‌کند؛ برخورد منبع مستقل خطای 409 می‌دهد. تست‌های API ماژول ۱۰۲/۱۰۲ و Web ماژول ۵۷/۵۷، lint، typecheck و build تولیدی API/Web موفق‌اند. دیتابیس ایزوله و ارسال واقعی SMS/وب‌سایت‌ها در این واحد اجرا نشده و هیچ داده/فرآیند ۳۱۰۰ تغییر نکرده است. [گزارش QA](tasks/CUSTOMER-AFFAIRS-API-FUNCTIONAL-QA-0928.md).

## 2026-09-28 — PROCUREMENT-FORM-QA-0928 — PC-B — READY_FOR_REVIEW

The Procurement draft form now tolerates older saved item rows without a measurement unit when loading reusable choices, and publish validation shows the required-field error instead of crashing. A regression test reproduced the `undefined.trim()` error before the fix. The broad API suite passed 1,682 tests with 175 skipped by default guards (209 passed / 15 skipped files). An isolated PostgreSQL 18 container with all 100 migrations then enabled all 35 guarded Procurement database tests: all 92 focused Procurement API tests passed, including draft persistence, atomic publication, rollback, idempotency and workflow handoff. All 10 draft-form tests, API/Web typechecks and builds, scoped lint and Prettier passed. Other guarded integration tests and authenticated browser flows were not executed. No Backend, schema, migration, contract, dependency or operational data changed.

## 2026-09-28 — API-FUNCTIONAL-QA-0928 — PC-B — READY_FOR_REVIEW

Full API regression on updated develop: 210 files and 1,701 tests passed; 175 opt-in tests skipped by default. Two confirmed backend defects were repaired: concurrent identical feedback submission now returns the committed receipt, and anonymous/sensitive Workbench attachments no longer leak identifying metadata or appear in another user's Documents catalogue/audit. Feedback creation verifies attachment confidentiality matches anonymity. Focused Workbench/Documents rerun: 118 passed; API lint, typecheck, production build passed. All 100 migrations and three form writes (meal service, facility, train type) with persistence/audit checks passed on a disposable PostgreSQL database. The opt-in PostgreSQL suites timed out in their Docker stdin helper before assertions, so they are not claimed as passing. No schema, migration, shared contract, dependency, operational data, or live runtime change. Details: [task report](tasks/API-FUNCTIONAL-QA-0928.md).

## 2026-09-29 — DOCUMENTS-SENSITIVE-LIST-PRIVACY-0929 — PC-B — READY_FOR_REVIEW

Shared actor-scoped repository lookups and explicit reference filtering enforce confidentiality and WorkbenchFeedback owner-only visibility across list/count, detail, favorites, file, audit, mutation, and organization-version-reference paths, including INTERNAL attachments and callers with sensitive-read access. 67 focused Documents tests, API lint/typecheck/build, formatting and full CI gates pass; a fresh independent R3 review approves merge. No schema, migration, API type, dependency or operational-data change.

## 2026-09-29 — ISTANBUL-GENERATOR-3100-ACTIVATION — PC-B — IN_PROGRESS

پیگیری قالب‌های استانبول، assetها و loaderهای Package Generator را در build محلی 3100 فعال می‌کند. تغییر مبنا commit `6c2d203f` است؛ اکنون با `origin/develop` همگام شده و منتظر بررسی‌های CI و PR است. API قیمت‌گذاری، Schema/Migration و دادهٔ عملیاتی تغییر نمی‌کنند.

# 2026-09-29 — TICKET-ROUNDTRIP-RETURN-DATE-0929 — PC-A — READY_FOR_REVIEW

مدیریت بلیت برای هر نرخ رفت‌وبرگشت، تاریخ و ساعت پرواز برگشت متناظر را کنار مبلغ نشان می‌دهد و با Tooltip شماره پرواز برگشت را هم توضیح می‌دهد. نرخ‌های چند برگشت یک پرواز رفت جداگانه می‌مانند؛ اگر رکورد برگشت در فهرست نباشد، مبلغ حفظ و تاریخ نامشخص اعلام می‌شود. ۶ تست متمرکز، ESLint فایل‌های متاثر، Web typecheck و build تولیدی با ۵۵ مسیر موفق‌اند. بدون تغییر API، قرارداد، Schema/Migration، Permission، Dependency یا دادهٔ عملیاتی. PR [#465](https://github.com/nirvanamahlou/Rubi/pull/465). جزئیات: [TICKET-ROUNDTRIP-RETURN-DATE-0929](tasks/TICKET-ROUNDTRIP-RETURN-DATE-0929.md).

## 2026-09-29 — WORKBENCH-LIGHT-DARK-0929 — PC-A

Default entry and home links now open Workbench; successful login starts light and manual dark remains available. Legacy panel/gradient/text dark contrast, IAM and System selected surfaces and corporate workspace palette are corrected without changing domain behavior. 250 targeted Web tests pass; lint/typecheck/build and CI checked before owner-authorized merge/local activation. No migration/API/dependency/data changes. Handoff: [WORKBENCH-LIGHT-DARK-0929](tasks/WORKBENCH-LIGHT-DARK-0929.md).

## 2026-09-29 — RESERVATION-OPERATION-SUMMARY-0929 — PC-A — READY_FOR_REVIEW

Selected-contract header now shows read-only financial-delivery approval, responsible name and automatic server time, alongside the latest reservation operator/time. Events no longer displays the operation box. Scoped public Finance/IAM composition, branch/permission checks and native revision/history fallback preserve owner boundaries. No schema/dependency or operational data edits. Validation and limits: [RESERVATION-OPERATION-SUMMARY-0929](tasks/RESERVATION-OPERATION-SUMMARY-0929.md). 45 scoped API tests (including 4 HTTP) and 42 Web tests, strict API/Web types and scoped lint pass; production API build passes and Web build/CI complete before integration; merge authorization for this new reservation work item is separate from prior IAM merges.

# 2026-09-29 — CUSTOMER-AFFAIRS-EXPORT-COMMENTS-0929 — READY_FOR_REVIEW

در شاخه مستقل PC-B، متن‌های اضافی و فیلدهای نمایشی اثر/فوریت حذف شدند، فیلترهای فهرست هم‌ردیف شدند، خروجی XLSX فیلترشده برای درخواست/تیکت، دانلود PDF قابل جست‌وجوی گزارش، فیلتر تاریخ گزارش و API امن ثبت کامنت سایت پیاده شدند. بازبینی مستقل سه مورد PDF غیرواقعی، کوئری سنگین Excel و کامنت فقط فاصله را یافت و اصلاح شدند؛ بازبینی مجدد بدون ایراد تازه بود. ۱۰۶ تست API و ۵۸ تست Web، typecheck، lint متمرکز و build تولیدی API/Web موفق‌اند. اتصال زنده به سایت‌ها بدون تنظیم connector/مجوز و آزمون PDF در مرورگر اجرا نشده؛ هیچ پیام یا داده واقعی آزمون نشده است. CI و انتشار در انتظارند.

## 2026-09-29 — PACKAGE-GENERATOR-MALAYSIA-THAILAND-OVERLAY-0929 — PC-B — IN_PROGRESS

قاب‌های گرد تاریخ و کارت‌های قیمت در هفت قالب مالزی/تایلند پس از ورود داده حفظ می‌شوند؛ متن روزهای طولانی پرواز تایلند در همان کارت می‌پیچد. [گزارش](tasks/PACKAGE-GENERATOR-MALAYSIA-THAILAND-OVERLAY-0929.md). بدون تغییر API، قرارداد، Migration یا دادهٔ عملیاتی.

## 2026-09-29 — TICKET-TIME-VALIDATION-PICKER-0929 — PC-A — READY_FOR_REVIEW

ویرایش بلیت منتشرشده حالا رسیدن در روز بعد از حرکت را برای عبور از نیمه‌شب درست می‌کند؛ با تغییر تاریخ حرکت، روز رسیدن نیز همگام می‌شود و تبدیل ساعت تهران به UTC ترتیب واقعی را حفظ می‌کند. تقویم ویرایش بلیت به popover ثابت و قابل‌موقعیت‌یابی منتقل شد تا از قاب Dialog بریده نشود و در محدودهٔ صفحه بماند. در شاخهٔ همگام‌شده با `develop@1e262f0b`، تست کامل Web با ۱۷۹۵ موفق/۳ اختیاری skip در ۲۹۲ فایل، ۱۶ تست هدفمند، ESLint محدوده، typecheck و build تولیدی Web با ۵۵ مسیر موفق‌اند. بدون API، Schema/Migration، Dependency یا دادهٔ عملیاتی. QA تعاملی مرورگر احراز‌شده انجام نشد. جزئیات: [گزارش تحویل](tasks/TICKET-TIME-VALIDATION-PICKER-0929.md).

## 2026-09-29 — TOPBAR-COMPANY-ROLE-0929 — PC-A — READY_FOR_REVIEW

انتخاب شرکت هدر به Radix Select قبلی برگشت تا عنوان‌ها و نشان شرکت‌ها در منو دوباره دیده شوند. نام نقش‌های فعال واقعی حساب جاری به‌صورت افزایشی و اختیاری از IAM به منوی هدر می‌رسد و زیر نام کاربر نمایش داده می‌شود؛ مجوزها یا حساب‌ها تغییری ندارند. typecheck، lint و build تولیدی API/Web (۵۵ مسیر) موفق‌اند. تست کامل در انتظار CI. بدون Migration، Seed، داده عملیاتی یا Dependency. جزئیات: [TOPBAR-COMPANY-ROLE-0929](tasks/TOPBAR-COMPANY-ROLE-0929.md).

## 2026-09-29 — TOPBAR-ROLE-NEXT-TO-DATE-0929 — PC-A — READY_FOR_REVIEW

نقش‌های فعال کاربر از نشست هدر کنار تاریخ نمایش داده می‌شوند و از دکمه کاربر حذف شدند. ۱۳ تست هدفمند، typecheck، lint و build تولیدی ۵۵ مسیر Web موفق‌اند؛ چهار gate CI مربوط به PR #473 نیز موفق شدند. بدون API، Migration، قرارداد، داده عملیاتی یا Dependency. جزئیات: [TOPBAR-ROLE-NEXT-TO-DATE-0929](tasks/TOPBAR-ROLE-NEXT-TO-DATE-0929.md). شاخه دربرگیرندهٔ آخرین develop است و CI نسخه جدید را اجرا می‌کند.

## 2026-09-29 — TICKET-PRICES-READABILITY-XLSX-0929 — PC-A — READY_FOR_REVIEW

خلاصه پرواز و مسیر خواناتر و کنترل ارز جا‌دارتر شد. خروجی اکسل فیلترهای جاری را رعایت می‌کند و هر رفت‌وبرگشت را با جزئیات دو پرواز، قیمت پایه و مبالغ/درصد مقصدها در یک ردیف می‌آورد؛ قالب راست‌به‌چپ از رزواسیون پیروی می‌کند. Web lint، typecheck و build تولیدی (۵۵ مسیر) و تمام CI (build، quality، test و PostgreSQL) موفق‌اند. PR #470 به develop؛ ادغام با مجوز صریح مالک در انتظار انجام است. بدون API، Migration، داده عملیاتی یا Dependency. جزئیات: [TICKET-PRICES-READABILITY-XLSX-0929](tasks/TICKET-PRICES-READABILITY-XLSX-0929.md).

## 2026-09-29 — SHARED-FORM-DROPDOWNS-0929 — READY_FOR_REVIEW

کنترل مشترک dropdown فرم‌ها زیر فیلد باز می‌شود و حداکثر پنج گزینهٔ اولیه یا مطابق جست‌وجو نشان می‌دهد؛ جست‌وجو در تمام گزینه‌ها باقی مانده است. قرارداد انتخاب و ارسال مقدار، API و داده تغییر نکردند. ۱۱ تست هدفمند، lint، typecheck و build تولیدی Web موفق‌اند.

## 2026-09-29 — TICKET-TARGET-ROWS-0929 — PC-A

مقصدهای قیمت بلیت در باکس‌های دو ردیفی قرار می‌گیرند؛ باکس‌ها متناسب با عرض کنار هم اضافه می‌شوند و بخش مقصدها ارتفاع محدود و اسکرول عمودی دارد. در عرض کم دکمه‌ها به خط مستقل می‌روند تا نام، درصد و قیمت روی هم نیفتند. بدون تغییر API، منطق کمیسیون، Migration یا داده. اعتبارسنجی و تحویل: [TICKET-TARGET-ROWS-0929](tasks/TICKET-TARGET-ROWS-0929.md).

## 2026-09-29 — CUSTOMER-AFFAIRS-ASSIGNEE-COMBOBOX-0929 — READY_FOR_REVIEW

دو کنترل جدا در فرم‌های امور مشتریان با یک انتخاب‌گر جست‌وجودار جایگزین شدند. منوی زیر فیلد پنج کارمند دارای حساب متصل از فهرست HR نشان می‌دهد و جست‌وجوی نام/کد/واحد، شناسهٔ مسئول و محدوده شعبه حفظ شد. ۶۱ تست Web، typecheck و lint محدود موفق‌اند؛ build/CI و فعال‌سازی ۳۱۰۰ در انتظارند.

## 2026-09-29 — TICKET-TARGET-COMPACT-WIDTH-0929 — PC-A — READY_FOR_REVIEW

Each two-target fare box is capped at 22rem (352px), matching the owner's hatched reference instead of stretching across the row. Auto-fill preserves side-by-side boxes and narrow viewport sizing. Two existing tests, CSS formatting and Web production build/typecheck (55 routes) pass. No calculations, API, migration or dependency changes. Local activation authorized; PR #478 targets develop; owner explicitly authorized merge on 2026-09-29.

## 2026-09-29 — RESERVATION-MANIFEST-ROUTE-FILTERS-0929 — PC-A — READY_FOR_REVIEW

برای نتایج منیفست بازه تاریخ، فیلترهای مبدا و مقصد مستقل/ترکیبی افزوده شدند. سه تست، typecheck، lint و build تولیدی ۵۵ مسیر Web موفق‌اند. بازه تاریخ، API، منطق مالی و دانلود تغییری نکرده‌اند. جزئیات: [RESERVATION-MANIFEST-ROUTE-FILTERS-0929](tasks/RESERVATION-MANIFEST-ROUTE-FILTERS-0929.md). PR و CI در انتظار review.

## 2026-09-29 — HEADER-SELECTED-ROLE-TITLE-0929 — PC-A — READY_FOR_REVIEW

نوار بالا فقط عنوان شغلی انتخاب‌شده از نقش‌های فعال IAM را نشان می‌دهد؛ برچسب عمومی مثل `Ramtin full access` یا متن ترکیبی کنار آن دیده نمی‌شود. داده نشست قدیمی نیز پیش از نمایش به یک عنوان معتبر تبدیل می‌شود. typecheck، lint و build تولیدی Web با ۵۵ مسیر موفق‌اند؛ CI پیش از merge اجرا می‌شود. بدون API، Migration، Dependency یا داده عملیاتی. جزئیات: [HEADER-SELECTED-ROLE-TITLE-0929](tasks/HEADER-SELECTED-ROLE-TITLE-0929.md).

## 2026-09-29 — SHARED-TICKET-DEMO-0929 — PC-A — READY_FOR_REVIEW

Owner-confirmed synthetic local catalog snapshot: 20 offers (11 visible, 9 already archived), 4 standalone fares, 4 round-trip fares and 12 commission revisions. Portable fixture plus explicit local-only transactional preview/import/archive CLI, source adoption without duplicate tickets, namespace/branch ownership markers and protected shared price targets. No passenger, contract, payment, identity or credential export; no migration, dependency or other-module mutations. Eight lifecycle/safety tests run through API Vitest, API build/typecheck/lint and real PostgreSQL rollback-only import/reuse/archive lifecycle pass. Original 20 local offers are now marked for later batch removal; no offer was created or archived on the source database. PR #484 targets develop; owner explicitly authorizes merge after CI. Per-computer import/cleanup instructions: [SHARED-TICKET-DEMO-0929](tasks/SHARED-TICKET-DEMO-0929.md).

## 2026-09-29 — CUSTOMER-AFFAIRS-LIST-TOOLBAR-ALIGN-0929 — READY_FOR_REVIEW

دکمه‌های نمای جدولی/مرحله‌ای و خروجی Excel در سربرگ فهرست‌های امور مشتریان هم‌خط و هم‌ارتفاع شدند؛ فاصلهٔ تب‌ها فقط در این نوار حذف شد و چیدمان موبایل محفوظ است. بدون تغییر رفتار عملیاتی. تست متمرکز ۱۰/۱۰ و typecheck موفق؛ CI و merge در انتظار.

## 2026-09-29 — CUSTOMER-AFFAIRS-REPORT-FILTER-BOX-0929 — READY_FOR_REVIEW

فیلتر بازهٔ تاریخ در صفحهٔ گزارش امور مشتریان داخل باکس مستقل تمام‌عرض قرار گرفت؛ منطق فیلتر و گزارش بدون تغییر ماند. ۱۴ تست متمرکز، lint، typecheck و قالب‌بندی موفق‌اند؛ build تولیدی در CI بررسی می‌شود.

## 2026-09-29 — CUSTOMER-AFFAIRS-REQUEST-PROFILE-REDESIGN-0929 — READY_FOR_REVIEW

نمای جزئیات درخواست امور مشتریان با سربرگ روشن، شرح جداگانه، مشخصات سفر برچسب‌دار و ردیف‌های منظم تاریخچه بازطراحی شد. رفتار عملیاتی و داده تغییر نکرده‌اند؛ ۴۲ تست کامپوننت، lint، typecheck و قالب‌بندی موفق‌اند. بازبینی CI و runtime باقی است.

## 2026-09-29 — THAILAND-POSTER-XLSX-0929 — PC-B — READY_FOR_REVIEW

سه اکسل پوکت، پاتایا و بانکوک–پوکت با ستون‌های فروش نهایی و بخش‌های پرواز/خدمات قالب‌های متناظر تطبیق داده شدند. بازبینی تصویری هر سه خروجی و تست نگاشت قیمت انجام شد؛ ۳۶ تست ماژول، lint، typecheck و build تولیدی موفق‌اند؛ PR در جریان است. [جزئیات](tasks/THAILAND-POSTER-XLSX-0929.md). بدون API، Migration، Dependency یا دادهٔ عملیاتی.

## 2026-09-29 — CUSTOMER-AFFAIRS-REQUEST-ACTIONS-SWAP-0929 — READY_FOR_REVIEW

جای دکمه‌های ثبت مشتری و تنظیم پیگیری در پروفایل درخواست مطابق علامت‌گذاری تصویر جابه‌جا شد؛ شرط‌های مجازبودن و رفتار فرم‌ها حفظ می‌شوند. ۴۲ تست امور مشتریان، typecheck وب و قالب‌بندی موفق؛ build و CI پیش از ادغام باقی است.

## 2026-09-29 — CUSTOMER-AFFAIRS-DETAIL-ACTIONS-ROW-0929 — READY_FOR_REVIEW

چهار اقدام اصلی پروفایل درخواست امور مشتریان در یک نوار مشترک قرار گرفتند؛ در دسکتاپ هم‌خط و در عرض کم واکنش‌گرا هستند. عملیات، شرط نمایش و فرم‌ها دست‌نخورده‌اند. ۴۲ تست کامپوننت، typecheck، ESLint، Prettier و diff check موفق‌اند؛ Build/CI در PR بررسی می‌شود. برای حفظ `.next` سرویس فعال ۳۱۰۰، build محلی اجرا نشد.

## 2026-09-29 — LOGIN-COMPANY-CAPTIONS-0929 — PC-A — READY_FOR_REVIEW

نام نمایشی زیر لوگوهای شرکت در صفحه ورود حذف می‌شود؛ خود لوگو، متن جایگزین دسترس‌پذیری و عنوان بخش حفظ شده‌اند. تغییر محدود به Web است؛ بدون API، Migration، داده یا Dependency. اعتبارسنجی CI پیش از merge انجام می‌شود. جزئیات: [LOGIN-COMPANY-CAPTIONS-0929](tasks/LOGIN-COMPANY-CAPTIONS-0929.md).

## 2026-09-29 — DOCUMENTS-CONFIDENTIAL-CODE-0929 — PC-B — READY_FOR_REVIEW

پیگیری امنیتی: کد معتبر اکنون برای همهٔ عملیات تغییر، آرشیو، بازیابی و حذف سند کددار نیز لازم است و کاهش محرمانگی رد می‌شود. سند کددار از جست‌وجوی متن خام و مرتب‌سازی/فیلتر حساس کنار می‌رود. شمارندهٔ تلاش با قفل تراکنشی برای هر کاربر و سند مستقل است؛ اشتباه یک کاربر دسترسی دیگران را نمی‌بندد. این اصلاح Migration جدید یا تغییر دادهٔ عملیاتی ندارد؛ بازبینی مستقل پیش از ادغام لازم است.

در فرم بارگذاری، یادداشت نسخه حذف و پرونده مربوطه اختیاری شد. اسناد جدید با محرمانگی «محرمانه» به کد شش‌رقمی نیاز دارند؛ کد خام ذخیره/بازگردانده نمی‌شود، با scrypt و salt یکتا هش می‌شود و پس از پنج تلاش ناموفق، قفل ۱۵ دقیقه‌ای اعمال می‌شود. کد درست مجوز مشاهدهٔ اطلاعات، پیش‌نمایش و دانلود متصل به کاربر و نشست را برای پنج دقیقه می‌دهد و دسترسی‌های فعلی IAM/شعبه/اسکن همچنان لازم‌اند. اسناد قدیمیِ بدون کد با سیاست فعلی‌شان کار می‌کنند. API سه suite: ۵۶ تست، Web form: ۶ تست؛ typecheck API/Web، lint، Prisma validate، build قرارداد/DB/API/Web و CI (چهار gate) موفق‌اند. Migrationهای ۱۲گانهٔ عقب‌ماندهٔ `develop` به‌علاوهٔ Documents migration روی دیتابیس محلی `rubi` پس از backup معتبر اعمال شد. نسخهٔ جدید روی `http://localhost:3100/documents` با commit `d008e1b6` smoke-test شد (HTTP 200). PR #496 به `develop` باز است؛ بازبینی امنیتی مستقل پیش از ادغام لازم است و worker launcher با permission مستقل در محیط فعلی در دسترس نیست.

## 2026-09-29 — CUSTOMER-AFFAIRS-CUSTOMER-CREATE-0929 — PC-B — READY_FOR_REVIEW

فرم‌های درخواست و تیکت امور مشتریان به جست‌وجوی مشتریان/مسافران موجود و فرم ایجاد مرجع Customers متصل شدند. پیش از جست‌وجو هیچ گزینه‌ای یا درخواست فهرست ندارند؛ سپس نتایج ده‌تایی صفحه‌بندی می‌شوند. ثبت مشتری جدید و انتخاب خودکار پروندهٔ ایجادشده فراهم است؛ داده در Customers می‌ماند و امور مشتریان فقط شناسه را ثبت می‌کند. بررسی runtime، CI و review مالک Customers پیش از ادغام باقی است. جزئیات و ریسک پاسخ نامطمئن API: [CUSTOMER-AFFAIRS-CUSTOMER-CREATE-0929](tasks/CUSTOMER-AFFAIRS-CUSTOMER-CREATE-0929.md).

## 2026-09-30 — CUSTOMER-AFFAIRS-CUSTOMER-CREATE-RUNTIME-0930 — ACTIVE

PR #493 با CI سبز به `develop@5c340730` ادغام شد. build تولیدی Web از همان commit روی پورت ۳۱۱۷ اجرا و درگاه ۳۱۰۰ به آن متصل شد؛ API فعلی ۴۰۰۰ و داده‌ها دست‌نخورده ماندند. هویت runtime، صفحهٔ ورود، هدایت مسیر محافظت‌شده و health API بررسی شدند. برای جلوگیری از ثبت در دادهٔ مشترک، آزمون احرازشدهٔ ساخت مشتری انجام نشد؛ ریسک پاسخ نامطمئنِ POST Customers مطابق [شرح کار](tasks/CUSTOMER-AFFAIRS-CUSTOMER-CREATE-0929.md) باقی است.

## 2026-09-29 — CUSTOMER-AFFAIRS-FOLLOWUP-OVERVIEW-0929 — PC-B — READY_FOR_REVIEW

در فهرست درخواست‌های امور مشتریان، دکمهٔ ردیفی «پیگیری» پروفایل و مشخصات همان درخواست را باز می‌کند. نمای کلی اکنون «آخرین درخواست‌ها» را مستقل از «منتظر پذیرش فروش» و «پیگیری معوق» از API مجازِ شعبه می‌خواند؛ وضعیت `NEW` دیگر به‌علت فیلتر تحویل فروش حذف نمی‌شود. ۲۸ تست متمرکز، typecheck، lint محدود و build وب موفق‌اند؛ CI و بررسی runtime باقی‌اند. [جزئیات](tasks/CUSTOMER-AFFAIRS-FOLLOWUP-OVERVIEW-0929.md).

## 2026-09-29 — CUSTOMER-AFFAIRS-ASSESSMENT-SAVE-0929 — READY_FOR_REVIEW

ارزیابی آمادگی فروش پس از ثبت در پرونده قابل بازخوانی و ویرایش مجدد است؛ دکمه کنار «ثبت ارتباط جدید» و گزارش آخرین نتیجه در پایین پروفایل قرار گرفت. کنترل مرحلهٔ مجاز در API و تفکیک ثبت موفق از شکست بازخوانی افزوده شد. ۲۵ تست Web و ۱۹ تست API، typecheck، lint محدود، build تولیدی و بازبینی مستقل موفق‌اند. آزمون پایگاه دادهٔ زنده و منع مجوز اجرا نشد. بدون Migration/Dependency؛ PR به develop برای بازبینی.

## 2026-09-29 — TICKET-WEEKDAY-RETURN-WINDOW-0929 — PC-A — READY_FOR_REVIEW

تعریف پرواز هفتگی با بازهٔ رفتِ شامل ابتدا و انتها، روزهای تیک‌خورده و عددِ فاصلهٔ برگشت پیاده شد؛ عدد تعداد تکرار نیست. برگشت‌ها خودکار ساخته و تاریخ‌های مشترک یک‌بار ثبت می‌شوند. Min/Max در دیتابیس و قرارداد عمومی ذخیره و در جست‌وجو پیش از صفحه‌بندی، رزرو فروش، انتخاب جفت قیمت و Load تور کنترل می‌شود. Migration فقط روی دیتابیس مصنوعی تست می‌شود؛ لوکال عملیاتی تغییر نکرده است. جزئیات و سازگاری: [TICKET-WEEKDAY-RETURN-WINDOW-0929](tasks/TICKET-WEEKDAY-RETURN-WINDOW-0929.md).

## 2026-09-30 — TICKET-SEAT-TIER-PRICING-0930 — PC-A — READY_FOR_REVIEW

قیمت‌گذاری پله‌ای صندلی برای بلیت یک‌طرفه و جفت رفت‌وبرگشت در فرم قیمت فروش، revisionهای Ticket Catalog و پیش‌فاکتور قرارداد افزوده شد. نرخ‌های قدیمی بدون پله همچنان ثابت‌اند. جزئیات و آزمون‌ها در [TICKET-SEAT-TIER-PRICING-0930](tasks/TICKET-SEAT-TIER-PRICING-0930.md) ثبت می‌شوند.

## 2026-09-30 — DOCUMENTS-010-RECORD-ACTIONS-0930 — PC-B — READY_FOR_REVIEW

اکشن‌های رکوردهای اسناد در نمای کلی، فهرست اصلی و اشتراک‌گذاری به دکمه‌های حذف قرمز با آیکون سفید، ویرایش و مشاهدهٔ کادردار تبدیل شدند. چشم، جزئیات سند را باز می‌کند و محدودیت‌های مجوز و مسیر پیگیری حفظ شده‌اند. ۹ تست هدفمند، lint فایل، Web typecheck، Prettier و Production Build با ۵۵ مسیر موفق‌اند. API/DB/Migration/Dependency تغییر نکرد. Branch `codex/pc-b-documents-record-actions-0930` از `origin/develop@a353bcab` برای PR به `develop` آماده است.

## 2026-09-30 — CUSTOMER-AFFAIRS-ASSESSMENT-REPORT-DESIGN-0930 — READY_FOR_REVIEW

کارت نتیجهٔ ارزیابی آمادگی فروش در پروفایل درخواست امور مشتریان با خلاصهٔ نتیجه/امتیاز/احتمال تبدیل، معیارهای تأییدشده و تأییدنشده در کارت‌های واکنش‌گرا و توضیحات تکمیلیِ دلایل ذخیره‌شده بازطراحی شد. دلایل دارای فاصلهٔ اضافی یا تکراری برای نمایش یکسان‌سازی می‌شوند. ۱۸ تست هدفمند، lint، typecheck، Prettier و build تولیدی Web موفق‌اند. API، داده، فرم ارزیابی و runtime پورت ۳۱۰۰ تغییر نکردند؛ PR به `develop` برای بازبینی ارسال می‌شود.

## 2026-09-30 — PC-A — company flight load

TICKET-LOAD-GRID-0930 adds side-by-side outbound/return load tables above Ticket Management, shared Min/Max eligible return selection, capacity totals and prices, Gregorian defaults, three supply choices and persisted manual economy/optional business baggage. An additive nullable migration preserves legacy provenance. Management Web drains paginated offers. Implementation and validation details: `docs/tasks/TICKET-LOAD-GRID-0930.md`. Operational deployment follows CI and merge to develop.

## 2026-09-30 — PC-A — visible ticket load follow-up

TICKET-LOAD-VISIBLE-0930 fixes the empty legacy load by reading unknown-provenance offers alongside explicit company capacity, without reclassifying stored tickets. Initial dates are unrestricted; editing a conflicting date clears the opposite bound. The duplicate lower published table is removed; selected-leg details retain edit, archive, activation and hold actions. The load uses a white light-mode surface. Explicit floating/API remain excluded. No API, migration or operational data changes. Ticket Catalog tests, scoped lint/types and 55-route Web build passed.

## 2026-09-30 — PC-A — separate selected-leg actions

TICKET-LOAD-LEG-ACTIONS-0930 places an independent action strip at the bottom of each selected outbound/return details box, including active/paused status and existing offer-specific edit, archive, sale activation and capacity-hold controls. Empty legs expose no actions. No API, migration or operational data changes; delivery is a PR for review.

## 2026-09-30 — PC-A — explicit flight-load search and holds

TICKET-LOAD-SEARCH-HOLDS-0930 adds explicit search-gated load tables, valid-date bounds derived from the selected origin/destination, stronger selected-row borders, gray date/carrier/capacity/remaining/sold/held columns and larger flight details. Paused legs have red end cells; enable/disable uses green/red Power icons, and archive uses a trash icon. Capacity reservation requests only quantity and manual requester name, persists nullable attribution, and retains automatic one-hour temporary expiry. PostgreSQL lifecycle checks cover pause/activate, paused-offer exclusion from Sales search and failed contract capacity allocation. No operational backfill or dependency changes.

## 2026-09-30 — PC-A — flight capacity view and history

FLIGHT-CAPACITY-HISTORY-0930 renames the module to تعریف و ظرفیت پرواز, adds independent read-only view actions under selected outbound/return legs, and removes the duplicate lower catalog list, filters and pagination. Management supports optional includePast=true under existing branch/permission checks; default consumers remain future-only. Expired non-archived flights remain available in explicit historical searches, while valid dates derive only future or in-progress charter legs by arrival UTC. No schema, migration or dependency changes. 179 Web regressions and three isolated PostgreSQL lifecycle/HTTP tests passed; default future listings and expired Sales exclusion remain intact.

## 2026-09-30 — PC-A — weekly flight return Max default

FLIGHT-RETURN-MAX-DEFAULT-0930 displays automatic Max from the selected return stay and saves each generated outbound with its own stay plus one day, within the existing 365-day ceiling. Manually edited Max remains authoritative, including clearing for unlimited. No API, schema, migration or dependency changes. Twelve schedule regressions cover different weekday stays, explicit manual values and unlimited compatibility.

## 2026-09-30 — PC-A — charter load defaults and destination filters

CHARTER-LOAD-TODAY-DEFAULT-0930 strengthens selection to a full blue row and renames the heading to «لود پرواز چارتر». Valid dates are checked on entry, begin today in Tehran, and end at the latest matching future departure; already-departed flights are excluded from this mode. Explicit search remains required. Country/city controls replace origin/destination, use Master Data destination geography, and leave matched reverse legs visible. Manual historical ranges retain the opposite displayed date and include past legs. No API/schema/migration/dependency changes.

## 2026-09-30 — MASTER-DATA-RECORD-PRESENTATION-0930 — PC-B — READY_FOR_REVIEW

Master Data record lists now use a dedicated authenticated logo column with a clear fallback across generic, specialized and nested renderers, including expanded geography children, collaboration/payment cards, bank branches and airline baggage rules. Direct power toggles are removed; status remains editable through the existing transport/collaboration form fields. Supplier contract-party KPI/column and airport review KPI are removed, while countries show the exact global related-city total from the existing summary API. Countries already omitted Version on this base; regression coverage locks the 8-data-cell-plus-actions layout and confirms regions/cities retain Version. Focused suites pass (32 tests), scoped Prettier, component ESLint and Web typecheck pass. Browser QA remains unverified because the connector fails with the existing OS error; no migration, API/contract, dependency, database or runtime change was made. Lead owns final build and reviewed commit.

Read-only profile follow-up now gives generic, terminal and every specialized profile a compact shared identity and label/value presentation. Specialized renderers directly compose the shared primitives; duplicate accommodation/supplier/bank identity blocks are removed while custom metrics, tabs, history/approval/reference panels and actions remain. Legacy header metadata remains visible in shared details, including hotel saleability and specialized profile versions. Detail grids respond from one to three columns, RTL remains explicit and long LTR values wrap safely; nested/history `dl` content is not globally restyled. Repeated terminal removals were verified without redundant edits; standalone terminal creation still uses the guarded airport pre-step. Ten focused test files / 56 tests, scoped Prettier, ESLint and Web typecheck pass. Lead owns the final production build.

Final independent verification exposed only a breadcrumb-test false positive: the global eyebrow matcher also saw the valid profile identity eyebrow. The repaired assertion uses the existing TypeScript TSX parser to inspect actual `PageHeader` attributes, including props after nested JSX actions and arrow expressions, and separately proves profile identity eyebrow remains allowed. Product source is unchanged; all 50 Master Data test files / 391 tests, scoped module ESLint and Web typecheck pass. The prior production build remains reusable on identical product inputs.

## 2026-10-01 — LOGIN-LAN-HYDRATION-1001 — PC-A — READY_FOR_REVIEW

LAN login page rendering without working form submission is traced to Next.js development-origin blocking of JavaScript resources. An environment-controlled allowed-origin list enables the local LAN host, while the login form's native fallback uses POST to keep credentials out of query strings. Scope is IAM Web login and Next development configuration only; no migration, dependency or API contract change. Sixteen focused login tests, scoped lint, Web typecheck, Prettier, diff check and 55-route production build pass. Local runtime rollout and browser smoke follow review/merge.

## 2026-10-01 — RESERVATION-DASHBOARD-DATE-FILTER-1001 — PC-A

Reservation operations no longer exposes a separate events tab. The dashboard now has date-basis, start-date and end-date controls, and its metrics reflect the active date range. The existing reservation foundation render regression was updated; no API, schema, migration, dependency or runtime change.

## 2026-10-01 — INDEPENDENT-RAIL-TERMINALS-1001 — PC-B — READY_FOR_REVIEW

The visible Geography terminal catalog now uses a new additive independent rail-terminal resource; legacy aviation terminals remain available only within airport children with their existing schema, API and counts. Rail records require only a name and receive an immutable generated code; optional city FK, English name, coherent local hours, display order, authenticated logo and status are supported. KPI totals use global list totals while distinct cities and valid defined hours are explicitly scoped to the current page. The migration creates only the new table and nullable restrictive city FK; no legacy rows are converted and no operational database/runtime was changed.

## 2026-10-01 — PC-A — reference flight ticket

FLIGHT-TICKET-REFERENCE-1001 shares one reference-style A4 ticket renderer between preview and PDF: Niyayesh and uploaded carrier marks, passenger/contract identity, outbound navy and return teal route cards, selected airport IATA/name, saved departure/arrival, class-specific baggage and independently verified booking-reference QR. No fabricated airport, allowance, flight duration or issuance identifiers. Additive nullable airport FKs and authorized branch-scoped catalog document details retain selected airports at publication. Legacy offers require re-saving the actual definition; no guessed backfill. Existing finance and cancellation gates remain. Synthetic two-leg PDF visually reviewed as one A4 page. Apply migration 20261001103000_ticket_selected_airports before API rollout. No dependency changes or operational data writes.

## 2026-10-01 — Legacy ticket airport compatibility (PC-A)

Missing selected airport code/name render as blank in shared preview and PDF; city labels and all other stored flight facts remain visible. No inferred airport or old-ticket resave/backfill. Local deployment applies only the existing additive selected-airports migration, preserving ticket rows and unrelated pending migrations.

## 2026-10-01 — Ticket visual polish and persistent identity (PC-A)

Shared ticket preview/PDF has Tehran Milad/Azadi and world-landmark silhouettes, geographic world watermark, aligned carrier/company marks, improved airplane and date typography, and a larger bilingual notice. E-Ticket No, canonical carrier code plus saved contract carrier, English-route RLOC and original UTC issue date are displayed. COMPANY allocations receive immutable unique six-digit numbers; floating/API/unknown supply uses explicit six-digit manual entry. New migration `20261001150000_reservation_ticket_documents` is additive and required before deployment; no production/local operational migration or number backfill performed. Draft/old outputs without stored identity keep identifier/date blank.

## 2026-10-01 — RESERVATION-BUNDLED-PURCHASE-1001 — PC-A — READY_FOR_REVIEW

Reservations purchase now prepares one atomic hotel-and-transfer request per contract. Outbound/return transfers share a broker and a per-passenger all-directions price; the hotel panel shows its name, assigned passenger age categories and nightly rates. Finance groups the resulting rows under the contract number and displays each purchase and totals by currency, while preserving individual settlement records. The schema change is additive and prior single purchases remain readable. Focused API/Web tests, scoped lint, both typechecks, Prisma validation and the six-task production build pass. No operational database or runtime change; apply migration before API rollout. User requested develop merge after CI.

## 2026-10-03 — LOGIN-HIGGSFIELD-BACKGROUND-1003 — PC-A — MEDIA_BLOCKED

Prepared optional single-play login video support with matching poster fallback and reduced-motion source suppression. Higgsfield rejected Seedance 2.5, Mini, Kling 2.6 and Grok Lite for account-plan access, including alternatives quoting exactly the available 10 credits; no generation job or video exists. User chose Higgsfield only and to retain a draft. Sixteen login tests, scoped lint, Web typecheck and the 55-route build pass. NOORA compositing and desktop/mobile visual acceptance remain pending. Current login background and local runtime remain unchanged; no merge before verified media. See [task handoff](tasks/LOGIN-HIGGSFIELD-BACKGROUND-1003.md).

### TICKET-NUMBER-CHARTER-FIX-1003 — PC-A

Fixed ticket identity issuance returning PostgreSQL void through Prisma: both advisory locks now return a supported integer column. COMPANY (charter) remains automatic and FLOATING/API/unknown supply remains manual. Airline and agency raster logos fit within the header without overlapping passenger details. Ten API regressions including rollback-only real PostgreSQL locks passed; Web focused tests, lint/typechecks and both production builds passed. Synthetic two-leg A4 PDF visually verified as one page. Two explicitly confirmed local legacy offers classified as COMPANY with actor audit; no passenger ticket number issued during repair. No migration/dependency change.

## 2026-10-03 — SERVICE-PURCHASE-FACTOR-1003 — PC-A

Hotel and transfer purchase entry now uses one base amount and factor per service. Contract check-in/check-out supplies nights, with exact four-decimal arithmetic and a single final rounding. API independently recalculates and rejects altered totals before atomic Finance submission. Calculation inputs and resolved nights are preserved in the existing nullable JSON purchase breakdown; legacy passenger arrays remain readable and previous clients remain accepted. No migration, dependencies or operational data changes. Scoped tests/lint, both typechecks and Web/API production builds verified. Owner requests develop merge after checks.

## RESERVATION-CONTRACT-FORM-BUTTONS-1003 — PC-A

In the selected-contract panel, «فرم رزواسیون» now sits under «عملیات قرارداد» and opens the existing reservation workflow. «مشاهده» now sits under «اطلاعات قرارداد» and continues to open the Sales contract PDF preview. Other contract actions and workflow behavior are unchanged. A focused panel regression covers group placement, the form route and contract preview. No API, schema, migration, dependency or operational-data change.

## 2026-10-03 — RESERVATION-SUPPLIER-PDF-1003 — PC-A — READY_FOR_REVIEW

فرم رزواسیون پیش از چاپ/دانلود نام کارگزار گیرنده را در نسخهٔ گردش‌کار ثبت می‌کند و نام در SUPPLIER هر دو پیش‌نمایش و PDF نمایش داده می‌شود؛ مسیر دانلود مستقیم نیز بدون نام ثبت‌شده 409 می‌دهد. متن راهنما در تنظیمات فرم ویرایش‌پذیر و پیش‌فرض آن Persian است. فیلد راهنمای خلاصه، ستون LEG پرواز و نام برند از پایین فرم ارسالی حذف شدند؛ واچر بدون تغییر ماند. خلاصه بوکینگ فشرده شد و PDF واقعی Chrome برای شش مسافر مصنوعی در یک صفحه A4 بررسی شد. موتور PDF مسیر Chrome/Edge را خودکار پیدا می‌کند، نبود فونت سفارشی را تحمل می‌کند و برای تکمیل فایل روی Windows صبر می‌کند. 17 تست هدفمند و lint فایل‌های تغییرکرده موفق‌اند. پس از بازسازی قراردادهای مشترک، Typecheck سراسری Web نیز بدون خطا موفق شد. بدون Migration، داده عملیاتی یا تغییر مجوز.

## 2026-10-03 — LOGIN-HIGGSFIELD-BACKGROUND-1003 — LOCAL_PREVIEW

Successful Higgsfield composite replaces the previously blocked media draft: exact NOORA lettering, upper-right aircraft, silent one-shot 12-second playback, static poster and reduced-motion fallback. User requested local rollout. Feature branch incorporates origin/develop; no authentication, API, schema or data change. PR #555 contains the final media revision. Sixteen login tests and scoped lint pass.

## 2026-10-03 — LOGIN-TAILWIND-FOLLOWUP-1003 — PC-A

Updated the local login video to a TAILWIND passenger aircraft and exact cloud-textured NOORA. Final Higgsfield composite is 12 seconds at 1280x720; one-shot playback, matching poster and mobile layout verified. 16 login tests and scoped lint pass. All aircraft vapor was later removed at the user's direction. The final smokeless revision is in PR #555.

## 2026-10-03 — LOGIN-ENGINE-VAPOR-1003 — PC-A

Login media now preserves the approved TAILWIND aircraft while emitting animated, independently drifting vapor from both engines; the previous rigid trail was removed. NOORA is centered above the login form. Local assets and cache versions updated; 16 login tests pass. No auth/API/schema/dependency/data changes.

Follow-up visual correction: replace the sparse puffs with denser white continuous turbulent engine plumes. Same approved airliner, centered NOORA and one-shot silent playback. Full Web build/TypeScript, lint and 16 login tests passed; final media rendered and visually inspected.

## 2026-10-03 — RESERVATION-SUPPLIER-PREVIEW-FIX-1003 — PC-A — READY_FOR_REVIEW

Supplier selection now precedes the reservation preview and uses the existing paginated reservation-scoped active broker directory. Reference loading preserves successful lists when another resource fails; loaded pickers remain searchable. Reference pickers no longer wrap interactive options in a label, preventing label activation from reopening selection. The current and historical forms share one preview slot; the print portal is hidden on screen and exposed only by print CSS. Four focused suites / 14 tests pass. Scoped source lint and the 55-route production build (including TypeScript) pass; no migration, dependency, API contract or operational data changes. PR #578 targets develop; user authorizes merge after CI. Scoped source locks release with the reviewed commit. Primary checkout and the running login-video worktree remain untouched.

## 2026-10-03 — RESERVATION-SINGLE-FORM-FOOTER-1003 — PC-A

Reservation supplier forms now select brokers solely from active Master Data and apply draft settings immediately to the single preview. Settings remain below the form; saved PDF/send actions wait for the revision to be persisted. All passengers remain in one logical form instead of repeating the whole document per passenger chunk; long lists can naturally span physical pages. Footer contact is Reservation@niyayehseir.com with a deployment-origin QR linking to an authenticated, branch-authorized form viewer. Voucher pagination and existing saved revisions are preserved. No API/schema/migration/dependency or operational data changes. Targeted regression tests, independent QR matrix comparison, scoped lint, typecheck and Web production build pass; synthetic six-passenger A4 layout verified.

## 2026-10-03 — RESERVATION-CONTRACT-TERMS-FINANCE-1003 — PC-A — READY_FOR_REVIEW

The supplied two-page travel-contract terms PDF replaces the previous static file byte-for-byte (SHA256 `8ED0C34F4E94F9802A5CA4F9F0CF45DE9AE49FCB92E1018B4AE30D56206767DC`). Reservations’ existing selected-contract «مفاد» action still downloads that shared asset. Sales’ «مدارک» dialog now includes «دانلود مفاد قرارداد» only after the existing server-side finance-authorized travel-document read succeeds; the API’s financial release checks remain the access gate for the dialog. 13 focused Sales/Reservations tests, scoped lint, Web typecheck and the 55-route production build passed before updating from develop; re-run after merge. The PDF was rendered and visually checked, and the copied file hash matches the supplied source. No API, permission, database, migration or runtime change. See `docs/tasks/RESERVATION-CONTRACT-TERMS-FINANCE-1003.md`.

\r\n

## 2026-10-03 — RESERVATION-COMPACT-ROWS-1003 — PC-A

Reservation request table minimum body-row height decreases from 46px to 36px while the existing 440px scroll viewport and columns remain unchanged. Saved status actor/time renders beside its checkbox so populated flags do not force tall rows; no audit information, permissions or operations are removed. Synthetic browser layout confirms roughly two more complete contracts. Twenty existing foundation/status tests, scoped lint and Web typecheck passed; production build and CI gate the explicitly requested develop merge. No API/schema/migration/dependency/data change.

## 2026-10-03 — B2B-UNIFIED-REPORT-SECTION-1003 — PC-B — READY_FOR_APPROVED_MERGE

Organizations 360 Reports/Audit/Export now form one «گزارش فعالیت‌ها» section, showing category summaries and export guidance alongside the unchanged branch/date filters, activity table, details and authorized-row Excel output. Old Audit/Export browser-history aliases normalize only within Reports; the canonical destination does not add a duplicate history entry. Focused history/activity-export regressions (7), all Organizations tests (135), scoped lint, Web typecheck and 55-route production build pass. Local generated contracts were refreshed from unchanged source. No API/contract, permission, migration/dependency, data or shared-runtime change; no authenticated browser QA. Same native implementation owner completed the bounded four-file UI/history change; lead inspected the exact diff. Usage unavailable. CI gates owner-authorized develop merge; scoped locks release with commit.

## 2026-10-03 — B2B-DOSSIER-LOGO-SUBTITLE-1003 — PC-B — READY_FOR_APPROVED_MERGE

The Organization Dossier subtitle is removed while other section descriptions remain. The uploaded logo now transitions from explicit pending scan states to the existing 62x62 header frame through bounded authenticated metadata retries (2/4/8/16 seconds); image fitting remains contain. Every attempt preserves BRAND/ACTIVE, permission, confidentiality/step-up, MIME/size and CLEAN gates before preview bytes. Organization/ref/version/permission changes abort old work, clear timers and revoke blob URLs. Producer inspection confirms MIME/size persist before initial scan readiness, and viewFile is authorization-based. Focused logo lifecycle tests (35), all Organizations tests (145), scoped lint, Web typecheck and the 55-route production build pass. No backend/API, permission policy, migration/dependency, data or shared-runtime change; no browser QA. Scanning beyond the finite 30-second retry window keeps the fallback until normal refresh. Same native owner implemented and repaired the four-file scope; lead inspected exact gates/lifecycle. Usage unavailable. CI gates owner-authorized develop merge; scoped locks release with commit.

## 2026-10-03 — B2B-HIDE-PAGE-SUBTITLES-1003 — PC-B

Removed the shared subtitle beneath Organizations section main headings (access, commercial, finance and reports). Directory, 360 home and dossier headings already have no subtitle. Main titles, breadcrumbs, actions, hub-card descriptions and form/panel help remain intact. No API, permission, schema, migration, dependency, data or runtime change. Organizations tests 145/145, scoped lint, Web typecheck, 55-route production build, root formatting and diff checks pass. The same native worker implemented and verified the bounded copy removal; lead reviewed the diff. Usage unavailable. CI gates the user-authorized push/develop merge; no live runtime rollout.

## 2026-10-03 — B2B-SALES-CONTRACT-CONNECTION-1003 — PC-B

The agency dossier now resolves the canonical organizational buyer across actor-authorized Customer branches and matches Sales contracts in the explicitly selected authorized contract branch. Framework agreement labels remain distinct from registered operational Sales contracts. A dossier panel exposes existing owner actions for contract PDF, Finance-gated travel documents and exact payment receipts; a new B2B read-only receipt metadata endpoint freshly binds organization, branch, Sales contract and payment before calling Documents public services. No Sales/Finance producer table or financial data is modified.

CRM results are keyed by organization, branch, refreshed authorized session and request revision. Opening/reopening/focus refreshes the projection; stale contexts are hidden immediately and late receipt responses/downloads are suppressed. Unavailable sources do not become zero totals. Frozen contract/advice and scope are in docs/tasks/B2B-SALES-CONTRACT-CONNECTION-1003.md; Final validation passes: Organizations158 tests, B2B API133 passed/19 skipped, focused HTTP/contract/context regressions, scoped lint, Contracts/API/Web typechecks and production builds (55 Web routes), root Prettier and diff checks. Independent final R3 review and CI precede the user-authorized develop merge. Same persistent native worker implemented and repaired the bounded scope; lead reviewed attribution/owner gates/deferred delivery; usage unavailable. No schema/migration, dependency or live runtime rollout.

Independent review of candidate29d70e6b found B2B-R3-01 unavailable-source KPI values and B2B-R3-02 owner-masked receipt metadata compatibility. Same worker repaired both with real KPI rendering and mixed protected/ordinary receipt regressions; fresh candidate review must explicitly resolve both before merge.

## 2026-10-03 — B2B-INITIAL-STATUS-1003 — PC-B

Removed the read-only initial status display from step one of the cooperation registration wizard as requested. Draft/submission lifecycle and validation remain unchanged. No API, schema, dependency, permission, data or runtime change; targeted checks and CI precede authorized develop merge.

## 2026-10-03 — B2B-HIDE-WARNING-COLUMN-1003 — PC-B — READY_FOR_APPROVED_MERGE

The Organizations desktop list no longer displays the warning header or its matching placeholder cell. Credit, remaining header/body alignment, mobile cards and row operations are unchanged. All 133 Organizations tests, scoped lint, Web typecheck and the 55-route production build pass. The first typecheck exposed stale local contracts output after branch reuse; rebuilding current contracts source resolved it without tracked shared/source edits. No API, migration/dependency, data or runtime change. Owner explicitly authorized push and develop merge; normal CI gates the merge. Same native task owner implemented the bounded two-line removal; lead inspected the exact diff. Usage telemetry unavailable.

## 2026-10-03 — B2B-EXCEL-EXPORT-1003 — PC-B

Organizations directory, commercial and dossier exports now use one attached download target with deferred Blob URL cleanup. Existing XLSX artifacts and authorized server filters are preserved. Regression checks cover workbook text/ZIP contents, exact artifact delivery and download cleanup. No API, schema, permission or dependency changes.

## 2026-10-03 — B2B-REGISTRATION-COPY-1003 — PC-B

Removed the visible registration title and explanatory paragraph from the Organizations directory toolbar at the owner's request. Registration and Excel actions retain their existing handlers and the region retains its accessible name. No API, data, migration or runtime change. Validation and user-authorized develop merge are recorded in the matching Work Item.

## 2026-10-03 — RESERVATION-SELECTION-BLUE-1003 — PC-A

Selected Reservation request rows now use the exact screenshot color #0078D7 with white text across all cells and status tones, in light and dark modes. The pink identity-cell override no longer masks selection; unselected status presentation remains intact. Compact row height, viewport, controls and keyboard selection are preserved. Nineteen existing foundation tests and synthetic Chrome computed-style QA pass. Scoped lint/typecheck/build and CI precede user-authorized merge. No API/schema/migration/dependency/data change.

## 2026-10-03 — CUSTOMER-AFFAIRS-REPORT-META-COPY-1003 — PC-B

Removed the fetched-at/access/date-range metadata line from the Customer Affairs report header. Date filters and the selected range passed to PDF export remain unchanged. Four focused component tests, scoped lint, Web typecheck and production build pass. No API, schema, permission, dependency, operational data, or live runtime change.

## 2026-10-03 — VOUCHER-BROKER-LEADER-1003 — PC-A

واچر هتل نام کارگزار را در SUPPLIER و Board او را در TRANSFER نشان می‌دهد. پیش از صدور، کاربر کارگزار و تورلیدر وابسته به او را انتخاب می‌کند یا تورلیدر را با تلفن در اطلاعات پایهٔ همان کارگزار ثبت می‌کند. شمارهٔ کامل تنها در مسیر مجوزدار سند واچر خوانده و ممیزی می‌شود. فیلدهای علامت‌خوردهٔ خلاصه، پرواز، مسافران، توضیحات و پایین واچر حذف و خلاصه فشرده شد. رابطهٔ nullable تورلیدر به کارگزار با migration افزایشی اضافه شده؛ رکوردهای تاریخی بدون کارگزار باقی می‌مانند. Migration عملیاتی اجرا نشده و پیش از rollout API باید اعمال شود.

LOGIN-NO-SMOKE-1003: removed all aircraft vapor from the login video at the user's request. Approved aircraft and centered NOORA retained. Native 12-second video render and mid-flight visual QA passed; local media endpoint serves HTTP 200. No source/API/data/migration changes.

## 2026-10-03 — RESERVATION-SEARCH-BUTTON-1003 — PC-A

Reservations inbox includes a search submit button and native Enter submission. Keyword entry is applied on submission; existing status/service/date/sort filters continue to apply immediately, and clear resets both entry and filters to the default previous-month window. Default bounds now respect the selected contract/received/travel date basis instead of silently forcing contract date. Search normalizes Persian/Arabic digits and Yeh/Kaf consistently across supported fields. Twenty-two foundation regressions cover combined filters, invalid dates, normalized keywords, default date-basis behavior and accessible submit controls. No API/schema/migration/dependency/data change; review PR precedes integration.

## 2026-10-03 — LOGIN-NORA-TITLE-1003 — PC-A

عنوان نمایان صفحهٔ ورود در دسکتاپ و موبایل «سامانه یکپارچه آژانس نورا» است. عنوان تب موجود «ورود امن نورا» حفظ شد. تغییر فقط متن UI است؛ API، داده، مجوز، Migration و وابستگی تغییر نکردند.

## 2026-10-03 — CUSTOMER-FOUR-FIELDS-1003 — PC-A

Pure person/customer creation now asks for exactly first name, last name, phone and address. Role and record-kind selection remain available; passenger/combined-role creation retains full identity fields and companion entry. Customer-only payload omits hidden passenger and metadata drafts, and persists phone and address through existing versioned Contacts/Addresses APIs with partial-create safeguards. API permits customer-only people without national ID while retaining the national-ID requirement for new passenger/combined-role people. No schema/migration/dependency or operational-data changes. Forty-nine focused Web and thirty-four API tests pass; scoped lint, both typechecks/builds and CI gate the user-authorized develop merge.

## 2026-10-03 — RESERVATION-MANIFEST-GREGORIAN-DIRECTION-1003 — PC-A — READY_FOR_REVIEW

Reservations Manifest now renders Gregorian Tehran-local dates and explicit origin → destination paths. Tehran/Antalya city-and-country filters retain both physical legs in correct outbound/return sections; empty messages follow the filtered sections. Nine focused tests, scoped lint, Web typecheck and 55-route production build passed. Full Web lint stalled in the shared runtime; CI gates merge. No API, data, migration or dependency change.

## 2026-10-03 — PURCHASE-CUSTOMER-DATE-RANGE-1003 — PC-A — READY_FOR_REVIEW

Sales new purchase now collects buyer name, phone, address and postal code above passengers, supports a separate canonical buyer/payer and stores an encrypted immutable contract contact snapshot for authorized printable output. New separate buyers use merged customer-only four-field creation without national ID or passenger passport; passenger identity validation is retained. Ticket results require a confirmed valid range, both legs respect its bounds, and changes invalidate prior catalog selections/quotes. 121 Sales/Customers API + 268 Web + 1 PostgreSQL regression passed (1 existing Web test skipped), affected lint/typechecks and API/Web production builds passed; Prisma validate/generate and all 113 migrations passed on a disposable PostgreSQL 18 database. The additive nullable Sales JSONB migration must precede API rollout; existing configured contact encryption keys are reused with domain separation. Primary dirty checkout and running local services remain unchanged. Scoped locks RELEASED; no merge/local rollout requested. See docs/tasks/PURCHASE-CUSTOMER-DATE-RANGE-1003.md.

## 2026-10-03 — INSURANCE-KPI-REPLACEMENTS-1003 — PC-B — READY_FOR_REVIEW

Insurance fourth cards now show `دارای طرح بیمه` and `متصل به طرح‌ها`, computed from existing numeric `planCount` projections over complete unfiltered pagination. Empty ready data renders zero; loading, errors or malformed projections render unavailable. Stale resource responses, duplicate rows, changing/invalid totals and incomplete pages are rejected, and CRUD plus explicit Refresh reload the relation summary. Focused 8 and all 538 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. One unrelated date-range test timed out on the first full run, then its isolated 10 tests and the full rerun passed. No authenticated browser/runtime QA or API/schema/runtime/database change; bounded locks release with commit.

## USER-CREATE-PASSWORD-RESET-1003 — PC-A — READY_FOR_REVIEW

User creation now saves the current explicit access selections even while optional role suggestions are open; weak initial passwords receive clear validation feedback. Canonical system administrators can reset another user using a confirmed password form. IAM rechecks active administrator membership and session, hashes credentials, revokes target sessions and records secret-free audit atomically. Self-service password changes remain unchanged. No schema, migration, dependency or actual user/password change.

84 focused IAM/HTTP tests and 34 Web tests pass; scoped lint, both typechecks and production API/Web builds (55 routes) pass. All 9 isolated PostgreSQL password/reset regressions pass, including old login/access/refresh rejection, administrator session preservation and audit-failure rollback. User authorizes CI-gated develop merge. See [task handoff](tasks/USER-CREATE-PASSWORD-RESET-1003.md).

- Delivery: implementation `a0a1afd4`, [PR #586](https://github.com/nirvanamahlou/Rubi/pull/586) targets develop. Other PCs should fetch the reviewed merge; no migration/dependency step is introduced by this task. Local rollout follows owner authorization while preserving current LAN origins, document storage and unrelated runtime files.

## 2026-10-03 — SALES-DASHBOARD-NEGATIVE-BALANCE-1003 — PC-A — READY_FOR_REVIEW

Sales dashboard aggregation now accepts legitimate negative computed balances from overpayment while rejecting negative payment input. The failing regression was reproduced before the fix; all 88 Sales API tests, scoped lint, formatting, Contracts/Database builds, API typecheck and production build pass. Prisma Client was regenerated locally without database access. No schema, permission, dependency or operational-data change.

## 2026-10-03 — AIRLINE-HIDE-REFERENCE-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

The Airlines list now omits Logo Reference and Integration Connection while preserving IATA, ICAO, airline name, country, the independent authenticated Logo column, status and all actions. Version / Audit was already absent and remains absent; forms, View, Excel, API, audit and integration data are unchanged. Focused 18 and all 538 Master Data tests, scoped ESLint, Web typecheck and the 55-route production build pass. No authenticated browser/runtime QA.

## 2026-10-03 — TRANSFER-PASSENGER-PRICING-1003 — PC-A

Transfer purchase now calculates editable chargeable passenger count times unit price, independent of stay nights. Optional split mode stores each transfer leg with its own broker/currency/count/price in one atomic financial batch. Coverage, server totals, CAS and idempotency remain validated; historical purchase amounts are preserved. No migration/dependency/database changes. See docs/tasks/TRANSFER-PASSENGER-PRICING-1003.md for compatibility and validation.

Validation completed: full Reservations API/Web regressions, shared arithmetic, final focused purchase tests, scoped lint/typechecks and affected production builds pass (55 Web routes). Bounded locks released; PR/develop merge follows owner authorization and CI.

## 2026-10-03 — PROFILE-AVATAR-SAVE-1003 — PC-B

Personal profile photo upload now accepts the edited name and contact details and links the stored document through the existing IAM profile service before responding. The Web form consumes the returned profile, eliminating its second save request after photo upload. Older file-only clients remain supported. No schema, migration, permission, dependency, or operational-data change. Local port 3100 was unavailable during verification, so live account behavior remains unverified; focused tests and build checks gate delivery.

## 2026-10-03 — SALES-STATS-SIGNED-BALANCE-1003 — PC-A

Read-only local diagnosis reproduced SALES_MONEY_INVALID when one of nine contracts had a negative computed outstanding balance. Develop already includes fb9a9df0 for signed aggregation; the active local API was compiled from older source. Added a dashboard-level multi-currency overpayment regression with authorization scope and exact decimal/malformed-value coverage, reusing existing production behavior. All 95 Sales API tests, scoped lint, typecheck and production build pass. No migration, shared contract, dependency or customer/payment mutation in this PR. Local rollout preserves unpublished login/user-reset commits; its existing pending additive develop migrations are tracked separately.

## 2026-10-03 — PERSIAN-CALENDAR-DIRECTION-1003 — PC-A

Calendar right arrows now advance and left arrows go back across shared DatePicker, Customers, Ticket Catalog, Sales date range, Marketing, Workbench and HR shifts. Explicit LTR navigation/day grids keep Persian Saturday-to-Friday headers aligned with dates inside RTL forms. Existing Gregorian order, conversion, date values and month/year paging remain intact. All 59 focused regressions, scoped lint, Web typecheck and 55-route webpack production build pass. No API/schema/migration/dependency/data/runtime change or authenticated browser QA; bounded locks released. See `docs/tasks/PERSIAN-CALENDAR-DIRECTION-1003.md`.

## 2026-10-03 — MASTER-DATA-REVIEW-KPIS-1003 — PC-B — READY_FOR_REVIEW

Seven remaining review/completion KPI cards now use validated global-summary metrics across Accommodation, Finance, Suppliers, Travel Services and Transportation. Invalid/loading/error/missing values remain unavailable rather than becoming fabricated zero; genuinely ready empty summaries show zero, and stale summary responses are ignored. Focused 65 and all 561 Master Data tests, scoped ESLint, Web typecheck, scoped Prettier and the 55-route production build pass. API/schema/backend remain unchanged. No authenticated browser/runtime QA; bounded locks release with commit.

## 2026-10-03 — AIRCRAFT-MODEL-KPI-1003 — PC-B — READY_FOR_REVIEW

Aircraft Types now replaces `انواع بدنه` with `مدل‌های یکتا`, counted from trimmed nonblank canonical `model` values across the existing complete unfiltered global summary. The first three cards, other resources and existing stale/loading/error/pagination guards remain unchanged. Focused 18 and all 562 Master Data tests, scoped ESLint, Web typecheck, scoped Prettier and the 55-route production build pass. No API/schema/backend/data/runtime change or authenticated browser QA; bounded locks release with commit.

## 2026-10-03 — B2B-REMOVE-ACCESS-SECTION-1003 — PC-B

Removed the Users and Access section/card from agency360 and its workspace panel mount. Legacy browser access history resolves to the dossier home, preserving browser navigation. Stored users, security permissions, global system users and historical activity reporting remain unchanged. Organizations159 tests, scoped lint/typecheck/format and production build validation; lead bounded diff review and CI precede user-authorized push/develop merge. No API/schema/dependency/runtime change. PC-A can fetch develop after merge.

## 2026-10-03 — RAIL-HIDE-EXTRA-COLUMNS-1003 — PC-B — READY_FOR_REVIEW

Rail Companies now displays code, company, country and organization from its resource-specific column model, plus the renderer's independent authenticated Logo, status and operations columns. Logo Reference, Integration Connection and `انواع قطار` are hidden only from this table; Version / Audit remains absent, and forms/View/export/backend plus every other resource remain unchanged. Focused 15 and all 563 Master Data tests, scoped ESLint, Web typecheck, scoped Prettier and the 55-route production build pass. No authenticated browser/runtime QA; bounded locks release with commit.

## 2026-10-03 — B2B-KPI-HIDE-NOTES-1003 — PC-B

Removed secondary explanatory text beneath colored KPI values in the agency directory and360 dossier. Labels, values, styling and unavailable-versus-zero semantics remain intact. Existing Organizations tests, scoped lint/typecheck/format and Web production build validate the bounded presentation change; CI precedes authorized push/develop merge. No API/schema/dependency/runtime or stored-data change. PC-A can fetch develop after merge.

## 2026-10-03 — TRAIN-INLINE-FACILITIES-1003 — PC-B — READY_FOR_REVIEW

Train Types create/edit now provides `افزودن امکان` beside the existing Facilities selector and reuses the canonical Facilities nested form/public API. Successful saves append/deduplicate the returned ID, refresh choices and preserve all other parent draft values; View, locked, saving/disabled and Bus Types behavior remains unchanged. Focused 29 and all 569 Master Data tests, scoped ESLint/Prettier, Web typecheck after refreshing existing Contracts output, and the 55-route production build pass. Coverage is SSR/helper rather than mounted/authenticated browser QA. No API/schema/database/dependency/runtime change; bounded locks release with commit.

## 2026-10-03 — B2B-CREATE-HIDE-DESCRIPTIONS-1003 — PC-B

Removed one-sentence subtitles under main headings in the agency creation wizard: overall dialog, four steps and identity section introduction. Labels, field guidance, validation, OTP, legal warnings and submission behavior remain unchanged. Existing tests, scoped lint/typecheck/format and Web build validate bounded copy removal; CI precedes user-authorized develop merge. No API/schema/dependency/runtime/data change. PC-A can fetch develop after merge.

## 2026-10-03 — B2B-SIGNATORY-FORM-FIX-1003 — PC-B

Improved agency signatory form document loading with context-keyed snapshots, safe owner API error text and retry. Attachment capability now matches the existing B2B public proof-reference service; selection pins the exact proof version and currency dependency is explained. Activation/proof/branch permissions remain enforced. Backend nullable-version resolution remains valid; pinning hardens concurrency consistency. Web Organizations165 tests, focused proof18 and existing API signatory16 tests, scoped lint/typecheck/Prettier and55-route production build pass. No live3100/API listener existed, so the screenshot's deployed fetch cause is still unverified. Local repair only; no API/schema/dependency/runtime change or permission expansion.

## 2026-10-03 — B2B-PHONE-VERIFICATION-1003 resumed integration — PC-B

User resumes dev-only visible test-code delivery and production-disabled sending. Original PR587 is synchronized with latest develop; five-stage verification flow coexists with removed wizard subtitles and current Sales-document client. Existing B2B frozenv1.1 security contract remains unchanged. Focused OTP API16/Web33/Contracts3 and Organizations164 tests pass; independent current-candidate review and remaining checks gate handoff. No SMS.IR secrets/provider, schema/dependency, operating data or runtime change. Local signatory repair remains on separate branch and is not included.

## 2026-10-04 — CONTRACT-TOUR-SEARCH-1004 — PC-A

Sales contracts now have synchronized top/bottom RTL horizontal scrollbars. New-contract tours use the standard searchable dropdown, with five initial active suggestions, date/capacity labels, capacity guards and substring matching across all loaded options before the display limit. Existing tour selection and contract provenance remain unchanged. Shared search already supports middle-text matches; its initial-suggestion regression was updated for Tours. No API/schema/migration/dependency/data change. See docs/tasks/CONTRACT-TOUR-SEARCH-1004.md.

Final validation: scoped ESLint, formatting and Web typecheck pass; production webpack build emits 55 routes. Final focused regression passes (four tests), all Sales/shared tests pass (281, one skipped). Scoped locks released; owner-authorized develop merge follows CI.

## 2026-10-04 — B2B-DOSSIER-CLEANUP-1004 — PC-B

Removed dossier banner organization code, Change Agency and marked Sales relation/document panels; edit/delete actions now accessible icon buttons with existing permissions and variants. Shared authorized branch context drives summary and Sales KPIs. Only assigned session branches appear; user declined expanded memberships and current live actor has HQ only. Backend integrations and document gates remain intact. Organizations171 tests, focused14, scoped lint/format, Web typecheck, API build and55-route Web build pass. User-authorized develop PR/CI and local3100 rollout follow. No migration, dependency or data mutation. Native persistent worker outcome accepted; usage unavailable.

## 2026-10-04 — TICKET-COMMISSION-HIDE-1004 — PC-A

A stored commission of exactly 100 percent means hidden for that sale destination, not a free ticket. Ticket Catalog retains administrative base fares and versioned commissions, marks hidden rules and removes hidden destination/direct fares from active price projections. Sales price management can still edit the original single/pair base; its destination preview and filtered Excel show عدم نمایش instead of a zero fare. Lowering the latest percentage restores that destination without modifying another destination. Existing outbound provider delivery is not initiated by this change. Additive optional Travel projection fields are coordinated with Sales consumers; no schema/migration/dependency/runtime/data change.

## 2026-10-04 — B2B-HUB-COPY-1004 — PC-B

Screenshot691: remove the three hub-card descriptions beneath Finance/settlement, Commercial/contract and Activity report. Titles, chips, navigation and all API/data behavior remain unchanged. Mechanical R0/C1 scope assigned to persistent native worker; lead owns integration. User authorizes push/develop merge; required checks and CI gate delivery. No migration/dependency or permission changes. Usage unavailable.

## 2026-10-04 — B2B-PROFILE-COPY-1004 — PC-B

Remove specified explanatory copy from360 profile/branches/signatories and hide display-order readout. Edit fields and stored order remain intact; no functionality/API/data/permission change. Persistent worker handles bounded Organizations presentation; lead reviews and owns user-authorized push/develop merge. Required checks and CI gate delivery; telemetry unavailable.

## 2026-10-04 — B2B-CONTACT-DISPLAY-1004 — PC-B

Screenshot692 requests readable full representative contacts and icon-only address controls. Full values are backend-masked; existing audited MasterData unmask owner contract remains sole disclosure source and permission unchanged. Frozenv1 requires fresh context, no-store and delayed-result isolation; independent finalreview gates delivery. No migration/dependency/data/permission changes. Current task owns bounded Organizations consumer and existing MasterData Web client method.

## INITIAL-PASSWORD-FOUR-DIGITS-1004 — PC-A — READY_FOR_REVIEW

User creation now accepts 4–200 character initial passwords, including numeric-only credentials. DTO, API service and Users form validation are aligned; reset/change/bootstrap remain strong. 50 API and 20 Web focused tests, scoped lint/format, API/Web typechecks and production builds (55 Web pages) pass. Service-level regressions verify four-digit credential hashing and rejection below four characters. No migration, data rewrite or runtime change. User-authorized develop integration follows PR checks; locks released at delivery.

## 2026-10-04 — B2B-SIGNATORY-LAYOUT-1004 — PC-B

Screenshot693: remove signatory action text and internal-branch display, align date filters to the right in a compact responsive row. Preserve date behavior, branch scope, forms and deletion gates. Bounded Organizations presentation assigned to persistent worker; lead owns user-authorized push/develop merge. No API/data/schema/dependency changes. Checks and CI gate delivery; telemetry unavailable.

## 2026-10-04 — B2B-SIGNATORY-FORM-COPY-1004 — PC-B

Remove four user-specified guidance texts from signatory form; fields, currency dependency, proof validity, inactive save and activation enforcement stay intact. Bounded R0/C1 UI copy assigned to persistent worker. Required checks/CI gate user-authorized push/develop merge. No API/data/schema/permission/dependency changes; usage unavailable.

## 2026-10-04 — SALES-VALIDATION-REFRESH-1004 — PC-A

International Sales registration recovery no longer sends blank hidden local names when valid passport names exist. Pending/duplicate recovery and existing-person updates share a compatible name fallback while preserving nonblank local names, validation, CAS and duplicate protection. Customers Web shows known invalid field labels in Persian from the existing error envelope. No API/schema/migration/dependency/data change. Handoff: docs/tasks/SALES-VALIDATION-REFRESH-1004.md.

Validation: focused47 tests, all Sales/Customers assertions after bounded timeout rerun, scoped lint/formatting and Web typecheck pass. Production build/final CI gate develop merge. The unrelated ticket-price SSR test exceeded5s on this host and passed with one worker/30s process-local limit; repository test configuration was unchanged. Scoped locks released for review.

## 2026-10-04 — B2B-SIGNATORY-UPLOAD-1004 — PC-B

In-form authority proof upload requested with persisted notes and manual activation after upload. Existing backend has no human-review gate: antivirus CLEAN, complete/unexpired exact-org/branch proof remains mandatory. Frozenv1 consumer-only implementation preserves Documents/B2B policy and adds bounded readiness refresh plus stale-upload/save protection. Independent review and required checks gate delivery. No schema/dependency/permission changes.

## 2026-10-04 — B2B-CREDIT-COPY-1004 — PC-B

Removed repeated toolbar title and explanatory copy from policy, guarantee and temporary-credit subviews. Main dossier title, tabs, actions, filters, alerts and forms retain behavior. One Organizations component changes; no API/schema/permission/dependency/data changes. Organizations191 tests, scoped lint/format and Web typecheck pass. Local Webpack compile/typecheck pass; final clean static generation and CI gate user-authorized develop merge. Prior pending agreement-upload source remains isolated and untouched. Telemetry unavailable.
## 2026-10-04 — SALES-EXPERT-NOTE-1004 — PC-A

The optional expert note is available in contract sale pricing and uses existing Sales reservationNote service metadata, read by Reservations explanations. Requests with Sales or Reservations notes have a yellow second (destination) cell, including selected rows, with an explanatory tooltip. Pricing notes remain separate. No schema/API/migration/dependency/runtime change. Focused checks and production build/CI gate user-authorized develop merge.

Validation: 68 focused Sales form/payload and Reservations inbox/feed tests pass, including existing metadata transport and notes projection regressions. Scoped ESLint, formatting and Web typecheck pass; production build and final CI gate develop merge.

## 2026-10-04 — SALES-AGREED-AUTOFILL-1004 — PC-A

New-contract sale-price fields are read-only and derive exactly from agreed prices per service/currency, retaining nightly/total hotel basis and zero/decimal precision. New-form draft projection also mirrors restored values, previews and outgoing payloads; catalog reference prices and historical contracts are unchanged. No API/schema/migration/dependency/runtime change. Focused tests and checks gate authorized develop merge.

Ticket-only activation keeps the catalog freshness guard independent through versioned catalogSaleQuote service metadata. Sales API uses the catalog quote for public Ticket Catalog reserve, falling back to historical daySale for old contracts; malformed new quotes fail closed. Agreements do not rewrite catalog fare sources.

## 2026-10-04 — B2B-PHONE-BRANCH-COPY-1004 — PC-B

Agency phone verification no longer displays the registration-branch selector. Existing authenticated authorized-branch default and OTP branch/session/grant enforcement remain unchanged. One wizard component changes; no API, schema, permission or dependency change. Organizations191 tests, scoped lint/format and Web typecheck pass; final Web build and CI gate user-authorized develop merge. Pending agreement upload task remains isolated.

SALES-AGREED-AUTOFILL-1004 validation: Sales294 tests plus final quote payload3 pass (one environment-dependent skipped); API boundary/catalog targeted12 pass. Scoped lint/API and Web typechecks pass; API build and55-route Web build validate initial candidate; final corrected scalar quote production build, quality, full tests and database CI gates all pass. Concurrent develop merged with appended owner reports retained; refreshed-head CI gates final merge. No local database/runtime change.

## 2026-10-04 — B2B-ADDRESS-INPUT-1004 — PC-B

Agency creation replaces the country selector with one free-text address field in the first step. User confirmed optional country/city in the owner backend. MasterData accepts a null pair, preserves omitted geography on edits and validates complete supplied pairs; additive nullable columns retain restrictive geography FKs and a paired-nullability CHECK. Existing address values and permissions remain unchanged. B2B projection and Organizations displays support absent geography. Task-specific tests, disposable PostgreSQL migration proof and affected builds gate user-authorized push/develop merge; no operational database change.

## 2026-10-04 — B2B-AGREEMENT-UPLOAD-1004 — PC-B

User selected fresh confidential-code access for each submit/approval actor. Documents owns raw organization-proof eligibility; masked list metadata cannot authorize contract references. Frozenv2.1 reserves a narrow opaque-reference producer and transient B2B referenceGrants transport, with credentials excluded from persisted terms/commands/fingerprints/audit. Existing organization/branch, scan/expiry, pinned version and independent approval gates remain. Same strong worker implements; focused/full checks and independent exact-candidate review gate user-authorized push/develop merge. No schema, dependency, permission expansion or operational database change.

B2B-AGREEMENT-UPLOAD-1004 validation checkpoint: user-approved Luna recovery after original implementer usage limit preserves task scope. API286 and Organizations198 tests pass; 19 PostgreSQL opt-in integration tests skipped. Contracts/API static and build checks plus Web lint/typecheck pass; generated database artifacts refreshed only, no operational database/schema change. Final Web build, independent exact-candidate review and CI remain outstanding; no push/merge claim.

B2B-AGREEMENT-UPLOAD-1004 final local validation: Web webpack production build55/55 passed; API286 and Organizations198 tests plus affected lint/typecheck/build gates passed. Independent committed-candidate review and CI remain required before authorized develop merge.
## 2026-10-04 — TICKET-PAYMENT-INLINE-PRICE-1004 — PC-A

Ticket seat/unit/invoice/currency entry moved into the existing Finance ticket payment dialog, removing the separate cost action. Existing public cost command prepares an accepted revision before the existing idempotent payment command; accepted preparation is retained for retries. Source-account filtering and FX follow selected purchase currency, paid-cost lock and receipt retry remain. No backend/schema/migration/dependency/runtime change. Tests/checks/CI gate owner-authorized develop merge.

Finance request page also has a top document-delivery jump button targeting the existing lower panel, with header scroll offset and keyboard focus target. No permission/data change.

Validation: all Finance Web40 tests pass, including retained accepted-cost revision/retry, paid-cost lock and failure handling. Scoped lint/typecheck/production build and final CI gate develop merge; no live financial commands or local deployment. PR648.

B2B-AGREEMENT-UPLOAD-1004 AU-R3-01 repair: deferred confidential-grant publication prevents upload self-invalidation; stale context publication remains blocked. Organizations200 tests and scoped Web static checks pass. Refreshed independent review and final build/CI required; not released yet.

B2B-AGREEMENT-UPLOAD-1004 AU-R3-02: draft upload grant moves atomically with its own new proof scope; submit/approval still request fresh actor grants. Organizations202 tests and Web static checks pass; final review/build/CI gate release.

B2B-AGREEMENT-UPLOAD-1004 final lifecycle checkpoint: session-bound uploads, context-owned busy state and recoverable expired-grant renewal added. Organizations204 tests and scoped Web static checks pass. No database/runtime mutation; exact-candidate final review/build/CI remain release gates.

B2B-AGREEMENT-UPLOAD-1004 PR652: independent review resolved all five lifecycle findings, no open blocker; local checks/build passed. Candidate source frozen and bounded locks released. Final CI/merge pending, no operational runtime/database change.

LOAD-ROUTE-SIDES-1004: PC-A adds both endpoint country/city filters in charter Load and disjoint outbound/eligible-return display. Explicit search snapshots both countries; changing country clears its city and results. Reservation manifest already provides four endpoint controls and route-relative direction, verified by existing tests. No backend/schema/runtime changes.

## 2026-10-05 — SALES-FLOATING-CALENDAR-1005 — PC-A

New-contract flight calendars accept future dates without a separate floating-date checkbox. Existing saleable catalog days remain red-marked, including registered return days with a floating outbound date. Matching catalog pairs retain their outbound filter; floating return dates do not impose an empty catalog allowlist. Return chronology and authoritative ticket capacity/fare checks remain. Sales/DatePicker311 tests pass (one existing skip), seven focused calendar regressions, scoped lint and Web typecheck pass; production build and exact-head CI gate authorized develop merge. No API/schema/migration/dependency/operational data or runtime rollout.

## 2026-10-05 — PROCUREMENT-ICON-THEME-1005 — PC-B — READY_FOR_REVIEW

Procurement record edit/delete glyphs are being repaired locally after confirming the shared `Button` auto-selects its destructive variant for Persian delete labels and the local destructive text utility hides the glyph on that background. Scope is limited to `record-actions.tsx`, meaningful Procurement specs and this unit's docs; callbacks, labels, disabled behavior and confirmation remain in scope for regression checks. No shared Button, API, database, permission, dependency, runtime or DOCX changes are authorized.

The repair uses readable sky/rose light/dark surfaces with hover and focus-ring states. Rendered SSR tests confirm actual labels, Lucide glyphs, disabled output and removal of conflicting destructive tokens; Procurement tests (9 files/36 tests), scoped lint, Web typecheck, the 55-route production build and four-file Prettier checks pass after rebuilding stale `@nora/contracts` dist from existing source exports. Chrome targetable-window/browser QA was unavailable, and no runtime or scheduled DOCX work was attempted.

## 2026-10-05 — FINANCE-SEARCH-SORT-1005 — PC-A

Finance document-delivery candidates now load only after an explicit nonempty contract search; changing/clearing the query discards previous rows and late responses. Finance inbox supports ascending/descending amount, due date and Finance entry timestamp sorting on the server before pagination and export, retained in saved views. Optional v1 query fields preserve existing newest-first clients; exact Decimal amount comparisons remain separate per currency with missing values last. No schema, dependency or migration changes. API Finance100 and Web Finance49 tests passed (eight API/one Web opt-in skips). Scoped lint/format, API and Web typechecks and API build passed. Web production build passed all55 routes; exact-head CI gates the user-authorized develop merge (PR663).

RESERVATION-VOUCHER-GATES-1005: supplier form preview/send requires a directory broker; voucher button waits for sent supplier form and voucher display/issue requires a directory leader from its broker. Canonical directory labels and membership validation used without new data contracts/schema. API152 tests passed (6 existing skips); final Web/static/build/CI gates remain. No local deployment.

## 2026-10-05 — RESERVATION-PURCHASE-BROKERS-1005 — PC-A

Reservations hotel/transfer purchase now reads independent active MasterBroker records rather than BROKER-role organizations. Adds a restrictive broker FK beside the preserved legacy organization FK with exactly-one-source CHECK; public broker validation and Finance/Reservations projections retain v1 compatibility and historical purchases. API166 tests (six opt-in skipped), Web11, API typecheck, Prisma validation/generation and disposable PostgreSQL migration integrity proof pass. Final builds/CI gate release; no real purchase created or develop merge authorized.



## 2026-10-05 — Issued passenger ticket report — PC-A

Ticket Catalog consumes Reservations actual ticket-document issuance through a new branch-scoped public read endpoint. Required issuance-date boundaries use Tehran days; optional contract/passenger/document/route/airline/status filters apply to the entire Excel/PDF server export without UI pagination. Each row is one assigned flight segment; unissued allocations never appear. Empty results produce a valid workbook/PDF. No schema, migration, dependency or operational runtime change. User authorizes develop merge; static/build/CI validation is the merge gate.


ISSUED-TICKET-EXPORT-1005 validation: scoped ESLint, API/Web typecheck, API build and 55-page Web production build pass after refreshing existing generated artifacts. Focused actual-issuance/date/filter/workbook/security/UI tests and real synthetic PDF rendering pass. PR665 exact-head full quality, test, build and PostgreSQL CI gate develop merge. No operational data or local runtime change.

## 2026-10-06 — MARKETING-DOCX-1006 — PC-B — MERGED (PR #672)

The 30 ordered Marketing DOCX paragraphs are represented by durable campaign/asset APIs, owner-side encrypted Customer Affairs intake and full-range source aggregates, and server-backed Marketing forms. Mutations enforce branch permissions, idempotency, CAS and atomic audit; raw phones remain outside Marketing commands/audit. Approval, preview fixtures, usage/history panels and unavailable external publication/dispatch are not presented as successful workflows.

Focused API tests (8 files/58) and Web tests (5 files/25), affected lint/typechecks, contracts/database builds and the API build pass. The final campaign-reference authorization repair has focused API test/lint/typecheck coverage; prior API/Web builds predate only that guard and the final actor-only explanatory copy respectively. Exported reference validation now requires the current actor, Marketing read plus attribution permissions and actor branch membership. Cross-user owner/sales-expert selection remains intentionally incomplete under the approved actor-only placeholder. The pre-index migration passed on disposable PostgreSQL; the amended migration validates/generates, local replay is blocked by `localhost:55473`, and the existing PostgreSQL18 CI migration job is the pending replay path. No live-browser QA. Independent review, refreshed-base integration/CI and browser verification remain before merge; no operational database/runtime change.

Fresh review-repair resolves MKT-R3-001..012: stored asset kinds are immutable and authorized before replay; exact related kinds are branch-scoped; populated campaign declarations round-trip without Decimal/currency/UTM/link loss; partial publication uses stable retry identities. Server data now drives campaign details/budgets, short links retain complete HTTP(S) paths, composer fields and four-port CAS graph edits are durable, and Persian calendar ranges track the displayed month. Marketing uploads omit classification so Documents applies its configured/type policy, and the notification bell invalidates only after successful mutations. API Marketing tests pass 61 with 3 real-PostgreSQL proofs opt-in for the existing PG18 CI job; Web Marketing/calendar tests pass 38; scoped lint, API/Web typecheck and the 55-route webpack build pass. Fresh independent review, refreshed CI PostgreSQL proof and authenticated browser QA remain gates. Actor-only owner/sales-expert selection remains the approved partial IAM placeholder.

Review2 repair closes MKT-R3-002/007/009/011/013/014/015 in the writer candidate: protected uploads retain the Documents code flow without classification override; saved four-port edges are visibly rendered; uncertain create/publication responses preserve and reconcile the same draft before correction; DRAFT reloads can publish; scheduled channel/reset and icon-only controls match displayed state; FORM/LANDING_PAGE relationships and four-decimal budgets round-trip. Web Marketing/calendar passes 46 tests and API Marketing/affected intake passes 61 with 3 local PostgreSQL skips; scoped lint/typechecks pass. Exact-source PG18 proof, fresh independent review and authenticated browser QA remain gates.

Review3 found four remaining partial fixes; its findings supersede the preceding writer closure claim. Bounded recovery on `66c33c17` now defers effective upload classification/code requirements to Documents, shares SVG/card/port geometry, reconciles every uncertain campaign command before corrected inputs, and covers active upload/detail/reference actions with named icons. Stateful real-client tests enforce replay/CAS, including committed lost create/update/publication responses followed by corrections and revoked permissions. Web Marketing/calendar 74 tests and API Marketing/affected intake 61 pass (3 optional local PostgreSQL skips); fresh review and exact-candidate CI/build/PG remain lead-owned. No operational database/runtime or authenticated browser change. See the command-outcome matrix and verification delta in `docs/tasks/MARKETING-DOCX-1006.md`.

Review4's remaining MKT-R3-009 finding is repaired: the campaign client validates the complete success envelope and entity, request identity where supplied, minimum version, valid state and operation-specific create/publication state, plus the requested scheduled instant, before notifications or adoption. Malformed/mismatched 2xx results remain uncertain and replay the same idempotent command. Web Marketing/calendar 79 tests, Web typecheck, scoped ESLint, formatting and diff check pass. Both exact-head CI runs passed all four gates: full quality, full tests, production build, and PostgreSQL 18 migration/seed plus Marketing CAS/replay/rollback proofs. PR #672 merged to `develop` as `eba4f054`. No browser QA, operational database write or local runtime rollout; cross-user owner/sales-expert selection remains partial pending the IAM public selector/validator. See `docs/tasks/MARKETING-DOCX-1006.md`.

## 2026-10-06 — TICKET-DUPLICATES-1006 — PC-A

Read-only local audit found seven identical50-seat Economy flight4512 departures on2026-10-09, created under different catalog request keys; six were retained in the shared test fixture. Publication only deduplicated actor/request keys, and local backfill compared mutable capacity/optional null/default fields. Adds transaction-scoped branch identity protection for publication/revision, semantic flight matching for backfill, exact unused-copy archival migration and archived fixture copies. Preserve distinct cabins/dates/supplies and all referenced/financial history (archived inventory does not remove Finance records). API177/Web183 tests, fixture safety8, API/Web lint/typecheck/build and Web55-route generation pass. Disposable PostgreSQL proof passed concurrent keys/same-key replay and safe archival with price retention; Final committed SQL passed a fresh 121-migration disposable PostgreSQL deploy and both concurrency/archive proof tests; exact-head CI gates the explicitly authorized develop merge. Read-only local repair preview identifies six redundant inventory copies, keeping one canonical offer. No operational database migration or runtime rollout yet.

## 2026-10-06 — Sidebar groups start closed — PC-A

All desktop/mobile sidebar group IDs initialize closed, including groups made visible after asynchronous permission loading. Manual open/close remains route-independent. No access, navigation destination, API or schema changes. User authorizes develop merge; targeted collapse regression, Web lint/typecheck/build and exact-head CI gate merge.

## 2026-10-06 — PROCUREMENT-DOCX-1005 — PC-B — MERGED

All 16 ordered DOCX requests are implemented. Request presentation and filters were simplified; requester/unit/need text is optional without changing audit identity or scope checks. Supplier display/edit keeps existing logo controls and record version; operational records show persisted fields, lines and documents. A branch-scoped Procurement category catalog is backed by an additive Prisma model/migration. Orders support approved-request selection, supplier consistency, tracking and archived attachments, versioned amendment and reasoned cancellation subject to invoice/receipt safeguards. Employee recipient assignment creates only a same-branch authorized follow-up; any separate approval task remains controlled by the snapshotted approved policy. The existing Workbench requests view filters follow-ups by authenticated assignee and authorized branches. Owner decisions: only actual authorized branches are offered; employee assignment is for follow-up and approval remains policy-controlled. PR #669 merged to `develop` as `747c42e4` after CI passed. Local checks: Web45 focused tests; API60 focused tests with37 database-gated skips; dedicated PostgreSQL18 service/export tests40/40; API/Web lint, typecheck and build pass; production Web build generated55 routes. PR Full quality, Full test suite, PostgreSQL18 migration/seed and production build gates passed in both CI runs. Chrome was not targetable; live browser, mobile/tablet, keyboard focus, logo upload appearance and network-loss QA are not claimed. No operational data, IAM permission, payment, external supplier communication or service restart was performed. See `docs/tasks/PROCUREMENT-DOCX-1005.md`.

## 2026-10-06 — B2B-COMPOSE-APPSTACK-1006 — PC-B

New-agency staged contract/guarantee uploads now create fresh confidential access grants and pass each token with its exact document ID to B2B contract save, preventing the service from rejecting confidential proofs after upload. Organizations and API regressions pass (27 each), as do scoped lint, Web typecheck, Contracts build, API dependency build and the 55-route Web production build. PR #673 merged to `develop` as `cf696496`; its exact-head format, lint/typecheck, full test, production build and PostgreSQL18 migration/seed CI gates passed. The first local Compose launch exposed a Next.js app-root issue, tracked and corrected in the follow-up task below. See `tasks/B2B-COMPOSE-APPSTACK-1006.md`.

## 2026-10-06 — B2B-COMPOSE-WEBROOT-1006 — PC-B

Compose now passes `apps/web` as Next.js's project directory. Local image build and service startup passed; API and Web containers report healthy, API health on4192 returns `ok`, and `/login` on3100 returns HTTP200. Existing PostgreSQL, Redis and MinIO containers remain healthy. PR #675 merged to `develop` as `3d48ef15`; formatting, full lint/typecheck, full tests, production build and PostgreSQL18 migration/seed gates passed. No schema, IAM, dependency or operational-record change.

## 2026-10-06 — PROCUREMENT-REQUEST-FORM-REDESIGN-1006 — PC-B — READY_FOR_REVIEW

فرم درخواست خرید با گریدهای مستقل و فشرده بازچینی شد تا کنترل‌های بلند باعث ایجاد فضای خالی کنار فیلدهای دیگر نشوند. متن‌های راهنمای تکراری مسئول پیگیری حذف شده‌اند؛ ثبت دستهٔ تازه، برچسب‌ها، اعتبارسنجی و پیام‌های خطا حفظ شدند. تست متمرکز ۱۱/۱۱، ESLint، TypeScript و build تولید وب با ۵۵ مسیر موفق‌اند. CI کامل PR شمارهٔ ۶۷۷ (quality، test، build و PostgreSQL migration/seed) موفق شد. شاخه: `codex/pc-b-procurement-form-redesign-1006`.

## 2026-10-06 — B2B-CONTRACT-GUARANTEE-PUBLISH-1006 — PC-B — MERGED

Agreement guarantee rows now use the canonical expanded Documents uploader; the screenshot-marked draft helper copy is removed. Agreement form save returns the exact persisted version and submits it with a separate request ID for independent review; sub-section-only edits remain save-only. Confidential proof submission creates fresh action-scoped grants; retries retain the same request/grant payload and explicit rejected grants can be renewed. Partial save/submit failure remains visible and retry never saves a second version. No API, schema, migration, permission or operational data changes. Focused/full Organizations tests, B2B workflow/idempotency/documents tests, Web typecheck/lint/build, exact-candidate independent review and CI remain release gates. See docs/tasks/B2B-CONTRACT-GUARANTEE-PUBLISH-1006.md.

B2B-CONTRACT-GUARANTEE-PUBLISH-1006 review repair: independent review blocked candidate `0b8302c3` on panel-unmount and stale confidential-grant boundaries. A mounted/context/request/proof-scope lease now prevents stale follow-on grants, saves/submits and state updates; deferred-grant regressions were added. After rebase on refreshed develop `6c631406`, Organizations 207/API 18 tests, Web typecheck, scoped lint and Web 55-route production build pass. Fresh review of source candidate `1017b936` reports NO_BLOCKER and resolves both findings; PR #678 merged to develop as `57385c481aa750e1026c73936ab7727a5caa1d34` from source `153d3e47`; exact-head independent review and all CI gates passed. No authenticated contract-upload browser run was performed. The Compose B2B image is active on port 3100; API and web are healthy, `/login` returns HTTP 200, and PostgreSQL, Redis and MinIO remain healthy. A read-only migration status found pending ticket-archive and marketing migrations; none was applied. The ticket migration changes unused duplicate offer statuses and writes audit rows, so the broader develop image awaits explicit authorization for that operational data change.
## 2026-10-06 — PROCUREMENT-ORDERS-UX-1006 — PC-B — MERGED

Supplier logos and per-record read-only previews are available throughout Purchase & Supply; the order list can open the approved request into its order flow. The API exposes only latest-version selections backed by unexpired valid quotations and active suppliers from the public Master Data directory, and paginates after this filtering. Versioned AMEND_ORDER now persists expectedAt, delivery location, payment terms and tracking while preserving omitted values and exact Documents references. Existing authorization, idempotency, immutable-version, approval, quantity, receipt, acceptance, invoice and finance safeguards remain. No hard delete, schema/migration, IAM, payment, external dispatch or runtime change. Verification: Web Procurement 44/44; targeted API PostgreSQL 3/3; API/Web lint and typecheck; Prettier; `git diff --check`; monorepo production build with 55 Web routes. The broader API file had 37 passing and 3 failures against the old persistent test DB (missing newer migrations in unrelated category/Reservations fixtures and one timeout); the DB was not migrated. Manual source review completed; exact-head PR #680 quality, full test, production build and PostgreSQL 18 migration/seed gates passed. PR #680 merged to `develop` as `bec51503`. No authenticated browser/mobile run.


## 2026-10-06 — Procurement order lifecycle cleanup

PC-B condensed the dossier into four workflow groups and simplified selected-order amendments without removing record types or audit history. Supplier/currency linkage is enforced in AMEND_ORDER; metadata-only amendments preserve existing commercial lines. Verification and PR status are tracked in WORK_ASSIGNMENTS.md and docs/tasks/PROCUREMENT-ORDER-LIFECYCLE-CLEANUP-1006.md.

PR #683 merged into develop at `9993f3d4` after all CI gates passed. Source reservation released; no runtime deployment or authenticated browser visual QA.

## 2026-10-06 — SALES-PASSENGER-PRICE-1006 — PC-A

New-contract service day/agreed-price inputs are replaced by passenger whole-package IRR/active foreign-currency table. Totals are the exact saved contract revenue and print/Finance source; no per-service allocation is fabricated. Existing surcharge/capacity/catalog freshness and old unmarked contracts remain. Added scoped actual-cost profit read/display in contract payments, separately per currency, with unknown costs retaining incomplete state. Insurance purchase enters the existing Reservations purchase/Finance workflow. Sales329 Web tests (one skip), focused table/purchase22 and Sales/Finance/Reservations API125 tests pass; scoped lint/typecheck and API/Web production builds pass, including all 55 Web routes. Profit HTTP authentication/permission/branch checks pass; shared Sales contracts 11 tests and final passenger totals 4 tests pass. Exact-head CI remains the merge gate. No schema/migration/dependency/operational DB/runtime change.

## 2026-10-06 — CAMPAIGN-OWNER-OPTIONAL-1006 — PC-B

Campaign owner no longer displays a required marker in the form. Automatic authenticated-user ownership and server authorization remain unchanged. 11 focused tests, affected lint, full Web TypeScript and production build (55 pages) passed. No schema/migration/contract/dependency/runtime/data change or authenticated browser QA. PR #685 awaits exact-head CI before user-authorized develop merge; bounded locks released.


## 2026-10-06 — Procurement category add shortcut

PC-B added an accessible, non-submit Add button beside the purchase-category label. It opens/focuses the existing new-category input and reuses branch-scoped category persistence. No API/schema/dependency changes. Source reservation complete; CI and PR merge gate pending.


## 2026-10-06 — Procurement owner initial loading

PC-B corrected a search-only query gate that left the follow-up owner dropdown empty until typing. Owner choices now load on branch selection, with search and pagination retaining branch scoping. Branch changes reset picker state; create/assign permission gates and backend eligibility remain authoritative. Focused tests and CI are required before merge; no API/IAM/schema/runtime changes.
## 2026-10-06 — B2B agency wizard and commercial toolbar — PC-B

Agency registration can advance past phone verification so the remaining form can be inspected; final save still checks the existing unexpired verification grant and returns to that step if missing. Removed the requested commercial helper copy and agreement heading. In credit/guarantee subsections the visible date captions are removed while date controls keep accessible names, and compact PDF/Excel exports appear alongside filter actions. Organizations focused tests: 22 passed; scoped lint, Web typecheck and production build (55 routes) passed after building the shared contracts package. No API, schema, IAM or operational data changes. Exact-head PR CI is the final gate.
## 2026-10-06 — CAMPAIGN-DETAILS-ACTION-1006 — PC-B

Dedicated RTL icon-only campaign declaration action/form persists goal progress, expense titles/exact amounts/currencies and links through existing versioned campaign update. Actual expense is the exact sum of expense rows per currency; refreshed cards/detail/budget tab show persisted values and detailed rows. Frozen idempotent retry preserves uncertain submissions. No schema/migration/dependency/permission/runtime changes. Verification and authorized develop merge are tracked in WORK_ASSIGNMENTS.md.

## 2026-10-06 — PROCUREMENT-REQUEST-HEADING-1006

Request detail breadcrumb uses the saved request title; redundant UUID/version heading removed. Internal identity and routing preserved. Web-only change; no migration/API/IAM/data changes. Web lint/typecheck and 7 focused tests passed; production build/PostgreSQL CI gates passed. PR #693 awaits remaining required gates; live authenticated browser unavailable (CUA initialization failure).
## 2026-10-06 — MESSAGE-PERSIAN-SAVE-1006 — PC-B

Visible message/scheduled-channel names use existing Persian labels while canonical enum values stay unchanged. The icon-only save action is placed in a final full-width RTL flex row aligned physically left, preserving its original handler. No API/data/schema/migration/permission/dependency/runtime changes. Targeted rendering tests and affected quality gates precede authorized push/develop merge.
## 2026-10-06 — PROCUREMENT-RECORD-LISTS-1006

Removed inert sidebar form previews from all seven Procurement sections. Scoped creation/decision actions now sit above full-width records, with a paginated authorized request chooser for dependent forms. Text preview triggers no longer match the shared icon-only action rule; full record titles wrap in lists and workbench. Supplier logos continue using authenticated Master Data document previews, and newly persisted logo profiles immediately refresh the adjacent title cache. No API/schema/IAM/dependency or operational data changes. Eight focused tests, Web typecheck and changed-file lint pass; local production build passed; full CI gates required before merge; authenticated browser verification unavailable because CUA initialization fails.

## 2026-10-06 — CONTENT-LIST-REDESIGN-1006 — PC-B

Marketing content/acquisition uses RTL list-first toolbars, search and semantic tables with named icon-only add/view/edit/delete actions. Persian form-type/status labels retain canonical API enums; content editors use dialogs and preserve campaign/related-record versions. Library lists actual paginated BRAND Documents through its public contract instead of non-persistent demo cards; upload remains in Documents, title edits retain metadata/CAS, removal archives with a reason and is recoverable in Documents. Confidential/step-up records delegate access verification to the canonical Documents page. No API/schema/migration/IAM/dependency/runtime change. Marketing88 Web and22 records-service tests pass; scoped lint and clean exact-head CI quality/build gates precede user-authorized develop merge. Local reused Sales contracts mismatch is documented in WORK_ASSIGNMENTS.md.

## 2026-10-06 — B2B contract and finance form simplification — PC-B

The agreement form keeps all existing contract, credit and guarantee values while removing redundant headings and explanatory copy; optional SLA, cancellation and refund terms sit in one expandable group. Each finance tab keeps its Sales-derived rows and uses a compact document bar with an expandable archive instead of an always-open document list and filters. The existing Documents upload form now accepts optional financial notes and sends them as the public `description` field with the selected file. The upload still validates branch, owner, type, confidentiality, expiry and file size through the existing Documents boundary. No accounting transaction, API change, schema/migration, IAM grant or operational data change. Focused Organizations tests 32/32, scoped ESLint, Web typecheck and production build (55 routes) passed; exact-head PR CI remains the final gate.

## 2026-10-06 — PROCUREMENT-ORDERS-TABLE-1006 — PC-B

Purchase orders now use a scoped persisted order table, named icon-only view/edit/cancel/discrepancy/return actions and a new-order dialog selecting an approved request and active supplier. The additive module-local ORDER_FORM command atomically registers/selects the priced quotation and creates the pending order using existing single-source and final-approval policy, request CAS/idempotency and clean scoped Documents references. Warranty, payment/delivery/tracking values persist; request-detail lifecycle panel removed. Amendments now accept pending/approved/issued unfulfilled orders and re-enter independent approval; replaced/cancelled pending steps are retired while immutable snapshots/history remain. Receipt item selection and server return context bind to the same order; discrepancy dates persist. No schema/migration/dependency/IAM/operational payment/dispatch changes. Isolated PostgreSQL18 replay (123 migrations) and 49 API tests pass; Procurement Web suite53 tests passes. API/Web production builds pass. Final lint/typecheck and exact-head CI gate release. CUA initialization fails, so authenticated browser/mobile QA and runtime rollout are not claimed.
## 2026-10-07 — HOTEL-IMPORT-DEVELOP-AGE-1007 — PC-A — READY_FOR_REVIEW

Owner explicitly authorizes merging hotel occupancy PR671 to develop. Age selectors now show every canonical child-age option, without expanding the age domain or changing unrelated combobox defaults. Develop integration preserves its passenger-total pricing and additive owner records; tariff editor uses the shared DatePicker. Integrated Sales/Reservations/shared tests607 pass (three existing skips), scoped lint and Web typecheck pass. Production build and exact-head CI remain merge gates; no operational data import or live deployment.


## 2026-10-07 — PROCUREMENT-PETTY-CASH-ACTIONS-1007

Procurement is displayed as تنخواه without changing its route, financial ownership or accounting meaning. Final request approval navigates to orders, whose approved-request list launches the existing supplier/price/commitment order form. Remove correction action and redundant detail-owner search; relocate Excel/PDF export beside new request. Show approval decisions only in IN_REVIEW, avoiding the invalid SUBMITTED decision shown in the user screenshot. Preserve actual server explanations for 403 failures.

Reproduced permanent DELETE 500 as PROCUREMENT_APPEND_ONLY. A new function-only migration permits an API-authorized, exact-request, transaction-local purge after CAS/branch/delete permission and accepted Finance commitment guards; ordinary history mutation and cross-request/idempotency deletes stay forbidden. Minimal immutable deletion receipts survive. Opt-in rejection-and-purge is atomic, independent-policy checked, requires approve/cancel/assign, supports exact-key replay, and cancels the Tasks projection. Financial commitments block deletion; no operational records were deleted during development. Concurrent deletes yield 404/409 rather than 500.

Validation: isolated PostgreSQL18 on task-owned 55473/procurement_001_api_test, fresh replay of all125 migrations; Procurement API114 tests plus the final pending-order rejection regression passed, Web71 tests passed. Affected lint, API/Web typecheck and API/Web production builds (55 Web routes) passed after rebuilding stale local generated Contracts/Prisma artifacts. Exact-head PR CI is the final merge gate. CUA initialization failed, so authenticated browser QA is unverified. Migration must precede new API/Web rollout; the shared operational runtime was not redeployed by this source task.
## 2026-10-07 — HR-WORD-REVISION-1006 — PC-B — READY_FOR_REVIEW

All Word-listed HR changes are implemented in `codex/pc-b-hr-word-revision-1006`: catalog-backed forms, manager/HR applicant assessment, provisional onboarding, archived contract/leave attachments, Workbench request inbox, survey removal, and updated navigation/labels. Additive assessment and permission-scoped Customer Affairs/Workbench endpoints preserve existing record columns and module ownership. No migration or dependency change. HR Web 102 tests, HR API 114 tests (26 opt-in PostgreSQL tests skipped), final focused 25 API tests, affected ESLint, Contracts/API/Web typechecks and production builds pass. A local opt-in PostgreSQL attempt could not start because the running container has no `nora_local` role expected by the harness; no operational data was changed. Exact-head CI and user-authorized develop merge are pending. See `docs/tasks/HR-WORD-REVISION-1006.md`.

## 2026-10-07 — PROCUREMENT-SUPPLIER-LOGO-1007

Supplier saves now surface partial logo upload failure and preserve the exact saved supplier ID/version in the open edit form, so retry does not create another supplier. Successful profile responses refresh the authenticated logo beside the supplier name. Documents duplicate-image reuse now verifies its encrypted object exists; ENOENT triggers a normal fresh upload and scan, while corruption fails closed. Missing-logo previews return an actionable 404 rather than a generic500, preserving exact-source, branch and scan guards. Read-only mounted-archive diagnostics found three supplier logo references with missing objects and one intact encrypted image; no files/operational records were changed or invented. Existing missing images require re-upload or restored originals. API62 and Web78 targeted tests passed; lint/typecheck/build and exact-head CI gate release. No schema/migration/dependency/IAM change. CUA initialization failed; authenticated browser QA and shared3100 rollout are not claimed.

## 2026-10-07 — TICKET-PURCHASE-INBOX-1007 — PC-A

Menu labels now use Flight pricing, Package management, B2c/B2B customers and Petty cash. A separate /ticket-purchases inbox lists persisted flight purchase envelopes with scoped read/quote permission, exact seat-unit cost and per-currency dashboard totals. Published flight requests wait there until a buyer prices them; Finance lists only priced requests and pays the immutable latest cost, including installments. Existing actual-cost Sales profit allocation uses purchased unit cost per assigned passenger/leg and keeps currencies separate. Cost operations use UUID payload fingerprint, request advisory lock and expected revision, with price frozen after any payment. No schema/migration/dependency/role grant or operational-data/runtime change. Contracts/API/Web typechecks and API production build passed; scoped tests and isolated PostgreSQL concurrent price-replay/installment checks passed. Legacy adult/child-priced purchases also remain payable without requiring a new seat-cost revision. Final Web production build (56 routes) and scoped lint passed; exact-head CI remains the merge gate. See docs/tasks/TICKET-PURCHASE-INBOX-1007.md.


## 2026-10-07 — Distinct sidebar group dots — PC-A

Sidebar headers consume each registered group's distinct palette rather than one shared cyan color. Work blue, Sales rose, Reservations green, Finance amber, HR purple, Documents/Reports cyan, Company settings orange; same colors on mobile and desktop with a slightly larger outlined dot. Group collapse, routes and permissions preserved. No API/schema/dependency/runtime change; user authorizes develop merge after validation.

## 2026-10-07 — PROCUREMENT-ORDER-PREVIEW-CLEANUP-1007

Order view hides requestId and record version from the main summary and nested item cards. Request/order numbers, commercial details and exact document-version links remain visible. Persisted IDs, optimistic versions, routing/API and other record previews are unchanged. Six focused render/table tests passed; affected lint/typecheck/Web production build and exact-head CI gate user-authorized develop merge. No schema/migration/dependency/IAM/runtime/data change; authenticated browser verification unavailable.

## 2026-10-07 — PROCUREMENT-ORDER-INVOICE-UPLOAD-1007

Purchase-order edit now uploads invoice files through the existing Documents archive, restores order-specific exact document-version references and persists newly validated references in both the order and immutable amendment snapshot. Omitted references retain existing attachments; request-level attachments no longer overwrite order attachments. Upload blocks edits and submission until completion. Branch, document read, CLEAN scan, CAS and order reapproval remain enforced. Upload alone creates no financial invoice or payment. Web61 Procurement tests and6 Documents client tests pass; focused form rerun10 tests, affected lint, API/Web typechecks and production builds pass. All 54 isolated PostgreSQL tests passed on the final rerun; exact-head CI gates release. Initial default-timeout run was inconclusive; wrong-version regression expectation corrected to the existing503 DOCUMENTS_UNAVAILABLE contract. No schema/migration/dependency/IAM/operational-data/runtime change; authenticated browser QA and shared3100 rollout not claimed.

## 2026-10-07 — PROCUREMENT-DISCREPANCY-RETURN-SAVE-1007

Order follow-up calendars now mount within their dialog instead of outside its focus/dismiss boundary. Return forms support direct evidence upload through Documents and validate receipt, positive four-decimal quantity, date, reason and evidence before submission; discrepancy forms validate order and description. Changing the order clears the receipt and resets receipt pagination; option cache keys include order/supplier context. Missing-receipt guidance and API field labels make prerequisites actionable. Existing receipt quantities, CLEAN evidence, branch/permission checks, CAS, idempotency and Finance correction boundaries remain enforced. All 55 isolated PostgreSQL tests passed, including form-shaped discrepancy/return save, exact dates/evidence reload and duplicate retry. All 62 Procurement Web tests, API/Web typechecks, scoped lint, API/Web production builds and final form 11-test rerun passed; exact-head CI gates release. No schema/migration/dependency/permission/operational data change. CUA initialization failed (os error3); browser interaction and shared3100 rollout are not claimed.

## 2026-10-07 — EXPENSE-DELETE-ICON-1007 — PC-B

Campaign expense-row removal uses a neutral background, red inherited foreground and subtle hover background to keep the trash icon legible. Icon-only accessible label, removal handler and frozen submission protections are unchanged. Six focused declaration tests pass; scoped lint, full Marketing suite and exact-head CI quality/build gates precede authorized develop merge. No API, schema, migration, dependency, data or runtime change.

## 2026-10-07 — PROCUREMENT-ORDER-REQUEST-SOURCE-1007

New order selection explicitly uses purchase requests through the additive module-local section=order-requests filter. Approval eligibility (APPROVED/SOURCING) is applied before pagination rather than mixing existing-order cases and filtering afterward. Approved requests without orders remain selectable. The default request-scoped order form uses request items and supplier choice, not the legacy selected-quotation shortcut. Existing commands preserve request scope, quantities, supplier/approval policy and independent final order approval. All 56 isolated PostgreSQL and 63 Web tests, scoped lint/format, API/Web typechecks and API/Web production builds passed. Exact-head CI gates release. No schema/migration/dependency/permission/operational data/runtime changes; authenticated browser QA and shared3100 rollout are not claimed.
## 2026-10-07 — AUDIENCES-REDESIGN-1007 — PC-B

Audience segments/intakes use shared Rubi RTL toolbars, search/status/source filters, 25-row semantic lists and separate guarded modal editors/details. Intakes show real aggregate counts, Persian statuses/sources/rule names and masked identities; canonical Customer Affairs source/status/rule IDs and scoring CAS remain unchanged. Segment editing retains additional rules, existing status and version. Source chart and legacy campaign-audience presentation use Persian labels; campaign-audience preview persistence is unchanged, not newly implemented. Marketing97 Web tests pass; affected lint and clean exact-head CI quality/build gates precede authorized develop merge. No API/schema/migration/IAM/dependency/live-runtime change or authenticated browser QA.

## 2026-10-07 — REMOVE-SCHEDULED-TAB-1007 — PC-B

Communications shows only immediate sending: removed scheduled-send tab definition, generated preview metadata and reachable scheduled panel branch; updated landing copy/highlights and regression expectations. Stored schedules and backend contracts remain intact. Full Marketing tests, scoped lint and exact-head CI build/typecheck/quality gates precede authorized develop merge. No API/schema/migration/dependency/runtime change or authenticated browser QA.
## 2026-10-07 — CONTENT-DELETE-REPAIR-1007 — PC-B

Fixed library deletion validation: trimmed archive reasons must meet Documents' existing5–500-character contract (previous UI minimum2). Successful archive removes the row and resets pagination; failure retains the record/dialog with a visible error. Durable form/landing/link deletion uses a shared Rubi confirmation dialog instead of a native popup, preserving ID/version, cancellation and disabled pending state. Documents confidentiality/capability checks and recoverable archive remain unchanged. Marketing101 tests and scoped lint pass; exact-head CI gates authorized develop merge. No backend/schema/migration/dependency/permission/runtime change or authenticated deletion QA.
## CONTENT-PUBLICATION-CALENDAR-1007

Marketing landing-content last publication now uses the existing shared DatePicker with date/time and dialog placement, retaining required validation, canonical timestamp payload and read-only detail mode. New landing drafts start with no fabricated publication date; short-link conversion input is unchanged. Focused regression verifies calendar selection, save payload/CAS and view mode. No API/schema/dependency or local runtime changes. Exact-head CI gates the user-authorized develop merge.

## 2026-10-07 — B2B agency registration save recovery — PC-B

The cooperation wizard final-save state distinguishes correctable validation/lookup errors from uncertain organization creation and partial persistence. Users may explicitly omit an unverified phone and save the other agency details; a supplied phone still requires the development-only verification grant. Focused regression tests and quality gates precede merge.
## OFFER-ROW-DELETE-1007

Discount and special-offer preview rows have icon-only delete and shared confirmation/cancellation. Deleted IDs are excluded from display, filters and Excel output; unrelated records and usage history stay unchanged. This is explicitly in-memory preview removal, restored on reload; no durable Offers API exists on this surface and no server deletion is claimed. Marketing/translation107 tests passed; exact-head full CI gates user-authorized develop merge. No API/schema/dependency/local runtime changes.
## REMOVE-CUSTOMER-JOURNEY-1007

Removed the customer-journey entry from Marketing's canonical section registry and hub description. Both initial legacy section URLs and browser navigation resolve through that registry, so journeys falls back to the hub instead of mounting journey/automation/scenario screens. Existing automation APIs, stored records and independent process workflows remain intact; no destructive data removal or local rollout. Focused navigation and full Marketing/translation tests plus exact-head CI gate authorized develop merge.
