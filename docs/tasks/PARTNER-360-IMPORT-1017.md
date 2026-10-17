# Partner dossier / import — PC-B — partial implementation

The user requested direct execution without worker-orchestrator, and authorized
push/merge. Do not present this unit as a complete Agency360 implementation.
Published as Draft PR https://github.com/nirvanamahlou/Rubi/pull/912 to develop;
hosted CI is running and merge remains held for the unfinished 360 scope.

## Implemented

- Supplier Provider ID hidden from the table; broker table already hides it.
- Meal/service creation omits code and lets the existing API generate it.
- Supplier geography uses scoped Master Data selectors beside its address.
- Both partner tabs expose XLSX template/preview/import with five columns:
  legal name, combined country/city, telephone, mobile, email.
- Existing safe Organizations XLSX ZIP/XML codec is reused without changing
  agency import semantics; formulas, external relationships and unsafe inputs
  remain rejected.
- `dossierVersion: '1'` opts into an atomic partner/organization/contact/address
  write. Legacy API producers remain unchanged. Only SUPPLIER or BROKER roles
  are created; never AGENCY. All phones/emails use existing authenticated
  encryption; ordinary reads expose masks only. Untouched contact edits are
  omitted and preserve stored values. Organization/contact/address writes have
  audit entries in the same transaction.
- Import retries serialize by resource/name/geography and skip an existing
  record without overwriting it. On an unknown write result the client stops
  rather than retrying every remaining row.

## Still required / do not merge as complete

Agency360 public B2B paths allow customer roles only and profile/rate queries
hardcode AGENCY. The complete role-compatible extension is not implemented.
Finance preview currently projects customer sales receipts; it must not be
reused for partner payables. Credit direction is confirmed by the user:
COUNTERPARTY_TO_US (they extend credit to our company).

Proposed producer/consumer handoff (not yet approved/implemented): PC-A Finance
publishes branch/permission-scoped supplier/broker payments, payable statement,
settlement and exposure snapshots through a public service/port; PC-B B2B
consumes these for SUPPLIER/BROKER roles. Preserve current AGENCY behavior and
never substitute missing exposure with zero. Procurement/Reservations purchase
references must also pass through their public contracts. Cross-role and
cross-branch isolation tests are required before a complete dossier can merge.

## Hotel logo — reproduced and locally corrected

On the existing local demo hotel `هتل آبیراه بسفر` (explicitly synthetic; no
reservations/contracts), selected the repository's public brand PNG, saved, and
observed successful attachment but HTTP409 quarantine preview. API runs in
Linux Docker, whereas its configured scanner implementation needs Windows.
Microsoft Defender on the Windows host is enabled.

`apps/api/src/documents/document-scan-worker.ts` is a standalone Windows host
companion using the existing Documents repository, encrypted storage and actual
Defender processor. It exposes no HTTP server and starts no unrelated jobs.
Required private environment:

- DATABASE_URL: same DB, via its loopback-published port.
- DOCUMENTS_STORAGE_ROOT: host bind source for the API's document storage.
- DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64: same private storage key as the API.
- DOCUMENTS_ANTIVIRUS_MODE: windows-defender.
- DOCUMENTS_ANTIVIRUS_COMMAND: installed genuine MpCmdRun.exe path.

Run from apps/api with Node's tsx import and
`src/documents/document-scan-worker.ts`; add `--once` for one batch. The existing
processor checks SHA256, scans decrypted temporary contents and records its
verdict/audit; scan/branch/ownership gates are unchanged. Do not mark CLEAN by
SQL or accept a stub scanner. Runtime secrets are not stored in this document
or Git and startup errors intentionally do not echo connection strings.

One batch converted both pending hotel files to CLEAN through genuine scans.
The UI then visibly displayed the saved logo. Screenshot outside Git:
`C:/Users/admin/.codex/hotel-logo-proof-20261017.png`.
Session companion PID19688 runs hidden on this machine for subsequent uploads.
It is not an installed Windows service and must be started again after reboot.
No Web/API image replacement occurred. The demo hotel retains the test logo;
no real business record was changed.

## Verification

- Eight focused Web suites: 86 passed.
- API meal/policy suite plus dossier policy: 52 passed.
- Dossier persistence: 4 passed.
- Antivirus/scan/storage: 7 passed.
- Isolated PostgreSQL18 full-migration/seed partner suite: 6 passed, including
  actual import, same-dossier edit and replay suppression for both resources.
- Translation coverage: 3 passed.
- Web/API types, API production build, scoped lint and formatting pass after
  refreshing generated Prisma declarations (no live migration).
- Full hosted CI and complete 360 remain outstanding. No merge confirmed.
