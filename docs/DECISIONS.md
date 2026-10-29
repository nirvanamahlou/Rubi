## CONTRACT-TRANSACTIONAL-NUMBERING-1029 — 2026-10-29

Owner supersedes the prior rollback-gap allowance and requests consecutive numbers for newly committed contracts. A Sales-owned singleton counter is updated inside the existing Serializable create transaction. Failed contract/service/payment/history writes roll back allocation; only proven serialization aborts are retried. Historical numbers and missing records are not fabricated or renumbered. The additive migration initializes above stored numbers and the old sequence high-water mark, preserving numbers possibly already shown to users. Stop all legacy API writers for migration/cutover and deploy only the new allocator; do not roll back to the old allocator after cutover. No API/event/dependency or production-data mutation is requested; user explicitly authorizes develop merge.

## VOUCHER-TRANSFER-OVERRIDES-1027 — supplier defaults with per-voucher exceptions

Owner explicitly permits a transfer supplier different from the hotel supplier and optional Board/leader corrections for a specific voucher. This supersedes the blanket leader-selection requirement and the no-client-text rule only for an explicit transferDetailsOverride=true voucher revision. Default mode still resolves the selected leader through the authorized audited directory; a supplied leader ID is always validated against transferBrokerId or, when omitted, the hotel broker. The sent hotel broker continues to identify the hotel confirmation recipient. Board/name/phone overrides are bounded output text, never directory writes, new reference identities or changes to Sales, purchases or issued files. Leader selection is optional, including vouchers without transfer. Financial release, branch/permission, version and insurance rules remain required. Producer/consumer optional fields ship together; no schema migration.
## AGENCY-CONTACT-ROUNDTRIP-1026 — 2026-10-26

Owner explicitly approves saving agency mobile numbers through the ordinary staff-authorized contact API without SMS verification or any verified-phone claim. Agency registration therefore skips the development-only verification stage; Corporate-customer verification and portal authentication policies are unchanged. Separate office phones reuse the existing encrypted organization-contacts model and Excel conventions. Hidden executive job titles remain stored, without an editable agency job-title input. No new IAM grant or schema change; see tasks/AGENCY-CONTACT-ROUNDTRIP-1026.md.

## LEGACY-CONTRACT-TOTAL-1025 — 2026-10-25

Owner supersedes per-service historical sale prices with one customer contract table: separate IRR/foreign gross amounts, discount and commission in their own selected currency, no FX conversion. Both deductions subtract from the same-currency gross total. Persist ordinary BASE/DISCOUNT components and existing contractPackagePricingVersion alongside legacyServicePartiesV2; service selections, age counts and real capacity references remain. Existing saved per-service historical contracts are not rewritten. Old unfinished draft service prices cannot override the newly entered customer total. Registered flight return defaults retain original load priority; explicit pair IDs disambiguate recurring dates and late calendar responses fill only an empty return, preserving manual choices. No schema/migration or permission changes.

## 2026-10-25 — FLIGHT-WEEKDAY-PURCHASE-1025

Owner authorizes grouping recurring company capacity by exact flight identity and Tehran weekday. Preserve existing per-offer Procurement and Finance FKs/payables; create all cost revisions atomically, with exact apportioned invoice totals and immutable pool evidence in the existing reason field. Contract and unsold-seat costs consume the pool total/seat denominator, never the rounded per-offer share or a duplicate pooled payable. New dates do not expand historical pools; paid/partial-paid or incomplete original-group amendments fail. Additive public types/endpoint and optional transaction-backed producer reads retain legacy compatibility. No schema/migration; see tasks/FLIGHT-WEEKDAY-PURCHASE-1025.md.

## LEGACY-CONTRACT-SERVICES-1025 — owner-approved aggregate historical services (2026-10-25)

The owner explicitly retains ordinary service/date/inventory selection and pricing in Legacy Contract while omitting the personal passenger table. V2 first-service metadata legacyServicePartiesV2 carries strictly validated adult/child/infant counts per selected service; real catalog ticket/hotel references remain and no synthetic Customer/passenger identity or manifest name is created. Historical adults plus children reserve real ticket capacity through the existing idempotent reserve/confirm path; infants do not consume seats. Counts are included in the immutable reservation snapshot and read by output consumers. Summary count is the maximum service-party total rather than a sum across both flight legs. Shared metadata producer is Sales; consumers are Sales validation/confirmation, Reservations supplier output and contract/list/Excel output. Existing V1 customer-only OTHER records and ordinary personal-passenger rules remain compatible. No database schema, migration, role or dependency changes. Manual historical service prices use the existing exact-decimal service pricing contract; current published sale-price assertions are not imposed on historical agreed prices, while canonical route/date/active inventory/capacity checks stay in force. Explicit review submission and immutable financial approval/payment controls remain.

## HOTEL-CHECKIN-DEPARTURE-DAY-1024 — owner clarification (2026-10-24)

Automatic check-in with an outbound flight uses its displayed Tehran departure day, including overnight arrivals and published packages. This supersedes the earlier whole-stay next-day flag for flight-linked automatic dates; stale draft flags must not advance check-in. Explicit manual check-in remains authoritative. Hotel-only/package-only dates, checkout policy and per-guest stay overrides remain unchanged. No persisted records are rewritten.

## RESERVATION-DELIVERY-PERMIT-1024 — owner-approved exception (2026-10-24)

The owner explicitly permits Reservations to authorize customer document delivery without confirmed receipt/full settlement or another Finance approval, with a mandatory5–500-character reason. This supersedes the Finance-only decision-maker wording solely for this pathway. Finance remains owner of the existing immutable customer delivery revisions: new basis RESERVATION_PERMISSION, same version/branch/contract lock, canonical cancellation check, actor/time and Sales notification. Existing reservations.documents.manage is required; read-only Reservations, Finance-only actors and unrelated branches cannot grant this basis. A dedicated minimal read/command port avoids giving Reservations access to Finance queues or payment authority. Reservations may revoke only this pathway; Finance retains revocation authority. A valid authorization from another pathway cannot be silently replaced. No second approver/expiry is required for this owner-chosen pathway; manager exceptions keep their existing controls. Refund/balance changes retain this explicit override; contract cancellation still revokes it. No blanket user/role grants or operational records are changed by implementation.

## DOCUMENT-QR-LINKS-1021 — public document capabilities (2026-10-21)

The owner explicitly chooses unauthenticated viewing through an unguessable link scoped to the scanned document. Authenticated, permission-scoped canonical Web PDF producers alone publish immutable distribution artifacts; no public API reads domain records and no client HTML is accepted. Each contract, supplier form, voucher and individual passenger ticket receives a separate random 192-bit capability. Batch ticket downloads publish passenger-isolated snapshots. Existing branch, cancellation, supplier/leader and financial-delivery guards execute before publication; local unsaved edits are never published.

Web owns these encrypted HTML distribution artifacts, not a second Sales/Reservations source of truth. AES-256-GCM uses a runtime-only key, token-bound AAD and hash-only filenames. Exact GET/HEAD /d/<32-character-token> bypasses login; no listing, mutation, identifier lookup or general proxy exception exists. Responses are no-store/noindex/noreferrer with script/form/network-restricting CSP. Previously issued snapshots remain immutable; updating a document creates a new link. Physical artifact removal revokes that capability. Existing legacy QR content cannot be made into a URL retroactively: regenerate outputs after activation.

Activation requires all three PUBLIC_TRAVEL_DOCUMENTS_* settings: HTTPS canonical origin (short enough for the 78-byte QR), absolute persistent private root, and independently generated 32-byte key represented as 64 hex characters. Mount the directory into Web, keep it out of public/static paths, restrict access logs containing capability paths, and include both encrypted artifacts and the separately protected key in recovery procedures. Preserve them across container replacement. Missing all settings keeps existing output compatible and does not expose records; partial configuration fails closed. No schema, dependency or domain API contract changes. Merge/rollout remain separately owner-authorized.

## RATE-ACTIONS-CHART-1019 — reference correction policy (2026-10-19)

The owner explicitly permits editing/removing registered Master Data reference quotes. Dedicated versioned PATCH/DELETE commands supersede blanket immutability only for these non-authoritative reference rows: edit amount/source, retaining original pair/type/observation/validity/status; removal logically deactivates with actor/time/version. All previous values remain in transactional audit, inactive rows are excluded from current/history and cannot be approved through legacy commands. This is not Finance rate approval, financial document rewriting or physical audit deletion. Preserve native update/delete authority, manual resource/field access, permitted audit branch, exact positive Decimal strings and compare-and-swap. Removing the visible isAuthoritative=false badge never changes the stored flag. No schema/migration or operational data change.

## DIRECT-CURRENCY-RATES-1019 — owner policy (2026-10-19)

The owner explicitly removes separate approval for newly entered Master Data reference currency quotes. POST currency-rates/quotes now atomically registers BUY/SELL as finalized (existing APPROVED enum), with backend-owned registrant/finalization time and creation audit; current-rate and chart consumers immediately read them. This supersedes maker/checker only for this new reference-registration command, not Finance authoritative FX or legacy draft approve/reject commands. Existing drafts/history are not mass-approved or rewritten. Keep create permissions, branch checks, positive exact Decimal strings, active currency FKs, validity windows, transactional audit and isAuthoritative=false. Producer/consumer deploy together; older API deployments still create drafts. No migration or accounting-rate change.

## OPTIONAL-OPERATION-REASONS-1015 — owner policy (2026-10-15)

The owner explicitly makes human change/action reason text optional throughout the application. This supersedes earlier nonempty/minimum-length reason requirements, including financial override/correction, administrative and document actions. Permissions, branch isolation, maker/checker, expiry, CAS, idempotency, actor/time and audit history remain mandatory. Omitted/blank reasons store empty text (or existing nullable representation), never an invented reason. Optional does not mean unbounded or untyped: supplied text retains maximum length and other content constraints. Structured failure reason codes and required business content such as a newly added note/message are not audit-reason fields. One forward SQL constraint replacement removes only the receipt adjustment reason-text check and preserves all quantity/FK/history constraints. No retrospective audit/data rewriting or local deployment.

## SUPPLIER-FORM-ISOLATION-1015 — owner clarification (2026-10-15)

Settings below the supplier reservation form are output-only. The owner explicitly limits their effect to that form, superseding earlier use of sent-form dates as a purchase basis. Voucher content defaults to the contract snapshot and its own saved settings, never a wholesale supplier-form copy. Hotel purchase nights use the contract snapshot for both per-passenger and formula paths. Broker identity continues to route supplier confirmation and voucher leader selection; it does not copy accommodation/passenger/content overrides. Existing issued files and booked purchases are not rewritten. Global contract-amendment editors remain separate and unchanged.

## MANUAL-USER-ACCESS-V3-1012 — authoritative individual grants

The user's2026-10-12 instruction supersedes additive shared-role behavior for manually converted users. Their exclusive versioned snapshot is the sole effective grant source; existing shared memberships remain for history but cannot restore an unchecked grant. Titles are labels. New catalog controls default off. Conversion snapshots the current effective legacy scope and requires before/after equality, serializable concurrency and matching active runtime capabilities. Agency identity edits use verified organization/contract ownership and immutable names. No passenger login role is introduced. Details: docs/tasks/MANUAL-USER-ACCESS-V3-1012.md.

## HOTEL-OCCUPANCY-IMPORT-PREVIEW-1006 — owner occupancy policy (2026-10-06)

