# Customer Affairs API and form functional QA — 2026-09-28

Scope: PC-B, branch `codex/pc-b-ca-api-functional-0928`, based on `origin/develop@4013211f`. No migration, seed, IAM grant, shared contract, dependency or running port-3100 process was changed. Synthetic inputs only; no real SMS, customer message, payment or destructive operation was performed.

## Endpoint inventory and exercised paths

The five Customer Affairs controllers expose 37 HTTP routes: dashboard/report/audit (4), request intake and follow-up (10), ticket intake and follow-up (17), public satisfaction (1), website bridge (2), internal referral bridge (2) and SMS (1). The 20 module API suites exercise domain/service policies, list filters, permissions, routing, workbench, site, SMS, SLA, reminders, reporting and the HTTP creation contract. The 13 Web suites exercise the API client, forms/components and list/report controls. Tests are not equivalent to a database-backed, authenticated end-to-end run of every route.

## Confirmed defect and correction

The travel-request form sent the same `sourceReference` for every manual intake. The database has `@@unique([branchId, sourceReference])`. On the second create, `createLead` caught `P2002` and returned the earlier lead without comparing its payload or idempotency command. The UI therefore could show success for the wrong request.

- The form now creates a distinct manual intake reference and retains a stable idempotency key and occurrence time for a retry of that submission. A synchronous submit guard prevents a double-click from sending two requests.
- The internal manual reference is rendered as “ثبت مستقیم در امور مشتریان” in request details, not shown as a technical UUID.
- The ticket form uses the same retry/double-submit guard. Invalid date conversion is caught and displayed instead of leaving either form stuck in a busy state.
- The API now replays only a matching idempotency command. A duplicate source with no matching command returns `409 LEAD_SOURCE_REFERENCE_EXISTS`, never an unrelated record.
- Regression tests cover the collision, actual HTTP create/400 validation for both forms, DTO boundary inputs, and forwarding of form idempotency keys.

## Verification

| Check | Result |
| --- | --- |
| API Customer Affairs suite | 20 files, 102 tests passed |
| Web Customer Affairs suite | 13 files, 57 tests passed |
| API/Web typecheck | passed |
| Focused API/Web lint | passed |
| API/Web production builds | passed; Web generated 53 routes |

The first Web suite run had one calendar test timeout under concurrent dependency compilation; its isolated rerun passed, and the final full Web run passed 57/57. The first run of the new DTO test lacked `reflect-metadata` setup; this was corrected and the final full API run passed 102/102.

## Not executed / remaining risk

- An isolated PostgreSQL Customer Affairs test environment was not configured for this worktree. The HTTP tests use a mock service; they verify routing/DTO validation but not persistence, transaction rollback or actual foreign-key behavior.
- No live calls to `sms.ir`, jahanbastan.ir or nystkt.ir were made. Existing adapter/service tests use doubles and cannot prove external delivery or webhook configuration.
- No authenticated browser E2E of this new branch was run on port 3100; that process belongs to the existing local workspace and was not replaced.
- The current HR public directory contract exposes employee lookup by employee ID, not validation of arbitrary selected IAM user IDs. The form picker is covered by existing tests, but invalid/stale HR-linked assignee selection still needs a producer-approved public validation contract and database-backed E2E.

These gaps must not be interpreted as passing tests or proof that all 37 routes are bug-free in production.
