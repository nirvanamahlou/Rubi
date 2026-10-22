# Master Data logo persistence and Linux scanner — PC-B

## Authorized production continuation — 2026-10-22

The owner superseded the earlier push-only limit and explicitly authorized merge,
production installation/activation and logo save/display tests. PR1045 merged into
develop at29517a4013d545474df040186b49569ce06c5619 after all8 exact-head checks
passed on c8a945c014f03c0d31fb56b3addd6d404c399460. The missing five translations
were repaired; no quality gate bypassed. Direct execution, no worker-orchestrator.

Concurrent full-develop publication was detected by the runtime snapshot guard.
Initial candidates preserving the previous QR/city overlay were never activated;
final scanner image is based on the newly published29517 runtime. Existing API,
Web, Worker, database/Redis containers, document volume, public snapshots, native
permissions and runtime secrets are preserved. No migration or seed.

Encrypted PostgreSQL backups were fully decrypted/parsed to a null output without
database writes; encrypted documents and private configuration were backed up
again against the concurrent rollout's current snapshot. Rollback configurations
and previous images retained in private production handoff artifacts.

Official ClamAV1.5.4 x86_64 Debian package SHA-256:
28d6efc5b4423e7830c3559339552eb53870a9eac51ac4efb37d60530d329886.
Matches vendor GitHub release metadata. Real scanner proof passes CLEAN image,
EICAR=INFECTED, missing executable=SCAN_FAILED and absent signature DB=SCAN_FAILED.
Official Docker CVD digital-signature verification passes (daily28157,2026-10-18).
Upstream sources: https://github.com/Cisco-Talos/clamav/releases/tag/clamav-1.5.4
and https://docs.clamav.net/manual/Installing/Docker.html.

Operational distinction: HTTP uploads retain quarantine while the existing
standalone document-scan worker consumes the shared queue sequentially. This
avoids starting one memory-heavy ClamAV process per simultaneous HTTP upload.
Scanner has4GiB memory limit, no exposed HTTP port, existing private Documents
volume/key and read-only signature volume. API antivirus remains disabled only
locally to prevent duplicate inline scan consumers; the actual queued scanner is
enabled with the real absolute ClamAV command. Files remain unavailable until CLEAN.

Freshclam daemon is configured to refresh the persistent signature volume. The
upstream CDN currently returns403/cooldown until2026-10-23 05:56:39 UTC; TLS
validation was retained, no proxy/access-control bypass or fake signatures used.
Initial signed databases came from the official stable image. Automatic update
recovery remains an explicit operational caveat, not a claimed success.

HTTPS synthetic bank and hotel tests pass: create, PNG upload, new detail read
retains the real document reference, downloaded bytes match the uploaded bytes,
replacement changes the downloaded bytes, and both records advance to version3.
Independent authenticated browser reload displays both bank and hotel actual blue
PNGs in their logo columns (not placeholders). Screenshots retained locally as
bank-logo-proof.png and hotel-logo-proof.png; no real business logos were changed.
Both own synthetic records were removed through native versioned APIs and their
logos detached/archived; cleanup proof passes. Existing business records/logos
were untouched. Final HTTPS API health passes and both scanner/updater services
are running with zero restarts. Production artifacts and rollback config remain
private under the bounded logo-1022 / logo-1022-current rollout directories.

Contract v1, 2026-10-21; branch `codex/pc-b-master-logo-save-display-1021`.
User approves code, tests and push only. No merge, server installation, scanner
activation, deployment, seed or operational record changes are included.

Read-only production evidence: the two fixed brand archive reference codes are
missing; Linux API antivirus is disabled. No Master Data logo document exists.
Uploading a record alone succeeds but its separately rejected logo does not.

## Frozen security contract

- Documents remains the sole owner of files and reference metadata. Insert only
  missing fixed `BRAND_ASSET_TEMPLATE` / `BRAND_ASSETS` rows, after native update
  permission and selected active branch/active actor membership checks. Concurrent
  insertions are safe. Existing disabled or customized rows remain unchanged.
- Match established shared seed defaults (BRAND, INTERNAL, 25 MiB, established
  document MIME allowlist, no expiry); logo entry still enforces PNG/JPEG and5 MiB
  plus the existing global and document-type policies. No general seed execution.
- ClamAV uses a real, absolute executable on Linux, no shell, fixed arguments,
  generated private0700 temporary directory and0600 file. Clean only on completed
  exit0; exit1 infected; all process failures/other exits fail closed. Scan-limit
  alerts are enabled. No stdout content is exposed or used to infer clean status.
- Retain encrypted quarantine, SHA-256 verification, CLEAN-only image delivery,
  exact source/resource/record/branch authorization and private response headers.
- Preserve optimistic attach, failed-attach cleanup, reused-file protection and
  old-logo cleanup. Surface scan pending/failure honestly; no blank table cell.
- Existing exhausted scan jobs are not reset. No production recovery is claimed.

Security advice `/root/logo_security_advice` at base7b4fa80a identified four
implementation requirements LOGO-SEC-01..04, incorporated above. Shared-reference
defaults explicitly retain the existing seed policy to avoid affecting templates.
User subsequently requests continuation without worker-orchestrator. No further
orchestrator dispatch occurs; the lead completes implementation and direct review.
The already received read-only advice is retained as evidence, not final acceptance.
ClamAV exit/limit behavior source:
https://github.com/Cisco-Talos/clamav/blob/main/docs/man/clamscan.1.in

## Verification

Focused regressions cover reference repair and denied authorization, actual logo
upload/scan result propagation, CLEAN-only preview, CAS/cleanup, scanner exit/process
failure mapping, private temporary-file cleanup and Web preview/fallback behavior.
133 API and27 Web tests pass; scoped API/Web lint, formatting/diff checks and API
production build pass. Web compiled; its first type-check caught an optional
property in the new test, fixed before publication. Final Web production build
(all65 routes) and Web full type check pass. No real ClamAV engine
or production UI acceptance claimed: local tests use controlled process outcomes.

## Production handoff (not executed)

An administrator must deploy this candidate and install/configure a real Linux
ClamAV executable plus current signatures before previews can become available.
Use DOCUMENTS_ANTIVIRUS_MODE=clamav and an absolute executable path in
DOCUMENTS_ANTIVIRUS_COMMAND (default /usr/bin/clamscan). The command must exist
inside the actual API/scanner runtime, with access to encrypted storage and keys.
Test a clean synthetic image, the standard antivirus test fixture and missing
signatures before activation. A disabled/unavailable scanner never permits preview.
Signature updates and runtime packaging are operational work, not part of this push.
Missing brand references initialize on the first authorized upload without running
the broad seed. Existing inactive/customized policies still block incompatible
uploads. Old files that never uploaded must be uploaded again; exhausted scan jobs
require a separately authorized recovery, not an automatic reset.
