# Avina session stability release — 2026-10-25

The owner explicitly authorized publishing the already merged session-stability fix in PR1115. The release applies only its seven Web runtime changes to active base `e266e049f760d27769e8425ca70d66e1373778d6`; it does not publish unrelated newer develop changes.

## Verified release

- Fix revision: `5d1a303d4a47aa6e4bae4de1ace6edd756b2179d`.
- Active Web image: `rubi-production:session-stability-5d1a303d4a47`.
- Publication receipt: `20261025T110102Z`.
- Verified encrypted backup: `/opt/rubi/backups/before-session-stability-20261025T110102Z`.
- API and Worker retain the previous base image. Database, Redis, scanner and signature services retain their original container identities.

The runtime patch uses an isolated Git index and exact baseline/source hashes. Active sources differed from the recorded Git blobs only by CRLF endings; normalized equality and exact active-file hashes were both checked. No package, schema, migration, permission grant or business-data command was added.

## Verification and preservation

The Web production build,50 focused in-image tests and isolated canary passed. HTTPS login and API health return200; new and retained old static assets are reachable. Refresh-only browser navigation reaches the recovery shell, anonymous navigation redirects to login, and protected API access still returns401. Source hashes, environment digests and all mount paths/options match the approved candidate. API/Worker/data services were not recreated, preserving current user sessions.

Database, documents and private configuration backups were encrypted and stream-validated entirely on the server. A compose digest and shared deployment lock guard activation; the previous Web image remains available for rollback. The first attempt safely rolled back because mount-list ordering was compared literally; the final comparison sorts by destination while requiring every mount field to match. Final activation and an independent public health check succeeded.

Private deployment scripts, source manifests and detailed receipts remain outside Git. The publication updates Web only; a future full release must preserve this fix or include PR1115 from develop.
