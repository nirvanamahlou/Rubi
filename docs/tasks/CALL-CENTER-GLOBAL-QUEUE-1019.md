# CALL-CENTER-GLOBAL-QUEUE-1019

PC-C; branch codex/pc-c-call-center-global-queue-1019 from package-two389ccec0. Owner requested moving branch selection into advanced filters and removing selected-branch filtering from request queue.

- Branch selector is rendered inside the existing middle filter grid; existing draft-discard confirmation and branch-scoped contacts/reports/registration remain.
- Queue defaults to ALL requests, including closed, across actor.branchIds. MINE/TODAY/OVERDUE/UNASSIGNED and new OPEN view remain available. Existing branch header no longer narrows queue; authorization still restricts the query before totals, title decryption or task selection.
- Each row returns branchId/name; details use the row branch, not selected contact-list branch. Queue title and explanatory text make scope explicit. Page size remains50 with stable updatedAt/id ordering.
- Existing Tasks matchingRequests public method accepts one branch or a branch array. No cross-module direct Tasks table access, migration, dependency or permission changes.
- PostgreSQL integration verifies identical authorized queues under different branch headers, inclusion of a closed request in another authorized branch, exclusion from OPEN and no leakage when that branch is not authorized.35 focused PostgreSQL/HTTP tests pass.
- Synthetic actual-component Chrome155/Edge155 checks confirm branch control inside filter grid, ALL default, keyboard/Escape/return focus, stale-search suppression and390px no-overflow. Authenticated owner acceptance remains a separate manual review.

Local deployment uses preserved durable-runtime worktree and API4000/Web3000. No PR/merge or production deployment authorized. API and Web contract changes ship together. See PROJECT_STATUS for final runtime and build results.
