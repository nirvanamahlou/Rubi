# INTEGRATIONS-RUNTIME-PLAN-1019

COMPUTER_ID=PC-D. User explicitly authorizes updating the existing local Docker
runtime to the latest fetched develop and delivering a Persian test-site plan.
No external site has been supplied in this unit. No new GitHub publication,
external deployment, access grant or business transaction is authorized here.

## Frozen source

The branch starts at PC-D-Integration and fast-forwards to the explicitly
requested merged runtime source, develop@c5b267c4. Existing navigation PR947 is
included. Current local API1017-access-v2 and Web1018-navigation are a partial
older overlay, not that complete revision. Root manifests and lockfile are
unchanged against their existing build baseline, allowing reuse of the pinned
installed dependencies. A tracked-source archive replaces sources in a new
image; Prisma is regenerated and API/Web dependencies are rebuilt on Linux.
The source snapshot includes public assets, avoiding the old primary checkout's
outdated public mount. Existing API environment and document storage stay local.

## Database safety

Read-only preflight found150 applied migration records and no checksum drift
against the frozen source. Sixteen pending migrations were reviewed: additive
tables/nullable columns, widened representation and compatible checks; no user
or business-row purge or schema reset. A custom-format PostgreSQL backup was
created outside Git and restored into rubi_upgrade_check_1019. No business seed
is run. The clone must migrate successfully before the existing local database
is touched. Existing table counts are recorded and compared after upgrade.
Before cutover, stop only Rubi API/Web, take another consistent backup, apply
the reviewed migrations and activate the new image. No other Docker project,
volume, infrastructure version or external database is changed.

Rollback uses the previous images/configuration. Schema rollback is not
automatic: preserve additive changes and all post-cutover data; restoring a
backup over the local working database needs a separate concrete decision.

## Plan

[Persian test-site integration plan](TEST-SITE-INTEGRATION-PLAN-1019.fa.md)
documents the domain intake, read-only discovery, site/Rubi change inventory,
owner contracts, server-only credentials, SSRF controls, durable event delivery,
sync concurrency and replay, real KPI provenance, optional SSO and acceptance.
It explicitly distinguishes existing metadata management from unimplemented
generic connectivity and avoids promising zero defects or vulnerabilities.

## Verification

Build, restored-clone migration, local cutover health, data-preservation checks
and authenticated browser verification are pending; do not infer success from
the existence of this runbook. Final runtime receipts stay outside Git with the
backups and contain no credentials or business payloads.


## Resource failure before cutover

The first image build compiled Web JavaScript successfully, but did not complete
TypeScript. Docker reached zero swap and later returned HTTP500 for read-only
image listing; WSL diagnostics also timed out. Only our build CLI was cancelled.
Old Rubi Web/API were stopped to free memory. The user explicitly declined
stopping Ghestiroo, and no other project was stopped or restarted. The local
working database remains unchanged; only the restored clone was migrated.
Recovery permission is pending because restarting Docker affects other projects.
A second build recipe is prepared, with sequential API then supported Webpack
Web build and a bounded Node heap, retaining TypeScript and all build checks.
Its success is not assumed. Backups, source archive and both Persian plan formats
are available outside Git.

The engine subsequently recovered after cancellation, and starting the previous
Rubi containers succeeded. No Docker-wide restart or other-project stop was
performed. The second bounded-memory build is running; recovery permission is
no longer needed while the engine remains responsive.
