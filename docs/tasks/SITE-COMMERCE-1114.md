# NSS website commerce v1

Owner request: connect `niyayeshseir.ir` to ERP, then merge to develop and activate
the required server configuration. Only explicitly selected ERP products use this
flow. Existing NSS products/orders and agency wallet sales retain their old flow.

## Business rules

- A Ticket Catalog manager selects **Publish on Niyayesh website** on a saved
  flight or tour departure. Every flag starts off; there is no historical import.
- New ticket definitions require an explicit branch choice when the user has
  multiple authorized branches. The current session revalidates that choice on
  save; changing it starts a separate create identity. Enabling a website flag
  requires the source branch to equal the configured connection branch. A listing
  in that branch can still be disabled after sale eligibility changes, without
  widening site-account access. Preserve the current multi-site delivery rules.
- Website customers browse `/erp-travel`. Flights, actual airports, schedules,
  included services and published room prices originate in ERP. Native flight
  quote logic handles direct fares, pair prices, tier crossings and held seats.
- The website server maps customers/passengers through Customers' public API.
  Buyer identity is separate from passenger identity, with durable native Sales
  registration keys. No phone/name-based merging or identity overwrites occur.
- A draft is created before payment. It does not promise a seat hold. After a site
  operator verifies the receipt, native Sales payment submission and confirmation
  record the sale under the dedicated **Site Niyayesh** account and dispatch the
  normal Reservations outbox. Receipt submission does not confirm Finance's ledger.
- Documents remain subject to the existing Finance delivery approval. NSS proxies
  the original ERP contract/ticket PDF renderer, not a new independent issuer.
- The v1 customer UI supports multiple rooms at the same hotel/period. Composite
  multi-stay packages requiring the existing native manual review are not silently
  converted to single-stay sales. Agency/wallet and installment integration are
  explicitly deferred by the owner.

## Request/response protocol

Prefix `/api/v1/sales/site-commerce/v1/nss`:

- `GET/POST publications/{ticket|tour}/{ERP UUID}`: staff flag with CAS version;
  native Ticket Catalog management permission, JSON write marker and IAM audit.
- `GET catalog`: only opted-in resources in the service account's bound branch;
  unpublishing or unavailable sources produce explicit disabled entries. No
  purchase costs, profit or internal fare commissions are public projections.
- `POST flight-quote`: publication IDs and birth dates, never caller prices.
- `POST people`, `POST buyers/{external customer ID}`: native Customers mapping.
- `POST orders/{external ID}`: native Sales draft. Stable identity plus changed
  content is a conflict, not an update or second sale. A lost create response can
  recover the native durable Sales receipt without requiring current prices.
- `POST orders/{external ID}/paid`: exact verified amounts/references; receipt
  identity and native command versions are frozen before side effects. A timeout
  resumes the same commands. Native price/capacity checks remain authoritative.
- `GET orders/{external ID}`, `/contract`, `/travel-documents`, `/payment-accounts`:
  site/branch-owned projections. Unrelated contracts cannot be selected by UUID.

All site requests use a dedicated IAM cookie session held only by the website
backend. Refresh/login, revocation and permission revalidation use existing IAM.
Writes require `x-nora-site-commerce: 1` and JSON. TLS, no redirects, bounded
timeouts and private/no-store responses apply. No secret is sent to browsers.

## Activation / recovery

ERP `SITE_COMMERCE_BINDINGS` maps `nss` to `{userId,branchId}`. Keep the dedicated
seller identity stable when rotating its password. Its issuer context is Niyayesh
Seir Sahar, never aggregate. Grant only Sales creation/own-read, confirmation,
reservation dispatch, payment submission, required Customers reads and public
Ticket Catalog selection, not IAM administration or Finance approval.

NSS server settings: `ERP_COMMERCE_ENABLED`, `ERP_API_URL`, `ERP_USERNAME`,
`ERP_PASSWORD`, `ERP_SITE_CODE`. All real values stay in protected server files.
The menu build flag is derived from the non-secret enabled flag. Start disabled,
apply additive migrations with checked backups, deploy ERP then NSS, configure the
dedicated account, and verify authenticated empty catalog before any staff opt-in.

The website persists ERP order links and exact retry payloads. Verified payment
survives a timeout; the 60-second worker resumes pending commands. Business
conflicts stop in `needs_review`; do not erase a payment or create another charge.
Refund/cancellation/instalment/agency changes are blocked on this new path until
their own ERP protocol is implemented. Historical operations remain unchanged.

