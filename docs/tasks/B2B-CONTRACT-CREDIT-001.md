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

Runtime coordination: Documents' owner confirms Web3100 PID15040 currently serves `C:/Users/admin/Rubi-documents-button-contrast-followup`, HEAD8c31bbf, contrast commit a11865d. Its final build/CI/merge/cutover is still active and explicit handoff is pending. API4190 remains owned by this task. No other task's listener is stopped; the final B2B runtime must retain the contrast fix and merged HR changes.
