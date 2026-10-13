# B2B-SALES-CONTRACT-CONNECTION-1003

## Frozen contract v1.1

COMPUTER_ID=PC-B. Branch codex/pc-b-b2b-sales-contract-link-1003, base 83c099e2.
Risk R3: cross-agency/branch document and financial-data disclosure. Complexity C3.
Native persistent implementer phone_verification_impl; preimplementation advisor agency_sales_connection_advice. Usage unavailable; coordinator launcher is absent.

### Decisions and invariants

- User requests operational Sales contracts made with an agency to update its dossier cards and all three artifact classes: contract PDF, passenger travel documents, payment receipts. Framework B2B agreements remain separate; prior removed Sales Operations/CRM cards stay removed.
- Identity uses exact current MasterOrganization.id -> Customer.organizationId -> Sales.customerId. No payer/referrer/name heuristic, new agency identity, history backfill or financial ownership duplication. Creation-time immutable affiliation is outside this reconnect scope.
- Sales accepts an organizational buyer Customer from any actor-authorized Customer branch while the contract has its own branch. Resolve candidate Customer IDs through the existing public authorized all-branch Customer list; include Sales contracts only from the explicitly selected authorized dossier branch. Displayed Customer KPI remains selected-branch scoped. Never read private producer tables or add grants.
- Existing public services and owner HTTP actions suffice; no Sales, Finance, Reservations producer, schema, migration, dependency or operational-data changes are authorized. One additive B2B-owned read-only payment-document metadata DTO/route in packages/contracts/src/b2b/index.ts is reserved with producer B2B and consumer Organizations; old CRM responses remain compatible.
- Bind response and displayed state to current organization, branch and authorized context; clear previous rows/totals while a new context loads; abort/ignore stale responses. Refresh on opening/reopening and window focus. No background job/polling required.
- Separate registered Sales count (all statuses) from framework counts. An unavailable/incomplete source is not zero. Deduplicate stable IDs; incomplete/inconsistent bounded paging is unavailable. Currency amounts remain exact strings and separated by currency; Sales outstanding is not Finance exposure.
- Render document actions only from canonical contract/payment IDs returned by the scoped backend aggregate. Do not copy, reclassify or store owner documents under ORGANIZATION. Do not leak passenger data in the CRM projection.
- Contract PDF reuses existing Sales output client/renderer and endpoint, retaining sales.export, legal-entity.read, Sales scope and lifecycle gates.
- Travel documents requery the existing Sales travel-documents HTTP endpoint on open, retaining current Finance customer-contract delivery approval, cancellation and Sales/Reservations branch checks. Never call TravelWorkflowService directly or adopt supplier-payment/manifest exemptions.
- Receipt metadata is loaded through a new B2B-owned no-store endpoint crm-connections/contracts/:contractId/payment-documents. It freshly rechecks B2B permission, organization role, selected authorized branch, canonical organizational Customer IDs and Sales.detail with the original actor before any Documents call. Reject unrelated contract/organization/branch and never trust caller payment/document association. Group minimal metadata by authorized contract/payment; no bytes, storage URLs or new grants. Require documents.list and documents.finance.read explicitly in the service (Documents.list HTTP-controller guard must not be skipped). Bounded metadata paging deduplicates stable IDs and rejects incomplete/inconsistent scans. Receipt metadata uses Documents list for the exact sales/SalesContractPaymentEntry/paymentId reference, branch and FINANCE domain, with documents.list and documents.finance.read. Existing owner download/preview retains file permissions, restricted metadata masking, sensitive reason, active/scan/confidentiality/step-up gates. No receipt upload or approval feature is added.

### Required verification

- Exact IDs exclude same-name, payer/referrer and foreign organizations; multiple linked Customers do not duplicate contracts.
- Actor-authorized cross-branch organizational Customer correctly links a selected-branch Sales contract; unauthorized Customer or contract branch does not.
- Previous organization/branch responses and revoked contexts cannot render under the new identity; malformed/incomplete scans and denied/outage sources show unavailable, successful empty shows zero.
- Fresh opening/focus reload reflects newly persisted contracts and payment references; framework and Sales counts/labels remain distinct.
- Each artifact class uses its owner endpoint; missing grants, revoked Finance delivery, cancelled workflow and unclean/restricted files remain denied.
- Forged/unrelated contract/payment/document references cannot be introduced into the displayed canonical cohort.
- Run meaningful focused API/Web regressions, affected existing module tests, lint, typechecks, affected production builds, root Prettier and diff checks. Independent fresh R3 review of the committed final candidate precedes acceptance and owner-authorized push/develop merge.

### Advice resolution

B2B-ADV-01 resolved by explicit canonical organizational buyer/current affiliation and distinct framework semantics. B2B-ADV-02 resolved by user selection of all three classes with original owner gates. B2B-ADV-03 resolved by selected authorized branch, context binding and open/focus refresh. B2B-ADV-04 resolved by Finance customer document delivery policy in FINANCE-CUSTOMER-DOCUMENT-DELIVERY-0920, independently of supplier purchases.

Delivery receipts follow implementation; no source acceptance asserted by this freeze.