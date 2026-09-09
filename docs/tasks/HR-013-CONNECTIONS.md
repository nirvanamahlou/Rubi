# HR-013 — HR module connections

COMPUTER_ID=PC-B. Base: origin/develop@e07c0c6. Branch: codex/pc-b-hr-module-connections.

User authorizes connections to every main-menu module. Deliver a durable, permission-scoped HR referral and response workflow in the source and destination workspaces, with source FK, optimistic concurrency, idempotency and audit. Dashboard and Reports consume the same scoped public projection; Ticket Management routes mission fulfillment through Reservations. Existing Documents and IAM public integrations are preserved.

Reserved files: apps/api/src/hr/**; apps/web/src/modules/hr/**; packages/contracts/src/hr/**; HR permission seed rows only; one additive integration outlet in apps/web/src/components/layout/app-shell.tsx; this task's assignment/status entries. No migration, lockfile, or existing destination domain mutation. Destination modules consume the HR public projection; HR never queries their tables. Source references use existing HrRecord.parentId and employeeId foreign keys. Referral content is explicitly shared by an HR manager; receiving it does not grant access to the underlying personnel record.

Contract: additive hr connections v1, producer HR API, consumers HR and all main-menu workspaces. Receiving permissions are additive and default-deny; seed defines permissions without granting them to users. Existing HR DTOs and endpoints remain compatible. Generic HR record commands cannot create, modify, delete or expose connection records.

Actual finance posting/payment, travel issuance and external device syncing require destination services/provider configuration that this baseline lacks. A referral acknowledgement or response is never a payment, reservation or access revocation receipt. Their integration status remains explicit; this task must not be reported as full execution of those domain operations.

UI assumptions: existing authenticated desktop/corporate application with responsive mobile support, existing Rubi components and AA keyboard/contrast target; PC-B owns this addition. No framework/rendering change. Performance budgets are design targets, not measured claims: p75 LCP 2500ms, INP 200ms, CLS 0.1; incremental lazy panel <=80KB gzip; Lighthouse accessibility >=90 and performance >=80. Server follows existing p95<500ms read target; p50/p99, uptime and RPO/RTO remain project decisions, not new architecture assumptions.

Preserve active Web3100/API4190 owned by B2B-DIRECTORY-ACTIONS-001; no live data QA or runtime replacement.

## Delivered behavior

- Main menu: 16 destination entries; 13 department inboxes, scoped Dashboard/Reports projections, and Ticket Management forwarding to the Reservations inbox.
- A source HR record can be referred from its detail view. Sender must hold hr.manage + hr.approve + hr.sensitive. It retains the source FK/version, employee FK, explicitly shared text and a UTC deadline. Approval-controlled sources must already be approved.
- The receiver sees only the shared snapshot in permitted branches. Each department needs its own hr.connections.<target>.receive permission. HR management alone never grants receiving authority. No sender or employee may respond to their own request.
- SUBMITTED → IN_REVIEW → ANSWERED, with rejection and sender cancellation. Final states cannot reopen. Every transition is audited; the response reaches the sender's HR notification feed. A business duplicate remains blocked while an open request exists, even with another idempotency key.
- Requests are isolated from generic HR records/bootstrap/export/update/delete; the specialized public service owns all transitions. Source records with referrals cannot be deleted through generic HR commands. No cross-module database reads were introduced.
- List is paginated, filtered and counted on the server before display. Deadlines use the full UTC timestamp, not the Date column. Shared text is escaped in the UI. The lazy outlet preserves existing destination workspaces.

## Activation / PC-A and runtime handoff

1. Review the branch/PR against develop; no merge is implicit. No migration or new dependency is required.
2. Rebuild contracts, database package (same Prisma schema), API and Web together.
3. Register the additive permission catalog using the existing HR maintenance process. The HR seed explicitly skips automatic assignment of receiving permissions, including for existing administrator/hr_staff roles. Assign only the chosen department's permission to its intended role through System management. No existing account/role was changed during this task.
4. Coordinate activation with B2B-DIRECTORY-ACTIONS-001, which owns the current combined Web3100/API4190 runtime. Preserve that task's newer B2B tree, current database and document storage. This isolated branch is based on develop, not the owner's unpublished runtime additions.

## Remaining from the broader integration request

This delivery is the shared referral/response layer, not completion of all domain automations in the original request. Finance posting/payroll consumption and receipts, procurement fulfillment, reservation/issuance, IAM lifecycle execution, employee-to-customer/account links, sales commissions/performance ingestion, centralized operational HR metrics, and biometric/provider synchronization still need their owners' executable public contracts and domain implementations. Device/provider setup and approved business rules cannot be replaced with a generic reply. No payment or access change is performed by these endpoints.

## Validation

- HR Web: 101 tests passed. HR API: 75 unit/domain/boundary tests passed. Authenticated PostgreSQL: 22 tests passed, including real referral/reply/idempotency/authorization/deadline checks in a randomly named temporary database that was removed by the test harness.
- Contracts: 63 tests passed. Database package: 73 tests passed. No tests were added that access live business data.
- API/Web/Contracts/Database lint and typecheck passed after fixing the new client effect lifecycle and reserved variable name. Database client generation used a synthetic codegen URL, not a live migration. Initial missing generated dependencies were built in this isolated worktree.
- Final API production build and Web production build passed (40 routes). Contracts and Database package builds passed. No migration or dependency changes.
- One legacy Web test initially timed out during simultaneous build load; the entire 101-test HR Web set passed sequentially without increasing test timeouts. The initial new PostgreSQL fixture was corrected to use the existing masked-contact format.
- Visual browser QA, live activation and measured performance targets are not claimed. No actual payroll/payment, reservation, purchase or IAM execution is claimed.
