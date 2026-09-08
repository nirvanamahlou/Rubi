# HEADER-TODAY / PR #115 integration

The owner explicitly approved the date-header PR and PR #115 merging to develop. PC-B reconciles published `628012a` (HR007/008 plus Agencies) with `origin/develop@130606d` (latest PC-A Sales, Customers, Reservations and grouped sidebar).

## Conflict resolution

- Keep both chronological task histories in assignments, status and plans.
- Union the already implemented HR permissions with current Sales/Ticket/Reservations permissions; retain IAM version8 and existing Step-up contracts. No account or grant changes.
- Preserve all current Prisma models plus the published HR models/relations. Historical migration files are byte-preserved; no new or rewritten migration.
- AppModule keeps all producers, including HR, Sales and Notifications; grouped navigation and HR mobile header layout both remain.
- The date is an independent small PR. Existing source branches/worktrees stay unchanged and no force push or branch deletion is allowed.

## Runtime safety

The active dataset is `rubi_hr_current_20260908` on local PostgreSQL55432 and document storage is `C:/Users/admin/AppData/Local/Rubi/hr007-documents`. Do not substitute a stale copy. Backup/rehearsal precedes the ten existing pending additive migrations. No operational seed or permission sync is authorized by this integration.

Local migration history already differs from file checksums for Master Data foundation, advanced currency, hotel Excel import and HR durable workflows (beyond LF/CRLF). Do not rewrite history/checksums; validate the existing dataset via rehearsal and report this pre-existing drift separately.

## Gates

Prisma format/validate/generate, current Web/API/Contract tests, lint/typecheck and production build; CI migration/seed gate on a disposable PostgreSQL database; restored-data migration rehearsal with unchanged HR/customer/document/company counts. Browser smoke must identify the served commit and preserve current identity, four companies, date, HR and Agencies permissions without fabricating an authenticated user.
