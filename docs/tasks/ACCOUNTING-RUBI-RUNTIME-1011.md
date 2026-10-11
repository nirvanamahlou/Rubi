# Accounting runtime on Rubi

Owner: PC-A. The user authorized develop integration and deployment on2026-10-11.

All future accounting changes use the Rubi repository and its `rubi` Docker Compose project. The accounting module is part of the shared API/Web application, not a separate application or database. Use `infrastructure/compose.apps.yaml`: Web3100, API4192, existing Rubi PostgreSQL. The previous standalone4217 accounting preview is retired after verified cutover. Preserve other Rubi modules and operational data.

The active runtime checkout is `C:/Users/admin/.codex/worktrees/rubi-latest-3100-1005/Rubi`, a clean worktree of `C:/Users/admin/Rubi` with the same GitHub Rubi origin. The development accounting worktree remains separate for edits and reviews. Fetch and deploy the approved merged revision to the clean runtime checkout; do not reset an unrelated dirty checkout.

Compose supports `RUBI_APP_IMAGE`, `RUBI_API_ENV_FILE`, `RUBI_PUBLIC_API_BASE_URL` and `RUBI_CORS_ORIGINS`. Existing defaults are preserved. Local secrets/configuration stay outside Git. Use an ignored runtime API environment file and a persistent local Compose environment file; never commit either. Database backups precede deployment of pending migrations. Review migration status and preserve existing data; never restore the isolated test database over Rubi.

The222 observed chart accounts and26 observed detail types are structural reference data. Transfer only this verified reference book into Rubi, preserving ledger hierarchy and type-reference relationships; no test IAM users, QA transactions, financial balances or FX data. Code is merged through PR778 only after the exact revision's quality, test, migration and build gates pass. Source-parity limitations remain in ACCOUNTING-ACCOUNTS-SECTIONS-1011.md.


## Verified cutover

PR778 merged at57793ab361d734dece7599e63bfa34fc72af9e60. Runtime source is the clean merged checkout. Image rubi-accounting-merged:f6335fec has the identical source tree and rebuilt API; both rubi application containers report healthy. Persistent local configuration: runtime-root/.env.rubi-compose and .env.rubi-api, both ignored. Preserve existing document storage mount C:/Users/admin/Rubi-b2b-crm-connections/.data/documents. Compose command uses --env-file .env.rubi-compose -f infrastructure/compose.apps.yaml up -d --no-build api web; never remove infrastructure orphans.

Fresh backup: task outputs/rubi-cutover-1011.dump. Migration and guarded transfer receipts remain outside Git. Reference book bba7b2bb-178e-47fa-938b-c22afba11737 resides in the existing authorized Rubi branch, with222 accounts and26 detail types and verified fields. Six existing users preserved; no journal transactions imported. Standard seven accounting permissions seeded only onto existing system administrator role; no new users, credentials or user-role assignments. API health200 and web login verified. Existing Rubi login is required for authenticated browser checks. Preview4217 is stopped; its isolated PostgreSQL container remains available as evidence and is not the runtime database.
