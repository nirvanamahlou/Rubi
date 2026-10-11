# Accounting runtime on Rubi

Owner: PC-A. The user authorized develop integration and deployment on2026-10-11.

All future accounting changes use the Rubi repository and its `rubi` Docker Compose project. The accounting module is part of the shared API/Web application, not a separate application or database. Use `infrastructure/compose.apps.yaml`: Web3100, API4192, existing Rubi PostgreSQL. The previous standalone4217 accounting preview is retired after verified cutover. Preserve other Rubi modules and operational data.

The active runtime checkout is `C:/Users/admin/.codex/worktrees/rubi-latest-3100-1005/Rubi`, a clean worktree of `C:/Users/admin/Rubi` with the same GitHub Rubi origin. The development accounting worktree remains separate for edits and reviews. Fetch and deploy the approved merged revision to the clean runtime checkout; do not reset an unrelated dirty checkout.

Compose supports `RUBI_APP_IMAGE`, `RUBI_API_ENV_FILE`, `RUBI_PUBLIC_API_BASE_URL` and `RUBI_CORS_ORIGINS`. Existing defaults are preserved. Local secrets/configuration stay outside Git. Use an ignored runtime API environment file and a persistent local Compose environment file; never commit either. Database backups precede deployment of pending migrations. Review migration status and preserve existing data; never restore the isolated test database over Rubi.

The222 observed chart accounts and26 observed detail types are structural reference data. Transfer only this verified reference book into Rubi, preserving ledger hierarchy and type-reference relationships; no test IAM users, QA transactions, financial balances or FX data. Code is merged through PR778 only after the exact revision's quality, test, migration and build gates pass. Source-parity limitations remain in ACCOUNTING-ACCOUNTS-SECTIONS-1011.md.
