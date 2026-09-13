# Customer Affairs workflow completion slice — PC-B

Branch: `codex/pc-b-customer-affairs-workflow-completion`. Based on combined `48d3989e`; no automatic merge or deployment. This slice does not complete the entire operational backlog.

## Implemented

- Atomic lead conversion: branch/version/state validation, own-row lock, Customers public transaction-aware creation preserving its identity validation/encryption/audit, then lead linkage in the same transaction. Existing customer linkage replays safely. No national ID in CA audit.
- Sales acceptance/return/rejection popup inside existing handoff card. Acceptance selects an existing permitted contract and validates customer and branch. It does not create or confirm a sales contract.
- Manual conversion probability persisted in qualification JSON (0–100), independent of qualification score. Omission preserves previous value.
- Ticket source-site filter for jahanbastan/nystkt in existing filter area. No additional tab or integration section.
- Opt-in due-followup and SLA notification scheduler: 60-second polling, 100-row keyset batches, own-record locks and durable command claims, notification/audit in one transaction. Closed records excluded. SLA recipients are responsible users, not automatic supervisor reassignment.
- WAITING_CUSTOMER pauses resolution elapsed time, not first-response time. Resume extends deadline by elapsed pause. This is not a business-hours calendar.
- Explicit SMS popup and authenticated `POST /api/v1/customer-affairs/tickets/:id/sms`, branch-scoped and restricted to approved senders.

## sms.ir activation (operator, secrets outside Git)

Provider contract verified against the [official sms.ir .NET SDK](https://github.com/IPeCompany/SmsPanelV2.DotNet): fixed HTTPS bulk endpoint, x-api-key header and lineNumber/messageText/mobiles/sendDateTime payload. No third-party SDK dependency added.

Required environment names only; do not paste secrets into chat or commit them:

- `CUSTOMER_AFFAIRS_SMS_ENABLED=true`
- `SMSIR_API_KEY`: provision in the API process secret environment.
- `SMSIR_LINE_NUMBER`: approved positive integer sending line.
- `CUSTOMER_AFFAIRS_SMS_SENDERS`: comma-separated approved IAM user IDs (also require ticket update permission).
- `CUSTOMER_AFFAIRS_REMINDERS_ENABLED=true`: separate opt-in for notifications; enabling processes existing overdue records.

Keep both features disabled until operator approval and configuration validation. Restart must use the approved runtime procedure; previous process-replacement command was blocked by execution policy. No alternate restart attempted.

Request body: mobile (09… or +989…) and message (2–1000 characters). `Idempotency-Key` is mandatory (16–160 characters). Durable claim commits before network submission. Reuse the same key/body after an uncertain client response; a changed body with the same key conflicts. Recipient stored masked in the timeline; message text uses existing timeline storage and visibility rules.

`ACCEPTED` means provider accepted a valid message ID, not handset delivery. `FAILED` means explicit rejection. Timeout, server error or malformed response remains `UNKNOWN`; crash after claim may remain `PENDING`. Never automatically resend these: operator must reconcile with sms.ir before authorizing a new send. There is no receipt polling/reconciliation screen yet. First-response SLA is not marked delivered by provider acceptance.

## Verification

- API: 24 test files, 177 tests passed (CA, Customers, Notifications).
- Web: 7 test files, 39 tests passed.
- Scoped ESLint, API/Web TypeScript and API/Web production builds passed; Web generated 46 routes targeting API4190.
- `git diff --check` passed. No schema/migration, lockfile or dependency changes.
- SMS tests mock fetch: config/permission rejection, acceptance/masking, timeout/no resend, replay conflict and persistence failure before network.
- Conversion and reminder transaction behavior tested with mocks, not live PostgreSQL concurrency. No real SMS or business submissions, no new-build browser QA. Existing processes have not been restarted to load these changes.

## Remaining work / handoff

- Live adapters and IAM bindings on the two website servers remain disabled.
- Inbound customer messages, delivery receipts and automatic survey-link sending are not implemented.
- Actual Sales/Reservations/Finance producer callbacks and final sales outcome synchronization remain incomplete; no edits made to their newer remote producer changes.
- Scheduler creates Notifications, not Tasks module entities. Automatic supervisor escalation, business calendar/holidays and advanced reporting remain incomplete.
- Structured dissatisfaction reasons are not implemented by this slice.
- Preserve four tabs, modal forms and Rubi Select styling. No automatic permission grants, no fabricated site connection, no customer contact made in QA.
