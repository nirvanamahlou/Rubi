# CUSTOMER-002B — Independent completion

## Current sequential integration review — 2026-08-31

- This section supersedes the historical parent/lock/merge blockers below. The product owner explicitly authorized customer-chain review, conflict repair and sequential merges.
- Parents merged to develop: #25 `d73f51f`, #26 `a470d06`, #27 `eb2fe1e`, #34 `b5f06a2`. #41 is reviewed on top of that develop tree, preserving Master Data, shared UI and the new additive national-ID constraint.
- Resolved the duplicated service-test conflict by retaining the child organization-rejection regression together with the parent birthday-preservation/date-validation regressions. No parent correction is dropped.
- Status: `READY_FOR_MERGE` for this bounded slice; full CUSTOMER-002B remains `PARTIAL_DELIVERY`. DEC-OPEN-006/011, passport/foreign identity, secure Documents, retention, real customer merging and durable import/idempotency remain blocked.
- Review uses synthetic PostgreSQL 5435, API 4015 and Web 3115 with stable DPAPI-protected keys separate from all existing local environments. The historical runner below needs an externally provided persistent `MASTER_DATA_IMPORT_TOKEN_KEY_BASE64` on the merged Master Data baseline; this review never runs it against its existing 55432 database or changes that environment.
- Final integrated gates: frozen install, Prisma validate/generate/status, full lint/typecheck/build; 425 tests in 81 files (API 230, Web 154, database 22, contracts 16, config 2, worker 1; unchanged packages may use cache). Eleven migrations were applied to a fresh isolated PostgreSQL and seed ran twice during parent review; the same migration files remain unchanged in #41.
- All 17 original completion smoke assertions passed against this integrated tree, adapted only to the isolated review endpoints and credentials: organizations via public Master Data, two synthetic people, identity duplicate rejection, masked and encrypted contacts, audited/no-store reveal, omitted identity/date preservation, 200/409 concurrency, consent reason, companions, branch 403, KPI consistency, status history and authenticated Web HTTP 200.
- Handoff is explicit in WORK_ASSIGNMENTS: current Customer migration/shared-contract/central-status locks become RELEASED upon #41 merge. No implicit acceptance of open decisions and no claim that all Customer backlog is DONE. Main preview, old data/keys and PC-B PRs are preserved.
- The following sections retain the original task-time evidence. Parent/lock/merge status there is historical and superseded by this dated integration section; capability/security limitations still apply.