Source monetary precision is retained up to12decimal places as Decimal strings; source Excel IEEE754 serialization noise is normalized within machine precision only. Exact BigInt sums round once to the existing4-place Sales financial boundary (half-up), never each nightly source price. The157 reversed date ranges found in the original data are explicitly rejected/reported by import, not guessed/swapped; corrected occupancy output retains source dates and prices.

The owner excludes IN DBL PP from the supplied output and uses DOUBLE/exact-composition totals for room-per-night pricing. Capacity lists all undominated real adult/child combinations of the same hotel/room, never independent maxima. Each tariff retains its exact adult count, all child age slots, currency and inclusive source date range converted to exclusive end. Integer boundaries are explicit (6.99 means under 7). Imported occupancy tariffs are versioned with existing Reservations packs through optional room-rate JSON; historical rows remain null and legacy per-person consumers must not price these rows through nominal factors. Sales consumes only the public projection and validates actual guests on submission. The original workbook and live data remain unchanged; owner imports the delivered file into a separate preview. No develop merge is authorized.

## TICKET-LOAD-EDIT-DELETE-1010 — owner-selected load lifecycle (2026-10-10)

The owner explicitly supersedes `TICKET-NO-DELETE-1006` for a selected flight-load row. Ticket Catalog may expose Edit Load and Delete Load beside View. Edit uses the canonical ticket-definition form and the existing optimistic revision command. Delete is a logical archive of the authoritative `TicketPublishedOffer`, never a physical row/history purge. It requires Ticket Catalog manage permission, branch scope and exact version, and is rejected while active contract allocations, unexpired capacity holds or tour links exist. Price, purchase, Finance and audit records remain immutable and readable through their owning histories; archived inventory disappears from management and new sales. Explicit close/Escape behavior and unrelated ticket records remain unchanged.

## TICKET-NO-DELETE-1006 — owner retention policy (2026-10-06)

Defined tickets remain in their management history and cannot be removed, including expired or unallocated tickets. This explicitly supersedes the previous user-triggered visibility archive/delete command. Web removes all corresponding controls; the authenticated legacy DELETE offer endpoint retains its permission/input guards but responds with a clear HTTP400 rejection before database access. Status activation/pause remains available under existing rules. Historical archived records and prior deduplication migration bytes remain untouched. No restoration, deletion of history, schema change or permission grant is introduced.

## MANIFEST-LOAD-SEARCH-0930 — owner policy update (2026-09-30)

The owner explicitly removes Finance approval as a prerequisite for manifest listing and export. Every contract already received by Reservations participates, subject to branch, passenger assignment and sensitive-read permissions. This supersedes the earlier manifest-specific Finance gate; financial delivery authorization for tickets/vouchers remains unchanged. Ticket Catalog exposes a read-only inventory projection through its public service; Reservations does not query its tables. Optional load fields preserve v1 client compatibility.

## USER-ACCESS-TREE-0928 — per-user IAM access (2026-09-28)

IAM owns a dedicated non-shareable `personal-access-<userId>` role for each managed account. The selected job title labels this role; it does not edit HR employment records or imply grants. Native permissions continue to authorize server operations. Additional `ui.profile` and catalogued `ui.screen.*` permissions control Web route, navigation and tab visibility. A whole-group checkbox selects assignable native permissions and child screens; children can be removed individually.

No schema migration, dependency or operational user change is required. IAM permission contract v12 is additive. Existing roleIds/branchIds clients remain compatible, and legacy navigation is preserved until an account is explicitly saved with a managed profile. Updates replace only that user's dedicated role/memberships transactionally. The last active administrator guard and native/UI anti-escalation checks remain. Future module routes/tabs must be registered in the IAM-owned screen catalog; unknown managed tabs are hidden. API guards remain authoritative for data and operations.

## MANIFEST-DEFAULT-TEMPLATE-0928 — owner clarification (2026-09-28)

The owner replaces the earlier automatic airline/destination matching and disabled-card fallback for ticket-card exports with an explicit per-ticket template choice. Null/absent selection uses a built-in default XLSX. An explicitly selected published XLSX is revalidated for the Tehran flight day and read through the audited Documents boundary; invalid explicit selections produce an error instead of silently changing format. Legacy per-contract/range Iran Airtour exports remain compatible.

The Sales intake has a contractNumber and no distinct contract-title field. The requested «نام قرارداد» column therefore contains the authoritative contractNumber, rather than an invented label. Ticket uses the recorded flight/service number; dates use the Tehran flight day and stored Gregorian birth/passport dates. Domestic means equal Master Data country IDs at the route endpoints; different IDs mean international. National ID is retained as text in both; passport number/expiry are added to international defaults. Missing optional identity fields remain blank; international passport identity is required. Ticket-specific passenger assignments, existing room order/age overrides, sensitive-data authorization, Finance delivery approval and new-only export history remain authoritative.

Migration and API contract changes are additive; legacy revisions omitting manifestTemplateId preserve an existing explicit selection, while null explicitly restores the default. Template-only changes may revise sold/held/tour-linked offers without altering their route, dates, capacity or fares. Master Data remains template owner and Documents remains file owner.

# تصمیم‌های معماری

## SALES-TICKET-PRICES-0922 — owner-approved ticket sale basis

مالک محصول قیمت فروش عملیاتی بلیت را در زیرماژول مستقل «قیمت بلیط» زیر فروش
تأیید کرد. Ticket Catalog همچنان آفر و تاریخچهٔ نسخه‌دار نرخ را مالک است و Sales
فقط public projection آن را مصرف و مبلغ انتخاب‌شده را در قرارداد immutable
snapshot می‌کند. نرخ یک‌طرفه برای یک آفر و نرخ رفت‌وبرگشت برای جفت دقیقِ مسیر
معکوس ثبت می‌شود؛ در قرارداد رفت‌وبرگشت، نرخ جفت بر جمع نرخ‌های یک‌طرفه اولویت
دارد و نبود نرخ جفت fail-closed است. این تصمیم، منع قبلی نگهداری نرخ فروش ثابت در
Catalog را برای این نرخ عمومی نسخه‌دار جایگزین می‌کند؛ تخفیف و توافق خاص مشتری
همچنان فقط در snapshot قرارداد Sales است.


## TOUR-HOTEL-PRICING-FLOW-0916 — owner-approved workflow

The owner requires Ticket Catalog tour -> outbound/return departure -> hotel
purchase-rate pack for that departure -> Sales tour/departure pricing. This
supersedes loose hotel/date matching for new Sales pricing. Selected hotels in
the linked rate pack are the pricing alternatives; unselected hotels do not
block publication. Hotel cost is nightly base times room factor, rounded per
night, times the explicit stay nights; a fixed or percentage change applies once
to that stay. Adult/child flight sale is the combined round-trip amount per
traveler; existing room occupancy determines the full-room package amount.

The owner explicitly chose multiple currencies (e.g. EUR + IRR), not implicit
FX conversion. Sum only like currencies; commission is a percentage expense
in each sale currency and never increases customer sale amounts. Finance's
settled purchase costs and the existing independent publication reviewer remain
required for publication. Family occupancy is entered explicitly and snapshotted.
Excel and banner generation are deferred by the owner.


## ADR-PACKAGE-FLIGHT-FINANCE-COST-0915 — owner clarification / isolated integration

The owner clarified that adult/child flight amounts entered in Sales are sale
prices. When a ticket is defined, its purchase-price request goes to Finance;
Finance enters the purchase amount and pays it directly, with no separate
Procurement approval for this pre-sale ticket request. This is a limited
owner-approved exception to the older generic Procurement-first purchase flow;
other contract/service procurement ownership remains unchanged. The latest
develop has a ProcurementTicketPurchaseRequest envelope and Finance inbox
projection, but Ticket Catalog currently sends the amount itself and the
free-form catalogProductReference is not a tour offer FK. That behavior is
not a confirmed Finance purchase price and must be changed before package
publication. The current tour departure uses TicketPublishedOffer, which
stores route/capacity but no purchase fare. Latest develop Finance inbox lists
pending Purchases requests, but has no Finance price-entry/payment action for
those requests yet.
There is no existing public, Finance-paid ticket-cost projection keyed to the
tour's offer IDs. Package Pricing must consume such a versioned Finance/Ticket
public contract (branch, offer ID/version, adult/child amounts and currency,
payment state), never infer cost by route/name/date, read private
tables or copy a manual purchase amount into Sales. A new pre-sale request
flow keeps the request envelope in its owning module while Finance owns cost
entry and settlement. Until that producer and its payment
policy exist, package publication and total net-profit claims fail closed;
hotel-only sale previews remain explicitly non-published. No historical
published snapshot is changed by this clarification.

Implementation on `codex/pc-a-package-pricing` after merging `origin/develop`
into that task branch: publishing a real TicketPublishedOffer creates an
amount-free Procurement envelope with a true offer FK/version. The older local
Ticket product editor is a preview and does not create a duplicate financial
request. Finance owns append-only adult/child unit purchase costs, invoice
amount and payment evidence. Recorded partial payments keep the offer cost
unavailable to Sales; only full settlement atomically marks the Procurement
envelope PAID and exposes Finance's public paid-cost projection. A recorded
payment is not an external bank transfer or accounting journal. Old free-form
requests and catalog estimates remain readable but cannot qualify as a tour
offer cost. Sales saves one editable draft per TourDeparture and HotelRate
batch, then a different actor may publish immutable per-hotel/per-room prices
after source, capacity, branch, version and currency recheck. Commission is
subtracted from net profit without increasing customer sale. Business uplift
applies per adult when this tour's offer cabin is BUSINESS. Known occupancy
codes map to 1/2/3 adults or 2 adults plus 1/2 children; family occupancy is
undefined in current data, so only its hotel-stay amount is published. Cross-
currency publication remains fail-closed until an approved FX source exists.

## ADR-PACKAGE-PURCHASE-SOURCE-0915 — owner purchase-cost clarification

The owner now requests package sale pricing to start from the actual hotel
purchase-rate table for a defined tour/date range, rather than treating Master
Data's hotel base-sale rate as purchase cost. This supersedes the
PACKAGE-PRICING-001 prohibition on using Reservations purchase cost for this
new tour-pricing flow, but does not relabel historical Master Data sale rates
as purchase costs. The owner confirmed that the existing Ticket Catalog tour
departure is the package anchor. In the current model, only Reservations'
group rate register identifies broker purchase base per room/night, so it is
the producer for this flow. Package Pricing receives a versioned,
branch/date/hotel-scoped public projection, never queries Reservations tables
directly. Costs from distinct alternative hotels are priced separately, not
summed into one source base. Existing immutable published price snapshots
are not rewritten. If the owner names a different purchase register, switch
the producer before sale publication rather than silently mixing cost models.

## ADR-PACKAGE-COMMISSION-NET-MARGIN-0915 — owner clarification

For new Package Pricing calculations, commission is a selling expense deducted
from realized margin, not an amount added to the published customer price.
The version-1 breakdown adds optional commissionCost; older immutable price
snapshots without that field remain readable as zero commission. Fixed/percent
sale adjustments and existing fees retain their own behavior. This decision
supersedes the prior generic COMMISSION-as-sale-uplift behavior for new versions;
no historical published price, contract or operational purchase is rewritten.
Package Pricing API produces the additive field and its Web client consumes it.
Commission input may be percent or a fixed amount with an explicit currency. Fixed commission is deducted once from the matching currency bucket for each independently priced room package; it never changes sale and no FX conversion is inferred. Historical drafts/publications default to percent.

## PROCUREMENT-BACKEND-CONNECTIONS-0915 — 2026-09-15

