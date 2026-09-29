# Shared trial tickets — PC-A, 2026-09-29

The owner confirmed that **all local tickets and ticket prices are synthetic**.
This frozen snapshot contains 20 offers (11 visible, 9 already archived), 4
one-way price revisions, 4 round-trip revisions and 12 commission revisions.
Commercial price target names are included. No contracts, passengers, payments,
purchase costs, credentials, user identities or source branch identities are
exported. Operational capacity consumption and purchase requests are not seeded.
The import creates catalog data only; it does not create finance purchase requests.
Dates remain fixed to the owner's entered dates. This is not a rolling-date seed.

## Import on another developer's computer

Pull develop, install the existing locked dependencies, generate the Prisma client
and build the API using the project's normal setup. Apply the normal develop
migrations to your own development database first. This tool adds no migrations,
dependencies or automatic startup seeding.

Create a **private, untracked** `.runtime/ticket-demo-config.json` in your checkout:

```json
{
  "actorUserId": "<existing local IAM user UUID>",
  "branchId": "<existing local branch UUID>",
  "cities": {
    "3154e5d0-1b8b-46bd-baaa-fcce6bad3dcd": "<local Antalya city UUID>",
    "30000000-0000-4000-8000-000000000002": "<local Tehran city UUID>"
  }
}
```

Use an existing development user and the branch whose ticket list you want to
populate. Obtain references from the normal IAM/Master Data interfaces; do not
create or copy production accounts. The CLI validates the actor through IAM's
public service and active cities through Master Data's public directory. Target
branch/actor references also enforce their existing foreign keys.

From the repository root (Node.js with `--env-file` support):

```powershell
pnpm --filter @nora/database db:generate
pnpm --filter @nora/api... build
node --env-file=.env apps/api/scripts/shared-ticket-demo.mjs --config .runtime/ticket-demo-config.json
node --env-file=.env apps/api/scripts/shared-ticket-demo.mjs --config .runtime/ticket-demo-config.json --apply
```

If your env file is elsewhere, replace `.env` with its path. `NODE_ENV` must be
explicitly `development` or `test`; only loopback PostgreSQL connections with no
connection overrides and public schema are accepted. Without `--apply`, the tool
runs the same database constraints and then rolls back the entire transaction.
Amounts are decimal strings and dates are UTC. All imported references stay inside
the dataset. Stable ticket/fare IDs and a dataset audit marker prevent duplicates.
Existing unmarked IDs cause an error and leave the database unchanged.

Only on the original PC-A database, add `--adopt-source` to preview/apply. This
checks every existing offer/price/target against the snapshot before adding the
ownership marker. It does not overwrite edits, actors, prices or existing history.
A different branch or mismatched source record aborts the entire transaction.
Already imported marked offers are reused without resetting later edits or
unarchiving cleared tickets.

## Remove the trial dataset later

**No clear operation is performed as part of publishing this dataset.** When the
owner requests removal, preview and then explicitly apply:

```powershell
node --env-file=.env apps/api/scripts/shared-ticket-demo.mjs --config .runtime/ticket-demo-config.json --clear
node --env-file=.env apps/api/scripts/shared-ticket-demo.mjs --config .runtime/ticket-demo-config.json --clear --apply
```

Cleanup archives only matching dataset-marked offers in the configured branch.
The 11 currently visible trial offers disappear from catalog/price selection;
immutable fare, finance and contract history stays intact, matching the catalog's
normal archive model. This is **visibility removal, not physical history deletion**.
Active allocations, unexpired active capacity holds, or any attached tour block
cleanup and roll back the entire batch. Imported demo-only price targets are
deactivated only when no non-dataset offer references them; adopted original/shared
targets remain intact. An unrelated ticket, even with a snapshot ID but without the
ownership marker, is never archived. Repeated cleanup has no further effect.
Run import/clear on each developer's database: Git merge transfers the snapshot
and tools, not live database state. After clear, import does not restore the offers.

## Validation

```powershell
node --test apps/api/scripts/ticket-demo-core-checks.mjs
```

Tests cover the local-only guard, fixture boundaries/privacy, transaction rollback,
idempotent import, exact decimal comparison, archived visibility, explicit source
adoption, collision handling and namespace/branch-scoped cleanup with in-use
rollback. API build/typecheck/lint and a PostgreSQL rollback-only import preview
also validate runtime compatibility. No migration or operational-module writes.
