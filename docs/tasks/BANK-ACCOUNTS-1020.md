# Company bank accounts — BANK-ACCOUNTS-1020

## Authorization and scope

- Date: 2026-10-20; COMPUTER_ID=PC-B.
- Owner explicitly asks to transfer this capability to PC-B; earlier request authorizes tests, push and develop merge.
- Owner confirms these are company accounts only, not customer/supplier accounts.
- Each reference bank may have multiple accounts with account number, card number and IBAN; a bank-profile consumer shows and edits them.
- Finance remains the data owner. Master Data must not store duplicate financial identifiers or query Finance tables directly.
- No payments, bank connection, CVV, credentials, customer accounts, IAM grants or unrelated Treasury ownership transfer.

## Coordination

Branch: codex/pc-b-bank-accounts-1020, base origin/develop@72f9f916.

Open PC-A PR998 (head995b8d3c at inspection) changes the shared Prisma schema and Finance module and contains migration20261020120000_receipt_allocations. Its source and migration must not be overwritten, reverted, assumed released or merged by this unit. The delegation authorizes the new capability, not concurrent shared-file writers. Notify the existing owner on PR998 and obtain explicit freeze/release before claiming the single Migration Owner lock or editing the central files. The existing PC-A allocation functionality remains with PC-A.

Current status: authorization recorded; shared lock handoff pending. No implementation, operational migration, account mutation, deployment or functionality test has occurred.

## Required implementation evidence after handoff

Use existing branch-scoped financial account relationships and permissions; protect full identifiers at rest, default to masked output and audit authorized reads/changes without logging the identifiers. Validate and normalize identifiers, preserve leading zeros and existing accounts, reject unauthorized cross-branch access and stale edits, and prevent accidental repeated creation. Keep old API clients compatible. Migration must be additive and tested on a disposable database; no live migration without backup and explicit rollout authorization.

Exercise multiple accounts under one bank, independent banks/branches, valid/invalid/empty inputs, persistence round-trip, edit/clear behavior, access denial, concurrency and audit rollback. Run affected lint/types/tests/build and all exact-head hosted checks before the authorized develop merge. Report any unexecuted browser or operational checks rather than claiming success.
