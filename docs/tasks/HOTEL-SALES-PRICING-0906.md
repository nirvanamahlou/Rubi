# HOTEL-SALES-PRICING-0906 — PC-A

User approved local implementation and explicit Migration lock transfer.
Base: verified local integration plus Customer entry sheet. No remote publication.

## Contract and storage design

Sales owns versioned day-sale and agreed prices per service/currency, persisted in
an additive JSON column on its service and included in the immutable Reservations
intake. Existing requests without pricing retain v1 legacy price components.
New requests derive BASE and DISCOUNT/SURCHARGE components; API verifies them.
Hotel NIGHT prices cover all selected rooms for one night (no implicit room or
passenger multiplication). TOTAL is the exact authoritative total when entered;
derived nightly figures are four-decimal rounded displays, never the source for
recomputing that total. Dates are UTC calendar dates, checkout exclusive.

Reservations owns append-only operational hotel purchase revisions on its intake:
branch scope, dedicated write permission, optimistic version and idempotency.
The reported cost is NOT Procurement approval, Finance settlement or financial
release. Immutable Sales/intake snapshots are never overwritten. Costs cannot
be subtracted across currencies or from an unrelated intake version.
No fabricated supplier discount: day sale minus agreed is seller discount;
agreed minus recorded same-currency cost is provisional hotel margin.

Ticket offers currently have no authoritative catalog purchase reference in their
public contract. Never match by route/name/time or read Ticket private tables.
Ticket purchase remains in its owner; total final contract profit cannot be claimed
until that versioned public cost bridge and Procurement approval exist.

## Verification and local rollout gate

- 15 lint/typecheck tasks passed. Contracts: 38 tests; Database: 71; API:
  882 passed / 78 optional skipped; Web: 727 passed, followed by all three final
  pricing panel/review tests. Initial unconstrained parallel run exceeded timing
  limits in unrelated calendar/HR tests; the full bounded Web rerun passed.
- Prisma generated and all 35 migrations deployed to fresh
  rubi_pricing_test_0906. Seed ran twice (85 permissions). The focused real
  PostgreSQL/domain suite passed 37 tests, including permission/branch rejection,
  immutable snapshots, repeated idempotent requests, stale version rejection
  and concurrent single-winner updates. Test data was isolated, not real travelers.
- API production build and direct Web production build (36 routes) passed.
  No authenticated browser QA or real-contract/purchase creation is claimed.

Operational preflight refused migration deployment before any schema mutation:
local rubi already contains 20260906095000_ticket_offer_capacity_allocations
and 20260906113000_reservation_arrangements, absent from this branch. Those
belong to codex/pc-a-sales-contracts (6f827d1 and da2e5fe; tip 3d3095e).
Both touch overlapping Sales/Reservations contracts and runtime. Owner-aware
integration is required before pricing activation; no history rewrite, schema
reset, merge, API replacement or public push was performed in this task.

The previously serving Web build was restored and is responding on 3100;
existing API 4000 was not stopped and its health returned 200. Tested pricing
Web output is retained locally in tmp/hotel-pricing-web-built-0906 (ignored).

User's separately approved IAM action was completed independently: only active
Ramtin received reservations.hotel_purchase.write via the single-purpose role
ramtin_hotel_purchase_local. No branch grant or shared role was altered. Other
user-role links and shared-role permission links were checked unchanged inside
the transaction. An audit record explicitly identifies user-authorized offline
maintenance, not a fabricated authenticated actor.
Backup: tmp/rubi-before-ramtin-hotel-permission-0906.dump (659987 bytes, ignored,
local only). The feature endpoint is not live until the integration gate is solved.