- Computer/owner: PC-A.
- Branch: `codex/pc-a-customer-002b-completion`.
- Baseline: `bcfb835` (PR #34 source, includes #26 fixes and #27).
- Status: PARTIAL_DELIVERY; shared-schema/security/integration scope remains blocked. Not merge-ready.
- Main checkout, database, encryption keys and preview ports 3100/4000 remain untouched.

## Remote evidence — 2026-08-31

- #25: MERGED, `d73f51fbcfac2d57b7662dd1ce598b183986c6b1`.
- #26: OPEN, ready, head `d50ec55d4d0c5a532015d8180b57f2ac825fe95e`; previous blocking COMMENTED review on old HEAD, no new approval/checks recorded. Unauthorized, conflict refresh and consent fixes exist and are ancestors of this baseline.
- #27: OPEN/DRAFT, head `6eab219453c0e09a14c124dfd3b1aa602e29d6af`, base #26 source; no review/checks recorded. Needs parent merge, retarget, final-basis gates and review.
- No PR merge, retarget or approval is authorized by this task.

## Shared-lock conflict

Remote WORK_ASSIGNMENTS requires sequential #25/#26/#27 merges before Migration, Central Docs and Customer Contract handoff. The conversation previously transferred Migration only. Explicit reconciliation has been requested; no additional shared file, Schema, Migration, Seed, dependency or root export changes are made pending confirmation. This task-local reservation records the Customers API/Web/test scope without editing locked WORK_ASSIGNMENTS.

## Security decision gate

DEC-OPEN-006 and DEC-OPEN-011 remain OPEN in origin/develop. No real travel documents, automatic deletion, customer merge or auto-merge will be enabled.

Proposed policy, NOT accepted: AES-256-GCM with versioned keys and independent HMAC; stable development keys outside Git; approved production KMS/residency; role-specific document access; short-lived Documents links; document removal 90 days after expiry/end of operational need unless legal hold; approved backup expiry. Retention periods, jurisdiction/residency, KMS provider and product/legal approval must be supplied before activation. Existing keys are never replaced.

## Independent implementation scope

- Restore person/organization, branch and update-date filters using the existing server contract.
- Restore organization creation and explicit customer/passenger role editing with existing persistence.
- Show incomplete legacy identity without blocking unrelated edits.
- Harden reveal lifecycle and request state handling without broadening permissions.
- Add validated import preview before any writes and retain masked exports.
- Test in a separate synthetic-only database; unsupported schema/API features remain explicitly blocked.

## Delivered delta

- Create organization profiles through the existing public Master Data selector; select customer/passenger roles without creating another person just to add a role.
- Restore person/organization, role, authorized branch, acquaintance and creation/update-date filters. Export uses these same filters across all pages. Role KPI counts no longer silently force PERSON; failed KPI requests are unavailable rather than zero.
- Preserve an omitted masked birth date and national ID on unrelated edits; reject invalid calendar dates and future birth dates. Mark legacy profiles without identity as needing completion.
- Invalidate delayed sensitive responses after tab changes, blur, visibility changes, customer changes and unmount. Preserve permission/reason/audit and 60-second remasking. Existing revealed-phone dialing links remain available.
- Distinguish timeline/audit 401 from 403/network failures. Existing #26 conflict refetch, retained draft and real consent reason fixes remain in the ancestry.
- XLSX preview requires confirmation before writes, reports invalid rows and within-file duplicates, canonicalizes identity digits and keeps errors attached to accepted source-row positions. Optional invalid fields are no longer silently skipped by the preview.
- XLSX controls: 5 MiB compressed, 20 MiB expanded, 100 ZIP members, 5,000 data rows; CRC/header checks; bounded streamed inflation; control-character, formula, macro, DDE, external relationship, traversal and encrypted-file rejection. Export cells use escaped inline text, not formulas.
- Database smoke revealed the existing `customers_kind_shape_check` forbids PERSON.organizationId. Do not pretend this is supported: API now rejects this input explicitly before persistence, and the passenger company selector is disabled with a handoff notice. No CHECK constraint was changed.

## Verification — this branch, not a merged develop tree

- Frozen install: passed, no dependency/lockfile change.
- Full lint and typecheck: passed.
- Full monorepo suite: 366 tests passed (API 186, Web 146, database 15, contracts 16, config 2, worker 1). Turbo reused unchanged-package cache; affected API/Web tests ran locally.
- Targeted Customers suites: API 86 and Web 75 tests.
- Production build: passed, including `/customers` and all 26 Web routes.
- PostgreSQL 18.1: all eight migrations in this baseline applied to an empty isolated database. Existing migrations are unchanged. Seed ran twice. Prisma validate and repeat deploy/status verify the existing database; no new migration is claimed.
- Authenticated synthetic smoke: 17 assertions passed, including two people, one organization through public Master Data API, national-ID duplicate rejection, encrypted contact/identity persistence, no-store reveal, audit without raw values, branch tampering 403, real status timeline, consent reason, companion constraints, atomic concurrent update (200/409) and authenticated `/customers` HTTP response.
- Browser interaction smoke is BLOCKED: the browser runtime exits before connection with Windows `apply deny-read ACLs`. HTTP smoke is not a substitute for visual/keyboard/auto-remask interaction proof. Some Web regression tests inspect component source; they are not full DOM interaction tests.
- Initial Next development generated files were malformed. Only this task's generated `.next/dev` directory was moved to a private backup, then regenerated; the final preview uses Production output. Main checkout `next-env.d.ts` was not touched.

## Local preview and isolation

- Web: `http://127.0.0.1:3102/customers`; API: `http://127.0.0.1:4002/api/v1`.
- Synthetic-only PostgreSQL: `127.0.0.1:55432`, database `rubi_customers_completion`, container `rubi-customer002b-completion-pg`.
- Stable local keys and synthetic account credentials live outside Git in `%LOCALAPPDATA%/Rubi/customer002b-completion/private-runtime.json`. They are never printed. Missing key state with an existing test container fails closed instead of replacing keys. No production-key rotation is implemented or claimed.
- Reproduce with `node tests/customer002b-local.cjs prepare`, `gates`, `start`, `smoke` and `database-check`. Requires the pinned pnpm/Node toolchain and Docker. Start only after confirming these isolated ports are unused; never stop the main preview to free ports.
- No main database connection, real customer fixture, main volume removal, main workspace change or existing encryption-key replacement occurred.

## Remaining capability and handoff matrix

| State                                         | Capability / required next action                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implemented and tested in this slice          | Existing person and organization profile workflows, role selection, filter/KPI consistency, legacy edit preservation, import preview/security, masked XLSX export, contact reveal hardening and timeline unauthorized handling. Existing encrypted Iranian identity/contact, consent, relationships and concurrency are regression-tested.                                                                                                                                                                   |
| Waiting for formal shared-lock reconciliation | Latin names, nationality/gender, stable business code, Iranian legal entity ID, foreign registration/travel identity, full encrypted street/postcode address, note history and permissions, person-to-organization relation, real mutation idempotency, dedicated export permissions/audited delivery, new KPI contract fields and staged identity migration. Do not force an Iranian ID on a foreign person or create a fake ID: the positive foreign-person workflow remains unsupported in this baseline. |
| Waiting for product/security decision         | DEC-OPEN-006: structured passport/visa activation, KMS/residency, retention, deletion and legal hold. The proposal above is not approval. DEC-OPEN-011: actual merge/auto-merge remains disabled. Global national-ID uniqueness exists in the inherited schema; approved ownership/dedup scope still requires reconciliation and a migration.                                                                                                                                                                |
| Waiting for public API from owner             | PC-B/Documents: upload intent, quarantine/scan result, scoped metadata, attachment authorization, short-lived download, retention/legal-hold/deletion contract. Customers will own structured person-document relations only after gates. Sales/Finance/Reservations/Customer Affairs must expose scoped customer summaries/events before purchases, travel, payments, checks, requests or tickets are shown.                                                                                                |
| Out of this implementation scope              | Developing or querying private repositories of those other modules, changing Suppliers/Accommodation/Date Picker Recovery, merging #26/#27, replacing production keys, importing real documents or changing the main preview.                                                                                                                                                                                                                                                                                |

### Explicit incomplete guarantees

- Import remains a client-orchestrated series of individually persisted API mutations, not an atomic/idempotent server import job. A later contact failure can leave the already-created profile. Server-side duplicate validation still applies; resumable jobs and durable per-row receipts require the schema/contract work above.
- XLSX template `customers-person-v2` is identified in the preview UI; a negotiated server-side template-version/import-job contract is not implemented. The current template requires name and Iranian national ID and does not claim organization/foreign-person import support.
- Masked export is still based on existing `customers.read` and branch scope. Dedicated export permission, sensitive export and secure file delivery are not implemented. No sensitive export was enabled.
- Existing address storage is a label plus city reference, not encrypted full-address storage. Do not use the label for a full street address. Notes, travel documents, retention/legal hold and cross-module KPI sources are not fabricated.
- Upgrade tests on the final merged develop baseline, real foreign identity tests, browser interaction tests, retention and storage-backed idempotency tests remain outstanding; full CUSTOMER-002B is not complete.

## Main preview UI follow-up — 2026-08-31

- PC-A, scope: Customers list filter cleanup on `codex/pc-a-customer-002b-main-preview`, explicitly requested in Screenshot (275).
- Task-local scope record only: central documents and shared locks are not modified by this UI-only follow-up.
- Remove person kind, status, role and updated-from/to controls. Retain branch, search, acquaintance, created-from/to and sorting controls.
- Old links no longer restore removed filters; list/KPI and XLSX queries use all kinds/statuses/roles and no updated-date restriction. Backend authorization and profile form fields remain unchanged.
- No database, schema, migration, dependency, lockfile or key changes. Preserve the pre-existing local change to `apps/web/next-env.d.ts`.
- Verification: Web tests 147/147, Web lint, Web typecheck, scoped Prettier and `git diff --check` passed. Production build and authenticated browser smoke were not repeated for this UI follow-up; preserve the running preview and its existing generated-file change. Existing Web/API listeners were not stopped.

## Branch-name follow-up — PC-A

- Reserved scope: Customers Web client, branch-label model, filter UI and their tests on the main-preview branch. Shared central documents remain locked and unchanged.
- Consume existing public IAM refresh response (`LoginResponse.user.branches`), shared with access-cookie refresh to avoid concurrent token rotation. No IAM implementation, permissions or contract change.
- Display real branch names only for IDs allowed by the Customers response. Keep UUIDs as internal selection values; unavailable names use an explicit unavailable state and retry, never a fabricated company label.
- Web regression tests cover real-name mapping, missing names, branch-scope intersection, shared refresh and retry. Browser verification was attempted twice but the trusted browser runtime exited before connection; no visual smoke result is claimed. Production build is not repeated in the active preview checkout to preserve its generated-file change.
- Passed: 151 Web tests, Web lint/typecheck, scoped Prettier and diff check. No API, database, shared-contract, dependency or lockfile changes.

## Merge prerequisites

Read-only `git merge-tree` against `origin/develop@d73f51f` reports conflicts in `WORK_ASSIGNMENTS.md`, `docs/PROJECT_STATUS.md` and `apps/web/src/modules/customers/components/customer-workspace.tsx`. No merge was applied. This branch deliberately preserves unmerged #26/#27/#34 ancestry instead of silently dropping existing features. Its incremental review range is `bcfb835..HEAD`; the PR against develop also contains inherited stack changes. Do not merge it until parents, shared-lock handoff, integration conflicts and final-basis review/gates are resolved. No other PR or branch was edited.
