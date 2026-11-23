# Flight age fares — 2026-11-16

Owner PC-A; branch codex/pc-a-flight-age-fares-1116.

The website search carries adult12+, child2–<12 and infant<2 composition through flight selection. Ticket pricing has child and infant fields inside the existing base-price card; the adult amount and currency remain its existing fields. Each standalone direction and paired fare has independent group prices. The sales-target commission applies to each configured group.100% still hides the target.

Two optional Decimal fields belong to each immutable price revision. Missing child rate preserves its legacy adult-seat rate; missing infant rate preserves legacy zero. Explicit zero is a free group rate; negative values are rejected by API and database constraints. Older clients omitting these fields preserve the previous configured values. Explicit null clears the custom rate. No historical revision/payment rewrite occurs.

Website quote and draft validation derive groups from birthdays. The final native Sales confirmation supplies trusted passenger counts to Ticket Catalog, which atomically checks group prices, commissions and current tiers/capacity before allocating. Children consume one seat and infants consume none. Combined pair totals are calculated once and split with the established precision rule. Current quote failures never bypass existing confirmation or payment verification.

Validation:57 API checks including7 new group-rate, persistence and atomic-capacity guards; real PostgreSQL18 migration/rollback, legacy-null, zero and negative constraints with synthetic data and financial-history FK preservation. Native Web checks/build are a release gate. No real purchase, customer data export or production test rates.
