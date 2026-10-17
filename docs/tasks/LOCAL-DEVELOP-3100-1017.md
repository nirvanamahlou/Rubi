# Latest merged develop on local3100 — PC-B — delivered

The human explicitly requested all latest merged develop changes on port3100.
No source feature work, seed or operational import was authorized or performed.

## Deployed version

- Exact source: `8a380e104285db15ae93944f738dd631ba1aff48`, re-fetched and confirmed
  still latest after cutover. This includes merged PR912 and PR913, not Draft910.
- Image for both services: `rubi-develop:8a380e10-3100`.
- Web: loopback3100; API: loopback4192. Both Docker health checks pass.
- `/api/hr-runtime` reports `develop-8a380e10` and the same full commit.
- Full develop CI was successful before deployment.

The original primary checkout keeps its existing user edits. Implementation and
report branch: `codex/pc-b-local-develop-3100-1017`. The clean, detached runtime
checkout advanced from aacb79db to the exact source above. Its private Compose
image pointer was updated; credentials were not printed, committed or changed.

## Packaging and validation

Both previous images have the identical pnpm lock hash as the merged source, so
their existing Linux dependencies were reused without installing or changing a
dependency. An exact Git archive supplies all tracked source/public files.
Shared Contracts/Config/Database and API were rebuilt from the pinned source;
generated Prisma artifacts were refreshed without modifying schema sources.
The Linux smoke with the actual private runtime configuration successfully loads
AppModule, native argon2 and Database modules without starting a second API.
An initial no-environment import correctly failed configuration validation;
the actual-configuration smoke then passed. No validation gate was bypassed.

Packaging artifacts are outside Git under
`C:/Users/admin/.codex/tmp/rubi-develop-8a380e10-3100/`.
No unmerged source or partial cherry-pick overlay is included.

## Database and storage

Before migration, a custom-format pg_dump was copied outside Git and its archive
directory successfully read with pg_restore:

`C:/Users/admin/.codex/backups/rubi-before-develop-8a380e10-20261017.dump`

- Size:2037490 bytes.
- SHA256:`A3283ECD301FA8A432A7650232134E9165908AFF259A2755BB964E8A17D0F48A`.
- Matching private API/Compose configuration backups are also retained there.

Only these pending, already-merged migrations were applied:

1. `20261015123000_optional_operation_reason`: relaxes the reason-only receipt
   adjustment check while preserving nonzero finite numerical guards.
2. `20261017103000_finance_purchase_fx`: adds an empty immutable FX snapshot
   table/FKs/index/trigger; no existing business rows are changed.

All156 source migrations are now applied. No failed migration existed before
the operation. Do not edit already-applied migration files or drop the FX data
to roll back application images.

Before/after counts matched: hotels5, suppliers10, brokers2, organizations158,
contacts302, documents37. The private API environment file's SHA is unchanged.
The existing Documents host bind is unchanged. PostgreSQL, Redis, MinIO and the
unrelated sales database/Redis containers were not recreated or deleted.

The real Windows Defender companion PID19688 remains active against the same
database and encrypted storage. It is a session process, not a reboot service.

## Actual UI smoke

Using the existing authenticated browser session, reloaded the supplier page and
confirmed the new Excel-import action, Provider ID-free table, and create form's
country/city/address/mobile/email controls. Closed the untouched form without
saving; no operational data was imported or edited.

Screenshot outside Git:
`C:/Users/admin/.codex/develop-3100-8a380e10-proof.png`.

## Rollback

Prior images are preserved:

- API:`rubi-workbench-merged:aacb79db`.
- Web:`rubi-workbench-merged:hr-status-1017`.

The temporary packaging folder contains a Compose rollback override with these
exact separate images. The prior runtime checkout commit and private Compose
backup are preserved. A compatible application rollback must retain DB/storage;
restoring the DB dump is a separate, potentially data-losing operation requiring
fresh assessment, not the automatic first action.

No GitHub feature merge or stable/production deployment belongs to this rollout.
The report branch is separate from the pinned application source.
