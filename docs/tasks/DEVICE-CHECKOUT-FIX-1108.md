# Device checkout repair — 2026-11-08

## Production diagnosis and repair

Supersedes the cutover date in HR-RADAN-LIVE-1101. Read-only comparison of source clockings with native daily attendance confirmed that the primary device was corrected on raw2026-11-07: the preceding offset morning and corrected afternoon belong to the same business day. The previous2026-11-08 cutover incorrectly moved that afternoon to the following day.

After an encrypted database backup and private configuration snapshot, changed only `HR_RADAN_DATE_CORRECTED_FROM` to2026-11-07. Recreated API and its network-dependent worker using their existing images; Web, PostgreSQL and Redis containers were preserved. The existing authenticated connector completed full native reconciliation successfully. Both reported employees now have the source checkouts on yesterday; today's open days have null checkout, early-departure and deficit metrics. API and worker remain running without restarts. No source device writes, punch deletions, invented exits or direct SQL attendance updates. Private backup and verification receipts remain on the server, outside Git.

## Connector hardening

Preserve provider timestamp seconds; prevent neutral copies of explicitly directed punches from toggling attendance twice; restore only punches previously rejected by the provider when the same source ID becomes accepted. Manually archived punches, manual corrections, inactive days and closed periods remain protected. Timestamp precision repairs run even when displayed minute values match. Coverage includes the date-correction boundary, stable-ID movement and both-date reconciliation.

These source changes are separate from the completed production configuration repair and require a normal software release. No schema, dependency, credential, permission or migration change.

## Validation

55 focused tests across seven HR files pass, including provider pagination, date cutover, import replay, direction interpretation, manual correction and inactive-day protection. Final lint/build and hosted gate results are recorded in the PR.