Server activation uses `scripts/site-commerce/activate.py` with the exact tested
revision and `SITE_COMMERCE_CI_APPROVED_REVISION`. The existing database-owner
connection is passed in memory only to the one-off migration container. The live
API and worker continue using `rubi_app`, whose default table/sequence privileges
apply to the additive connector tables. Never grant migration privileges to the
runtime role or place the maintenance connection in the live service env files.

Rollback application images/config, not the additive tables or financial links.
Disable the website flag to stop new sales; preserve credentials temporarily for
reconciling pending operations. No destructive downgrade is automatic.

## Validation record

Local ERP: full API suite 4,752 passing / 648 skipped; focused native contract,
published-package and connector tests; API/Web types, scoped lint and builds.
Local NSS: full backend regression suite and new isolated HTTP/SQLite tests for
stable identity, ownership, payment outage recovery, and native PDF proxy;
frontend types/build and existing frontend tests. Hosted final-head CI and actual
server activation results must be recorded separately; a local pass is not a live
transaction or Finance/airline issuance claim.

Live E2E follow-up on 2026-11-14 created only the synthetic one-way offer
`TEST-NO-PAY-1114` (2036-01-15, THR to KIH, four seats), ID
`23659b0f-134f-4473-b270-dc85cffe7692`. The UI selected HQ implicitly despite the
active issuer being Niyayesh. Read-only checks found no sale price, website flag,
or capacity allocation for this offer. Do not duplicate or publish this HQ offer
as a Niyayesh source. The browser connection failed after that submission.

Acceptance resumed on 2026-11-18 through the owner's real logged-in ERP session.
Created Niyayesh test tour `ad5cd887-352d-4294-b7b3-388a2d12c779`, named
`TEST-NO-PAY-1118 | تور آزمایشی اتصال ERP کیش`, with THR/KIH references. Created
hotel-rate batch `a85369d5-d435-4673-a2f4-dd8398786b31` for 2036-01-15 to
2036-01-18 and room type `TEST-NO-PAY-1118 STANDARD`; base purchase per night is
1,000,000 IRR, double factor 2 and single factor 1.5. No real funds or supplier
request is involved. The inline tour-flight form rejects creation because its
airport inputs are disabled; no test flight was saved by that attempt. Continue
using the corrected ordinary ticket-definition form. Website publication,
simulated paid orders, native contract confirmation and PDF acceptance remain
pending; do not describe this partial state as a completed end-to-end test.

Current-develop integration retains its newer multi-site publication, banking,
capacity-hold and document guards. The superseded API branch patch is replaced by
the native current publication binding checks; both branch rejection and safe
disable regression tests remain. Local validation: 37 API publication/connector
tests, 10 Web branch/workspace tests, 3 i18n checks, scoped lint and Web TypeScript.
The scoped runtime was rebased onto the then-active 9ea8a329 source and layered
over the newer live hotel-publication Web image, preserving peer changes.
Runtime f3fb5b83724eda340f567a3ccb17581eadb4c168 passed all four hosted gates
(run 44315699388) and was activated for Web only, with image/compose CAS, the shared
deployment lock, rollback and successful public health checks. This activation
did not replace API/worker or change the database or financial permissions.

### Production acceptance on 2026-11-18: published products and unpaid checkout

The active NSS binding and sale destination belong to Headquarters. The owner
explicitly approved creating the synthetic fixtures in Headquarters after the
branch mismatch was identified; the existing binding/products were retained.

- Outbound `TEST-NO-PAY-1118-HO`: `52d3250b-4109-436b-af15-d699ff3e6205`.
- Return `TEST-NO-PAY-1118-HR`: `4713b23a-2e04-465d-8c43-471f103a8c54`.
- HQ tour definition `9f3d076f-76de-4919-8fce-7a4cb714a14d`, departure
  `170b6f57-3a31-4c06-a672-4d91762690cf`, hotel batch
  `89913033-f6ef-4e30-bc98-c74ee409285a` and price publication
  `549ef863-14f2-4b83-a967-f0b453b3c8a9`.
- Only the new outbound and HQ tour were selected for NSS. Their website
  publication IDs are `8182489c-fd78-4e5c-8b91-10cfe16366d0` and
  `9218f421-c84e-4030-9d19-96fb09f0a96d`. The earlier Niyayesh-branch fixtures
  remain unpublished to the website.
- Both legs use THR/KIH references, 10:20–12:05 Tehran time, economy, 20 kg and
  four seats. The three-night hotel purchase is 6,000,000 IRR for two adults;
  hotel sale 8,000,000 IRR plus flight sale 2 × 4,690,000 IRR gives the published
  package total 17,380,000 IRR.
