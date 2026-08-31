# MASTER-003-DEMO-BOOTSTRAP

Owner: PC-B. Date: 2026-08-31. Target: `develop`.

## Goal

The 78 safe Master Data fixtures are already versioned in Git, but PostgreSQL
rows are local to each computer. Provide discoverable repository-root commands
so PC-A and PC-B can preview or install the exact same realistic fixture pack in
their own local database after pulling `develop`.

## Safety and scope

- Reuse the existing 78-record, 40-catalog fixture graph and MasterDataService.
- Keep application startup and the general Prisma seed unchanged.
- Apply only after an explicit command acknowledgement.
- Retain the existing environment and target guard: development/test only,
  PostgreSQL on localhost/127.0.0.1:55432, and the named Rubi local/test database.
- Retain the enclosing transaction, advisory lock, Audit provenance,
  idempotency and protection of user-edited fixture records.
- No exchange rates, real PII, accounts, cards, credentials, external
  connections or documents are added.
- No Schema, Migration, API contract, Dependency/Lockfile, Customers or IAM
  change is part of this task.

## Developer workflow

After local migrations and private API environment setup:

```powershell
pnpm master-data:demo:preview
pnpm master-data:demo:apply
```

Preview performs the complete operation and rolls it back. Apply installs or
reuses the realistic synthetic fixture pack. The command itself supplies the
explicit acknowledgement; the lower-level script still accepts the original
environment acknowledgement for backward compatibility. The runner loads
`apps/api/.env` before Prisma generation and builds the API with its workspace
dependencies. An isolated worktree may set `RUBI_API_ENV_FILE` to its existing
private API environment file without copying or committing it.

## Verification

- Frozen install completed without a lockfile change.
- The repository preview command built Prisma, API and workspace dependencies,
  found/reused all 78 existing local fixtures across 40 catalogs, and rolled the
  operation back (`applied=false`, `created=0`, `reused=78`).
- CLI/fixture unit suite: 12 passed. Dedicated PostgreSQL 18 suite: 9 passed on
  a random isolated database; its apply/idempotency/rollback/visibility/Audit
  checks completed and the database was removed.
- Full project: lint and typecheck passed; 1,259 ordinary tests passed (API 669,
  Web 510, Database 61, Contracts 16, Config 2, Worker 1), with the 66 opt-in DB
  tests skipped in that ordinary run. The relevant nine were separately run and
  passed as reported above.
- Full production build passed for Web, API, Worker and packages.
- Two preflight command attempts did not execute application checks: the first
  ran tests before workspace builds existed, and the second passed an unsupported
  Vitest `--force` option. The corrected build-first targeted test and Turbo
  force execution passed; no code or safety guard was weakened to address them.
