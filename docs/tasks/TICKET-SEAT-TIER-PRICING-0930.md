# TICKET-SEAT-TIER-PRICING-0930

COMPUTER_ID: PC-A. Branch: `codex/pc-a-ticket-seat-tier-pricing-0930` → `develop`.

Sales ticket pricing accepts consecutive seat-count and amount blocks for a standalone fare or a specific outbound/return fare. The blocks cover the entire published capacity. The first block matches the base amount. Each immutable base revision owns its own blocks; revisions without blocks retain the legacy flat amount. Ticket Catalog projects raw and commission-adjusted blocks; Sales adds exact four-decimal amounts for the seats crossed by a contract and splits round-trip totals without losing a unit. The reservation public API rechecks tier totals under the offer locks before allocating seats, so a stale contract must be refreshed.

The additive migration creates `TicketOfferSalePriceTier` with one restrictive parent FK, positive amount/count constraints, per-parent ordered uniqueness and an update/delete rejection trigger. It does not rewrite old prices, tickets or contracts. Apply the migration before deploying the API. No dependency changes or operational seed.

Validation: Prisma schema format/validate and database/contracts/API/Web builds passed. API/Web typechecks and lint passed. Focused API and Web price, commission, reservation and compatibility tests passed. `git diff --check` passed. PR CI passed the full quality, test, production build and PostgreSQL 18 migration/seed gates. The migration was not applied to the operational database. Migration owner and bounded shared-file locks released at delivery.
## Follow-up — capacity guard (2026-09-30)

The Sales editor bounds each tier count by the seats left after the other tiers, prevents adding a tier after capacity is assigned, and caps a typed value at the remaining capacity. Pair pricing uses the smaller outbound/return capacity in both the editor and Ticket Catalog API, so a round-trip schedule cannot price seats that cannot be sold on both legs. Legacy flat-price and immutable revision behavior remain unchanged.

Follow-up validation: ten focused Web tests and ten API tests pass; scoped lint, Web/API typechecks and production Web/API builds pass. `git diff --check` passes. No schema, migration, contract, dependency or operational-data changes.
