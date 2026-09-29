# API-FUNCTIONAL-QA-0928

- Owner: PC-B; branch: `codex/pc-b-api-functional-qa-0928`; base: `origin/develop@4013211f`.
- Scope: read-only inventory and full existing API suite across all modules; PC-B-owned Backend repairs for confirmed Workbench feedback and Documents defects. PC-A modules were not edited.
- Inventory: 39 API controllers, 333 route decorators, 184 write-route decorators in this snapshot.

## Invariants and repairs

1. Repeating the same feedback submission ID and payload must return its committed receipt, including when two requests race. A different payload/owner with the same ID remains a conflict. Only the winning transaction creates notifications.
2. Documents list/detail must not disclose owner, creator, original filename, download filename or version note for sensitive documents without sensitive-read permission. An anonymous Workbench feedback attachment must keep these fields hidden from other users even if they hold sensitive-read permission.
3. All Workbench feedback attachments, including older records with an inconsistent confidentiality value, are excluded from other users' general Documents catalogue and audit trail. Other users need sensitive-file permissions to preview/download even an older misclassified attachment, and response filenames are neutral. Metadata editing cannot change a feedback attachment's anonymity marker.
4. Feedback creation validates that every attached document's stored confidentiality matches the submission anonymity flag; a mismatched upload is rejected before persistence. For callers without `documents.sensitive.read`, every Documents list row and every aggregate derived from its predicate (including count and pagination totals) excludes CONFIDENTIAL and RESTRICTED documents for every supported filter combination. Explicit sensitive filters fail closed with zero results. The anonymous WorkbenchFeedback owner-only catalogue exclusion remains independent.
5. For any non-owner viewing an anonymous WorkbenchFeedback attachment, detail responses do not disclose source provenance or relations, regardless of sensitive-read permission. Redacted detail uses empty `sourceModule`, null source entity fields and an empty relations array; authorized owners retain normal provenance.

## Verification

- Full existing API suite after rebasing onto current `origin/develop` and rebuilding `@nora/contracts`: 210 files and 1,701 tests passed; 15 files and 175 optional tests skipped with default flags. Focused Workbench/Documents rerun: 18 files and 118 tests passed. API lint, typecheck, and production build passed.
- PostgreSQL form suites attempted only against disposable PostgreSQL 18 container `nora-test-apiqa-0928` on loopback port 55439. Both parallel and serial attempts timed out before assertions in the existing Node-to-Docker CLI stdin helper. An independent reproduction confirmed the helper issue; these suites cannot be reported as passed.
- Direct PostgreSQL smoke on a separate disposable database applied all 100 Prisma migrations, then created meal service, facility, and train type form records through `MasterDataService`; the stored normalized meal status/code, train model, and meal audit event were checked. Seed script timed out starting a transaction, but was not required for this smoke.
- No schema, migration, shared external contract, dependency/lockfile, operational data or live runtime changes.
- Privacy follow-up after independent review: 18 list-filter variants verify the same unconditional visibility predicate reaches both `count` and `findMany`; detail tests verify source provenance and relations are hidden for non-owners. The focused repository/service suite passes 56 tests, and API lint, typecheck and production build pass.

## Limit

The existing suite exercises many paths but does not constitute a proof that every one of the 333 routes or every possible input combination is bug-free. PostgreSQL-backed opt-in results and any unresolved route-level gaps must be reported explicitly.
