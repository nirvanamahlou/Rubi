# Shared Rubi runtime — Customer Affairs, Excel and existing modules

## Authority and source

PC-B. The user explicitly requested a combined runtime on 3100, then separately approved Customer Affairs permissions for the existing administrator role only. Base `origin/develop@6a4e041` includes current Excel/B2B, registration-document upload and Workbench messaging. Customer Affairs operational/UI source `f34166c` was merged on `codex/pc-b-unified-customer-affairs-3100`, not on main/develop. Existing worktrees were not edited.

The merge preserved both Messaging and Customer Affairs reverse relations in User/Branch. Documentation conflicts retain both task histories. Organizations Web, Master Data API and Messaging API are byte-identical to the current develop base. No dependency/lockfile or new domain contract was introduced.

## Data upgrade

- Existing database: `rubi_hr_current_20260908`; existing storage: `C:/Users/admin/AppData/Local/Rubi/hr007-documents`.
- Local backup: `C:/Users/admin/AppData/Local/Rubi/backups/rubi-ca-unified-20260912.dump` (920533 bytes), copied from a PostgreSQL custom-format dump before upgrade.
- Backup restored to separate rehearsal database `rubi_ca_unified_verify_20260912`.
- Only pending repository migration was `20260912173000_customer_affairs_operational`. Standard Prisma migrate deploy succeeded on the rehearsal and current databases, adding nine Customer Affairs tables. Existing local feedback migration was neither reset nor overwritten.
- Users/branches/documents stayed at 38 / 5 / 44 on rehearsal and current databases.
- Exactly 19 Customer Affairs permissions were installed for the existing active system `administrator` role; other roles and user-role assignments were untouched. The change is recorded in IAM audit. Repeated rehearsal execution added zero grants. No global seed or credential reset was run.
- Backup and rehearsal database remain local for recovery. Do not restore the backup over newer live changes without explicit recovery approval. The additive schema can remain if code is rolled back.

## Runtime

Working directory: `C:/Users/admin/Rubi-unified-customer-affairs-3100`.
Web: `http://127.0.0.1:3100`; API: `http://127.0.0.1:4190/api/v1`.
The compiled public API address targets 4190; the existing launcher authorizes both localhost and 127.0.0.1 on 3100 in CORS. Existing secrets are loaded from the same local environment file without copying them into Git.

After building this worktree, restart with:

```powershell
./infrastructure/scripts/start-unified-local.ps1 `
  -ApiEnvFile C:/Users/admin/Rubi-hr-foundation/apps/api/.env `
  -DocumentStorageRoot C:/Users/admin/AppData/Local/Rubi/hr007-documents
```

The initial approved cutover additionally supplies `-PreviousRuntimeRoot C:/Users/admin/Rubi-excel-integration-runtime`. The launcher validates both listener owners before stopping either and rejects unknown checkouts. Logs are under ignored `tmp/unified-runtime`. Runtime identity is available at `/api/hr-runtime` using the existing diagnostic endpoint.

For later module changes, integrate into this combined source before rebuilding; do not replace 3100 with a feature-only checkout. Runtime handoff must still be coordinated and rechecked.

## Verification

- Frozen installation and Prisma formatting/generation succeeded without lockfile changes.
- Production build: all six build tasks succeeded; Web contains 46 routes.
- Database tests: 73 passed; Contracts: 70 passed.
- Full Web run: 1336 passed with one unrelated HR rendering test exceeding 5000ms under concurrent load. That entire HR file passed separately (42 tests), without changing its timeout or assertions.
- All 15 lint/typecheck tasks passed. Full API suite: 1230 passed, 135 optional PostgreSQL tests skipped. Separate affected CA/Messaging/IAM suite: 39 passed.
- Current runtime: source `09b3b18`, build `unified-vnpjB6iJEmubY1N0rxXr5`, Web PID1628, API PID12504. Both health/identity endpoints return 200. CA unauthenticated dashboard returns 401 with the correct CORS origin, preserving authentication.
- User signed in successfully. Browser verified actual CA overview and authorized report, eight existing agency rows, enabled Excel controls and the Excel import dialog (opened and closed without importing). No business record was created, edited or deleted during browser QA.
- Previous CA preview3102 and rehearsal API4192 were stopped after successful cutover. Old source/build and local backup remain available; no destructive cleanup or force-push was performed.
- Non-blocking existing `pg` concurrent-query deprecation warning appears in the API log; no startup or observed request failure. No claim of zero console/deprecation warnings is made.
