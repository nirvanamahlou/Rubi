# REPORTING-LIVE-SOURCES-1027

COMPUTER_ID=PC-C; branch codex/pc-c-reporting-live-sources-1027, base020dcc5b3.
Owner requests complete production Reports source investigation and correct exports.

## Scope and coordination

Reserve new Reporting source orchestration, native result assembly/tests and
`scripts/reporting/inspect-production.py`, with own assignment/status notes.
Domain-owned read-only reporting producers are separate new leaf files; preserve
native ownership, branch/own permissions and currency/grain. No schema, migration,
seed or dependency changes. Dashboard task concurrently owns dashboard source
files, ReportingService dashboardProjection, its constructor/module integration
and Dashboard contracts. Do not edit those reserved sections until coordinated.
Report preview/export integration must preserve all Dashboard work.

## Confirmed defects

The current Reports query/export consumes only reporting_travel_facts. No
operational writer populates that demo-oriented table. Twelve different report
codes group the same rows without implementing report-specific eligibility.
Generic reporting.read currently removes branch filtering; it must not replace
the source domain's native own/branch/all authorization.

## Production evidence and gate (updated after root-console receipts)

SSH rubi-deploy works with the existing 20261027 key. Limited sudo permits only
fixed audit/backup/restore/approved-deploy commands. Audit confirms production
revision2b43d28d and196 completed migrations. Docker/database/schema inspection
is unavailable to this account; never bypass the sudo boundary or expose secrets.
The owner executed both prepared read-only scripts from the approved root console.
The schema/count receipt and reconciliation receipt have been retrieved privately.
The reconciliation executes candidate code in a separate Node process in the API
container, with a read-only repeatable-read transaction; it does not deploy code,
write operational records, create an authenticated session or alter running services.
Do not confuse this source/Excel verification with authenticated UI acceptance.

## Source map for implementation (schema references, not live-presence claims)

| Reports | Required authoritative producer / grain |
| --- | --- |
| sales_by_organization, sales_contract_pipeline | Sales contracts + price components; one confirmed contract/currency, current pipeline separately includes drafts |
| sales_by_service_route | Distinct combination of actual Sales services and route, one contract/currency; not per-service revenue allocation |
| purchase_by_supplier, supplier_payment_queue | Procurement request/invoice versions and Finance-approved payable/payment, per supplier/currency |
| contract_service_profit, agency_performance | Approved Sales revenue and actual purchase allocations with Finance reconciliation; never unapproved quote as cost |
| payments_refunds, customer_payment_aging | Finance-confirmed Sales payments, allocations/refunds and actual due dates; refunds require completed lifecycle |
| paid_not_issued, reservation_delivery_readiness | Confirmed receipt evidence plus current Reservations fulfillment/document release; payment alone does not prove issue |
| reservation_errors, cancellations_refunds, reservation_cycle_time | Reservation intake/workflow revisions, actual transitions, cancellation/refund facts; missing timestamps stay unavailable |
| tickets_manifest, route_passengers, ticket_capacity | Ticket inventory + issued documents/manifest and Sales passenger/service allocation; count persons without multiplying money |
| lead_to_order_conversion, lead_pipeline | Customer Affairs lead/handoff with explicit Sales linkage; customer-name matching is not attribution |
| customer_satisfaction, customer_service_sla | Customer Affairs satisfaction/tickets/SLA excluding reserved Call Center private/no-SLA category |
| customer_portfolio_growth, customer_consent_coverage | Customers and actual consent validity, scoped/masked and excluding deleted records |
| receivables_payables, account_balances, due_checks, cash_position | Finance ledger/treasury/verified checks, approved purchase liabilities; posted books only and currency kept separate |
| marketing_performance | Marketing campaign/spend and explicit conversion attribution; no fabricated ROI from lead counts |
| hr_performance, hr_record_expiry | HR employee/record aggregates with sensitive-read rules and actual expiry dates |
| document_compliance | Documents metadata/versions/processing with domain visibility; no unrestricted file listing |
| workbench_due_actions | Tasks-owned pending work with user/branch visibility; no implicit team-wide access |
| hotel_rate_comparison | Reservations published rate versions, dates, room/occupancy/board and currency; incompatible rates are not compared |
| future_travel_commitments | Sales future departure cohort with Finance confirmed collection/obligation snapshot |
| manifest_finance_exclusions | Reservations manifest versions and Finance release decisions with explicit exclusion reason |
| export_audit | ReportingRun and ReportingExportArtifact; administrative audit permission and creator/scope restrictions |

At baseline the frontend catalogue defines35 reports. Backend catalogue exposes20 entries
(12 READY and8 PENDING);17 unreleased codes are recognized only by metadata
fallback, including2 HR/optional catalogue entries. Therefore UI existence does
not prove a runnable domain producer. Each report needs an explicit capabilities
and source contract, not a generic READY badge.

