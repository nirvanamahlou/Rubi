# HR-013 — HR module connections

COMPUTER_ID=PC-B. Base: origin/develop@e07c0c6. Branch: codex/pc-b-hr-module-connections.

Initial referral implementation: `93c0a7e`. PR: https://github.com/nirvanamahlou/Rubi/pull/139 (base develop). The owner subsequently explicitly requested bidirectional form references, push and merge. The same PR includes that follow-up, with merge gated on its final head checks. Local runtime activation is separate.

User authorizes connections to every main-menu module. Deliver a durable, permission-scoped HR referral and response workflow in the source and destination workspaces, with source FK, optimistic concurrency, idempotency and audit. Dashboard and Reports consume the same scoped public projection; Ticket Management routes mission fulfillment through Reservations. Existing Documents and IAM public integrations are preserved.

Reserved files: apps/api/src/hr/**; apps/web/src/modules/hr/**; packages/contracts/src/hr/**; HR permission seed rows only; one additive integration outlet in apps/web/src/components/layout/app-shell.tsx; this task's assignment/status entries. No migration, lockfile, or existing destination domain mutation. Destination modules consume the HR public projection; HR never queries their tables. Source references use existing HrRecord.parentId and employeeId foreign keys. Referral content is explicitly shared by an HR manager; receiving it does not grant access to the underlying personnel record.

Follow-up reservation also covers an additive Master Data currency directory/export, Documents upload source selection and public HR validation, and employee selectors in Finance, Customer Affairs and Module Foundation forms. The minimal HR directory is a separate Nest module to avoid a Documents ↔ full HR module cycle. Existing IAM user and HR document foreign keys are reused; Documents retains its existing polymorphic source reference contract. No new table relationship is represented as a fabricated foreign key.

## Form reference follow-up

- `GET /hr/form-references` reads active currencies through Master Data's public directory. HR managers also get active IAM accounts in their branches, excluding accounts already claimed by another employee (including archived personnel). Edit hydration includes the current employee's account. No email, role list, login history or account credentials are returned.
- Employee create/edit now offers the actual account choices and persists `HrEmployee.userId`, including explicit unlink. Existing identity/branch validation, unique FK, version checks and audit remain authoritative. This connects HR self-service and notifications to the same IAM identity used as operator/owner elsewhere; employee IDs never substitute for user IDs.
- HR monetary fields load currency codes from Master Data. Saving checks the current active catalog and persists the existing Decimal amount/currency representation. Deactivated/unknown codes are rejected transactionally. Historical saved amounts remain readable.
- HR file fields can search/page through existing authorized HR-domain Documents in the selected branch. Selecting a file sends `document://<id>` plus `data.documentId`, persists the actual HR document FK and does not re-upload the file. Create/edit/photo attachment now enforce the record's branch, even if the actor can access multiple branches.
- Documents upload can select a personnel case directly from HR before any document relation exists. The selected employee ID is sent through the existing source contract; Documents asks the public HR directory to validate the employee/branch and derive the authoritative label before writing storage. A personnel source requires an HR document type and `documents.hr.read`. Changing branch/type/source clears the incompatible selection.
- `GET /hr/directory` is a minimal, searchable, paginated projection (50 employees per page). Selection lists exclude deleted/inactive employees and other branches. The projection contains only employee ID, name, personnel code, branch, linked user ID, unit and position. It grants no HR bootstrap or private-record access. Read authority is `hr.directory.read`, existing HR branch read/manage, or `documents.hr.read` for the personnel-case consumer. The new permission is defined but not granted to existing users by maintenance.
- Finance's party field, Customer Affairs' follow-up owner, and Module Foundation owner fields (including Tasks/Purchases) now offer actual HR choices and retain the employee ID separately from the label. Their baseline forms have no persistence backend and continue to say so; selecting a real employee does not create a payment, task or procurement record.
- Internal HR reference data is keyed to the store revision so previous-page catalogs are not reused after mutation; inactive employees are excluded from role/person choices, and employee company options use the fully loaded catalog.

The remaining menu modules either consume the referral/response projection or already identify staff through IAM. Customer/passenger and agency-contact fields remain owned by their own domains: a personnel record is not automatically copied into a customer/contact. No dedicated employee field was invented for forms that do not have one. General address text, narrative fields, legacy unit/position labels, and provider/account configuration are not new relational models in this change.

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

1. The owner explicitly authorizes merging this PR to develop after final exact-head CI succeeds. No migration or new dependency is required.
2. Rebuild contracts, database package (same Prisma schema), API and Web together.
3. Register the additive permission catalog using the existing HR maintenance process. The HR seed explicitly skips automatic assignment of receiving permissions and `hr.directory.read`, including for existing administrator/hr_staff roles. Assign only the chosen department's receiving permission and, where required for form selection, `hr.directory.read` through System management. Existing HR read/manage and Documents HR read already authorize their corresponding selectors. No existing account/role was changed during this task. Currency definitions must be active in Master Data before new HR money records can be saved.
4. Coordinate activation with B2B-DIRECTORY-ACTIONS-001, which owns the current combined Web3100/API4190 runtime. Preserve that task's newer B2B tree, current database and document storage. This isolated branch is based on develop, not the owner's unpublished runtime additions.

## Remaining from the broader integration request

This delivery includes the referral/response layer and the form references listed above. Finance posting/payroll consumption and receipts, procurement fulfillment, reservation/issuance, automatic IAM lifecycle execution, employee-to-customer conversion, sales commissions/performance ingestion, centralized operational HR metrics, and biometric/provider synchronization still need executable destination contracts and domain implementations. Device/provider setup and business rules cannot be replaced with a generic reply. No payment or automatic access revocation is performed by these endpoints.

## Validation

Follow-up final targeted suite: 469 passing tests — 157 Web tests across HR/Documents/Finance/Customer Affairs/Module Foundation; 150 API HR/Documents unit/domain/boundary tests; 26 real authenticated PostgreSQL tests; 63 Contracts tests; 73 Database tests. Added checks cover IAM create/edit/unlink and self-service round-trip, current name propagation, minimal response/permission/branch boundaries, multi-page inactive/deleted exclusion, active-currency/Decimal round-trip and rejection after deactivation, and Documents FK round-trip/cross-branch rejection. Documents upload tests verify that source labels come from HR and invalid source references fail before storage. One isolated PostgreSQL setup timed out during concurrent CPU load; a sequential retry exposed a new incomplete document fixture, which was corrected to include a current version; all 26 tests then passed without increasing timeouts.

Final follow-up: API/Web/Contracts/Database lint and typecheck passed; API production build and Web production build (40 routes) passed. No schema migration or dependency change. The initial implementation's validation record is retained below; visual browser QA and local runtime activation are not claimed.

- HR Web: 101 tests passed. HR API: 75 unit/domain/boundary tests passed. Authenticated PostgreSQL: 22 tests passed, including real referral/reply/idempotency/authorization/deadline checks in a randomly named temporary database that was removed by the test harness.
- Contracts: 63 tests passed. Database package: 73 tests passed. No tests were added that access live business data.
- API/Web/Contracts/Database lint and typecheck passed after fixing the new client effect lifecycle and reserved variable name. Database client generation used a synthetic codegen URL, not a live migration. Initial missing generated dependencies were built in this isolated worktree.
- Final API production build and Web production build passed (40 routes). Contracts and Database package builds passed. No migration or dependency changes.
- One legacy Web test initially timed out during simultaneous build load; the entire 101-test HR Web set passed sequentially without increasing test timeouts. The initial new PostgreSQL fixture was corrected to use the existing masked-contact format.
- Visual browser QA, live activation and measured performance targets are not claimed. No actual payroll/payment, reservation, purchase or IAM execution is claimed.
