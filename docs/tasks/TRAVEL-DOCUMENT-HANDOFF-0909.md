# TRAVEL-DOCUMENT-HANDOFF-0909

PC-A; branch `codex/pc-a-travel-document-handoff`, stacked on `codex/pc-a-reservation-page-cleanup`.

## Behavior

- Reservations actions persist append-only workflow revisions with actor/time and optimistic version checking. Supplier request, confirmation/reference, cancellation/reason, insurance reference, operational passenger order/age and voucher issuance are real API commands. A voucher requires broker confirmation; absent insurance requires explicit acknowledgement. Cancellation and issued vouchers close the operational workflow, including the older arrangement endpoint.
- Saved contract ticket output is available in Reservations. Both former Sales draft preview entry points are removed. Sales must pass its existing contract ownership/branch checks and Finance delivery authorization before fetching passenger documents; cancellation remains blocked. Finance approval/revocation is a separate manual document gate, not a settlement/credit/ledger calculation.
- Finance UI lists branch-scoped requests and records approval/revocation with reason and expected revision. Voucher/cancellation and Finance delivery changes notify the Sales contract owner in the same transaction. New-request arrival notifications remain the existing live Reservations page notification.
- Output letterhead uses active company context or an active registered agency with its stored logo reference. No arbitrary logo URL or fabricated agency. Missing logo blocks document print readiness. Reservation form and issued voucher support browser print/save-as-PDF; existing ticket sheet is reused. These are immutable operational snapshots, not a new archived PDF-file subsystem or a live airline issuance integration. Actual airline PNR/e-ticket identifiers are not fabricated; the existing ticket output retains its non-airline-issued notice.
- Over-60-at-trip-start warning and per-passenger integer toman insurance extra. Conversion to IRR uses bigint/Decimal-safe strings, a single explicitly assigned extra service, matching passenger total and contract components. Server validates age, membership, currency, price and unique passenger surcharge. UI distinguishes base passenger input from final total including the extra. No automatic rate is assumed.

## Validation

- Shared contracts suite: 64 passed. Reservations/Sales HTTP targeted suite: 23 passed (includes 401, ownership, Finance blocked/revoked, cancelled and approved/no-store scenarios).
- Initial full API run: 113 suites / 1003 tests passed; one existing XLSX HTTP fixture needed the newly injected providers. Fixture fixed and its three tests passed on targeted rerun. Eleven integration suites remained environment-skipped; no claim they ran.
- Web affected Reservations and Sales tests passed; surcharge payload test verifies repeated serialization does not duplicate charges. Three additional output tests verify company-code logo selection, unissued voucher denial and no agency-to-own-logo fallback.
- Scoped API/Web/contracts/database lint, API/Web type checks and API/Web production builds passed; Web has 40 routes.
- Real PostgreSQL rehearsal on a restored local copy verifies branch isolation, simultaneous workflow commands, simultaneous Finance decisions, explicit uninsured issuance, immutable completion, persisted revocation and transactional notifications. Original data was not used for test mutations.

## Migration and local rollout

Additive migration `20260909140000_travel_document_handoff`: workflow/delivery revision tables with actor/intake FKs and positive unique versions; optional Sales-owner FK on Reservations intake populated from existing Sales ownership; permission catalog entries only. No automatic role grants.

Two restored local copies exercised raw transactional migration and Prisma deploy. A fresh local backup was made before applying only this task's migration to the original loopback PostgreSQL `rubi` database. Local ledger is now 44 applied migrations; unrelated pending HR migrations were deliberately excluded from the task-local deployment manifest. The canonical repository migration chain remains intact for normal full deployments. Counts after rollout: 350 customers, 5 contracts, 5 reservation intakes, zero operational/financial decisions on real contracts. Ignored backups/rehearsal scripts/configs under `tmp/travel-handoff`, `apps/api/tmp`, `packages/database/tmp`; no backup, credential or passenger data committed.

API4000 and Web3100 use the original database/context keys and bind to loopback. No production deployment or merge performed. Role grants are pending the user's answer to the separate access question: `finance_staff` gets Finance read/approve; existing local full-access role gets Finance read/approve plus `reservations.documents.manage`. Sales roles must not acquire Finance approval. IAM administrators can assign these catalog permissions through the existing role editor. Browser login/session is required; no authenticated manual decision was made on a real contract.
