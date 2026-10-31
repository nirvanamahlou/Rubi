# Reservation price amendments by person — 2026-10-27

PC-A, owner-authorized develop merge; no production rollout requested.

The Prices section uses one grid of name/ordinal, recorded age category, rial/foreign gross amount, discount and commission. Remove the old room, standalone service and editable whole-contract controls from this section. Unchanged per-person prices reopen as saved. A total-only contract initializes all currency totals on the first row and zero on subsequent rows; do not divide or convert currencies. Preserve separately calculated cheque fees and insurance extras exactly once.

Named contracts use existing canonical passenger-total pricing. Converting an old total/automatic/service model clears superseded pricing drivers while retaining insurance-extra service evidence; service/date/hotel/passenger assignments and receipt history remain. Pricing-model marker changes are financial-only for the operational fingerprint.

For V2 historical contracts without identities, use age-count pricing ordinals from the largest service party (same max headcount used by the existing contract summary). The approved rows are ADT, CHD, INF in that order with stable ordinal keys, never Customer IDs, passenger records, allocations or Manifest identities. First-service legacyRowPricesV1 stores strict gross/deduction maps; shared code validates exact expected rows/currencies/decimal amounts and deductions. Sales validates row-net totals plus existing cheque fees against canonical contract totals before persistence. No old records are backfilled. Missing legacy counts cannot create invented rows.

Producer/consumer: shared Sales reader/export defines additive scalar JSON metadata; reservation editor writes it and canonical Sales money validation consumes it in the same release. Old metadata-free records remain valid. No route, permission, schema, dependency or migration change. Supplier purchase amounts and reference hotel rates are independent.

Validation: focused UI/model/shared/API tests cover total fallback, preserving existing per-person amounts, save/reopen, exact net totals, malformed/extra/missing rows, excessive deductions, cheque/insurance handling and receipt/capacity/execution preservation. Affected lint/types/build plus all exact-head hosted checks gate merge.
