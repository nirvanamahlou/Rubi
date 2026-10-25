# Floating purchases — 2026-10-25

User requests a review PR only. No merge, deployment, operational data rewrite or account grants are part of this candidate.

## Access setup

- Give Sales `floating_purchases.write.own` to record flight/hotel costs for contracts whose authoritative intake salesOwnerUserId is their user ID.
- Give Sales managers `floating_purchases.read.all` to see all floating purchases in their existing branches. This permission does not allow writing another seller's cost. Add write-own separately if managers must record their own contracts.
- Manual access prerequisites add exactly `floating-purchases.hotels` and `floating-purchases.flights` screen/control permissions. No generic Purchasing, Reservations, Master Data or Finance grant is implied. Explicit screen denies remain effective.
- Apply the insert-only permission catalogue migration before configuring access. Existing user/role grants are not changed automatically. Unknown legacy ownership fails closed for own writes.

## Behavior and boundaries

Hotel and flight entries are stacked in Purchasing & Supply. The existing Reservations public producer supplies branch/owner-scoped rows; filtering occurs before count and pagination and is repeated at hydration. Actual Inventory supply plus canonical contract-only flight metadata classify the contract. Client-provided supply metadata cannot authorize purchases. Any floating leg makes the associated hotel floating; company-capacity flights are not purchased again per contract.

The existing append-only Reservations cost command records one aggregate supplier/currency amount per selected floating service, with version/owner CAS, idempotency, purchase FX and an actor audit. Flight Finance settlement/refund coverage remains required. No synthetic passenger nightly prices, duplicate cost producer or financial posting is introduced.

Hotels still reach Reservations. Floating voucher issuance can proceed without supplier confirmation or a previously sent supplier form, and does not inherit that form's broker restriction. The actual voucher settings/broker, cancellation, document access and Finance release remain enforced. Ordinary contracts retain their existing workflow. Ticket/download financial/document guards are unchanged.

## Verification and rollout

Focused ownership, branch, legacy snapshot, spoofed classification, manager read-only, IAM/menu isolation, regular purchase and workflow tests pass. Contracts build and affected lint pass. Local full API types cannot be claimed against stale shared generated Prisma; hosted clean builds are required. Local Docker engine is unavailable; database CI runs the new opt-in PostgreSQL18 test using synthetic temporary tables inside one transaction, without operational data reads/writes. All exact-head hosted checks must pass before review/merge.

No schema/dependency changes. No automatic account grants or ownership backfill. Producer/consumer and additive catalogue migration ship together. Existing supplier-operation and Finance histories remain intact.
