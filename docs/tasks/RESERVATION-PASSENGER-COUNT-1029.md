# RESERVATION-PASSENGER-COUNT-1029

Owner: PC-A. Base: develop acf9cf070. User authorizes implementation and merge to develop; no production rollout is part of this change.

## Behavior

Reservations contract correction now exposes a passenger-count control. Increasing the count opens an independent identity/service entry row for every additional person. Increasing the selected hotel room occupancy also opens the missing rows. Incomplete rows block the final amendment, and can be removed without creating a contract link. A registered new person appears immediately in the main passenger table, with identity fields read-only until the contract link is saved. Each actual table row has its own remove action, disabled for the final passenger. Removing a row excludes that identity from pending identity saves; it never deletes a Customer profile.

## Prices and compatibility

The optional amendment-only `preserveContractPrices: true` command is produced by Web roster correction and consumed by Sales.update only through the existing authorized amendment route/categories. The API requires the exact stored component facts (type/title/amount/currency), at least one passenger, aggregate contract pricing and absent per-person allocations. It still enforces branch/owner/confirm/reservation-request grants, unchanged retained identity snapshots, active Customer passenger profiles, version checks and inventory capacity inside the existing amendment transaction.

After a roster change the old per-person price allocation no longer describes the current roster. The editor switches to existing aggregate contract-package pricing, retains the original contract components including deductions/currencies, and removes obsolete per-person price maps instead of reallocating a removed person's money or demanding new prices. Existing immutable contract revisions preserve the prior allocation. Existing receipts, customer identities and issued document versions are retained. Insurance surcharge service prices for remaining assigned people stay intact; removed-person surcharges and stay/transfer links are filtered. Subsequent intentional price edits remain in the Prices section.

Existing clients omitting the command retain the existing per-person price validation. No schema, migration, new global permission or dependency change. API/Web/shared contract must ship together; an old API safely rejects the new membership command instead of silently saving a different price.

## Verification

Focused component/model/API tests cover multirow count expansion, hotel-count expansion, pending-entry save blocking, targeted deletion and last-passenger protection, historical unpriced contracts, exact multi-currency totals, removal of stale pricing maps, canonical republishing/capacity callbacks, authorization and rejection of changed amounts. Final lint/types/build and hosted gates are recorded in the handoff below.

## Handoff

PR: https://github.com/nirvanamahlou/Rubi/pull/1215. Twenty focused Web and25 API amendment/repository checks pass, including newly registered-row visibility and targeted removal before membership save. Local API and Web production builds pass; Web includes TypeScript and66 generated pages. Shared Contracts/Database builds, standalone Web types and translation synchronization pass. Scoped lint covers changed production files and tests. Full independent API types and all hosted quality/test/build/PostgreSQL outcomes are verified against the final PR head before merge. The local standalone API typecheck initially exhausted the default heap and a subsequent run overlapped source integration/stale generated dependencies; neither is treated as a passing gate. No authenticated browser QA or production business writes were performed. The server was not redeployed by this source task.