مالک محصول اتصال‌های ناقص خرید را فقط در Backend خواسته است. Settings/PC-A مالک
چرخهٔ تأیید می‌ماند: Procurement فقط artifact سیاست نسخه‌دارِ مصوب را از مسیر
`SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE` می‌خواند و برای هر شعبه/واحد/دسته/ارز
دقیقاً یک سیاست معتبر لازم دارد؛ نبودن، خرابی یا ابهام، ارسال را مسدود می‌کند.
شناسه/سقف تأییدکننده هنوز از مالک دریافت نشده و هیچ grant خودکاری انجام نمی‌شود.

Procurement/PC-B producer `procurement.finance-source.v1` را از فاکتور تطبیق‌شده
و handoff ذخیره‌شده از public service، با محدوده شعبه، برای Finance/PC-A قابل
خواندن می‌کند. Finance باید consumer/ack نسخه‌دار و تطبیق با پرداخت خود را پس از
هماهنگی قرارداد اضافه کند؛ فقط ایجاد projection، status پرداخت یا journal را
تغییر نمی‌دهد. مسیر Reservations/PC-A نیز باید operation/contract/service/supplier
reference مصوب را منتشر کند؛ تا آن زمان specialized submission gate می‌ماند.

پس از صدور داخلی و تأیید نهایی سفارش، outbox intent نسخه‌دار
`procurement.supplier-order-intent.v1` با شناسه/نسخه سفارش، شعبه، تأمین‌کننده و
مبلغ ثبت می‌شود. وضعیت آن `BLOCKED` است تا Integrations/PC-A API و callback
احراز‌شده و idempotent را فراهم کند؛ هیچ سفارش بیرونی صادر نمی‌شود. رخدادهای
پیگیری خرید نیز در outbox هستند و تا ایجاد public Tasks consumer/PC-B تحویل
نمی‌شوند. این مرزها اجازه جعل پاسخ تأمین‌کننده یا پرداخت را نمی‌دهند.

## PROCUREMENT-LIVE-INTEGRATION-0915 — 2026-09-15

در فرم خرید، دستور جدید مالک حذف دلیل خرید مشابه، علت نامشخص بودن مبلغ و معیار
پذیرش را بر متن قدیمی PRD مقدم می‌کند؛ دلیل اضطرار و محل تحویل اختیاری‌اند.
درخواست‌کننده از کارمندان فعال ذخیره‌شدهٔ HR انتخاب و با FK شعبه‌ای واقعی به
درخواست خرید وصل می‌شود؛ IAM actor جداگانه برای مجوز و audit می‌ماند. شش کارمند
محلی موجود هنوز `userId` مرتبط با IAM ندارند، پس الزام FK به کارمند واقعی بدون
این تفکیک، فهرست درخواست‌کننده را خالی می‌کرد. ثبت برای نقش کارکنان و تأیید/سفارش
برای نقش‌های مشخص مستقل تعریف شد؛ grant خودکار اختیار تجاری به مدیر فنی انجام
نمی‌شود. تا امضای قرارداد producer/consumer با PC-A و استقرار adapter و policy
مصوب، تحویل مالی، ارجاع رزرواسیون و صدور سفارش در gate صریح باقی می‌مانند.
قرارداد منتشرشدهٔ بعدی PC-A برای قیمت خرید بلیت از `ProcurementPublicService`
به Ticket Catalog و کارتابل Finance وصل شده است؛ این intake جدا از سفارش و فاکتور
درخواست خرید عمومی است و gate آن‌ها را تغییر نمی‌دهد. migration منتشرشدهٔ این
intake بدون ویرایش حفظ شد و migration افزایشی دیگری FK شعبه و IAM creator را
اضافه کرد؛ هر دو ابتدا روی کپی داده و سپس پایگاه محلی تمرین/اعمال شدند.

## B2B-DOSSIER-REPORTS-001 — 2026-09-09

The dossier Reports/Audit UI consumes normalized metadata from B2B audit events and public Master Organization/Documents owner projections. It does not read another module's tables, change the central Reporting module or create financial events. Existing branch and source/domain permissions apply to every page. Snapshots stay server-side; the projection exposes changed field labels, action, actor and time, never private contact values, notes, document contents or credential fields. Export contains the same authorized filtered projection. Per-source keyset pages share a fixed upper timestamp, including a deterministic cross-source tie key; Tehran calendar-day filters include both day boundaries.

Inspection found that Documents permanent deletion removed its audit rows. To preserve the requested history without a new schema, deletion now removes versions and payload metadata but retains a minimal DELETED document, case identifiers and audit events. Detail/file/restore and list APIs exclude that tombstone, including explicit DELETED queries. Version references in retained audits are cleared before physical version removal; a deletion event is appended atomically with the tombstone. Already-erased historical events cannot be reconstructed. Existing owner file cleanup behavior remains; no local business record was deleted by this task. Finance preview data is never reported as real transactions.

## B2B-CONTRACT-CREDIT-DEMO-001 — 2026-09-09

Credit/guarantees moves beneath the commercial contract UI; existing credit authorization identifiers and approval rules remain independent. The owner requests synthetic guarantee and financial data. Guarantee drafts and proofs persist through B2B/Documents public services against explicitly synthetic agencies. Finance currently has a Phase A preview foundation and no posting/exposure adapter in this checkout, so the financial scenario is explicitly labelled as a UI preview and never supplied as authoritative exposure, receipt confirmation or ledger state. This satisfies the requested visual sample without crossing Finance ownership or changing account balances.

## B2B-CONTRACT-FORMS-002 — 2026-09-09

Master Data owns payment-method identity; B2B consumes its public directory and persists a nullable revision FK and label snapshot. Settlement mode remains PREPAID/CREDIT/MIXED. Optional v1 fields preserve older client writes and immutable historical revisions. The expanded agreement-type check is additive. Documents owns all inline uploads and file state; pending scans may be linked to drafts, while submission/approval always requires CLEAN and the existing scope/completeness/expiry checks. Removing the editable limit type preserves existing values and the HARD default; it does not silently alter credit enforcement. Shared calendar and selector behavior is opt-in for the affected forms.

## B2B-ORGANIZATION-USERS-001 — 2026-09-09

The owner explicitly limits per-user selection to the same agency's 360 dossier. Provide six view permissions and a standalone agency portal; do not grant global Nora roles, administrative mutations, independent contract/credit approval, or access to other agencies. B2B stores membership and consumes exported IAM provisioning methods. A global B2B interceptor restricts any linked account, including inactive memberships and accounts subsequently granted global IAM roles, to its portal and own authentication/session endpoints. Each portal projection rechecks active membership, organization and selected section and derives organization/branch from the server. Existing staff accounts are never converted. Failed membership creation disables the new IAM account; B2B membership/audit are atomic, while IAM and B2B provisioning are separate public-service operations. Finance remains explicitly unavailable until its owner projection is connected; no fabricated balances. Role labels do not confer IAM privileges.

## B2B-UNIFIED-PROFILE-001 — 2026-09-09

The owner's unified-page request moves all organization profile entry actions into the profile/roles screen. Existing organization tabs become sections on that same page and popup editors preserve current data contracts. National ID remains the existing Master Data company field in step one and edit, not a duplicate identity field.

Implement signatory directory entries against existing Master Data contacts, following FR-PEO-02 document-type, limit/currency, date and proof requirements. Only B2B metadata is stored; public Master Data and Documents methods validate references. An incomplete proof permits saving an inactive entry only. No automatic IAM grant, portal account, independent approval or legal signature verification is implied. This bounded registration feature does not invent a new signatory-approval workflow. Existing cooperation agreement approval remains unchanged.

## B2B-PROFILE-CLARITY-001 — 2026-09-09

- پاسخ مالک محصول: گزینه‌های شعب، شعب آژانس طرف همکاری هستند. منبع آن‌ها آدرس‌های همان MasterOrganization و CRUD عمومی Master Data است. انتخاب نشانی صرفاً نمایش جزئیات است؛ شناسه نشانی به‌جای IAM branchId ارسال نمی‌شود. شعبه داخلی مسئول قرارداد و دسترسی‌ها جدا و روشن نمایش داده می‌شود.
- شناسه ملی شرکت، فیلد اختیاری `MasterOrganization.nationalId` برای شخصیت حقوقی است؛ ورود دستی ۱۱ رقم با تبدیل ارقام فارسی/عربی به لاتین، یکتا بین سازمان‌ها و قابل اصلاح با مجوز Master Data و version موجود. این ثبت، استعلام یا تأیید اصالت ثبتی نیست. کد ملی شخص حقیقی در این فیلد ذخیره نمی‌شود. رکوردهای قدیمی NULL می‌مانند و درخواست‌های قدیمی که فیلد را نمی‌فرستند مقدار آن را حفظ می‌کنند.
- تغییر قرارداد عمومی فقط افزودن attribute/value اختیاری است؛ producer اطلاعات پایه و consumer فرم و پرونده سازمان است. Migration افزایشی محدود به همین ستون، unique index و قید قالب/شخصیت است؛ پس از backup و rehearsal روی نسخه بازیابی‌شده اعمال می‌شود. هیچ migration تاریخی یا داده موجود بازنویسی نمی‌شود.
- مدیر حساب کاربر داخلی مسئول پیگیری آژانس است. وضعیت همکاری از پروفایل واقعی خوانده می‌شود؛ دکمه بررسی به گردش قرارداد موجود می‌رود و تأیید مستقل قرارداد، پروفایل در حال بررسی را فعال می‌کند. قواعد دسترسی و منع خودتأییدی بدون تغییر می‌مانند.

## B2B-AGENCIES-001 — اعتبار چندارزی و حذف هویت استفاده‌شده

- پاسخ صریح مالک در پیگیری PRD: **سقف جدا برای هر ارز؛ بدون تبدیل خودکار**. محاسبه اعتبار فقط Decimalهای هم‌ارز را ترکیب می‌کند؛ currency mismatch نتیجه قابل‌استفاده تولید نمی‌کند. مدل نهایی Policy باید ارز را در scope یکتا لحاظ کند؛ schema فعلی تک‌سیاستی به‌عنوان پیاده‌سازی چندارزی معرفی نمی‌شود.
- درخواست حذف دائمی داده با FR-ORG-04 چنین جمع می‌شود: رکورد بدون وابستگی از API نسخه‌دار و audited مالک قابل حذف است؛ FK محدودکننده هویت استفاده‌شده و تاریخچه تجاری حفظ می‌شود. هیچ حذف آبشاری قرارداد/سفارش/سند مالی مجاز نشده است.
- زمان تحقق پورسانت، تعداد مراحل/مجوزهای تأیید، ترکیب Exposure و سایر P0های باز سند با این پاسخ تعیین نشده‌اند. جزئیات و وضعیت واقعی پیاده‌سازی: `tasks/B2B-AGENCIES-001-PRD-COVERAGE.md`.

## SALES-OUTPUT-CLEANUP-0907 — customer copy vs operator guidance

At the user's request, operational issuance/context disclaimers and template generation metadata are removed from the customer-facing printed/PDF page. The same disclosures stay in the operator dialog; this layout-only change does not establish historical issuer binding, official issuance, archive completion, Finance payment confirmation or reservation fulfillment. Existing fail-closed API policies remain unchanged.

## SALES-CUSTOMER-PRICING-0907 — local additive upgrade gate

