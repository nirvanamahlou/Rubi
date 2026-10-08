# MAIN3100-ROLLOUT-1008 — PC-A

The owner explicitly requests activating the merged hotel-table redesign on
localhost3100. This is a local runtime deployment, not a new feature, remote
main/develop merge, data reset or seed operation.

## Release and preservation

The isolated release checkout is `.runtime/releases/main3100-1008`, on
`codex/pc-a-main3100-rollout-1008`. It integrates develop@8b805570 (hotel PR743 and
package price-field PR744) with the root checkout's already tested login
presentation@042dd9af (PR745), retaining the current login rather than rolling it
back. Only append-only assignment/status documentation conflicted; both sides
were preserved. Integration source is02dafcb0. Root checkout, its branch/files,
other worktrees and the separate3210/4210 preview remain unchanged. PR745 and all
other remote PRs are not merged or updated by this deployment.

Frozen offline installation succeeds without lockfile or dependency changes.
Prisma client generation and Contracts/Config/Database builds succeed. API build
and27 targeted hotel editor/New Package/login/localization regressions pass.
Full Web production build and clean integration CI gate activation.

## Database and storage

The fixed local target is existing database `rubi` on localhost5432, role
`rubi_local`. Existing IAM/contact/import/document keys and the absolute document
storage directory are retained. The production TOTP configuration uses exactly
the pre-existing development HKDF fallback key, not a new key or credential
rotation. Web targets API4000; API uses the original CORS allowlist and antivirus
policy. No role assignments, permission seeds or synthetic records are introduced.

A full custom-format pg_dump is saved outside Git under the primary workspace's
`.runtime/main3100-1008/rubi-before-main3100-1008.dump`, with verified pg_restore
table-data listing, SHA256 manifest and normalized fingerprints for all257 public
application tables. Backup fingerprints match before and after the dump.

Exactly one reviewed released migration is pending:
`20261008073000_package_tour_price_fields`. It only adds nullable JSONB priceFields
to PackagePricingTourDraft and PackagePricingTourPublishedVersion. The deployment
helper permits exactly these two SQL statements and checks the plan against the
backup before execution. Application data fingerprints exclude only the two new
nullable fields so the data-preservation check remains meaningful across DDL.

Pre-existing historical checksum differences affect five older migrations. A
read-only schema comparison also reports legacy extra tables, columns, defaults
and constraint/index naming differences. Its generated reconciliation SQL is
NOT executed: no db push/reset, destructive drop, baseline rewrite, migration
resolve, historical checksum modification or automatic repair is permitted here.
These prior differences are recorded in the private backup manifest and must
remain exactly unchanged. They do not intersect the independently allowlisted
two-column addition. Any different pending SQL or changed backup/data/history
aborts activation. This deployment does not claim to repair legacy schema drift.

## Activation gates and recovery

Build with the main API address; do not copy the3210 build because its browser
API address targets the preview database. Start the new API and temporary Web3110
against the original database, verify health/readiness, route guards and asset
delivery, then replace only the validated root Next dev3100 process tree. Preserve
that root checkout and command for rollback. Stop only the owned3110 preflight
listener after successful3100 activation. No broad process kill, application/data
directory deletion or preview restart is authorized.

The final activation result is appended after smoke checks. Private launchers,
environment values, backups and runtime process/log manifests are never committed.
