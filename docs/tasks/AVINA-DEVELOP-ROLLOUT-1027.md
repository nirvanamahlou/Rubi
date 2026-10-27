# Avina develop rollout — 2026-10-27

- Owner explicitly authorized updating Avina with develop; execution owner PC-A.
- Previous release: `d5dae6f4788a2a8f294b5a8c9116cbe83067a9c6`.
- Deployed release: `684d3ec5e5ade3817ada59a792bf47848dd023ff`, verified against remote develop before activation.
- API, Web and Worker use `rubi-production:684d3ec5e5ade3817ada59a792bf47848dd023ff`.

## Preparation and data preservation

The exact Git archive was checksum-verified on the server. Dependencies and lockfile were unchanged from the prior production release; target sources were built using its existing dependency installation. Historical migration SQL matched the prior release. The only pending migration was the reviewed additive `20261027120000_sales_hotel_stay_rooms`; it creates room-allocation child storage without modifying existing business records.

Encrypted database, document-volume and public-document backups were created and validated through decryption and archive inspection. Encrypted copies were downloaded off-server and their SHA-256 checksums matched. Backup and rollback materials remain outside Git; no credentials, real customer records or document contents are included here.

The shared deployment lock and comparisons of active compose/container state guarded the operation. Existing database, document and Redis volumes were retained. Database, Redis and scanner/signature container identities were unchanged. Runtime environment hashes matched before and after; the sole mount change was Web's versioned public directory. No seed or destructive migration ran. The previous application image and compose remain available for rollback; an application rollback must retain the additive table.

## Verification

- Existing exact-head hosted quality, type, test, build and database gates passed.
- On-server API/Web/Worker production build passed.
- Weekday-edit model (5), weekday-move interaction (4) and reservation-services rendering (3) tests passed in the new image without network access: 12 tests total.
- Isolated Web canary verified login, static assets and protected-page redirect before activation.
- Migration history was clean before and matched target sources afterward.
- Public login and API health passed after activation.
- Unauthenticated reservations redirect and Sales API 401 remained intact.
- Old and new browser static assets returned successfully; open clients retain access to their previous bundles.
- Selected deployed Web sources and API Prisma schema hashes matched the pinned release.
- All three application services remained running without restart after the stability check.
- Root filesystem retained approximately 21 GiB free after rollout.

Deployment was verified at 2026-10-27 07:24 UTC. This was a deployment and documentation task; it introduced no additional application changes or production business-data test fixtures.