The operational database has pre-existing file/checksum differences for master_data_foundation (20260823084001), legal_entity_context (20260825123000), and reservation_arrangements (20260906113000), plus LF/CRLF differences elsewhere. This task does not repair/rebaseline/rewrite any historical migration or owner data. Like the previous local rollout, permit only the single reviewed additive Sales passenger-price migration after a fresh backup restore rehearsal. Require every historical migration to be known/finished, reject any other pending migration, and compare all stored historical checksums plus business counts before/after. The new table depends only on the existing Sales passenger UUID key. Broader historical reconciliation remains outside this task.

## HOTEL-SALES-PRICING-0906 — 2026-09-06

- مالک محصول ورود قیمت روز فروش/توافقی هتل به‌صورت هر شب یا کل و ثبت بعدی هزینه خرید در رزرواسیون را تأیید کرد. انتقال محدود قفل Migration نیز صریحاً تأیید شد.
- هزینه ثبت‌شده در رزرواسیون سابقه عملیاتی خرید است؛ مالکیت تأیید خرید/بدهی در Procurement و Finance حفظ می‌شود. این ثبت هیچ financial release یا پرداخت تأییدشده تولید نمی‌کند.
- اختلاف روز فروش و توافق «تخفیف فروشنده» است؛ بدون قیمت اولیه کارگزار، هیچ مقدار ساختگی با نام تخفیف کارگزار تولید نمی‌شود. حاشیه هتل فقط در ارز یکسان و بر پایه هزینه ثبت‌شده نمایش داده می‌شود، نه سود قطعی کل قرارداد.

## اجرای موقت DOCUMENTS-002 — 2026-09-01

- ADR-002 و الزام S3/MinIO برای محیط تولید بدون تغییر باقی می‌ماند. Adapter فعلی Documents
  فقط برای Development/Test این Vertical Slice است و فایل را بیرون Database با AES-256-GCM،
  کلید مستقل، object key تصادفی و permission محدود نگه می‌دارد؛ معرفی آن به‌عنوان Storage
  تولید ممنوع است.
- تا اتصال Antivirus واقعی، هر نسخه جدید `AWAITING_ANTIVIRUS_ADAPTER` می‌ماند و دانلود
  آن fail-closed است. تغییر دستی Scan به `CLEAN` یا جعل پاسخ Scanner در Seed/UI ممنوع است.
- تصمیم `DEC-OPEN-006` درباره retention، residency و key management همچنان باز است؛ این
  Slice حذف دائمی، گردش کلید تولید یا تعهد نگهداری را حدس نمی‌زند.
- درخواست صریح مالک محصول در 2026-09-05 ورود دستی اختیاری شماره پاسپورت و تصویر
  اختیاری آن را برای Development/Test مجاز کرد. شماره فقط در مرز Customers با
  AES-256-GCM، HMAC دامنه‌جدا، Mask و Sensitive-read Audit نگهداری می‌شود و فایل از
  Public Contract ماژول Documents عبور می‌کند. این مجوز محدود، `DEC-OPEN-006` را برای
  Production، retention، residency یا گردش کلید حل‌شده اعلام نمی‌کند.

## Clarifications carried from the approved source tasks — 2026-08-31

- `TICKET-PRICING-002`: PR #46 records the owner's clarification that final sale
  prices are dynamic Sales quotation/contract snapshots. Ticket Catalog owns
  purchase/cost reference versions only, not a fixed sale amount. This supersedes
  older combined purchase/sale wording for Catalog; no Sales persistence or FX
  conversion is implemented by this integration. See `tasks/TICKET-CATALOG-001.md`.
- The same source handoff clarifies mixed-currency Sales: preserve separate
  Decimal/currency components for one ticket sale; never sum unlike currencies
  or invent an FX rate. Converted totals need the approved Finance policy and a
  rate snapshot. This is a Sales backlog requirement, not an implemented feature.
- PR #46 also records the owner's narrow IAM policy change: minimum password
  length 10, preserving uppercase/lowercase/digit/special-character checks and
  maximum 200. This integration carries that existing change to Web and API
  together; it does not reset passwords or provision application users.


## هماهنگی MASTER-003-CATALOG-USABILITY — 2026-08-31

مبنای اولیه بررسی Handoff origin/develop پس از #41 بود؛ بررسی نهایی Merge #58 / e25f288
را نشان داد. Handoff جدید صراحتاً قفل‌های توسعه PC-B را حفظ می‌کند و تنها رزرو integration
پس از Merge خاتمه می‌یابد؛ رزرو محدود کار جاری زیر PC-B/MASTER-003 ادامه دارد.
درخواست جدید مالک با حفظ نسخه‌های تحویلی روی شاخه مستقل از #57 اجرا می‌شود؛ ادغام
develop یا تغییر والدها جزو این کار نیست. فقط قرارداد Master Data و اسناد اعلام‌شده
در WORK_ASSIGNMENTS برای این اصلاح رزرو شده‌اند. پس از تطبیق ماکاپ، قفل محدود Schema/Migration
برای افزودن ترتیب کشور با پیش‌فرض صفر و قید عدد صحیح نامنفی به همین Work Item اضافه شد؛ Calendar دست نمی‌خورد.
ستون‌های وابسته به ماژول‌های دیگر بدون Public Contract مقدار واقعی ندارند؛ مقدار ناموجود
با وضعیت انتظار نمایش داده می‌شود، نه صفر یا اتصال ساختگی. داده نمونه فقط با منشأ آزمایشی
و بدون دست‌کاری داده کاربر واقع‌گراتر می‌شود؛ نرخ ارز و PII واقعی همچنان ممنوع‌اند.

## تصمیم‌های پذیرفته‌شده در Bootstrap

| ID      | تصمیم                                                                                              | دلیل/پیامد                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | Modular Monolith در Monorepo                                                                       | transaction و توسعه ساده‌تر؛ مرز ماژول با contract/test enforce می‌شود                                                        |
| ADR-002 | PostgreSQL سیستم ثبت، Redis موقت، S3/MinIO فایل                                                    | جلوگیری از چند source of truth                                                                                                |
| ADR-003 | دو سایت فقط Booking API مرکزی                                                                      | امنیت، pricing و Provider abstraction مرکزی                                                                                   |
| ADR-004 | Adapter و مدل normalized برای هر Provider                                                          | جلوگیری از نشت schema بیرونی به domain                                                                                        |
| ADR-005 | فروش، خرید و finance ledger جدا ولی FK-linked                                                      | margin/reconciliation معتبر و جلوگیری از اختلاط grain                                                                         |
| ADR-006 | payment، booking و issue state مستقل                                                               | نمایش دقیق paid-not-issued و recovery                                                                                         |
| ADR-007 | journal دوطرفه و balance محاسباتی                                                                  | auditability؛ posted entries immutable/reversed                                                                               |
| ADR-008 | Reporting Views با grain صریح                                                                      | جلوگیری از تکثیر مبلغ و KPI ناسازگار                                                                                          |
| ADR-009 | UTC در storage و شمسی فقط presentation                                                             | interoperability و محاسبه صحیح زمان                                                                                           |
| ADR-010 | Outbox/Inbox و handler idempotent                                                                  | side effect قابل بازیابی و delivery at-least-once                                                                             |
| ADR-011 | Organization مشترک با چند Role                                                                     | حذف duplicate agency/provider/corporate identity                                                                              |
| ADR-012 | اسناد در domain تولید معنایی و در Documents archive/render می‌شوند                                 | منوی صدور مستقل ایجاد نمی‌شود؛ version/access مرکزی                                                                           |
| ADR-013 | Toolchain پایه Node 24، pnpm 11، Turborepo 2 و TypeScript 6 است                                    | نسخه‌ها pin و در lockfile ثبت می‌شوند؛ TypeScript 7 تا سازگاری lint ecosystem استفاده نمی‌شود                                 |
| ADR-014 | Prisma 7 با `prisma.config.ts`، generator جدید `prisma-client` و adapter PostgreSQL استفاده می‌شود | URL فقط از environment می‌آید؛ schema Technical Bootstrap بدون model معتبر می‌ماند                                            |
| ADR-015 | Worker در این مرحله Nest standalone با BullMQ/ioredis است                                          | فقط اتصال/health queue دارد و هیچ job تجاری یا retry policy حدس‌زده نمی‌شود                                                   |
| ADR-016 | Compose محلی PostgreSQL، Redis و MinIO را فقط روی loopback منتشر می‌کند                            | network پروژه نام‌دار است؛ Nginx تا تعیین domain/topology اضافه نمی‌شود                                                       |
| ADR-017 | PC-A و PC-B هر دو Full-Stack و مالک همه لایه‌های ماژول‌های تخصیص‌یافته‌اند                         | تقسیم ثابت Backend/Frontend حذف می‌شود؛ Migration، Dependency/Lockfile، فایل مرکزی و قرارداد مشترک قفل هماهنگی دارند          |
| ADR-018 | Human Resources ماژول مستقل و Employee جدا از Customer/Passenger است                               | حریم خصوصی و lifecycle استخدام حفظ می‌شود؛ Finance فقط ورودی تاییدشده پرداخت را می‌گیرد و payroll قانونی کامل نسخه اولیه نیست |
| ADR-019 | IAM از Argon2id، access JWT کوتاه‌عمر و refresh opaque چرخشی با Hash ذخیره‌شده استفاده می‌کند          | token خام در DB نیست؛ reuse کل family را revoke می‌کند؛ RBAC و branch scope از قرارداد عمومی منتشر می‌شوند                    |
| ADR-020 | فروش مالک قرارداد و تخصیص passenger/service؛ Ticket Catalog مالک تعریف بلیت؛ Reservations مالک اجرا/صدور/Manifest؛ Procurement مالک خرید؛ Finance مالک release تحویل است | حذف ورود تکراری و جلوگیری از اختلاط فروش/عملیات/خرید/مالی؛ شرح کامل در `TRAVEL_WORKFLOW_ARCHITECTURE.md` |
| ADR-021 | ماژول تولیدکننده مالک Render و Issue سند است؛ Documents فقط فایل نهایی، نسخه، محرمانگی، دسترسی و Archive را مالک است | ADR-012 را در بخش Render supersede می‌کند؛ Metadata هویت صادرکننده از `legal-entities.v1` گرفته می‌شود و هیچ منوی صدور مستقل یا query مستقیم جدول Legal Entity ایجاد نمی‌شود |
| ADR-022 | Master Data فایل XLSX گذرای فیلترشده را مستقیم Render و Download می‌کند؛ PDF و آرشیو پایدار همچنان از Documents/Worker عبور می‌کنند | خروجی Excel عملیاتی بدون جعل Artifact فعال می‌شود؛ سقف ۱۰٬۰۰۰ ردیف، Permission، Audit و ایمنی Formula Injection اجباری است |
| ADR-023 | Snapshot فروش در Reservations تغییرناپذیر می‌ماند؛ رزرواسیون فقط چیدمان اجرایی هتل را برای همان مسافران به‌صورت append-only و versioned اصلاح می‌کند | نیاز عملیات به تغییر اتاق/تخت و اعضای هتل بدون انتقال مالکیت قرارداد؛ تغییر مسافر یا ظرفیت صندلی همچنان اصلاح Sales و کنترل Ticket Catalog است |

## تصمیم‌های باز

