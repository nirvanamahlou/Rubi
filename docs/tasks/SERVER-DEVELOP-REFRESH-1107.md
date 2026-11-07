# SERVER-DEVELOP-REFRESH-1107 — completed

The owner authorized latest-develop production publication and removal of one
unused old image. After the first image freed only about60MiB because its layers
were shared, the owner explicitly authorized unused build-cache and temporary
deployment-input cleanup. Completed backups, business data, original recordings,
current images and rollback inputs were preserved.

## Published revision and verification

Published develop `5f5f6ec8b80674640bd600579d45f1e89267a89a`, including reservation
form PR1468, combined-hotel PR1470 and calendar PR1469. The release pin was updated
before any live service change when the latter changes merged during preparation.
All four hosted checks on the final merge revision passed.

API, Web and Worker run `rubi-production:develop-5f5f6ec8b-1107-{api,web,worker}`.
All target source hashes were verified, with three existing translation overlays
retained. API/Worker source is unchanged by the final two Web-only merges, so the
validated full build was reused and Web was rebuilt for the final revision.

Validation:431 API checks and610 initial Web checks passed;512 final Web checks
passed, including Sales, reservation/PDF, calendar/notes and translation coverage.
Seven opt-in API checks and four Web checks were skipped in the network-isolated
candidate runs; hosted PostgreSQL migration/seed checks passed. Full production
builds, source verification and candidate login canaries passed.

Post-activation HTTPS login/health, old and new static assets, protected-route
denial, zero restart counters, Worker authentication and its exact API network
namespace, recent AMI connection and recording/network-guard timers passed.
Environment hashes and all unrelated service IDs were preserved; only the Web
public bind path changed to the preserved release directory. No human test call
or live financial transaction was created for verification.

## Database and backups

Applied reviewed additive migrations:

- `20261107090000_package_rial_conversion`
- `20261107120000_manifest_document_references`

Existing airline row fingerprints were unchanged. No destructive migration or
manual operational-data repair was performed.

Fresh encrypted database/documents/configuration archives were decrypted and
validated before activation. Final backup:
`/opt/rubi/backups/before-develop-5f5f6ec8b8-initial-1794051818`.
The earlier complete checkpoint from this same operation is also retained.
The final configuration archive excludes exact historical database-dump files
already retained on the server; their hashes are referenced and rechecked, while
the new DB dump captures current data. Live configuration, secrets, public
documents and remaining private files are included. This avoids recursively
duplicating historical encrypted database backups inside each configuration
backup. No sensitive backup left the server. The15-minute backup-age and2GiB
operational disk reserve checks remained enforced.

## Capacity and evidence

Removed exactly one unused untagged image:
`sha256:f2e6b0d898bd58d6c71b959cdf660483a6058fd14ec1bc133a24efc510793577`.
Every container, including stopped containers, was checked before removal; no
force removal or image/volume/system prune was used. Unused builder-cache cleanup
reclaimed no material space.44 explicitly selected unmounted generated contexts
and redundant source uploads were retired after inspection.1567 identical files
in unmounted historical public-code directories were deduplicated against the
preserved canonical assets; every path and all contents remain available.

Existing-artifact cleanup reclaimed approximately4.57GiB in total. After builds,
fresh backups and activation, available disk was3190276096 bytes (about2.97GiB),
versus about2GiB initially. Backups and business/document/recording volumes were
not deleted.

Protected receipts and logs remain under:
`/opt/rubi/server-develop-bd59eafd4-1107/`.
Key receipts: `verified.json`, `image-cleanup.json`, `temporary-cleanup.json`,
`extra-temporary-cleanup.json`, `extra-temporary-cleanup-2.json`,
`public-code-deduplication.json`, `build-verified.json`, `latest-tests.log` and
`latest-deploy-status.json`. The deployment record was appended.

PC-B/PC-C should fetch the operational branch for this receipt and the pinned
one-time release scripts. No further migration or server activation is pending
for this work item; rollback images and prior public directories remain intact.
