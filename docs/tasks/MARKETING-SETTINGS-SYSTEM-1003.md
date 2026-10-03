# MARKETING-SETTINGS-SYSTEM-1003

- COMPUTER_ID: PC-B
- Branch: `codex/pc-b-marketing-settings-system-1003`
- Base: `origin/develop@4d67795c`
- Owner request: move Marketing settings to System Management → Marketing, then push and merge into develop.

## Accepted behavior

Marketing no longer exposes its Settings card. Legacy `/marketing?section=settings` links redirect to `/system?module=marketing`. The existing System Management Marketing module retains its persisted audience, campaign and offer settings and hosts the transferred channel, site, role, alert, general and log views. Their existing preview behavior and detail interactions are preserved; relocation does not introduce new setting keys, change permissions, or claim active provider/analytics connections.

## Scope and coordination

Marketing Web route/model/presentation, bounded System Management Marketing presentation, focused checks and this task's documentation. Shared navigation changes are limited to Marketing breadcrumb handling. Prior System Management work is PC-B-owned in the work ledger. Existing user `.data/` and the other active coordinator lane are preserved in a separate checkout. No API, shared contract, schema/migration, dependency/lockfile, database or local service mutation.

## Validation and handoff

Implementation and verification are in progress. The lead owns commit, push, PR and the user-authorized develop merge after source review and required checks. All actual checks and release evidence will be recorded before handoff.
