# LOCAL-HR-AGENCIES-009 — Agencies and current HR on localhost:3100

PC-B / `codex/pc-b-hr-agencies-local`, based on HR-008 `838c1eb`.

The owner requests the latest Agencies workspace on the same local application as HR. This branch imports the published B2B implementation from `codex/pc-b-agencies-organizations@fc573ac` (draft PR #113) into the current HR-008 checkout (draft PR #114). Both histories share base `30d67ec`; the imported delta is restricted to the B2B API, Organizations UI and its original task report. This is a review branch, with no merge to main/develop.

## Result and boundaries

- `/organizations` serves the current agencies/corporate directory, organization profile and connected B2B forms. `/hr` retains HR-008 unchanged; `/human-resources` continues redirecting to it.
- Existing app shell, IAM permissions, company selection, HR records and Documents storage remain unchanged. No schema, migration, shared contract, dependency or lockfile changes are introduced by this integration.
- Organization identities and contacts still use public Master Data APIs. The source B2B maker/checker gates remain in force: credit changes and creation of non-draft agreements cannot bypass approval. Unavailable Finance/Sales/Reservations projections remain explicitly unavailable. See `B2B-AGENCIES-001.md` for the source implementation's scope and remaining work.
- The agency source worktree and its preview are preserved. The only replaced listeners are the owned Web3100/API4190 processes from this checkout.

## Validation

- All 14 Organizations Web tests and 28 B2B API tests passed, including four isolated PostgreSQL transaction tests.
- Full Web/API lint and typecheck passed; API production build passed.
- The imported module files are identical to the published source. HR Web/API, Contracts and Prisma files are unchanged from HR-008.
- Production handoff checks: build the Web from the committed branch; verify `/api/hr-runtime` matches HEAD; authenticate with the existing scoped QA account; check both `/organizations` and `/hr`, directory search/profile navigation and mobile rendering; verify localhost and 127.0.0.1 login compatibility. Store runtime and browser evidence outside Git, and disable the QA account after checking.

## Local startup

From this checkout, after building the API:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File infrastructure/scripts/start-hr-local.ps1 -Build -Port 3100 -ApiPort 4190 -ApiEnvFile C:/Users/admin/Rubi-hr-foundation/apps/api/.env -DatabaseName rubi_hr_current_20260908 -DocumentStorageRoot C:/Users/admin/AppData/Local/Rubi/hr007-documents
```

Use `http://localhost:3100/organizations` and `http://localhost:3100/hr`. The independent HR-007 database/document snapshot is retained. Other checkouts, API4000, original databases and user passwords are not replaced. Credentials and temporary QA artifacts must remain outside Git.
