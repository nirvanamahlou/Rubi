# DIRECT-CURRENCY-RATES-1019

COMPUTER_ID=PC-B. User authorizes direct reference-rate registration, tests, push and develop merge. Branch `codex/pc-b-direct-currency-rates-1019`, base `85c54d2f`.

## Policy and implementation

- `POST /master-data/currency-rates/quotes` finalizes newly supplied BUY/SELL quotes atomically, using the existing APPROVED representation. Backend records the registrant and finalization timestamp, not a fictional independent reviewer.
- Both existing create permissions and the actor's permitted audit branch are required. Exact positive Decimal strings, active currency FKs, validity windows, transaction and audit remain enforced. Rates remain non-authoritative reference data; Finance posting/settlement and per-unit toman metadata do not change.
- Legacy drafts are not silently approved, and their existing maker/checker/CAS decision path remains guarded. No schema, migration or dependency changes.
- Successful submission returns to the currency profile, selects the submitted pair/type and reloads persisted history so the finalized quote reaches the KPI/chart immediately. Empty/status/success copy no longer asks for approval; English translations accompany the Persian labels.

## Verification

- Focused API:32 tests passed, including create-only actor, metadata, invalid Decimal/date/pair, permissions/branch, inactive currencies, DTO injection protection and legacy decision guards.
- Focused Web:22 tests passed (currency form/model and actual server-rendered chart), including first-point visibility, subsequent trend and exclusion of legacy drafts. Translation completeness is checked separately.
- Added disposable PostgreSQL regression for exact BUY/SELL persistence, real constraints/audit, current/history reads, later-rate selection and rollback on an injected second-audit failure inside the real transaction. The first hosted run disproved the initial test assumption that audit actor IDs have a user FK; the test now injects the intended failure explicitly. Hosted database CI is required; no operational database is used.
- Lint, typecheck, affected builds and final-head hosted gates must pass before merge. Final evidence/hash is recorded on the PR.

## Rollout / limits

Deploy API and Web together through the normal release process. Older API versions still create drafts. This task does not deploy avinaofficial.ir or mutate historical rates. No authenticated live browser or production-rate write is claimed.
