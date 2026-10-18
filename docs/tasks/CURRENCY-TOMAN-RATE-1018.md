# CURRENCY-TOMAN-RATE-1018

PC-B. Follow-up explicitly authorizes push and develop merge after final-head
CI; not operational migration or3100 rollout. User corrects the manual reference: one unit of each currency equals N
tomans. USD270000 means one dollar costs270000 tomans; IRR0.1 may be entered
explicitly. Values are positive exact Decimal(24,10) strings, optional/editable,
and displayed with the toman unit. This is reference metadata, not an FX trade,
buy/sell quote, settlement conversion or automatically refreshed market rate.

Use a new nullable MasterCurrency.tomanPerUnit column and optional mutation
attribute. Keep legacy unitsPerUsd and its old validation unchanged for compatible
clients; do not relabel, infer, invert or backfill old numbers. New Web forms omit
the old attribute. No other module consumes the new reference automatically.

Additive migration20261018110000_currency_toman_per_unit adds the decimal and a
positive/finite CHECK. Existing rows remain NULL. Application rollback preserves
the column/data; do not drop it after writes. No operational migration, runtime
rollout, push or merge is authorized/performed by this correction alone.

Focused Web25 and API46 tests pass. Added disposable PostgreSQL persistence/CAS,
legacy-isolation/clear and invalid-value regressions; not executed while local
Docker is unavailable. Full types/build and live migration are not claimed.
Skill schema analyzer reports no normalization/type/constraint issues for the
bounded model; existing PascalCase naming warning is retained to match Prisma.
The bundled migration-generator validate-only command fails on its own Column
JSON serialization; it is not counted as validation. Prisma schema validation
is a separate required check. No new index/relationship is needed for metadata
read with an existing currency row.
