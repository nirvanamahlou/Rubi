# Cancellation and charter capacity — 2026-11-09

PC-A; owner requests verification, repair and develop merge.

Existing Sales cancellation and Reservations CANCEL already release the contract's ACTIVE allocations transactionally. Reservations REOPEN already calls the Catalog public restoration boundary and rolls back workflow persistence when capacity is unavailable. Original quantities exclude infant seats and must not increase the published capacity.

Repairs:

- Restore locks the selected inventory before reading allocations; malformed/duplicate selections and invalid original quantities fail closed. Other active allocations and unexpired temporary holds count against remaining capacity.
- A known charter request without its current ticket identities cannot reopen without acquiring inventory.
- Flight-load reports now compose the latest Reservations lifecycle through its existing public reader. Operationally cancelled contracts move to the cancelled list rather than remaining in sold load; a successful reopen reverses that projection. Sales authorization and branch/owner filtering remain before composition.

Verification covers exact capacity, insufficient outbound/return capacity, active temporary holds, missing/duplicate ticket references, unauthorized and stale commands, and rollback of both cancellation and reopen on storage failure. The existing mandatory PostgreSQL ticket-routes gate also proves release/re-sale/reopen, rollback and two concurrent reopen attempts against one freed block. Local Docker is unavailable, so this real-database proof is delegated to the existing hosted gate, not claimed as locally run.

No schema, migration, dependency, operational-data update or deployment. All exact-final-head hosted gates must pass before merge. Source reservations release on verified develop merge.

Local targeted API checks:36 passed; scoped ESLint and formatting pass. Full API typecheck/build are checked before merge; real PostgreSQL execution remains the hosted gate.
