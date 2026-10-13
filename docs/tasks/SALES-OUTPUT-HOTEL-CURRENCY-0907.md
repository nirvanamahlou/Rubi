# SALES-OUTPUT-HOTEL-CURRENCY-0907

- Computer: PC-A. Base: 1c1acd2. Branch: codex/pc-a-sales-customer-pricing-0907.
- Status: COMPLETE_LOCAL. No public push, merge, rebase, producer checkout change or IAM grant.

## Behavior

- Customer contract footer uses Nystkt.ir. Hotel section uses public Master Data attributes englishName and website; missing values are disclosed, not transliterated or guessed.
- Hotel guests choose DBL / SINGLE / INFANT / CHILD_WITH_BED / CHILD_WITHOUT_BED in the themed Sales people step. Choices are age-compatible at travel date. This is a passenger accommodation category, not a new inventory allocation; room counts remain unchanged.
- Additive nullable SalesContractPassenger.accommodationKind persists across create/read/update. Database CHECK restricts values, domain validation requires compatible age and hotel service allocation. An existing stored choice cannot silently disappear through an older update client while its hotel allocation remains.
- Passenger sale column contains the entered whole-package IRR amount. Foreign column contains entered amount(s) and currency code; empty when absent. English numeric glyphs and exact decimal grouping remain.
- Agreement total sums complete explicit passenger prices independently per currency, without exchange conversion. Backend reconciliation with service-agreed totals is retained. Legacy absent per-passenger prices keep the saved agreement total and unrecorded disclosure. Finance balances and confirmed-payment settlement are unchanged.

## Verification

- 132 Web Sales, 45 API Sales, 48 Contracts tests pass.
- Scoped ESLint, API/Web TypeScript, Contracts/Database builds and API/Web production builds pass.
- Actual Chrome PDF renderer: one-page sample and three-page 42-passenger sample. All four pages visually inspected; B Nazanin, navy theme, site and column contents preserved.
- Empty PostgreSQL database: all migrations deploy and seed twice yields the same 86 permission count. Operational seed not run.
- Restored operational backup: additive migration applies, all five accommodation values roundtrip, invalid value fails CHECK, fixture writes rolled back. Existing business counts and historical migration rows unchanged.
- Operational activation uses a new retained local backup; only 20260907130000_sales_passenger_accommodation was pending/applied. Previously documented historical checksum differences were not rewritten or rebaselined.
- Web3100 and API4000 restarted; login and health return HTTP 200. No authenticated real-customer edit or end-to-end record creation performed.

## Local evidence and limits

Ignored tmp/accommodation-upgrade-evidence.json, accommodation-migration-gate.cjs, accommodation-upgrade.cjs, accommodation-persistence-qa.cjs and pdfs/accommodation-0907 contain scoped verification evidence. Backup before-accommodation-1788770625305.dump is retained locally; no real data is committed.

Old contracts do not acquire invented room categories or passenger prices. Hotel references reflect accessible current Master Data attributes. Supplier purchase costs, Reservations workflow and Finance confirmation rules are unchanged.

Task-specific Migration/Sales contract/Central Docs reservations released.
