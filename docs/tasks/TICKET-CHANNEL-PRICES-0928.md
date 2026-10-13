# TICKET-CHANNEL-PRICES-0928

COMPUTER_ID=PC-A. Branch: codex/pc-a-ticket-channel-prices-0928. Base: origin/develop@e4eb048c. Owner explicitly authorized preserving overlaps and merging to develop on 2026-09-28.

## Behavior

- One-way offers and registered round trips share the same lower list. Each pair has concise outbound/return airline, number, Tehran day/time and capacity. The pair editor remains above the list; base fare can also be revised inline.
- Origin, travel destination, one-way/round-trip, free-text and inclusive Tehran departure-day filters combine. Sales targets are separate from travel cities.
- A saved base opens fields for direct company sales and each active named target of the offer branch. Zero commission keeps the base; 3% yields base × 0.97. Inputs accept Persian/Arabic digits and up to four decimal places. Money uses exact BigInt/Decimal arithmetic with four-place half-up rounding.
- Each target has an independent saved percentage. Copy applies that percentage to every future, unarchived, base-priced one-way and pair fare in the same branch, regardless of screen filters. Unpriced tickets, other targets, other branches and historical contract snapshots remain unchanged. The response reports the number changed.
- Legacy absolute partner fares remain readable and are marked as an earlier independent price. They convert to base-plus-percentage only when the user explicitly saves a commission; existing rows are never overwritten.

## Data/API and overlap

Ticket Catalog owns append-only TicketSaleCommissionRevision with real offer, optional return, optional target and actor FKs. Unique scope/revision and scope/command indexes cover nullable target/pair identities; a database trigger prevents revision update/delete. Percent is Decimal(7,4), constrained to 0..100. Base prices retain their original versioned tables and monetary currency. Derived net fares are recalculated from the current base and saved percent.

PATCH /ticket-catalog/offers/sale-commissions requires ticket_catalog.manage, offer branch access, active same-branch target, expected base/commission revisions and an idempotency key. Bulk copy is one serializable transaction, locks offers in stable order shared with fare writers, and rolls back all rows on failure. Optional v1 baseStandaloneSalePrice, saleCommissions and round-trip baseAmount fields preserve existing consumers. Direct effective fares continue through the established standalone/pair fields used by new Sales contracts; old contract snapshots are unchanged. Named-target fares are available in the public projection. No external partner API transmission is implemented or attempted.

Manifest transport's optional transportType addition and Finance's separate UI work must be preserved when integrating current develop. Neither other worktree nor the dirty original checkout is edited. Dependency/lockfile, permissions and operational data are outside this unit.

## Verification and rollout

All 100 migrations, including 20260928160000_ticket_sale_commissions, were applied successfully on a fresh isolated local PostgreSQL database. Targeted tests cover filters, pair rendering, exact preview arithmetic, permission/branch guards, stale version checks, idempotency and copy scope. PostgreSQL tests additionally exercise persistence/readback, rollback on a later write, concurrent stale updates, recomputation after repricing, restrictive FKs and append-only revision protection. Final gate results are recorded in PROJECT_STATUS.

Apply the additive migration before deploying the matching API and Web. No operational database or running localhost service is changed by this implementation. Merge to develop is explicitly authorized; main remains outside scope.
