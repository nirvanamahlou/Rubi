# RATE-ACTIONS-CHART-1019

COMPUTER_ID=PC-B; branch `codex/pc-b-rate-actions-chart-1019` from `35941c03`.
Owner authorizes rate edit/delete, visible chart axes, removal of the technical badge, tests, push and develop merge.

## API / compatibility

- Producer Master Data adds `PATCH /master-data/currency-rates/:id` with `{expectedVersion, rate?, source?}` and `DELETE` at the same path with `{expectedVersion}`. At least one edit field is required; rate is an exact positive Decimal string,14 integer/10 fractional digits. Source is optional bounded text. Existing envelopes/quote-registration/decision endpoints remain; new response `data.isActive` makes deletion explicit.
- Web consumes dedicated commands only, not generic record mutations. Edit preserves pair/type/time/validity/status; it does not revive rejected or expired historical records. No new approval is introduced for directly finalized quotes.
- Native update/delete permissions plus existing currency-rate write authority (`master_data.currency_rate.create`), resource and changed-field controls, permitted audit branch and CAS remain mandatory. No approval permission or new user grants are introduced. Missing/deleted rows return404, stale writes409, denied access403 and invalid IDs/versions/amounts400. Client-owned lifecycle, pair or actor properties are rejected by DTO whitelist.
- Delete is logical, preserving the row, references and audit. History/current filter active records, and legacy decisions cannot revive deleted drafts. Audit failure rolls the entire mutation back. `isAuthoritative` stays false; Finance authoritative rates, accounting documents and frozen transaction snapshots do not change.
- No schema/migration/dependency or operational data/runtime changes. API and Web should be published together; an older API does not support these new actions.

## UI

- Both rate lists provide compact edit/delete icons, explicit delete confirmation, busy/repeat-click guard and visible errors. The displayed record/version is captured when opening; successful commands reload persisted history/current chart.
- Chart X uses actual observation-date intervals, Y uses amount, with visible axes/ticks/date and amount captions. Single/equal points remain finite; tiny/large amounts remain legible. Date labels follow the existing Persian/Tehran display; full exact rate remains in the point title. Compact/scientific labels and numeric plotting are presentation only, not monetary arithmetic.
- The technical flag badge is removed from display only. Narrow screens can scroll the chart without clipping its labels.

## Verification

- Initial focused run:46 API and43 Web tests passed, including DTO injection, permissions, field/resource denial, CAS, audit propagation, current/history filtering, client command shapes, actual SSR icons/chart and legacy generic-mutation restrictions.
- Broad Master Data API:623 tests passed with one optional PostgreSQL suite skipped locally; focused Web:60 passed. Updated mutation/permission checks:21 passed. Scoped API/Web lint and format/offline translation checks passed; final hosted gates cover fresh full builds/types and disposable database execution.
- Added disposable PostgreSQL proof for exact edit/current read, concurrent updates, logical delete/history exclusion/audit retention and real rollback on update/delete audit failures. No production rate is entered or modified for testing.
- Scoped lint, typechecks/build and all exact-final-head hosted checks gate merge; final evidence is recorded on the PR. Local memory constraints may require hosted builds rather than a live preview. No authenticated browser or server deployment is claimed.
