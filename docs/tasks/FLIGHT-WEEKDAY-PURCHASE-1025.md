# Recurring flight capacity purchases — PC-A

User requests one purchase total for same-number flights on the same weekday and contract cost proportional to consumed seats. Develop merge is explicitly authorized; runtime rollout is not requested.

## Identity and display
Company capacity only; exact branch, carrier, flight number, route/airport pair, cabin, supplier snapshot and Tehran weekday form the trusted grouping key. No title parsing and no floating/unknown supply inference. Unpriced departures within current date filters combine; dates and member count remain inspectable. Existing recorded groups keep complete membership even when only one date matches. New departures never retroactively expand an old purchase denominator. Legacy and already separately priced requests remain readable separately.

## Cost and integrity
One group command contains member IDs/expected versions, exact total seats, total amount, currency and optional purchase FX rate. Finance validates the authoritative Procurement and Ticket Catalog producers, takes sorted request advisory locks and producer row-share locks in the same transaction, rechecks current facts, then creates append-only per-offer payable shares. Four-decimal cumulative apportionment guarantees their sum equals the single entered total. Each member retains the pooled unit price and a bounded machine marker in the existing500-character reason field: operation UUID, input fingerprint, pool seat count and exact total. No schema or migration.

The public recorded-cost projection passes the pool denominator to Sales. A contract consumes only assigned non-infant seats at pool total / pool seats; unrelated per-contract flight cost cannot double count company capacity. Remaining seats use that same denominator, with final loss only after their own flight arrival; mixed past/future groups retain separate remaining/final amounts. Finance payments remain per existing per-offer invoice share; the pool total is never added as another payable.

Group retries replay the same immutable rows, including after settlement. Altered payload, stale cost versions, missing/full-seat mismatch, different route/day/supplier/supply, partial original-group edits and any started payment reject atomically. A single-offer command cannot overwrite a pooled member. Scoped own-only readers do not receive other members' pooled totals. FX snapshot failures roll back every member; all group members use the first captured rate when system FX is used.

## Verification
API52 related tests pass; Web26 purchase/filter/translation tests pass. API/Web typechecks and scoped lint passed before final refinements; final builds and hosted exact-head checks gate merge. Local Docker engine is unavailable. The existing isolated Finance PostgreSQL suite is extended with real recurring group locks, concurrent replay, exact totals, public cost denominator, stale version rejection and rollback. One additive database CI step runs it against the job's disposable PostgreSQL18 and a uniquely named test database, never an operational database. No dependency, permission grant, operational mutation or server deployment.

Develop integration: incoming legacyServicePartiesV2 aggregate historical contracts use validated per-service adult/child counts for the same pooled cost allocation; infants remain excluded. Sales profit files remain in this work item scope. Regression covers four seats out of150 with no personal passenger records.
