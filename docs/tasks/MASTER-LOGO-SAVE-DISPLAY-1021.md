# Master Data logo persistence and Linux scanner — PC-B

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
property in the new test, fixed before publication; final full build/type checks
are recorded in publication notes. No real ClamAV engine
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
