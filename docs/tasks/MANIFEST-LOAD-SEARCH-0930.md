# MANIFEST-LOAD-SEARCH-0930 — PC-A

The owner requests a date/selectable-route search before results, load tables comparable to Ticket Management, separate outbound/return XLSX actions, selected-template labels, new-only/all options and removal of Finance approval from manifest inclusion.

Reservations groups every latest intake already received from Sales by ticket and direction. Search applies the chosen route (including its reverse return leg) only when Search is pressed. Exports use the searched date range, even if draft filters change afterward. Tables display total capacity, allocated seats, active temporary holds and remaining seats through Ticket Catalog's public branch-scoped projection. Ground/legacy records without inventory display a dash, not an invented capacity.

Finance delivery approval is no longer consulted for ticket, range or per-contract manifests. Passenger read/sensitive permissions, branch scope, assignments, latest snapshots and template validation remain enforced. The owner policy update is recorded in DECISIONS; issuance, vouchers, payment and financial delivery controls outside manifest remain unchanged. Historical skippedFinanceCount is retained in schema/response compatibility; new exports record zero.

Each ticket has its own export history namespace. Outbound ticket exports still recognize old non-ticket range exports. Return exports do not inherit outbound export history. New-only never silently falls back to all; users explicitly choose all when needed. XLSX templates and audit history remain unchanged.

Compatibility: additive GET /reservations/manifests/routes and four optional inventory fields added to ReservationManifestTicketCardV1. Producer Ticket Catalog/Reservations and consumer Reservations Web are PC-A-owned. Old clients ignore fields, new clients display a dash when older API responses omit them. No migration/dependency/operational-data/runtime changes.

Validation: 39 focused API tests (including binary HTTP XLSX output), 9 Web tests, scoped lint, Web/API/contracts typechecks and both production builds passed. Authenticated browser interaction and production database concurrency are outside the unit/HTTP test coverage.
