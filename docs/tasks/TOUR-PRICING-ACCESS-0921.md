# TOUR-PRICING-ACCESS-0921

COMPUTER_ID=PC-A. Branch: `codex/pc-a-tour-pricing-access-0921`.

## Scope and cause

Read-only diagnosis of the local runtime found zero `package_pricing.*`
permissions in its database, although the canonical permission catalog and
API guards already define them. Defining a tour uses Ticket Catalog permissions;
reading departures for pricing requires `package_pricing.read` separately.
The 403 was genuine; guards must not be removed or replaced by ticket permissions.

The owner explicitly approved restoring only read, cost read, margin read and
draft-period management for the existing account's exclusively assigned custom
role. Publication, finance approval, administrator assignment, branch membership,
customers and contracts are not changed. The full fixture seed must not run.

This independent slice reserves only the new repair module, CLI, tests and this
task document. Central/shared files, schema, migrations, seed and dependencies
are unchanged; other task worktrees and the 3100 runtime remain untouched.

## Operation

Run `packages/database/scripts/repair-package-pricing-access.ts` with the existing
local environment via `tsx`, supplying `--user-id`, `--role-code` and a non-PII
`--reason`. Default execution previews missing catalog entries and four bounded
grants without writing. Review the preview and obtain owner approval before
adding `--apply`. It refuses inactive users, inactive/system/shared roles and
non-local database URLs. Run again without `--apply` to confirm no missing entries.

Changes and audit are atomic in a serializable transaction. Repeating apply is
idempotent; no role/user/branch is created and existing permissions are preserved.
Refresh the authenticated pricing page after applying; no server restart or
authentication bypass is needed.

The workflow remains: define tour/services → define dated departure and actual
ticket inventory → connect hotel rates → save draft prices → independent authorized
publication → use the real available tour in Sales. Missing ticket/hotel/rate data
must remain explicit; this repair does not synthesize inventory or approve payments.

## Validation

- Frozen offline install succeeded using the existing local package store; no
  dependency or lockfile change.
- Scoped formatting, database lint, Prisma client generation, database typecheck
  and database build passed.
- Focused repair/catalog tests: 14 passed. Complete database suite: 90 passed,
  14 skipped (environment-gated integration tests); rollback coverage here uses
  a transaction mock, not a new isolated PostgreSQL integration run.
- Owner-approved local apply created 15 missing catalog definitions and granted
  only the four approved codes. A read-only query confirmed those exact four
  pricing grants and one successful repair audit. Subsequent preview returned
  empty catalog/grant changes.
- Authenticated browser smoke on `http://localhost:3100/sales/pricing` passed:
  the forbidden state disappeared, both previously created synthetic tour
  definitions were selectable, and selecting a tour displayed dated-departure
  and outbound/return ticket controls. No departure exists yet, so the pricing
  list correctly shows an empty state, not a permissions error.
- No ticket inventory, hotel rate, price publication, payment or contract was
  created by this repair. The full sales lifecycle is not yet verified.
- Full monorepo tests and API/Web production builds were not rerun for this
  database-only operational tool; no runtime source or running service changed.
- Latest develop changes were inspected for overlap: no changed target file is
  shared with this slice. Central documents modified by other tasks are untouched.
