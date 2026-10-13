# Reservation purchases hub — 2026-10-07

PC-A; codex/pc-a-reservation-purchases-hub-1007. Owner requests a unified Purchasing & Supply entry for Reservations contract purchases with five colored categories.

## Behavior

- The selected contract's Purchase action links to /ticket-purchases with its intake ID and contract number. All services, Hotel, Flight, Transfer and Insurance cards filter the same hub.
- Received contract snapshots are the source regardless of whether purchase revisions exist. Every supported selected service has its registered/missing status, supplier, Decimal amount/currency and separate Finance settlement evidence.
- Hotel/transfer use the existing atomic batch editor; insurance selects the exact service client key, including multiple policies. Existing CAS, idempotency and append-only revisions remain authoritative.
- Flight rows match the existing authorized inventory requests by exact offer ID and branch, excluding cancelled requests. Inventory totals are not fabricated as per-contract costs. The original flight purchasing workspace remains available and supports an optional offer focus. Train/bus services are not mislabeled as flights.

## Contract and ownership

Reservations produces additive private GET /reservations/requests/purchases; Web reservation-purchases consumes it. Query kind defaults ALL; page defaults1, page size25 with look-ahead; optional literal contract-number search. Category, branch and search are applied in bound PostgreSQL selection before pagination and hydration. Existing API consumers and write contracts remain compatible.

The endpoint requires existing reservations.read and branch scope. canRecord reflects the existing reservations.hotel_purchase.write capability. Route visibility permits existing Reservations access without granting Procurement or Finance privileges. Original Procurement permissions still protect flight queries and saves. No Procurement command/table, schema, migration or dependency changes.

## Verification and handoff

- Production Web build passes56 routes; affected lint and Web/API typechecks pass; API production build passes.
- Bound-query PostgreSQL fixtures plus real authenticated HTTP tests14 pass. Fixtures use temporary tables inside rollback transactions; no operational records are changed.
- Contracts105 tests pass. Targeted model/UI tests cover categories, missing purchases, exact service/offer matching, English presentation, and second-policy selection. Affected Reservations/Ticket Purchase/i18n suite is the final local regression gate.
- Visual preview renders actual hub markup and production CSS with clearly labeled synthetic DEMO-42 data. Authenticated purchase submission is not exercised, and no payment is made.
- Offline English catalogues and future coverage checks remain enforced. Existing user-authored stored text is preserved.

Review PR targets develop. No develop merge, operational database mutation or service3100 rollout is included without matching authorization.
