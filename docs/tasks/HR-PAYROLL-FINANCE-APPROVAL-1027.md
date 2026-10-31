# Payroll worksheet Finance approval

Owner: PC-B. Work item `HR-PAYROLL-FINANCE-APPROVAL-1027`.
The user authorizes implementation, tests, push and normal develop merge.

## Public boundary

HR owns encrypted worksheet cells, the frozen source version and the integer-IRR
payable projection. HR confirmation freezes the complete saved worksheet and
submits the sum of `remaining` (net less advances), irrespective of the employee
search filter. All row names must be present, row balances nonnegative, and the
aggregate positive and below the existing Decimal(24,4) integer bound.

Finance owns the `PAYROLL_WORKSHEET` operational approval request and append-only
revisions. The existing string kind column and unique HR-record FK support this
kind without a schema change. It is separate from employee `PAYROLL` disbursement
requests: it neither invents an employee FK nor posts accounting events or pays
funds. Existing employee payroll, procurement and petty-cash workflows retain
their behavior. Generic Finance creation cannot create worksheet-source requests.

The Finance-owned transactional public functions accept only the source ID,
branch, Persian period, frozen version, row count, amount and currency. Financial
review receives no employee names, bank accounts or encrypted private cells.
The HR-owned public payment-source function validates branch, frozen state,
version and the payable projection for operational commands. Neither owner reads
the other owner's private tables directly.

## Atomicity and state

The existing HR sensitive/manage/approve permissions gate explicit submission.
The worksheet author may submit; Finance requires a different final approver.
Submission serializes on the worksheet business key, performs CAS,
freezes the canonical payable projection, creates the Finance request and its
initial revision, and appends HR audit in one transaction. A failure rolls back
all changes. An ambiguous retry by the same submitting actor at the immediately
preceding source version returns the existing result. The unique HR-record FK
and source serialization prevent duplicate requests.

HR stores `PENDING_FINANCE` as the frozen source state. Read-only DTOs project the
real Finance decision: NEW/UNDER_REVIEW -> PENDING_FINANCE; APPROVED -> APPROVED;
CORRECTION_REQUIRED/REJECTED/CANCELLED retain their distinct states. Historical
HR-only APPROVED sources without a Finance request display HR_APPROVED, never a
fabricated Finance approval.

Finance approval retains branch/read/manage checks, independent requester review
and expected-version/idempotent operation guards. A worksheet cannot be reopened
while pending or approved. Finance-returned or rejected worksheets may reopen;
resubmission updates the same request with a new frozen source version and an
immutable revision. Direct Finance RESUBMIT and PAY are disabled for this
approval-only kind. Existing request history is never deleted.

The Finance inbox classifies the request as HR/PAYROLL_REQUEST, including source
counts. HR filters and labels support every projected state. Pending list/detail
views refresh status on focus and every 15 seconds through a minimal scoped
no-store status endpoint, without fetching private cells for polling.

## Validation

Focused tests cover scope/permission denial, legacy status semantics, repeated
submission, immutable pending/approved sources and inbox classification. The
existing isolated PostgreSQL Finance suite adds a full worksheet journey:
failed Finance insertion rolls back HR CAS; concurrent submissions create one
request/revision; Finance self-approval is denied; approval changes the HR DTO;
returned/rejected sources reopen and resubmit; the aggregate cannot be paid from
the approval request. Synthetic data exists only in disposable test databases.

Local and hosted validation results are recorded in the work ledger and PR.
No operational database migration, seed, permission grant or runtime rollout is
part of this work item. Source locks release upon verified develop merge.
