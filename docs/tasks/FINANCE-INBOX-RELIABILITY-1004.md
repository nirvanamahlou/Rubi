# Finance inbox reliability — 2026-10-04

COMPUTER_ID=PC-A. Branch: `codex/pc-a-finance-inbox-reliability-1004`, originally from `origin/develop@82272a25`. The human owner explicitly releases the stale Finance reservation in TICKET-PROCUREMENT-FINANCE-PAYMENT-0927 for this chat and authorizes develop merge after verification. No operational runtime or database rollout is authorized or performed.

## Delivered scope

- Ticket payment retries use the existing payment primary-key UUID as their operation ID. Operation and request advisory locks prevent races; immutable payload/actor/branch checks precede replay. A stale observed payment version is rejected, and full settlement replays do not depend on a still-pending Procurement envelope. Public Procurement reads happen before the Finance transaction to avoid connection-pool starvation.
- The Web keeps the same command for an uncertain response and freezes its fields until success or an authoritative client rejection. Receipt upload failure never reports the committed payment as failed. Receipt-only retries reference that same payment ID; retry files live only in the current browser session.
- HR referrals load every public page, with duplicate/total/page validation. Public response eligibility is projected; review, answer and reject use HR's existing transitions, permissions, source version, idempotency and audit/notification contract. A referral response is not payroll or payment evidence.
- Matched purchase invoice approval/payment and return correction decisions use their own APIs, not Sales or Reservations endpoints. Finance revision and Procurement source revision are distinct. Only a new corrected unpaid source may be re-approved; existing payments are not reset. Stale producer versions cannot silently approve/pay a new amount.
- Date ranges include the whole selected Tehran day. Payment KPIs count actionable monetary requests only. Grouped Reservations display each purchase line's existing persistent installment history.
- Closed queue filters no longer imply a complete archive. The existing separately paginated receipt/payment history remains accessible and clearly independent of queue filters.
- Owner decision: no new amount ceiling or mandatory manager approval is imposed. Existing operational permissions, branch scope and overpayment guards remain intact.

## Compatibility and deployment

Finance API produces optional additive `operationId`, `expectedPaymentVersion`, `financeVersion`, `expectedSourceVersion` and `hrReferral` fields; Finance Web consumes them. Deploy API, then Web; refresh stale browser clients. Historical rows are unchanged and remain readable. Legacy callers without the new operation/version fields retain their old behavior and must be upgraded to obtain the new replay/CAS guarantees. No dependency or migration is needed. No bank transfer, journal posting, financial rollback, seed, account-role grant or live server change is made by this task.

## Verification

- Full API suite: 1961 passed, 187 opt-in skips; subsequent focused regressions cover final changes.
- Finance/HR targeted tests, Finance Web tests, lint, typechecks, API/Web production builds and changed-file formatting gate delivery.
- Two opt-in real PostgreSQL tests apply every repository migration to a randomly named local database, prove concurrent retry/CAS and full-settlement replay, then drop only that test database. Run with `NORA_RUN_FINANCE_POSTGRES_TESTS=1` and a local administrative DATABASE_URL on port 5432; the suite never targets the configured operational database for fixture writes.
- Full Windows Web suite has two unchanged Master Data raw-source assertions sensitive to CRLF; the same two failures reproduce in the unmodified password-task base. Linux CI is the independent final full-suite gate. No Master Data source or test is changed to mask them.
- No mounted/authenticated browser or live server QA is claimed.

## Remaining product work — not claimed complete

Persistent assignment/claim ownership, scheduled SLA/reminder delivery, complete archived-request decisions, server-side queue pagination/filtering and saved views, permission-aware receipt/invoice exports, and additional refund/commission/check/payroll producers require separately reserved Finance/Tasks/HR/Procurement/Documents contracts and implementation. Existing Procurement public invoice/return projections are capped at 500; Finance cannot fabricate missing producer pages. These are broader product features, not silently implemented by disabling permissions or inventing money/workflow state.
