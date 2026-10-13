# CUSTOMER-DOCUMENTS-AGENCIES-INTEGRATION-001

## Scope and ownership

- Owner: PC-B
- Base: origin/develop at a56b62e875e61e79b299fd9cc4b6f1a8b3993af5
- Replacement branch for the technical parts of PR #85:
  codex/pc-b-customer-documents-agencies-integration
- This task does not own Prisma Schema/Migrations, Central Docs, Sales contracts,
  Finance, Reservations or Ticket Catalog.
- Migration, Central Docs and Sales shared-contract/root-export locks remain with
  PC-A/SALES-CONTRACTS-001.

## Delivery status

| Area | Status | Result |
| --- | --- | --- |
| Canonical Documents filtering | IMPLEMENTED | sourceModule, sourceEntityType and sourceEntityId are an all-or-none exact relation filter. |
| Customer 360 Documents | IMPLEMENTED | Real list/upload through the versioned Documents API with branch, domain, permissions and scan-state handling. |
| Documents authorization, branch and scan lifecycle | ALREADY_AVAILABLE | The PR #93 guards and CLEAN-only delivery remain authoritative and all regression tests pass. |
| Button/Slot event semantics | IMPLEMENTED | Slot children receive composed handlers without losing the button action. |
| Sensitive Customer reads | IMPLEMENTED | Full values use the audited detail route with the fixed support-request reason; general APIs remain masked. |
| Customer Master Data references | IMPLEMENTED | Active choices come from the public Master Data API; an already referenced inactive value remains visible but cannot become a new choice. |
| Agency list | IMPLEMENTED | /organizations consumes shared MasterOrganization records with role AGENCY; no parallel Agency entity exists. |
| Agency contacts | IMPLEMENTED | Masked phone/email are loaded from public organization-contacts; protected values are not requested. |
| Agency base address | IMPLEMENTED_BY_SUCCESSOR | `AGENCY-B2B-INTEGRATIONS-001` adds the Master Data-owned address relation and public endpoints. |
| Agency operational profile | IMPLEMENTED_BY_SUCCESSOR | `AGENCY-B2B-INTEGRATIONS-001` adds the branch-scoped B2B profile and popup integration. |
| Agency contracts, credit and agreed rates | IMPLEMENTED_BY_SUCCESSOR | `AGENCY-B2B-INTEGRATIONS-001` owns these B2B records and consumes Finance exposure through a public port without direct table access. |
| Master Data logo flow | IMPLEMENTED | Persisted entity first, canonical Documents upload second, optimistic attach third; temporary IDs are rejected and retry reuses the canonical file. |
| Logo MIME, size, permission, audit and CLEAN-only delivery | ALREADY_AVAILABLE | The public Documents producer remains the single policy owner; Master Data stores only its stable file reference. |

## Public contracts

### Documents producer to Customers and Master Data consumers

DocumentListQueryV1 adds an optional canonical source triplet. The producer
validates that the three fields are supplied together and filters the primary
relation exactly. This is additive and backward-compatible.

Customer documents use:

- domain=CUSTOMER_IDENTITY
- sourceModule=customers
- sourceEntityType=Customer
- the persisted Customer UUID as sourceEntityId
- the current user branch selected from Documents options

Master Data logos use:

- domain=BRAND
- sourceModule=master-data
- the Master Data resource name as sourceEntityType
- the persisted Master Data ID as sourceEntityId
- an opaque deterministic idempotency token (derived locally without exposing
  the raw digest) to reuse an earlier successful upload after an attach failure

The binary, storage key, private URL and unmasked hash are never stored in Master
Data.

### Master Data producer to Organizations and Customers consumers

MasterDataListQuery adds the allowlisted organizationRole filter. The Agency
consumer requests AGENCY; Customers continue to use stable IDs and the public
list/detail API for Organization, Acquaintance Method, Country and City.

Inactive reference policy:

1. create lists only active records;
2. edit/detail fetches a missing current ID by public detail API;
3. the existing inactive item is labelled and retained;
4. only active alternatives can replace it.

## Successor implementation

The proposals below were implemented additively by
`AGENCY-B2B-INTEGRATIONS-001` after the product owner released the former PR #90
blocker. This historical task still contains no schema change of its own.

## Implemented migration design

### Organization base address

Proposed owner: Master Data.

MasterOrganizationAddress:

- id UUID primary key
- organizationId UUID FK to MasterOrganization
- countryId UUID FK to MasterCountry
- cityId UUID FK to MasterCity
- label, postalCode, addressLine
- isPrimary, isActive, version, audit timestamps/actors

Proposed public API:

- GET /api/v1/master-data/organizations/:id/addresses
- POST /api/v1/master-data/organizations/:id/addresses
- PATCH /api/v1/master-data/organizations/:id/addresses/:addressId

Writes require Master Data permissions and optimistic version. Consumers receive
only the contract DTO, never the repository or Prisma delegate.

### Agency operational profile

Proposed owner: future B2B/Agencies module.

AgencyOperationalProfile:

- id UUID primary key
- organizationId UUID unique FK to MasterOrganization
- branchId UUID FK to Branch for operational scope
- contractReferenceId through the future Sales public contract
- creditPolicyReferenceId through the future Finance/B2B public contract
- status, version, audit timestamps/actors

Agreed rates belong to a separate versioned B2B contract keyed by
organizationId; no Sales or Finance tables may be queried directly.

## Security and failure behavior

- All browser calls include the authenticated session cookie.
- Documents and Master Data guards remain deny-by-default.
- Branch filtering is enforced by Documents. Shared Organization identity is
  global; the proposed operational Agency profile is branch-scoped.
- Documents owns MIME, extension, size, antivirus/scan and CLEAN-only delivery.
- Sensitive Customer values still use the audited sensitive-read endpoint and
  are masked by default.
- Logo upload failure leaves the real Master Data record intact and reports
  saved without logo; the next edit retries safely.
- Concurrent logo attachment returns a visible refresh/retry warning for HTTP
  409.
- Logo replacement detaches through optimistic Master Data update and archives
  the superseded file through the public Documents API with an audit reason.

## Explicit non-goals

- No Prisma change, migration or seed.
- No direct cross-module repository/table query.
- No Sales contract/root export change.
- No fabricated address, contract, credit, agreed-rate or document value.
- No real customer, passenger or document data in code or tests.

## Validation

- Prisma format, validate and generate: passed; schema blob unchanged.
- Monorepo lint and typecheck: passed.
- Monorepo and Agency adapter tests: 1,500 passed; 70 optional PostgreSQL tests skipped by the
  existing test gate.
- Production build: passed with 34 application routes.
- Scope, secret/PII and direct cross-module query scans: passed.
