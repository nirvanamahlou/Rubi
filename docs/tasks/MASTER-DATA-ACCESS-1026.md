# Local Master Data registration access

Owner: PC-B. The user authorized two existing named local accounts to register
Master Data, and requested push and merge to develop on 2026-10-26.

The local accounts had no assigned roles. Added individual manual access
snapshots using the public `ManualUserAccessService`, which rechecks the active
administrator, uses revision conflict protection and writes an audit event.
No shared role was broadened and no other account or branch membership changed.
Real account identifiers and the before-state receipt remain outside Git.

The grant includes `master_data.read`, `master_data.create` and
`master_data.currency_rate.create`, Master Data navigation/resource controls and
editable field controls. It permits reference-data creation and exchange-rate
proposals; it adds no update, delete, import, approval or user-administration
authority. Hotel purchase-rate management remains a separate workflow.

The maintenance script is explicit and opt-in. It never runs during startup,
build or seed, never infers users from job titles, and requires exact existing
usernames, an active existing administrator and the expected local database.
Build the API first; execute from the same local environment as the API:

```text
node apps/api/scripts/master-data-registration-access.mjs --preview EXPECTED_DATABASE OPERATOR_UUID USERNAME [USERNAME ...]
node apps/api/scripts/master-data-registration-access.mjs --apply EXPECTED_DATABASE OPERATOR_UUID USERNAME [USERNAME ...]
```

Preview is read-only. All targets are resolved before changes begin. Each
account update is its own audited transaction; if a later account encounters a
concurrent change, review and rerun the preview. Repeated application is a no-op
when the requested grants already exist. Existing access selections are retained.

Local evidence: 20 focused tests and scoped ESLint passed. The apply changed
exactly two users; the subsequent preview reported zero pending changes.
Read-back checks verified every Master Data resource and editable field for both
accounts, audit records, unchanged other users and unchanged branch memberships.
No real reference records were inserted to test authorization. Users should
refresh their page or sign in again to refresh the displayed access snapshot.

No migration, schema, dependency, shared contract or application deployment is
required. Full hosted quality, tests, database and build gates must pass before
the authorized develop merge. The earlier local-only payment UUID fix is not
included in this branch.