## Implemented native source integration

Five report codes use Sales-owned public producers rather than the empty staging
table: sales_by_organization, sales_by_service_route, route_passengers,
sales_contract_pipeline, payments_refunds. The first four preserve contract/currency
grain. Non-pipeline sales require confirmation and an active confirmed status;
pipeline includes cancellation status separately. Service combinations group a
contract only once; a package total is never assigned to every service separately.
Payment events require Finance-confirmed receipts or recorded completed refunds;
outgoing supplier payments are not implied by this narrower report.

Preview and export dispatch through the same native repository path. Producers
enforce Sales own/branch/all permissions independently of generic reporting.read,
intersect requested filters with the source scope and reject unsupported filters.
Money uses the existing Sales Decimal balance calculator and currencies never mix.
Source IDs prevent equal display names merging separate branch/agent/city groups.
Unknown purchase, profit, issue and settlement metrics are omitted from UI/export
columns, not presented as real zero financial values. Legacy result totals retain
compatibility fields; those fields are not authoritative for omitted measures.
Native filters, dimension labels, source/grain metadata and chart sort choices are
updated without redesigning navigation. New cross-module reads are exposed only
through domain-owned public leaf producers; Reporting does not query domain tables.

## Bounded legacy correction

Report eligibility is now applied before aggregation, totals, freshness,
pagination and export. Paid-but-unissued excludes issued/unpaid/cancelled/unknown
issuance facts. Error, cancellation/refund, issued-ticket, supplier-purchase,
agency and lead-attributed report populations are restricted to their actual
evidence. Eight projection tests cover preview/export eligibility and totals.
This correction is not a claim that remaining legacy reports now have native data.

## Received verification and remaining gates

Uploaded inspector: `/home/rubi-deploy/reports-inspect-production-1027.py`.
Initial audit executed successfully from the approved root console:

```sh
python3 /home/rubi-deploy/reports-inspect-production-1027.py
```

Its private receipt contains public-schema columns, PK/FK/check definitions
and exact bounded counts of selected snake-case source tables, no business rows or secrets.
CamelCase table columns were inspected, but their row counts were not covered by
the initial count-prefix selection; do not claim these tables are empty.
The SQL runs inside BEGIN READ ONLY with per-statement timeout and ROLLBACK.
The limited SSH user cannot execute it as root under its current sudo policy.
Do not alter sudoers or use the deployment command to bypass that boundary.

Reconciliation receipt timestamp 2026-10-27T13:18:28.502Z: 121 sent-to-reservations
and 11 cancelled contracts, none unpriced. Organization and route report sums
match independent SQL exactly for each of three currencies. Their grouped outputs
have 10 and 8 rows; pipeline has 4 rows; confirmed-payment/refund source has no rows.
Four actual server-built XLSX files were downloaded privately, parsed with
independent openpyxl and Artifact Tool, rendered, and scanned for formula errors.
Title style references resolve to 16pt, gridlines are hidden, all XML/rels parse,
all cell style indices are valid, and no formula-error values were found.
This does not prove Microsoft Excel native-engine behavior or authenticated export
download. Private XLSX/JSON receipts and all real data remain ignored outside Git.

Service-combination grouping and its corrected label were added after that receipt;
they have unit coverage but require a new production read-only reconciliation.
Build candidate with esbuild using scripts/reporting/reconcile-production.ts,
upload the generated ignored bundle and scripts/reporting/verify-production.py,
then execute only from the approved root console. Verifier instructions are for
this bounded audit, not a background/deploy mechanism.

Remaining: integrate with latest approved Dashboard changes without overwriting
them; required hosted gates/review and separately authorized rollout; authenticated
own/branch/all preview/save/download verification; remaining catalogue producer
work in the source matrix above. No end-to-end completion or rollout is claimed.

## Local checks

All Reporting API tests: 63 passed across 12 suites. All Reports Web tests: 63
passed across 7 suites, including native-column/grain normalization. Scoped API
and Web ESLint passed. API full typecheck and emitted build passed with locally
generated matching Prisma/Contracts declarations; Web full typecheck also passed
using matching local Contracts declarations (temporary ignored config only).
No shared dependency cache was rebuilt or changed.

Default Web production build stops on Turbopack's refusal of the reused external
node_modules junction. Webpack compiles successfully but its default typecheck
resolves the reused stale Contracts package, producing unrelated missing domain
contract exports. Do not bypass TypeScript checks or modify shared caches to hide
this: a clean pnpm install/build in hosted CI on the final integrated head remains
required before rollout. No full production-build success is claimed.
