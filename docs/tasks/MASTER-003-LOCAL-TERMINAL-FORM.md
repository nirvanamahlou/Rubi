# MASTER-003-LOCAL-TERMINAL-FORM

Publication update (2026-08-31): user authorized publishing all local work and local activation. This slice is on `codex/pc-b-master-data-terminal-form-details`, stacked on travel-form-details. The additive migration was deployed after a local DB backup; existing rows and parent branches were retained. The following is the original implementation-stage report.

PC-B — local terminal-form slice, authorized 2026-08-31. No branch switch,
commit/push, shared-server restart, Finance/Customers edits, or shared-database
deployment is part of this side-conversation change. Existing local work is retained.

## Screenshot coverage

| Item | Form and persistence |
| --- | --- |
| Code/title | Generated immutable code; required Persian title and optional English title |
| Airport | Searchable, clearable reference to an existing active airport; real FK |
| City, IATA/ICAO | Read-only values from the selected airport, also returned in the terminal list/detail |
| Terminal type | Domestic, international, mixed/shared, VIP |
| Gate count | Optional integer, zero allowed, maximum PostgreSQL integer; blank means unknown, not zero |
| Operating hours | Unknown, all day, or local-airport HH:mm range; end-of-day 24:00 and overnight ranges supported |
| Status | Active, inactive, maintenance; subject to existing status-management permission |
| Last change | Server timestamp and actor ID; actor display name from IAM's authorized public endpoint, otherwise an explicit unavailable/ID fallback |
| View/edit | Existing list opens a popup, not a separate profile section; view is read-only |

Clearing a required selector leaves a validation error until a replacement is selected.
Clearing optional gate count/hours persists null. Changing from a time range to
all-day/unknown clears both clocks. Numeric form input accepts Persian/Arabic digits.

## Data relationship and ownership

City → Airport → Terminal. City, airport codes and IANA timezone are **not**
duplicated as editable terminal data. No direct query of IAM tables is introduced.
The optional actor-name lookup uses IAM's existing public API and respects its
permissions. It never grants additional access or blocks the catalog on denial.

## Contract and compatibility

Producer: Master Data API. Consumer: Master Data Web. Existing CRUD, list, detail,
optimistic-lock and audit endpoints remain in place; `MasterTerminalType` adds `MIXED`
in the contract, request DTO, list/export validation and frontend validation.

Terminal mutation `values` adds `gateCount`, `operatingHoursMode` (`ALL_DAY` /
`TIME_RANGE` / null), `opensAt`, `closesAt`, and form-only `status`
(`active` / `inactive` / `maintenance`). Clock strings describe a recurring local
schedule, **not a timestamp**; audit/record instants remain UTC. Omitted PATCH fields
stay unchanged; partial clock updates merge against the current row before validation.

Maintenance is stored as `isActive=false` and `isUnderMaintenance=true`, so existing
active-reference consumers cannot treat a maintenance terminal as available.
Shared `MasterDataStatus` remains `active | inactive`; the form and table interpret
the separate maintenance attribute. The existing inactive filter includes maintenance.
Ordinary activate/deactivate operations clear the maintenance flag. Status changes
require `master_data.status.manage`, except normal active creation. An unchanged
form status is omitted so a regular editor is not required to manage status.

Status and other fields are persisted in the same repository transaction, version
claim and audit snapshot. City, timestamps, actor IDs and maintenance flags cannot be
forged through the generic values payload. Audit records are not manually editable.

## Migration and rollout

Additive migration: `20260831110000_master_data_terminal_details`.

- Adds `MIXED` to the terminal type enum, optional gate/hours columns and a false-default maintenance flag.
- SQL checks enforce nonnegative gate count, maintenance/inactive consistency and coherent clock groups (including SQL null semantics).
- Existing terminal rows, FKs and uniqueness/indexes remain intact; no fabricated hours or counts are backfilled.
- Deploy the additive schema before activating the newly generated client/API. No shared/local operational database was migrated by this task.
- Rollback is application rollback with the added columns retained; no destructive down migration or loss of newly entered metadata is proposed. Coordinate readers of the new `MIXED` value before rolling back consumers.

The database-design skill's analyzer was run against a focused before/after projection.
Its missing-index/global-code suggestions do not apply: the real schema already has
FK-leading indexes and airport-scoped terminal-code uniqueness. Its migration-generator
failed with a serialization error; migration safety is instead verified by executable
PostgreSQL constraint and preservation tests. No skill/tool source was modified.

## Verification

- API policy/service/repository tests cover complete payloads, partial updates, metadata forgery, permission checks, one-transaction audit and stale versions.
- Form-model and server-rendered component tests cover every requested field, read-only metadata, clearable selectors, Persian digits, unknown values and popup view mode.
- `RUBI_RUN_TERMINAL_POSTGRES_TESTS=1` enables the isolated PostgreSQL 18 suite in `apps/api/test/terminal-form.postgres.spec.ts`.
- The PostgreSQL suite creates only a uniquely named `rubi_md_terminal_test_<uuid>` database, applies all migrations, seeds before and after the additive migration, checks preservation/constraints, exercises the real repository and removes its own test database.
- Optional `RUBI_TERMINAL_TEST_CLIENT` selects a separately generated Prisma client, avoiding replacement of a running shared server's client.
- Optional `RUBI_TERMINAL_TEST_SEED` selects an isolated copy of the unchanged seed. On this shared machine, the normal seed's 5-second transaction timeout expired; a temporary client factory restricted to `rubi_md_terminal_test_<uuid>` used a 60-second timeout. The application seed/client and operational configuration were not changed.
- Shared-server browser smoke and shared-database rollout are not claimed; build and data tests run separately.

Final results: 41 new API and 28 new Web tests pass; all 15 PostgreSQL tests pass.
The full current checkout passes 463 API tests (39 opt-in cases skipped in that run),
304 Web tests and 14 contract tests. Targeted lint passes. API/Web typechecking
against the current contract source passes, as do isolated API and Next production
builds and Prisma format/validate/generate. The generated shared contract declarations
were stale, so source-path overrides were used in temporary typecheck configs instead
of rebuilding a live shared dependency. The old three-terminal-types catalog assertion
was updated to include the new mixed type. `git diff --check` and focused secret/scope
checks pass; no Customers, Finance implementation or dependency/lockfile edits were made.

The shared server still needs coordinated schema deployment and client/API activation
before the new fields can be saved there. No commit or push was made by this task.