| ID           | اولویت | سوال/مالک لازم                                                                                         | اثر در صورت بازماندن                                  |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| DEC-OPEN-002 | P0     | دو سایت: دامنه، برند، channel، ارز، markup و gateway؟ مالک محصول                                       | channel/config/branding                               |
| DEC-OPEN-003 | P0     | Providerهای موج اول و capability/SLA واقعی؟ عملیات سفر                                                 | adapter و reservation states                          |
| DEC-OPEN-006 | P0     | PII/document retention، residency و key management؟ حقوقی/امنیت                                        | data/security/deployment                              |
| DEC-OPEN-007 | P0     | hosting، RPO/RTO، availability و traffic؟ عملیات                                                       | topology/backup/capacity                              |
| DEC-OPEN-008 | P1     | B2B credit exposure و blocking policy؟ فروش B2B/مالی                                                   | order authorization                                   |
| DEC-OPEN-009 | P1     | SLA تقویم کاری، تعطیلات و escalation؟ پشتیبانی                                                         | settings/automation                                   |
| DEC-OPEN-010 | P1     | Prefix و Sequence اتمیک هر نوع سند در scope شرکت صادرکننده و الزامات رسمی PDF؟ مالی/حقوقی             | unique constraints/templates؛ اجرای Sequence به Task بعدی موکول است |
| DEC-OPEN-011 | P1     | Customer duplicate/merge authority و matching thresholds؟ CRM                                          | privacy/audit/workflow                                |
| DEC-OPEN-012 | P1     | attribution model و campaign cost source؟ مارکتینگ                                                     | KPI/reporting                                         |
| DEC-OPEN-013 | P1     | تقویم/شیفت، سیاست حضور و مرخصی، حداقل payroll input و retention پرونده پرسنلی؟ منابع انسانی/مالی/حقوقی | HR workflow، permission، reporting و Finance contract |
| DEC-OPEN-014 | P0     | مشخصات واقعی API بیمه سامان، sandbox، طرح‌ها، cancel/refund و SLA؟ عملیات سفر/بیمه                     | Insurance adapter و state/error mapping               |
| DEC-OPEN-015 | P0     | قالب Excel، تناوب ارسال، کانال انتقال و acknowledgement هر ایرلاین؟ رزرواسیون                          | Manifest template/version/schedule                    |

## روش ثبت تصمیم بعدی

هر تصمیم باید Context، گزینه‌ها، انتخاب، دلیل، consequences، owner/date و migration/reversal plan
داشته باشد. تغییر تصمیم پذیرفته‌شده با ADR جدید supersede می‌شود و تاریخچه حذف نمی‌شود.

## تصمیم‌های پذیرفته‌شده FINANCE-001

مالک محصول و کسب‌وکار در 2026-08-24 هر چهار Decision Record زیر را رسماً پذیرفت:

- [DEC-OPEN-001 — مرز Sub-ledger و حسابداری قانونی](decisions/DEC-OPEN-001-finance-ledger-boundary.md)
- [DEC-OPEN-004 — Money، FX، Tax و Recognition](decisions/DEC-OPEN-004-money-fx-tax-recognition.md)
- [DEC-OPEN-005 — Approval Matrix و Maker/Checker](decisions/DEC-OPEN-005-finance-approval-matrix.md)
- [DEC-OPEN-016 — Financial Release](decisions/DEC-OPEN-016-financial-release-policy.md)

این چهار مورد دیگر تصمیم باز نیستند. پذیرش آن‌ها فقط Gate معماری را رفع می‌کند؛ در
FINANCE-001 Phase A هیچ Prisma Schema، Migration، Repository، Persistence، Dependency یا
Lockfile تغییر نمی‌کند. پس از Merge PR #21، ایجاد Schema و Migration افزایشی مالی فقط در
Task مستقل Phase B، با رزرو مجدد قفل‌ها و Migration gate کامل، مجاز خواهد بود.

## ADR-TRAVEL-DELIVERY-0909 — confirmed by owner
Implement the explicit Finance delivery tick as a manual document-delivery authorization, separate from settlement, credit, ledger and payment approval. It never changes financial facts or pretends to satisfy the broader settlement engine. Default blocked, Finance-only permission, mandatory reason, versioned approval/revocation and actor/time audit. Sales document APIs remain blocked until this authorization and operational readiness both hold. Reservations can preview operational documents independently. Supplier confirmation is required for vouchers; insurance absence requires explicit acknowledgement rather than blocking. Operational room/age overrides preserve customer birth dates and commercial allocations; commercial changes require Sales correction. Earlier draft previews in the Sales form must not bypass the delivery gate.

## ADR-CONFIRM-VOUCHER-0909 — owner request
Supplier confirmation now atomically issues the hotel voucher and notifies the Sales owner. There is no separate confirmed-only stage for new commands. Explicit missing-insurance acknowledgement is still required; the Finance delivery gate remains unchanged. Legacy already-confirmed records retain ISSUE_VOUCHER support. New queue cards use #FFC0C0 only on the identity column, and issued vouchers use dark gray. This refines the prior travel handoff flow without changing stored schema or grants.

## ADR-SUPPLIER-FORM-ISOLATION-0910 — explicit owner choice
The owner selected: No affects supplier reservation form and purchasing basis only; Yes also affects contract and voucher. Supplier draft settings and sent settings are separate workflow JSON copies. Purchase displays the sent copy, never an unsent draft; explicit re-send records a new copy/version. Sales confirmed commercial records are not edited through updateDraft. The public Sales operational-amendment service records nonfinancial form settings in service metadata, increments the contract version and writes before/after Sales audit within the same transaction as the Reservations revision. Current contract output renders operational hotel amendments and an explicit amendment section; original financial terms, customer/master foreign keys and prior evidence remain intact. Sales update permission/branch scope and optimistic version checks are required for apply-both. Failure rolls back both destinations. No schema migration or new external send channel.
## B2B-CONTRACT-CREDIT-001 — decisions confirmed by owner

- A single independent reviewer approves contract/credit changes using the corresponding permission; the proposer cannot approve their own request. Confirmed explicitly in this task on the Screenshot527 follow-up.
- Each currency has a separate credit limit; no implicit FX conversion. Contract/policy drafts have no effective financial authority before approval. Submitted/approved content is versioned and preserved, and edits require a new draft/revision.
- Evolve existing B2B profile/agreement/credit persistence and public routes. Organization identity remains in Master Data, binary/version storage in Documents, and exposure/payment/deposit balances in Finance. This scope completes the contract/credit wizard and its management workflow, not every independent PRD module.
# PACKAGE-PRICING-001 — Fail-closed upstream contracts (2026-09-14)

مرزبندی صریح مالک محصول، نرخ پایه هتل را به Master Data و نرخ پایه/ظرفیت بلیت را به Ticket
Catalog واگذار می‌کند. چون develop فعلی این دو Public Contract نسخه‌دار را ارائه نمی‌کند،
Package Pricing از adapter صریح fail-closed استفاده می‌کند (`SOURCE_RATE_UNAVAILABLE` و
`CAPACITY_RECHECK_FAILED`). استفاده از داده ReservationHotelGroupRate به‌جای نرخ پایه ممنوع
است، چون آن مدل هزینه واقعی خرید Reservations است. Renderer نیز producer مستقل است و نبود آن
فقط Render Request واقعی `AWAITING_RENDERER` می‌سازد؛ فایل یا success ساختگی ممنوع است.

## ADR-MASTER-HOTEL-BASE-RATES-0914 — versioned period grid

با درخواست صریح مالک محصول، Master Data مالک نرخ پایه فروش هتل در بازه اقامت است: یک شهر،
check-in/check-out و تعداد شب، همه هتل‌های فعال همان شهر، انتخاب حضور در تور، مبلغ پایه هر
اتاق/شب و ضرایب رده‌های اقامت. ویرایش رکورد قبلی تاریخچه را بازنویسی نمی‌کند و نسخه immutable
جدید می‌سازد. Package Pricing فقط Public Contract نسخه‌دار را مصرف می‌کند و reference غیرجاری،
خارج از شعبه یا با ارز ناسازگار را fail-closed رد می‌کند. مدل خرید واقعی Reservations مستقل
می‌ماند. این تصمیم blocker هتل را رفع می‌کند و blocker Ticket Catalog یا Renderer را رفع‌شده
فرض نمی‌کند.

## ADR-TICKET-TARGET-COMMISSION-0928 — accepted by explicit product-owner request

Standalone ticket target pricing changes from manually entered independent absolute amounts to a shared base with a separately saved commission percentage per ticket/round-trip and sales target. The owner explicitly requires net = base minus target commission and copying one percentage to all priced tickets for that target. This applies to standalone ticket sales only; Package Pricing's profit commission rules remain separate. Legacy absolute target prices remain readable until an explicit commission is saved, optional public fields preserve v1 consumers, new contracts use the current effective direct fare and old contract snapshots are immutable. Copy is atomic, branch-scoped, includes both one-way/pair fares regardless of UI filters and excludes unpriced/archived/departed offers. User authorized overlap management and merge to develop on 2026-09-28; preserve Manifest transportType and unrelated Finance work during integration.

## B2B-SALES-DOCUMENT-GATE-1003 — current owner contract

For B2B-SALES-CONTRACT-CONNECTION-1003, the older supplier-payment wording in MODULE_BOUNDARIES does not define passenger-document delivery. The merged owner decision FINANCE-CUSTOMER-DOCUMENT-DELIVERY-0920 and the current Sales travel-documents endpoint are authoritative: customer-contract Finance delivery permission is independent of supplier purchase/payment. The later Reservations manifest exemption is not extended to passenger documents. Organizations reuses the owner HTTP action and adds no delivery authorization or bypass. Contract PDF output and FINANCE payment receipts retain their separate original owner gates. This resolves the reference conflict before implementing the new dossier entry points; it changes no Finance policy.
## INITIAL-PASSWORD-FOUR-DIGITS-1004 — 2026-10-04

Owner-approved exception to PR #46: administrator-created initial user passwords accept 4–200 characters, including numeric-only values, without required character classes. This is limited to creation; self-service change, administrator reset and bootstrap administrator keep the existing strong policy. Password hashing, permissions, login throttling and existing credentials remain unchanged. Four-digit numeric passwords have only 10,000 combinations; owner explicitly approves the simpler initial credential policy. No automatic data or password rewrite.

## FINANCE-WORKFLOW-EXPORTS-1004 — accepted owner decisions

Owner defers amount-based multi-stage Finance approval/separation for now, confirms one-day pre-due reminder and one-day overdue escalation, chooses a selectable authorized manager per branch and authorizes only a limited public approved HR salary bridge. Salary entry is an HR amount-only approved payment request, not an invented calculated payslip or direct private HR table read. Existing HR self-approval protection stays unchanged. Native source workflow contracts are not rewritten into a false uniform approval or bank settlement; new Finance-owned cases implement the clear review/approve/partial/full operational workflow. XLSX/PDF receipts attest recorded internal authorized transactions only. New export/management permissions are not silently granted. Missing source/render capability is reported as failure instead of producing an apparently complete/valid receipt.
## SALES-EXACT-TRIP-FLOW-1004 — owner-approved contract entry policy

- 2026-10-04: the owner requests one agreed total and one day-sale total for a round-trip ticket, exact departure/return dates with flight-availability dots, and no manual question about each passenger's hotel room/occupancy. This supersedes mandatory accommodation selection for new Sales contract entry only. Existing optional occupancy snapshots, age validation, aggregate room counts and guest/service assignments remain intact; no room assignment is invented.
- The UI groups both flight legs, but the public payload retains two service/allocation identities. Decimal-unit splitting preserves the exact combined currency total and existing catalog day-fare snapshots. Day sale and agreed price remain distinct; one-way services retain their own service identity.
- Calendar dates follow Tehran local days. Public paginated Ticket Catalog projections provide the marked days; reverse-route, branch, arrival, capacity, fare and inclusive Min/Max constraints determine return dates. Exact-day listing and authoritative server recheck prevent dates from weakening inventory validation. Floating contract-only tickets retain explicit manual-date entry.
## VOUCHER-SEARCHABLE-LEADER-1005 — existing producer/consumer Board compatibility

