# B2B-CONTRACT-CREDIT-001 — contract and credit workflow

PC-B / `codex/pc-b-b2b-contract-credit` / `C:/Users/admin/Rubi-b2b-form-runtime`.

The owner reported Screenshot527: the third step of the cooperation modal contained a disabled draft checkbox and unavailable-workflow notices. The replacement edits and persists contract terms for both agency and corporate roles, using the existing Master Data identity and existing B2B profile/agreement/credit aggregates.

## Delivered behavior

- Four-step RTL popup, shared Rubi Vazirmatn font, contract title/type/dates, currencies, services, payment method, settlement period/days/monthly cutoff, SLA, cancellation/refund terms, notes and reason.
- Dynamic per-currency Decimal limits, hard/soft control, due days, overdue behavior and bounded policy validity. No FX conversion or floating-point money conversion.
- Guarantee type/reference/amount/currency/issuer/dates/status and pinned Documents version. A deposit requirement is contractual metadata; actual deposits and receipts remain Finance-owned.
- Draft creation/edit, submit, independent approve/reject and a new revision after rejection/approval. Submitted content and history are immutable; an amendment does not overwrite the active revision. Future-dated amendments can be submitted but are approved on or after their start, keeping the prior active revision intact until then.
- Scoped list/detail and management popup in both organization dossiers, including credit and guarantee tabs, revision history, reasons and timestamped outcomes. Legacy agreements remain visible and can be completed with a revision.
- Actor/request idempotency, payload fingerprints, optimistic versions, profile-scoped transaction locks, overlap checks and transactionally written audit. All draft contributors, not only the original creator, are ineligible to review their own revision.

## Public boundaries and migration

Existing `/b2b/agencies/:organizationId` routes remain compatible for legacy consumers. New agreement collection/detail, draft, submit and review actions use the same module and aggregate. Organization/role and active currency resolution use the Master Data public directory. Documents owns access, scan, expiry and versions; B2B stores restrictive version FKs. Finance exposure remains unavailable and is never fabricated or written by this workflow.

Migration `20260909230000_b2b_contract_credit_workflow` preserves old records, adds role to profile uniqueness, revision/history and guarantee children, and per-revision/per-currency credit rows. Legacy null-revision policies retain their single-profile uniqueness. SQL guards preserve submitted content, child terms and valid approved revision pointers. User and Documents references have real FKs. Only the two approval permission catalogue entries are inserted; no user or role grant is included.

Draft writers need `b2b.agreement.read`, `b2b.credit.read`, `b2b.agreement.manage`, plus `b2b.credit.manage` when credit or guarantees are changed. Reviewers need the read permissions and `b2b.agreement.approve`, plus `b2b.credit.approve` for a credit/guarantee bundle. Branch access is enforced for all operations. Document attachment additionally requires Documents' own read permissions. The owner's decision is one independent reviewer; a bundle requires that one reviewer to hold both relevant approval permissions.

## Verification and operational handoff

The targeted disposable PostgreSQL suite passes all 12 tests, including exact large decimal values, simultaneous duplicate commands, concurrent edits/approvals, creator/editor self-review denial, immutable SQL history/children, rejected amendments preserving active terms, branch isolation, FK failures and audit-failure rollback. DTO/HTTP tests exercise nested validation and the separate review permission. Browser QA uses the actual React components against isolated mock ports for create/edit/two currencies/guarantee/review UI; it changes no operational business data.

A private custom-format database backup was restored to a disposable PostgreSQL container and this exact migration rehearsed successfully. Existing Master Data, Documents, IAM grants and six HR employee rows remain unchanged. The runtime preflight finds only this one pending migration. Private backup/evidence: `C:/Users/admin/Rubi-backups/b2b-contract-credit/`; none of those files belong in Git.

Runtime activation and final build/test evidence are recorded in the follow-up status entry. The current operational database has no role with B2B permissions. Assigning actual writer/reviewer access requires the owner's explicit account selection/approval; the implementation does not silently grant it.

This completes the reported contract/credit form and its versioned review workflow, not the entire B2B PRD. Remaining independent scope includes Finance exposure/booking enforcement, temporary limit increases, advanced rate resolution and Sales snapshots, signatory/delegation/travel models, and suspension/termination/notification workflows. See the updated PRD coverage report.

Validation before runtime handoff: API full suite 1,037 passed / 116 opt-in skipped; the 12 B2B PostgreSQL tests ran separately and passed. Web full suite passed 1,141 tests with one unrelated HR timeout under host load; that entire HR file passed all 42 tests on an isolated rerun. Organizations' final targeted suite passes 89 tests. Contracts 61 and Database 73 tests pass, and affected lint/typecheck/build gates pass (Web 40 routes). The two updated workflow/HTTP files passed 16 tests again after final validation edits.

Runtime coordination completed: Documents' owner explicitly transferred Web3100 PID16692 after PR131 merged into develop e07c0c6. That develop revision, including contrast a11865d and HR PR125/127, was merged normally into this branch. Only the transferred Web and this task's own API listeners were replaced. Documents' frontend remains byte-identical to e07c0c6; its five contrast component tests pass. The owner's pre-handoff browser evidence was white `rgb(255, 255, 255)` text on blue `rgb(21, 87, 184)` for all nine CTA links; a fresh authenticated check after this cutover is pending re-login and is not claimed as completed.

Migration applied at 2026-09-08T22:40:47Z to `rubi_hr_current_20260908`, after the exact-SQL restore rehearsal and a fresh pre-cutover backup. Before/after counts match: 12 organizations, 25 roles, 2 contacts, 18 documents and versions, 5 IAM users, 9 IAM roles, 177 role permission grants and 6 HR employees. Existing B2B aggregate counts remain zero. Private evidence is `C:/Users/admin/Rubi-backups/b2b-contract-credit/applied.json`; the fresh backup SHA256 is `a8bb016b125882b292d81a625fc7ff5c5f6b9b0acd4d294cc325d58cb46cb2ba`. No seed, business form submission or actual IAM grant was performed.

Final Web3100 PID7740 serves `a8c986d0efc2e609de0a0fa220dfb1ec1e3a0448`, fingerprint `hr005-54d77a794617c989`; API4190 PID17316 serves the same application source (its subsequent commit only fixes a test dependency). Both health/runtime endpoints respond successfully. A first build inherited an API URL missing `/api/v1`; the browser caught the failed directory load, and Web was rebuilt explicitly with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4190/api/v1`. The final served bundle contains the correct URL. Restart with that explicit build-time value and the existing private API env/database/storage configuration. Documentation-only commits after a8c986d do not change the running application source.

Final source validation: all four GitHub jobs pass for a8c986d (quality, full tests, production build and PostgreSQL18 migration/seed). The public Documents reference boundary adds four tests; the latest B2B/Documents targeted run passed 32, plus all 12 disposable B2B PostgreSQL tests. An initially missing NotificationsService constructor fixture argument failed CI typecheck; it was corrected, its four tests/lint/typecheck passed, and the final CI is green. PR132 contains the completed implementation and is ready for review without an automatic merge.

Remaining operational action: the final browser session requires re-login. The owner has been asked which real account receives writer permissions and which distinct account receives reviewer permissions. These access grants are not implied by selecting the review model and have not been made. Implementation and migration reservations are released; runtime ownership remains with this task until coordinated handoff.
