# HOTEL-SALES-PRICING-0906 — PC-A

User approved local implementation and explicit Migration lock transfer.
Base: verified local integration plus Customer entry sheet. No remote publication.

## Final status — COMPLETE_LOCAL

User approved resolving the rollout gate. Merge e31b8d1 joins the prior pricing
history (43111fd) and Sales owner tip 3d3095e without rebasing or changing the
producer branch. The earlier blocked-rollout account below is retained as history.
Both work assignments/handoffs survive. Ticket capacity code is unchanged from
the producer. The public Reservations presenter now includes both independent
arrangement and purchase revisions; cost writes do not replace arrangements,
arrangement writes retain costs, and neither changes the Sales snapshot.
Legacy nullable room composition is omitted from the public contract instead
of inventing zeroes.

Final gates:

- All 15 lint/typecheck tasks; 733 Web tests, 883 API tests (81 optional cases
  skipped in the full run), 38 Contracts tests, 71 Database tests passed.
- 37 migrations passed on fresh rubi_combined_pricing_test_0906. Seed twice
  passed with 86 permissions. One earlier seed attempt under concurrent
  test/build load timed out; the independent rerun succeeded without altering
  seed behavior or running it on the operational database.
- All 46 focused tests passed on that isolated database: domain, actual
  reservation purchase/arrangement persistence, immutable snapshot, idempotency,
  branch scope and concurrent ticket oversell protection.
- API build and direct Web production build (36 routes) passed.
- Fresh backup restored to rubi_hotel_integration_upgrade_0906 and the pending
  migration was applied successfully there. Operational rollout then took
  another backup and applied only 20260906100000_hotel_service_pricing. All
  historical checksums and existing customer/user/contract/intake/arrangement/
  capacity-allocation row counts remained unchanged.
- Backups retained locally, ignored by Git:
  tmp/rubi-before-pricing-integration-rehearsal-0906.dump and
  tmp/rubi-before-pricing-integration-live-0906.dump, each 660386 bytes.
  Earlier Web output remains in tmp/hotel-pricing-integrated-web-before-0906.
- Combined Web3100 and API4000 are active. HTTP health and login redirect,
  the new pricing chunk, CORS credentials/preflight and 401 denial of an
  unauthenticated purchase request passed. Ramtin's effective reservations.read
  and reservations.hotel_purchase.write were checked; his dedicated new role
  has one user and one permission. No further permission assignment occurred.
- Existing Documents key/storage preserved. No authenticated browser walkthrough,
  live business-record creation, public push or main/develop update is claimed.
  Local task reservations are released; new work needs a fresh reservation.

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