Master Data's registered broker Board already permits 300 characters, while the Reservations snapshot rejected more than 200. The owner requests automatic registered Board persistence without the current validation error. Accept exactly the existing 300-character producer bound for transferBoard only, preserving other field bounds and all passenger/age validation. Canonical Board/contact/name are resolved through the existing audited public directory, not copied from client assertions. No schema/migration/shared wire or producer change.

## TICKET-CATALOG-SALE-DEFAULT-1005 — owner-approved narrow new-contract policy

On 2026-10-05 the owner explicitly requires a new contract with only FLIGHT selected to obtain day-sale price from the registered public ticket sale price and prefill an independently editable agreement with that price. This specific case does not mirror day sale from agreement, superseding the earlier temporary agreed-price mirror where applicable. Preserve catalog quote freshness, exact seat-tier/pair totals, historic contracts and all other service/package policy. A missing registered fare does not invent a price or replace a manually entered floating-ticket price. No new price producer, API/permission policy or database change.


## 2026-10-05 — RESERVATION-PURCHASE-BROKERS-1005

The new independent MasterBroker form conflicts with the older purchase selector and required MasterOrganization FK. Use a new broker-only option kind for Reservations hotel/transfer purchase, leaving legacy organization/rate-capture consumers intact. Add a nullable broker FK beside the nullable legacy organization FK with exactly-one-source CHECK; preserve all historical rows and existing v1 wire keys. Producer MasterTravelDirectory validates canonical active brokers; only NotFound allows legacy organization fallback, never inactive/permission/server failures. Rollout is additive migration → API → Web. No historical supplier relinking or synthetic organization creation.

## 2026-10-06 — SALES-PASSENGER-PRICE-1006

Owner replaces new-contract per-service day/agreed-price entry with explicit passenger whole-package amounts: IRR plus optional selected active foreign currency per passenger. These are final Sales revenue, independently totalled per currency with exact four-decimal arithmetic; no ticket/hotel revenue allocation or FX conversion is invented. New snapshots mark all services passengerPackagePricingVersion=1; package components exactly reconcile to passenger agreedPrices. Existing validated over-60 insurance surcharge is included once for its assigned passenger. Legacy unmarked service-priced contracts retain their meaning; public catalog quote freshness and capacity checks remain independent of customer package amounts.

Actual contract profit is Sales revenue minus recorded Reservations hotel/transfer/insurance costs and Finance-recorded ticket unit cost times the contract's assigned seated passengers. Costs are read only through owner public services; payment settlement is distinct from incurred purchase cost. Latest grouped purchases count once, legacy hotel amounts only as fallback, missing costs suppress a final profit, and each currency stays separate. Profit requires existing Sales read authority, finance.read and actual branch membership. No Reporting fact rewrite, schema/migration, permission grant or operational backfill.

## TICKET-PURCHASE-INBOX-1007 (2026-10-07)

The owner requests moving travel ticket purchase pricing from Finance to a separate Purchase & Supply inbox. This supersedes only the previous direct-Finance price-entry exception: Ticket publication still produces one persisted Procurement envelope per real offer; authorized Procurement quote managers enter seat count and actual unit cost through the public Finance cost command, and Finance pays only a priced envelope. Financial revisions and payment/receipt history remain Finance-owned; the general PC-B Procurement implementation is untouched and its menu presentation becomes تنخواه. Existing marked package revenue and actual allocated-seat contract profit are unchanged, separately per currency. No new journal, cost allocation or FX conversion is inferred. Existing Finance cost/payment fields remain; old Finance price HTTP route rejects edits. New purchase price writes require an operation UUID and expected cost version, serialize on the existing request lock, retain retries in the cost audit reason, enforce capacity bounds and freeze after payment starts. No schema or IAM grant.

## 2026-10-07 — PROCUREMENT-PETTY-CASH-ACTIONS-1007

The owner explicitly requests permanent deletion and deletion on rejection. The pre-existing remove API conflicts with unconditional append-only database triggers. Resolve with an exact-request, transaction-local purge capability used only after API deletion authorization/CAS and the Finance commitment guard. The database independently verifies the exact request and absence of accepted/paid Finance handoffs before allowing DELETE on that request's history. UPDATE remains forbidden, idempotency records never allow deletion, and a minimal immutable actor/branch/request-number deletion receipt survives in ProcurementIdempotency. Ordinary history mutation and cross-request purges remain rejected. No Finance-owned record is deleted. Rejection with deleteRejected=true is atomic and requires approval, deletion and foreign-request assignment permissions; existing rejection clients retain their previous behavior. Display rename to تنخواه changes no financial accounting semantics. Approval exposes the approved request in orders; an actual order still requires supplier, amounts and commitment approval.

## ACCOUNTING-PRD-1007 — operational accounting persistence

User authorizes the PRD implementation, not statutory ownership or external filing. Implement internal branch-scoped books and local business dates; issuer Legal Entity does not filter operational records. Preserve DEC-OPEN-001 external legal ownership. Independent detailed accounts are dimensions separate from group/general/subsidiary chart levels; legacy preview DETAIL leaves are not migrated implicitly. Incomplete draft lines are persisted without constructing the existing fully validated JournalEntry; transitions validate all posting invariants transactionally. Posted originals remain immutable and included after reversal. New ledger/period/account entities are additive; existing settlement accounts and payment revisions remain their source of truth.

ACCOUNTING-PRD-1007 FX carry policy: operational closing/opening preserves immutable posted historical lots grouped by account/dimensions/currency/approved snapshot/rate, including their signed quantities and base values. It does not create a fresh FX valuation. The server-owned OPEN/CLOSE provenance retains this policy; ordinary manual journals cannot use it to bypass current-rate checks. Zero-base/nonzero-quantity lots fail preflight for explicit resolution.

ACCOUNTING-PRD-1007 report scope: trial balance and turnover select exactly one fiscal period (explicit ID, reference date, then latest available period). Opening is the posted balance before the selected from-date within that period. Prior-period movements are excluded after carry-forward; arbitrary multi-period aggregation requires a separately designed consolidation policy. UI hides results when their generating filters no longer match.

## HOTEL-MANUAL-COEFFICIENTS-1008 — owner manual pricing policy (2026-10-08)

The owner confirms purchase/night = the selected room type's base price × the hotel's exact guest-composition coefficient. Sale adjustments affect only selected sale rows and are relative to purchase, never compounded against current sale. Fixed additions/subtractions, percentage adjustments and an explicit sale override replace the prior selected rule. All monetary arithmetic is exact Decimal-string/BigInt with currency half-up rounding and bounded values; negative sale and non-positive purchase are rejected.

Only the old manual table/coefficient editor is retired; it is not a blanket deletion of imported Nora tariffs or historical revisions. Old manual factors are not inferred as valid new coefficients. Explicitly saving a replacement pack version drops old manual factors from that version. Original versions, existing contracts and published prices remain immutable; no operational database cleanup or deployment is authorized here. Manual child ranges are selected, integer and below15; source Excel bands remain untouched.

Reservations produces additive optional manual metadata and sale amounts inside the existing occupancy JSON. Sales explicitly quotes sale; purchase/capacity consumers keep the purchase default. Legacy/imported tariffs without new metadata retain their exact price. New manual packs stay independent from tour-linked per-person pricing.

## ADR-HOTEL-SHARED-PERIODS-1008 — Accepted

The owner requests independently editable hotel rate periods and a selectable common stay for package creation. Keep original versioned rate periods and materialize selected complete nightly tariffs into a separate immutable shared pack, with restrictive source-batch FKs. Recheck source versions and create the shared snapshot atomically under Serializable isolation. Do not reinterpret room capacities as prices, mix brokers/room types/boards/currencies, silently fill missing nights or average rates without weighting nights. Package Pricing keeps its established batch references, exact-night calculator and publication controls. Repricing a source requires explicitly creating a new shared snapshot; previously published packages remain unchanged. No change to operational contract sale prices or historical data.

## EXECUTIVE-ASSISTANT-1011 — independent executive assistant (2026-10-11)

The owner explicitly requests an ERP-integrated assistant UI with a separately
running backend. Keep the ERP modular monolith and domain ownership unchanged;
add a bounded external read adapter, not a second owner of ERP tables. The Web
same-origin proxy transports one access cookie to the configured service. IAM
and fixed public Workbench APIs enforce user scope. The assistant requires an
explicit executive screen grant; administrator alone is insufficient.

This slice uses existing Node 24 without dependencies or DB/model credentials.
No LLM or news provider is selected because the owner deferred data-processing
policy. Generated reference images define panel coverage, not factual metrics.
Business forecasts and scenarios fail closed as unavailable until source,
company scope, metric definitions and evaluation are approved. Details and
acceptance: docs/tasks/EXECUTIVE-ASSISTANT-1011.md. No migration or role grant.

## ASSISTANT-ALL-USERS-1011 — shared SELF access (2026-10-11)

Supersedes only the executive-only entry gate in EXECUTIVE-ASSISTANT-1011.
The owner explicitly requests temporary access for all departments and users,
including Amin. The existing six-view shell is available to every authenticated
ERP user; current tools return SELF data only. Revalidate the active IAM identity
before each tool and response, forward only the access cookie, and preserve source
API permission checks and fail-closed denial. No bulk executive grants, role
changes, corporate scope, new persona, write tool or administrator bypass.
Future corporate capabilities require separate source authorization. No expiry
was requested; revisit shared availability before final product rollout.
## ASSISTANT-MVP-FOUNDATION-1012 — no-model first delivery (2026-10-12)

The owner approves implementing the staged plan and confirms that the first
version must send no data to a model. Implement read-only fixed capabilities and
deterministic source-backed output first. A capability dispatcher is not an LLM
or general conversation. Shared SELF entry remains authenticated and existing
source permissions remain authoritative. Corporate source contracts/definitions,
RAG documents, model processing and Production pilot are independent gates.
This explicitly supersedes the former deferred-provider policy for the current
iteration: no provider is selected or called. Financial catalog metadata does not
prove readiness; receivables producer is PENDING_CONNECTION. See the foundation
task for fixed APIs, source discovery and complete staged acceptance tracking.
# HOTEL-TEMPLATE-IMPORT-1012 — editable hotel source metadata

The user's 2026-10-12 follow-up requires supplied workbook data to remain available in each hotel's editable profile. Store hotel service level and internal note as nullable Master Data profile fields; expose the existing description and hotelRules fields. Preserve workbook destination, refund text, image-source addresses and featured flag as nullable descriptive source fields. This resolves the earlier import behavior that discarded these values: storing source text does not authorize a Procurement cancellation policy, Sales popularity computation, Documents binary ingestion or remote URL fetch. Public Master Data scalar attributes carry these additive optional fields; older clients preserve them when omitted. Existing geography FKs remain authoritative and no data is backfilled or fabricated.
## ASSISTANT-PHASE1-REPORTS-1012 — accepted definitions, real source (2026-10-12)

Owner confirms creation-date valid contracts, discount inclusion/refund exclusion,
separate currencies, two seven-completed-day Tehran windows, route contract counts
with passengers separate, contacted-lead conversion and Finance-owned receivables.
Owner explicitly advances from Phase0, deferring final source/business acceptance
and access/retention refinements. Existing authorization remains mandatory.
READY demo Reporting metadata cannot substitute for a real Sales public projection.
Add a bounded native-permission Sales-owned read API; independent assistant has no
DB access and exposes only reconciled aggregates with explicit unavailable metrics.
No money/net/refund or CRM cohort is inferred. See Phase1 task for source readiness,
full accepted definitions, partial coverage and separate ERP runtime publication.


