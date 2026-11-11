# Architecture remediation — 2026-11-10

COMPUTER_ID=PC-B. Base: develop 3370748caf88df76aeccc4eb3ec2e837b37eb4ce.
The product owner requests implementation of the GitHub architecture/code review.
Work proceeds without orchestration or delegated writers. Preserve all existing
product behavior, authorization, financial atomicity and persisted data.

## Tracking

| Scope | Implemented in develop | Remaining |
| --- | --- | --- |
| IAM and diagnostics | Dedicated attendance integration identity and safe unexpected-error context in PR #1600 | Validate runtime ownership when changing attendance sync |
| Messaging and notifications | Batched identities and unread lookups, compact paged metadata and exact authorization counts in PR #1600; verbatim chat text in PR #1603 | Exact notification counts still visit unread metadata |
| Attendance and HR | Batched penalty evaluation, explicit optional reasons and key ring in PR #1600 | Named field adapters for legacy positional records; distributed Radan execution |
| Web transport and locale | Shared HTTP retry on migrated clients and one HR refresh in PR #1600; lazy fallback index in PR #1604 | Migrate other clients and defer catalog transfer; split translation responsibilities |
| Reporting and Documents | Worker-thread rendering and authenticated chunked downloads in PR #1600; scan recovery and optional worker ownership in PR #1611; durable Reports workspace export and retry queue in PR #1631; streamed antivirus job input | Bounded database row projection and buffered uploads; legacy synchronous export endpoints remain available |
| Marketing and Finance | Server pages for promotions and campaigns in PRs #1608 and #1613; scoped HR referral projection in PR #1614; scoped Reservations purchase projection in PR #1626; bounded ticket revision reads and field-selected Sales receipts in PR #1628; page-only FX enrichment in PR #1629; cursor batches replace silent Sales and Procurement source limits; audience groups filter and paginate in PostgreSQL with exact scoped totals | Other Marketing collections and end-to-end Finance inbox pagination, including bounded global filtering and totals |
| Module boundaries | Recursive repository import guard in PR #1600 | Explicit public ports, transaction abstractions and ownership for direct database reads |

The architecture and deployment baselines now distinguish checked-in behavior
from target design. The API repository guard also covers static re-exports,
type references and literal dynamic imports or require calls.

The Finance inbox reads only the latest projected revision per authorized
procurement invoice. The Procurement source handoff scan remains separate.

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
- Compatibility document reads fill one result buffer from 64 KiB chunks
  and return it only after authentication. ZIP/OLE still needs the result
  buffer, without the previous full ciphertext and plaintext copies.

- The bell scans compact notification metadata in pages of 200 in a consistent
  database snapshot. It counts authorized unread rows, preserves assignment
  priority and fetches details for the selected rows only. Exact counting still
  visits unread metadata because route permissions are evaluated in contracts.
- Archive and incoming multipart uploads stream directly into encrypted
  storage. ZIP/OLE validation and other internal upload callers still use
  buffered inputs.

- The shared authenticated transport passed six focused Web tests. The final
  PR #1600 revision also passed the hosted quality, build, test and migration checks.

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
  Antivirus jobs hash streamed plaintext while writing their private temporary
  input file. Uploads and the demo scanner still accept buffers. Storage writes
  encrypt in 64 KiB chunks without copying the full ciphertext. Both report
  export paths now stream output from the rendering worker into this storage
  writer. The worker sends one chunk at a time and waits for its consumption.
  Report rows and multipart uploads still produce buffered inputs.
- Master Data logo deduplication uses an exact scoped document projection
  and bounded stored-object authentication before reusing the existing file.

- Ninety-nine focused Documents and Reporting tests passed. The tests cover
  multiple chunks and mutation after successful verification.
- Removed the attendance forms' extra list refresh after saving. The HR store
  revision is the single signal for that list to reload. The bootstrap store shares
  overlapping refresh requests and starts a fresh read after a committed mutation.

- Purchase FX evidence reads only the projected money fields for visible
  foreign-currency purchase versions. Bound OR predicates in batches and
  preserve the branch and revision checks used for exact comparisons.

- Finance pages count and summarize the complete filtered set in one pass.
  Ranking keeps only the best rows through the requested page endpoint and
  sorts those candidates. The legacy listing and export order are preserved.
  Source collection and deep offsets still need database-backed pagination.

- The travel facts fallback folds eligibility, groups, currency totals,
  filter options and source timestamp in one traversal. Its input can be a
  single-use iterable. Fallback preview and exports feed this aggregation in
  1,000-row keyset batches from a single read-only repeatable snapshot. Native
  source streaming and grouped output materialization remain open.

## HR encryption configuration

Existing ciphertext without a key identifier is read with the key named
legacy. To introduce a new key, configure HR_PRIVATE_ENCRYPTION_KEYS_JSON with
the existing key under legacy and the new key under a distinct identifier.
Distribute the same ring to every reader before setting
HR_PRIVATE_ENCRYPTION_KEY_ID to the new identifier on writers. Keep the legacy
key available for older ciphertext and command fingerprints. These settings
are secrets and belong in the runtime secret store. Existing deployments can
continue using the single key configuration.

- Named adapters now decode daily and hourly leave request rows and classify approved attendance credit components. Other positional HR record types remain open.
