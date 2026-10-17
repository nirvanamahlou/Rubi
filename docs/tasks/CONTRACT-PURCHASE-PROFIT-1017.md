# Contract purchase margin and broker purchases

User authorizes completion and develop merge. FX-owner coordination is recorded in PURCHASE-FX-PROFIT-1017: the immutable purchase-day FX baseline/payment variance remains independent; this task consumes recorded invoice amounts and never counts FX variance twice. The FX schema/contracts/capture hooks are untouched. Runtime module changes are limited to the new broker history controller/provider registrations.

Finance readers can open the existing protected contract-profit projection directly from the purchase form, refreshed after purchase revision changes. It subtracts recorded hotel/transfer/service purchases and allocated flight costs from current contractual sales, per currency. Missing costs keep profit unknown; rates or zero costs are not invented. Round-trip legs sharing one service key now both contribute, and one missing leg keeps the service incomplete. Existing bundled transfer and legacy hotel de-duplication remain intact.

The broker profile consumes a new Reservations-owned, authenticated read endpoint. It lists persisted purchases attached to that exact registered broker or compatible legacy organization, scoped to the actor's branches and finance.read. Latest revisions are selected before supplier filtering so reassignment does not leave a current purchase in the former broker's account. Amounts stay Decimal strings. Pagination is bounded to25 rows. No duplicated purchase/ledger write or operational backfill occurs; existing persisted purchases appear automatically.

No schema/migration/dependency or local runtime changes. English labels and derived catalogs are included. Targeted tests, lint, typechecks, builds and final CI must pass before merge.