## 2026-10-14 — Sales amendments from Reservations (PC-A)

User explicitly requested actual flight/hotel/sale-price amendments, independent passenger identity editing and counterparty reassignment including existing debt and receipts. Sales remains the writer of the canonical contract. The additive party command changes buyer/payer together under Sales edit plus Finance receipt-approval permission, with encrypted contact audit; payment IDs, amounts, confirmations and bank/check evidence remain unchanged. The additive full amendment command uses optimistic versioning and a Serializable transaction; Ticket's public capacity method participates in that transaction and locks both old/new offers before replacing allocations. No cross-module table writes are performed by Sales.

A changed execution selection or age category creates a new durable Sales reservation snapshot in the same transaction. Previously issued intake snapshots and operational revisions are retained and viewable from contract history. Price-only amendments retain the current operational intake. Newly amended operational selections return to the Reservations queue for review/issuance; previous documents are historical, not silently rewritten. Passenger identity remains Customers-owned; contract age correction does not alter birth dates. No schema or migration changes.
## 2026-10-14 — Explicit Sales role scope

The reference-PC owner explicitly overrides the earlier title-neutral Sales scope
for the bounded Manager, Sales Manager and Sales Expert profiles. Active Manager
and Sales Manager profiles receive system-wide contract read and contract creation;
Sales Expert profiles remain owner-only, including valid manual snapshots. Other
permissions, explicit UI restrictions and malformed/disabled snapshot denial remain
authoritative. This is source policy only, not an operational grant migration.
Role/profile producers must validate these effective Sales grants during assignment;
the display title cannot bypass an operator's delegation boundary.
See tasks/SALES-SELLER-VISIBILITY-1014.md.

## 2026-10-15 — Flight purchase ownership and capacity cost allocation
Owner explicitly approves this rule: floating flights are purchased against the individual contract/service using the Reservations service purchase revisions, supplier/currency FK, branch authorization, CAS and idempotency. Company capacity is purchased once for the seat block, with its total supplier invoice. Each contract consumes only its allocated non-infant seat fraction of that total; unsold seats are never charged to a sold contract. Until scheduled arrival the residual is remaining-capacity cost; after arrival it is final-loss evidence in the purchase read model. Currency totals remain separate. The read model does not post an additional journal or duplicate the invoice. Legacy unclassified supply is not inferred to be company or floating. Existing company contract-level costs cannot replace the known shared invoice source. This owner instruction supersedes the previous rule routing every flight purchase through the shared inventory queue.

## PACKAGE-SALE-FLOW-1018 — 2026-10-18

Owner requests per-room base purchase rates, package-only sale adjustments, exact composition sale defaults, salesperson discount and automatic single/double banner handoff; develop merge authorized. Preserve legacy/imported data and maker/checker. New package publication uses exact room/composition/board/date identity rather than a cheapest-room substitution. Missing nights or conflicting age-band tariffs do not invent a sale price. Purchase rates stay immutable. Sales consumes only sale amounts through Package Pricing's branch-scoped public projection; approved publication validation may authorize a hotel alternative outside the original Tour definition while all flight identity/capacity/service guards remain. Banner data is derived from the same selected immutable publication, grouped by hotel/room/board; only one/two-adult, no-child combinations appear and missing tariffs remain blank. Sale-only frame v2 supports missing single/double alternatives, preserving strict legacy v1 payloads. Currency arithmetic uses decimal strings/BigInt/Prisma Decimal; no cross-currency sum.


## WORKBENCH-MESSENGER-FILES-1018 — owner-approved immediate chat file delivery — 2026-10-18

Owner explicitly requests removing the antivirus-wait restriction when another participant downloads a chat attachment. Messaging may deliver an owned, message-linked GENERAL/INTERNAL attachment in CLEAN, PENDING_SCAN, AWAITING_ANTIVIRUS_ADAPTER or SCAN_FAILED state. Known INFECTED/QUARANTINED files stay denied. Membership, branch, source linkage, archive state, authenticated download, audit, encrypted storage and upload content/type/size validation remain mandatory. This exception applies only to the narrow Messaging download port; general Documents, profile and other consumers keep their existing policy. No version is falsely marked clean and no scanner is disabled globally.

## Owner-approved self-service password exception — 2026-10-18

The owner extends the simple-password policy to authenticated self-service password changes: 4–200 characters, including numeric-only passwords, without mandatory character classes. This supersedes the earlier creation-only limitation for self-service changes only. Administrator reset and bootstrap policies remain unchanged. Current-password verification, session revocation, hashing and throttling remain intact. No existing credentials are rewritten.

## 2026-10-19 — Temporary Sales past-ticket entry

Owner explicitly authorizes selecting past dated flights and continuing contract registration. Civil dates are still validated and return ordering/Min-Max stay, active status, branch, immutable flight facts, fares and seat capacity remain enforced. Search and management reads no longer automatically pause departed offers; previously paused records remain paused until an authorized manager explicitly reactivates them. No historical status/data backfill or automatic reactivation. Tour publication dates and unrelated financial deadlines are unchanged. No schema, migration or dependency change. Remove this temporary policy only under a later owner instruction.

## 2026-10-19 — Floating clocks and consistent combined Sales parties

Owner requests inheriting previously selected outbound/return civil dates for floating flights, asking only Tehran departure/arrival clocks, and automatic next-day arrival when the arrival clock does not follow departure. Changing calendar dates clears prior floating choices to prevent stale snapshots. Owner additionally requires exact hotel/flight adult, child and infant totals using existing airline age normalization and matching passenger membership on the API. Room negotiated currency now permits IRR through UI and shared validation, using existing exact per-currency totals with no exchange conversion. Legacy roomless draft compatibility remains; new UI requires room details. No data backfill, schema or dependency change. Owner authorizes develop merge and backed-up production rollout.

## 2026-10-19 — Call Center request and follow-up ownership

CALL-CENTER-PACKAGE-ONE-1019 reuses Customer Affairs Ticket and Tasks AutomationTask rather than duplicate generic request/task models. The reserved Call Center category keeps private data encrypted and is excluded from generic support reads/mutations/reports/SLA reminders. No business SLA is assumed: its explicit no-SLA marker permits equal technical required date placeholders while preserving the existing support SLA-order constraint for ordinary tickets. Caller number groups communication history within one branch and does not establish Customer identity; unknown numbers are event-specific. Existing historical records remain unchanged. New workflow authority is independent and only the owner-approved amin grant is applied locally. Private unconfirmed drafts stay in memory with exit warnings, without browser plaintext persistence or crash-recovery guarantees.

## Call Center package two search decision — 2026-10-19

Use bounded, branch-domain-separated HMAC whole-word tokens for name/subject, exact phone fingerprints and opaque source/team fingerprints. No substring/ngram index and no plaintext private shadow columns. Leakage: token equality, frequency and token count within a branch; key holders can test guesses. API only exposes authorized matches. Index generation is a resumable one-time bounded backfill, never a full decrypt scan per query. Queries reject incomplete index coverage rather than silently returning incomplete results. Exact normalized words (AND) and exact equivalent phone formats are supported; partial-word search is explicitly unsupported. Pagination rejects a changed data revision with409 and offers explicit refresh, preserving selected context; it never silently skips shifted rows. No URL private search terms. Reports state time window, grain, timezone, null denominator and coverage.

## 2026-10-19 — Telephony package three, internal contract v1

No Issabel protocol, authentication, capabilities or latency are known. This package supplies an authenticated synthetic adapter only; real connections stay inactive. Integrations owns encrypted durable canonical Inbox, dispatch Outbox, connection/mapping configuration and audit. Customer Affairs exposes a transactional projection port and owns the single business call plus technical root/legs, recipient snapshots, claims and completion. No raw provider payload is accepted or distributed. Shared v1 producer/consumer ship together, with explicit nulls and server receipt time distinct from occurrence.

Worker uses existing BullMQ and polls the durable Outbox. Redis is disposable transport, never the acknowledgement source. The authenticated shell uses a bounded authoritative two-second polling snapshot rather than asserting provider push/latency. Reconnection reloads persisted incomplete work; tab leases and call CAS are enforced by the server. Synthetic rows use SYNTHETIC origin and reserved fictional numbers. Mapping recipients are snapshotted at receipt and revalidated at processing; unknown extensions are not broadcast. Canonical processed inbox payloads expire after seven days; HMAC deduplication tombstones remain. Real retention/recording policy and provider adapter activation require a separate approved integration.

## 2026-10-19 — الزام مالک محصول برای حفظ طراحی کال سنتر

تصمیم قطعی مالک: در بسته چهارم و اتصال ایزابل، آخرین طراحی/رفتار تأییدشده بدون اجازه
صریح او تغییر نکند؛ هیچ بخش فنی یا آزمایشی به پنل افزوده یا بازگردانده نشود. حذف بخش
آزمایش داخلی در8f485a26 باید حفظ شود. نیاز فنی یا دریافت API مجوز ضمنی UI نیست.
این تصمیم، هر برداشت متفاوت از راهنمای تاریخی بسته سوم را کنار می‌زند.
[سند الزام‌آور و روند تأیید](tasks/CALL-CENTER-UI-PRESERVATION.md).

## 2026-10-19 — PASSENGER-DIRECTIONS-1019

Owner explicitly replaces mandatory hotel/flight membership equality with per-leg passenger selections: hotel-only guests are valid, and each flight consumes only its assigned non-infant seats. Existing global room composition validation and actual guest occupancy remain. New Sales drafts use manual per-guest hotel prices; legacy room agreement snapshots remain readable, while new per-guest totals never double count them. Canonical service allocations drive existing Reservations manifests. No schema or historical data rewrite.

## ISSABEL-ADAPTER-1020 — bounded recording storage

Owner explicitly requests saved call audio without ERP playback. For this initial integration, actual audio is stored as authenticated encrypted32KiB chunks in Integration-owned PostgreSQL tables, rather than exposing an external recording URL or claiming that metadata is an audio backup. This is a bounded exception to general Documents/S3 file storage:20MiB WAV maximum, approved retention required, explicit byte/hash finalization and private PBX uploader. No cross-module Documents table access. Reassess storage/backup volume with measured call traffic before Production. AMI UserEvent hooks express verified PBX facts; generic channel Hangup/IVR Up is insufficient evidence of linked-call completion/human answer. Actual installed-version hook compatibility and reconciliation remain live-acceptance requirements, not assumptions.

## LOAD-CONTRACT-TICKET-SYNC-1022 — current flight schedule projection

Owner explicitly requires load revisions to reach existing linked contracts and already issued ticket downloads. Current authorized reads overlay the exact catalog offer's operational schedule, including stopped/archived but still linked offers. Saved contract amounts and immutable issue/history/QR artifacts remain historical records; new current previews/downloads use the latest schedule. This resolves earlier snapshot-only display wording without mutating financial or historical source records. No migration or automatic external reissuance is implied.

## HR-JOB-TITLES-PROFILE-1022 — employee assignment corrections

Owner explicitly permits unit, job title, grade and direct-manager correction from the employee editor. This supersedes the earlier editor-only prohibition for these four fields. Branch, employment start and exit remain in their established workflows. Corrections require HR management, branch scope and employee CAS, validate canonical references and append an applied assignment snapshot plus before/after audit in the same serializable transaction. Job titles are shared through an HR-owned minimal catalogue (ID/name/status); underlying record mutation remains branch-authorized. Existing stored position slots and identity14 payloads remain compatible; postal code appends identity slot14 and stays encrypted. A forward migration adds nullable employee/assignment job-title FKs without the ordinary parent branch constraint. No historical rewrite or backfill.