- The explicitly approved ordinary B2C fixture is customer 13, without SMS,
  agency/admin access or wallet credit. Its random login remains only on the
  website server. No credentials belong in Git.
- Native public HTTPS checkout created site orders 68 / `NSS-ERP-0000000025`
  (ticket: 2,345,000 IRR / 234,500 toman) and 69 / `NSS-ERP-0000000026`
  (two-adult tour: 17,380,000 IRR / 1,738,000 toman). Replaying each exact
  idempotency key returned the same order. Passenger identities/dates, both
  routes and service selections matched. PDF requests before payment returned
  409, and status is `AWAITING_PAYMENT`, with no ERP contract number.

The live site has a newer deferred checkout/ERP financial-authority implementation
than the earlier main-branch snapshot. It rejects manual admin confirmation of
connected orders with 409; verified bank proof and native settlement gate issuance.
No active sandbox payment path was found. The owner explicitly selected a private
payment simulator for final payment/issuance acceptance. Production orders remain
unpaid; no production bank proof, receipt confirmation or contract was fabricated.

The public catalogue supplied `economyBaggageKg: "20"`, while the website
order-status adapter reads `baggageAllowanceKg`. The additive selected-cabin alias
now preserves both source fields, explicit zero and unknown values. Five public
catalogue regressions cover economy/business selection and missing allowances.
All 42 focused catalogue/publication tests pass, alongside scoped lint, API
TypeScript and build. No payment or document guard was relaxed.

### Private final acceptance on 2026-11-18

The isolated `rubi-e2e-1118` internal Docker network on the ERP host has no external
egress. Both databases were created from schema-only dumps, then initialized with
the official ERP seed and only the synthetic product/pricing fixtures above.
Fresh passwords, IAM keys, webhook and gateway secrets stay in a protected server
directory; no real customer rows, credentials, receipts or operational data were
copied. The schema-only database needed the empty-database contract-counter floor
from migration 20261029100000; the production counter was never read or changed.

The exact current website backend image and native ERP API/Web run privately.
Only bank transport is simulated; normal IAM/customer authentication, quotes,
capacity holds, verified receipt signatures, native customer/contract commands,
Finance settlement, reservation intake and original ERP PDF routes remain active.
The private API includes the selected-cabin alias. The simulator permits only the
fake terminal and the two expected amounts, and never follows a PSP URL or public
callback redirect. An initial harness-only nationality typo (`IR` instead of the
real form's `IRN`) was retained as a failed private fixture; fresh valid orders
were tested without rewriting its receipt. No website product-code change was
needed for that test-input error.

- Private order `NSS-ERP-0000000003`: native contract `120123`, ticket
  2,345,000 IRR / 234,500 toman, one passenger, THR to KIH, economy and 20 kg.
- Private order `NSS-ERP-0000000004`: native contract `120124`, tour
  17,380,000 IRR / 1,738,000 toman, two adults, THR/KIH return flights,
  2036-01-15 to 2036-01-18, TORANJ, one double room and 20 kg on both legs.
- Both contracts are owned by the dedicated seller `سایت نیایش`, issued by
  `NIYAYESH_SEIR_SAHAR`, in the private seeded Headquarters branch. Each has one
  `FINANCE_CONFIRMED` synthetic gateway payment, exact expected amount, zero
  outstanding balance, accepted reservation intake and automatic full-settlement
  document delivery. The native site result is `paid`, `fullySettled: true`,
  `hasConfirmedPayment: true`, `siteSyncStatus: confirmed` and `erp_recorded: true`.
- Exact create-key replay returned the same order. Replaying verified callbacks
  before/after settlement retained the same contract and payment IDs, without an
  extra receipt. Another ordinary customer's status request returned 404 and an
  anonymous PDF request returned 401. Before payment, PDF requests returned 409.
- The website's original ERP proxy returned 200/application-pdf for all four
  contract/ticket downloads. All five PDF pages were rendered and visually
  inspected: both totals, seller/issuer, passenger names, THR/KIH schedules,
  double-room stay and 20 kg baggage are correct and readable. Tour ticket PDF has
  one page per passenger and both flight legs. These are the ERP's native ticket
  documents; no airline/provider booking or real funds movement was attempted.

Protected server evidence: `verified-acceptance.json`, the two `acceptance-*.json`
files and `TEST-NO-PAY-1118-*-*.pdf` under the private task directory. Secrets and
generated operational evidence are excluded from Git. Production acceptance is
limited to publication/unpaid checkout; full settlement/PDF acceptance is private.
