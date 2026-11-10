# Issabel recordings on demand — PC-C — 2026-11-10

User requirement: do not persist call audio in ERP PostgreSQL; fetch from Issabel
only when an authorized user requests a download. Existing executive-only access
is unchanged. Existing stored audio is not deleted by this change.

Default `ISSABEL_RECORDING_STORAGE_MODE=REMOTE` blocks every database upload
phase and background expiry/publication job. Explicit `DATABASE` is retained for
legacy integration tests and controlled rollback compatibility only. No automatic
database fallback is permitted when the PBX source is unavailable.

CustomerAffairs supplies an authorized ended-session root through its existing
public media context, validating the encrypted identity against its fingerprint.
Integrations checks its active connection, records a small audit receipt, enforces
a per-user request limit and calls a root-only same-host Unix socket. Neither
source filenames nor PBX credentials are returned to the browser.

The host gateway reuses pinned SSH and the reviewed read-only PBX source script.
Each request proves CEL/CDR linkage, finalization and file confinement. Opaque
identifiers are deterministic and root-bound; downloads revalidate identity,
quiet-file checks, WAV size and SHA256. Audio is buffered transiently in memory,
with two source requests at most, and is never written to disk or the ERP database.
The API socket bind is read-only; the private directory/socket are root-only.

Deployment must use the shared deployment lock, current image/config guards,
verified encrypted backup, bounded API image and Worker network namespace
recreation. Other service images, credentials, VPN and PBX configuration remain
unchanged. Install the gateway unit and API socket bind; set storage mode REMOTE.
Replace the old importer unit's ExecStart using `recordings-health-only.conf`:
the existing timer becomes a socket health check, preserving deployment health
compatibility without importing any audio. Do not restore the importer on failure.

2026-11-10: the old importer timer was disabled and its service stopped under the
deployment lock before implementation, preventing further periodic DB uploads.

Acceptance requires an actual authorized WAV download, negative nonexecutive
authorization, unchanged recording/chunk row counts across repeated downloads,
healthy public ERP, authenticated Worker and connected AMI. Availability and
retention of new downloads now depend on recordings retained on Issabel.