## 2026-10-24 — Contract-only person entry authorization
Owner explicitly authorizes the entire new-contract person workflow under sales.contracts.create and visibility of /sales/contracts/new. Customers exposes a bounded sales/people entry adapter using its existing validation/encryption/branch/CAS/audit producer. It derives request-local read/create/update/sensitive/contact and Customer field capabilities solely for those actions; general Customers administration remains unchanged and no grants are stored. Role/status/merge/archive and organization mutation remain outside this adapter. Active agency resolution stays on the existing Sales reference endpoint.


## 2026-10-24 — Current contract amendment output and passenger pricing

CONTRACT-EDIT-PASSENGER-PRICES-1024: owner requests passenger prices and deductions together in Reservations amendment, and current outputs after edits. Current form/ticket reads use a Sales-owned branch-scoped execution projection; historical workflow reads retain the stored intake. Reservations rebases changed canonical hotel/flight/age/service facts while retaining broker/leader/notes and unchanged output-only overrides. A server-owned optional outputSourceSnapshot on workflow state records the last acknowledged base, so a later price-only revision cannot erase output-only customizations; no command accepts this field. Old states fall back to their intake snapshot. Existing issued artifacts and public bearer-link files remain immutable; newly generated previews/PDFs/shares use current facts. Downloaded copies cannot be changed remotely.

Passenger-total amendments persist gross totals, deductions, net agreed prices and contract totals together with per-currency Decimal math and existing cheque/insurance rules. They omit obsolete room-price controls. Pure monetary metadata changes do not publish a new execution intake or reset approvals. Existing receipts, audit revisions, branch/own permissions and CAS remain. Customers exposes current name/DOB only for an already authorized Sales output path, audited without decrypting document numbers. No schema/migration/dependency or new permission grant.

## 2026-10-24 — Immediate raster image preview (IMAGE-PREVIEW-NO-SCAN-WAIT-1024)

Owner requests removing antivirus wait from uploaded photo preview. This supersedes the general CLEAN-only rule solely for authenticated JPEG/PNG preview, including PREVIEW step-up grants. Permit explicit non-infected scan states without relabeling them CLEAN. All existing branch, domain, file-read, confidentiality, archive and step-up checks remain. Infected/quarantined images remain blocked. Download, template execution and non-image delivery retain their original scan requirements. Existing MIME detection, response isolation and browser rasterization remain in place. No migration or scanner shutdown.


## 2026-10-24 — Optional national ID in New Contract only

SALES-OPTIONAL-NATIONAL-ID-1024: owner explicitly scopes optional national ID to New Contract. Customers-owned createForSales applies this policy only after validating contract-create, screen and actor branch access; general directory create remains strict. Missing ID is omitted (never fabricated), provided IDs retain normalization/protection/uniqueness. Sales entry relaxes national-ID required attributes through an opt-in shared component prop, leaving default consumers unchanged. Birth date/passport and all other identity rules remain. Uncertain no-ID creation requires choosing the existing record instead of unsafe automatic re-creation. No schema/migration or permission grant changes.

## 2026-10-24 — Temporary Sales hotel capacity exception

Owner explicitly disables blocking hotel room capacity and guest-age/composition matching while room capacities are incomplete. Shared Sales policy governs Web save and API save/confirmation. Actual passenger allocations, valid room IDs/ordinals, stay dates and money checks stay authoritative; absent tariff matches do not create quotes or erase negotiated prices. Re-enabling requires a new owner request. Agency buyer landlines accept any nonempty digit sequence (optional leading +), without a minimum national-number length; mobile number validation remains unchanged. Owner also authorizes develop merge and production rollout.

## 2026-10-24 — Contract owner self-service

Owner authorizes visible Sales contract-area users to export, amend and record additional payments for their own contracts in their allowed branches, without separate export/update/payment grants. Existing explicit screen denies, broader native permissions, contract state/CAS/idempotency and payment validation stay authoritative. This grants no receipt approval, financial release, payer transfer or access to other owners' contracts. The old flight/room party equality error follows the already-approved temporary hotel-capacity policy. Develop merge and production rollout explicitly authorized.

## 2026-10-25 — Call Center request assignee scope

Explicit owner approval makes request execution assignment self-only for ordinary agents, current-unit-only for team managers, and cross-unit for an explicitly configured executive/demo allowlist. Use active native ERP identities and the existing team-management permission with exact organizationUnitId; never infer authority from display names or phone extensions. A dedicated request directory avoids widening telephony/referral eligibility. Server-side assignment validation is authoritative. HR's public minimal projection supplies full name/title; unknown titles remain unknown. Branch and contact permissions remain intact, and accounts/grants are not implicitly created. See tasks/CALL-REQUEST-ASSIGNEES-1025.md.

## 2026-10-25 — Evidence-backed financial workflow completion

Owner authorizes implementation, develop merge and3100 rollout without orchestration or automatic banking, preserving current forms. Principal/agent is explicit; outgoing agency commission is not earned revenue. Actual imported gross/deduction/net payroll is reconciled with the approved HR request, without invented statutory rates. Posted original payable carrying and prior valid revaluations determine realised FX; actual cash is never journalled twice. Failed payouts remain, and actual refunds/write-offs are separately evidenced and capped. Immutable source facts, independent posting/cancellation, additive FKs and isolated tests are mandatory. IFRS15/IAS19/IAS21 inform treatment, not a claim of Iranian statutory compliance; source-specific operational rules are explicitly documented as inference in docs/tasks/FINANCIAL-WORKFLOWS-COMPLETION-1025.md. Legal exports remain deferred by owner.

## CONTRACT-SELLER-NAME-1025 — 2026-10-25

Owner authorizes showing the responsible seller in readable contract outputs without global IAM users-directory access. Sales authorizes the saved contract first, then requests only contract.ownerUserId through an IAM-owned internal document identity projection selecting ID/displayName. Current exporter identity must never replace the seller. User status/branch reassignment does not erase the name from a historical readable contract. No new client-selectable identity endpoint, role grant, schema or shared wire change; preview/PDF retain the existing ownerName contract. Missing identities remain null rather than inventing an actor name.

## REMOVE-EXTRA-TRAVEL-DATE-1025 — 2026-10-25

The owner removes redundant trip-start inputs from New Contract. Identity registration must not demand a second date before service selection. Actual flight/hotel/tour dates remain canonical for travel/age/output; service-only contracts use execution dates attached to selected services rather than an identity-sheet date. Missing birth dates, mismatched ages after date selection, invalid service dates, inventory and allocation validation remain. Keep the existing departureDate wire/DB field as a derived summary and legacy draft fallback, with no schema/migration or invented current-date default.
# COMPOSITE-HOTELS-CITIES-1026 — owner-directed multicity composition

2026-10-26: owner replaces the old same-city alternative-hotel reference editor
with one title and ordered repeatable city/hotel selections and native inline
Hotel creation. This explicitly supersedes the same-city member invariant in
Accommodation Master Data. Keep actual Hotel FKs and existing member priorities;
derive each city's identity from its real Hotel. The existing parent city FK is
a backward-compatible first-member anchor, not a restriction on later members.
No automatic dates, prices, bookings, availability or financial writes are inferred.
Owner clarified that every hotel loads into the contract and its dates are entered
independently there. Add optional SalesHotelSelectionInput.additionalStays, one
normalized Sales-owned child table with actual Hotel/City FKs, explicit ordered
dates and historical name snapshots. Keep the primary selection/room allocation
and contract-total pricing protocol intact; no cloned charged services or inferred
dates/prices. Additional stays accompany the immutable reservation snapshot and
contract output, not automatic hotel purchases. Old contracts need no backfill.
Omitted itinerary fields on compatible updates preserve saved stays; an explicit
empty list removes them. Published Tour prices cannot be reused for a changed
composite itinerary. Rollback retains storage and must not allow old application
writes to multi-stay contracts. No production migration or rollout requested.

## 2026-10-26 — COMPLETION-NAME-ONLY-1026

Owner supersedes mandatory passport/birth fields in correction Add passenger: only first and last names are mandatory. Missing birth dates persist as SQL NULL with the existing booked age category; do not invent identity dates. A contract-authorized Customer completion policy permits name-only profiles without weakening ordinary Customer/new-contract validation. Optional supplied facts remain validated and known birth dates cannot contradict booked categories. Nullable Sales read projections preserve output compatibility with empty strings and unknown child bands. Apply the additive migration before API rollout. No production deployment is requested.

## 2026-10-26 — PURCHASE-BROKER-ENGLISH-COMPAT-1026

Owner requires English Purchase broker labels even for remaining Persian-only records. Official registered Latin names remain authoritative; missing/non-Latin English fields use a display-only Latin transcription, never a new official name or Master data update. After the asynchronous preference question and response opportunity, this visible implementation assumption follows the repeated Latin-display request. Source names, IDs, payable parties and snapshots remain unchanged. The existing generic options API and modern picker share one pure naming helper; no API shape or permission change. Production publication is a separate operation from the requested repository merge.

## 2026-10-27 — CONTRACT-PASSENGER-FIELDS-1027

Owner supersedes the prior mandatory passport-number/expiry rule at new-contract entry: those two documents are optional for hotel-only, flight-only and combined contracts. International hotel guest identity fields now match international flight identity fields. Supplied document values still validate; no generated identity or relaxation of operational Manifest completeness. Gender and national-ID columns exchange positions; domestic gender stays optional and persists when supplied. Correction Add passenger requires only first/last name; skip national-ID matching when absent rather than sending an empty ID to a ten-digit lookup. Existing supplied-ID matching/review and Customer identity checks remain intact. No database/API contract change; user authorizes develop merge and backed-up Avina rollout.

## 2026-10-27 — CONTRACT-OPTIONAL-BIRTH-1027

Owner explicitly makes birth date optional during new-contract entry and authorizes develop merge/Avina rollout. Extend the existing scoped Customer Sales-entry policy without weakening ordinary Customer creation. Reuse nullable Customer and Sales passenger columns; persist SQL NULL and an explicit booked ADT/CHD/INF category, never an inferred birthday. The additive optional request ageCategory is consumed only when DOB is absent; a supplied DOB remains authoritative and validated. Sales Web derives booked categories from step-one composition, including room-driven/flight-only slots. Hotel room/visa composition matching allocates unknown identities to already-booked slots without changing identity data; count and known-DOB contradictions still reject. Existing consumer projections already expose empty DOB with stored category. No schema/dependency migration is needed.

## 2026-10-29 — Call Center production reads follow trusted answers

The owner explicitly requests completing CALL-ANSWER-ACCESS-1024 and testing experts, unit managers, executive/demo. In the strict deployment policy, manual owner assignment and popup claim are no longer read-entitlement evidence; they retain their own CAS/audit and execution semantics. Only trusted provider ANSWERED receipts establish additive per-account contact responsibility. HR/IAM identity and exact unit IDs remain authoritative; ambiguous history is unresolved. Approved executive/demo account UUIDs receive Call-Center-only global request scope, never general IAM/admin grants. Existing localhost legacy behavior remains available only via server configuration; browser headers cannot opt out. Migration is additive and operational activation/account mapping remains a separately verified rollout. Scope and tests: tasks/CALL-CENTER-ANSWERED-ACCESS-1029.md.
