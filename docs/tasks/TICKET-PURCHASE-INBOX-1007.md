# Ticket purchase inbox — PC-A

Owner request: rename five navigation entries; introduce Purchasing & supply for reservation flight purchases, seat-unit costs, dashboard/table, then Finance settlement and contract profit. User authorizes develop merge.

## Flow and boundaries

- Ticket publication retains its idempotent Procurement public envelope; no operational records are migrated or copied.
- Procurement owns envelope, branch and supplier snapshot. Finance stores immutable actual-cost/payment revisions. The purchasing UI calls the bounded public Finance cost service via /procurement/ticket-purchases; general Procurement orders/requests remain untouched.
- GET /procurement/ticket-purchases/inbox requires existing Procurement read scope or quote permission; branch and own-request scope remain enforced. New Web route reuses existing Procurement screen grants.
- POST /procurement/ticket-purchases/:id/costs requires procurement.quote.manage, operation UUID, expected cost version, purchased seat count, unit price and currency. Seat count cannot exceed request capacity; Decimal unit × seats gives the invoice total. Supplier snapshot is required.
- Same operation/payload retries replay one persisted revision. Changed payload, stale cost version and price edits after payment are rejected. Advisory lock serializes pricing and payment. Old Finance pricing HTTP route rejects cost creation; Finance payment route and immutable installment history remain unchanged.
- Finance inbox excludes unpriced envelopes. Buyer dashboard groups exact monetary totals per currency and tracks unpaid, partly paid and settled requests.
- Existing Sales actual-profit public boundary allocates latest purchased unit cost to contract passenger seats and each flight leg; hotel, transfer and insurance costs remain included. Incomplete costs withhold profit; no implicit FX conversion.

## Verification and handoff

Contracts/API/Web typechecks, scoped unit/HTTP/access tests and API production build pass. Isolated local PostgreSQL tests replay repository migrations in a randomly named guarded test database, then drop only that test database; operational data is unchanged. They cover repeated/concurrent pricing and two installments with stale version and settlement replay checks. Final Web build, lint and exact-head CI are required before develop merge. No browser QA, new migration, dependency change or local runtime deployment is claimed. Existing unpriced requests are visible in the new inbox; previously priced or paid history remains in existing storage.
