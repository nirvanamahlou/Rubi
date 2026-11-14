# NSS website commerce v1

Owner request: connect `niyayeshseir.ir` to ERP, then merge to develop and activate
the required server configuration. Only explicitly selected ERP products use this
flow. Existing NSS products/orders and agency wallet sales retain their old flow.

## Business rules

- A Ticket Catalog manager selects **Publish on Niyayesh website** on a saved
  flight or tour departure. Every flag starts off; there is no historical import.
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
