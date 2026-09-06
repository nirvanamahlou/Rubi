# Customers / Documents / Passport preservation — PC-A

- User authorized preserving and separating all foreign local changes from Sales on 2026-09-05.
- This is an exact recovery snapshot, NOT a reviewed implementation or permission to deploy its migration. No PR is created. Do not merge this whole branch into Sales or the active Customers branch.
- Source: sales-contracts-001 at 8dbc5f45b7ff1b0fa958c2cbfe35c312ee0c8f80. All 27 files are preserved byte-for-byte in the local backup and this worktree; manifest SHA256 values describe the source bytes before Git newline normalization.
- Backup: ../sales-foreign-backup-20260905 (sibling of this worktree).
- Twelve files match the active codex/pc-a-customer-connections-0905 branch at 2014d01; fifteen differ. Customers owns customer/passport changes; Documents changes need its owner review; shared Button matches the existing Customers integration. Active owner worktrees are untouched.
- Schema/Passport migration and DECISIONS additions are preserved only, not approved, applied or published as final migrations. Migration/Central Docs/Sales locks remain with PC-A/SALES-CONTRACTS-001.
- Validation here is preservation integrity only (27 SHA256 checks and clean snapshot commit). Functional tests are not claimed. An owner must reconcile the delta against their active branch and run full gates before integration.
