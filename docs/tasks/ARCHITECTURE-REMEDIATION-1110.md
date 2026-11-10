# Architecture remediation — 2026-11-10

COMPUTER_ID=PC-B. Base: develop 3370748caf88df76aeccc4eb3ec2e837b37eb4ce.
The product owner requests implementation of the GitHub architecture/code review.
Work proceeds without orchestration or delegated writers. Preserve all existing
product behavior, authorization, financial atomicity and persisted data.

## Tracking

- [ ] Attendance service identity independent of browser sessions, current scope/revocation enforced.
- [ ] Safe diagnostic context for unexpected errors.
- [ ] Grouped messaging identity and unread-count reads.
- [ ] Bounded notification queries with exact authorized counts and assignment priority.
- [ ] Grouped attendance penalty calculations; preserve pending attendance-editor PR1511.
- [ ] Shared Web HTTP transport and coherent HR refresh.
- [ ] Versioned HR field adapters independent of translated labels; retain legacy records.
- [ ] HR encryption key rotation compatibility.
- [ ] Runtime domain integration, recursive architecture checks and focused behavioral tests.
- [ ] Reporting/marketing query and export bounds; memory-safe downloads.
- [ ] Explicit background processing ownership and lifecycle.
- [ ] Translation loading and UI responsibility separation.
- [ ] Actual architecture documentation and review completion evidence.

## Coordination and validation

Reserve only review-related implementation and tests, with no lockfile or dependency
version changes. Additional shared contract or schema changes must be documented
here before implementation. Open PR1511 overlaps hr.service.ts attendance editing;
do not overwrite that patch. Open HR profile/pay-document work is out of scope.
No production deployment, operational data changes or key rotation is performed.
Record exact tests, remaining work and delivery state; never equate a static
architecture check with end-to-end behavior or claim the entire report resolved
when only selected paths are addressed.

## Implementation evidence

- Daily penalties load policies and shared inputs once per branch and group
  punch reads for up to 50 attendance rows. Dense batches fall back to bounded
  per-day reads so the existing per-day data limit remains intact.
- The bell scans compact notification metadata in pages of 200 in a consistent
  database snapshot. It counts authorized unread rows, preserves assignment
  priority and fetches details for the selected rows only. Exact counting still
  visits unread metadata because route permissions are evaluated in contracts.
- The shared authenticated transport passed its six focused Web tests. The
  broader run reported failures in several UI suites before it was stopped.
  Baseline comparison and the current API/type checks are pending.

- Reporting now renders CSV, XLSX and PDF in a worker thread. The export entry
  point limits concurrent work to two jobs per API process. Rendering has a
  90-second deadline. The existing request still waits for the stored export.
  A durable queue and streaming row projection remain open.
- Ten reporting tests passed, including reading an XLSX produced by the worker
  and checking that the export flow stores the artifact with its configured retention.
- HR text validation uses explicit optional flags for reason fields. Renaming
  a translated field label can no longer change whether it is required.

- Document, profile attachment and report downloads authenticate the encrypted
  file in 64 KiB chunks. Delivery rereads and checks each ciphertext chunk
  against the verified digest before sending it. Downloads trade a second disk
  pass for bounded memory and preserve the existing encrypted file format.
  Malware scanning and upload still use the existing buffer-based interfaces.
- Ninety-nine focused Documents and Reporting tests passed. The tests cover
  multiple chunks and mutation after successful verification.
- Removed the attendance forms' extra list refresh after saving. The HR store
  revision is the single signal for that list to reload.
- The API compiler reached the local Node heap limit. A larger-heap check is
  required before delivery.

## HR encryption configuration

Existing ciphertext without a key identifier is read with the key named
legacy. To introduce a new key, configure HR_PRIVATE_ENCRYPTION_KEYS_JSON with
the existing key under legacy and the new key under a distinct identifier.
Distribute the same ring to every reader before setting
HR_PRIVATE_ENCRYPTION_KEY_ID to the new identifier on writers. Keep the legacy
key available for older ciphertext and command fingerprints. These settings
are secrets and belong in the runtime secret store. Existing deployments can
continue using the single key configuration.
