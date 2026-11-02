# TICKET-LOAD-CONTRACTS-1102

PC-A; `codex/pc-a-ticket-load-contracts-1102` from develop `87cc38f1f`.
Owner authorizes the dated ticket-load contract report, XLSX and develop merge.
The later clarification requires cancelled seats to return to available load,
while total capacity and cancellation history remain intact.

Clicking the date of either flight leg opens its contract table below the load.
The exact offer ID identifies date, airline, route and cabin; matching only a
flight number or day is deliberately insufficient. The report shows contract,
buyer, state, direction, route, current outbound/return dates, flight facts and
ADT/CHD age bands/unknown child ages/INF counts. Counts use that leg's passenger
allocations, with the existing service-specific historical aggregate metadata
for incomplete rosters. Infants count as passengers, never occupied seats.

Confirmed operational contracts appear by default. The cancelled-history filter
keeps cancelled contracts available separately without adding their seats back
to active sales. Empty/error/loading/retry/refresh states, keyboard date links
and cancellation of stale requests are supported. XLSX applies the same offer
and history filter, includes numeric composition totals, Gregorian Tehran dates,
text-safe identifiers and names, frozen headers and autofilter.

Sales owns the read query and exposes additive v1 DTOs through
`GET /sales/flight-load/:offerId/contracts` and `contracts.xlsx`. Both require
Ticket Catalog read plus existing Sales own/branch/all visibility; exports also
require `sales.export`. Queries intersect visible branches before aggregation.
Catalog validates the exact offer and supplies current flight facts through its
existing public services; city labels use Master Data's public service. No
other module's tables or repositories are queried directly. Passenger identities
and birth dates are not exported. Responses are private/no-store and the report
rejects more than 10,000 contracts rather than silently truncating.

Cancellation now passes the transaction from Sales' existing serializable status
transition through its Ticket adapter to Catalog's public `releaseContract`.
The optional transaction parameter retains existing callers. Version conflict,
Finance restrictions or a release failure cannot commit a partial cancellation.
Only active allocations of that contract are released; both leg quantities,
other contracts, original total capacities and allocation history remain intact.
Available load is recalculated from total minus active allocations/holds, so the
released quantity returns exactly once without incrementing total inventory.

Validation covers service scopes and exact offer selection, leg composition,
unknown ages, incomplete rosters, current dates, empty/large reports, authenticated
HTTP/filter/export behavior, real ZIP/XML XLSX contents, table rendering/date
actions, translations and cancellation transaction wiring/failure/conflict.
Local scoped lint and Contracts/API types/builds are required before publication.
Web production build and typecheck passed using webpack because this Windows
worktree's dependency junctions are outside Turbopack's filesystem root; no
application configuration was changed. Hosted CI verifies the normal clean
checkout build and all required final-head gates before the authorized merge.

No schema, migration, dependency, operational data rewrite or deployment.
