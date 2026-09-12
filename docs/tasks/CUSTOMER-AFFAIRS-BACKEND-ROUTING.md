# Customer Affairs backend routing

PC-B; branch `codex/pc-b-customer-affairs-backend-routing`, base `503c39c` from the preserved combined Customer Affairs worktree. Backend-only; no UI section.

## Delivered scope

- Lead reassignment notifies the new assignee; ordinary edits and queue-only assignment do not emit spurious notifications.
- Ticket creation includes its execution owner, and owner reassignment notifies changed customer/execution owners with deduplicated recipients.
- Sales handoff responses notify the lead assignee (creator fallback for queue leads). Identical replay does not emit another event; changed reasons conflict. An atomic conditional update prevents concurrent responses from each updating the lead and notifying.
- Workbench referral responses suppress identical retries even while in progress. Conditional writes reject concurrent changes before recording timeline/notification/audit. Closed referrals cannot reopen through the response API.
- Notification links for leads, tickets, referrals, escalations and dissatisfaction now include the correct view, so the existing UI opens the target record rather than overview.
- Notifications are written through the existing public Notifications service inside the owning business transaction. Failure propagates; there is no detached send, new provider, private-table access or changed endpoint/schema contract.

## Assumptions and boundaries

The user authorizes ordinary pre-operational defaults rather than another capacity questionnaire. Planning assumptions only: 10:1 reads/writes, 50 QPS peak at one year, existing branch-scoped shared deployment, internal + PII data, existing TypeScript modular monolith/PostgreSQL. Retain synchronous internal transactions; do not introduce queues or external transports here. Provisional validation targets for later operational readiness: p50 100ms/p95 300ms/p99 600ms, SLO 99.5%, RPO 24h/RTO 4h, PC-B owns this module's test/reliability follow-up. These are unmeasured planning assumptions, not production guarantees or a backup configuration change. This follows the senior-backend skill using the user's explicit instruction to choose defaults.

Not delivered: website ingress/site filters, external messaging and survey delivery, Customers conversion, Finance invoice/payment adapters, new Sales/Reservations outcome contracts or general task creation. Those require separately coordinated producer contracts and (where needed) migration locks. PC-A owns websites, Customers, Sales, Reservations and Finance. No dormant/fake external connector is claimed ready. Existing references and referral APIs remain as before.

## Validation and activation

52 Customer Affairs + Notifications tests pass, including 15 new routing tests for replay, concurrent loser, recipient/branch authorization, changed owners and transaction failure propagation. Tests use mocked public services/transaction delegates; no claim of live concurrent PostgreSQL verification. Scoped ESLint, API typecheck and production API build pass. No migration/dependency/permission or business-data changes.

Newer PC-A work exists on origin/develop, but local process inspection confirms Web3100 still runs from this combined worktree (PID28820). API4190 had no listener. The updated API was started using the previously configured local environment/database/document root, without replacing Web or running migrations/seeds. Local startup verification is recorded below. Origin/develop is not merged or replaced; integrators must reconcile this stacked branch with the newer PC-A producer changes. No automatic merge.
