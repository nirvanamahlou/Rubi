# Company bank accounts — BANK-ACCOUNTS-1020

## Implementation candidate

PR998 merged during this work; its shared locks are conclusively released. The final candidate must integrate its develop result. Existing receipt-allocation code and migration remain unchanged.

Finance owns nullable encrypted identifier fields and keyed deduplication fingerprints on the existing FinanceSettlementAccount; a new append-only FinanceBankAccountAudit references the real account and actor. Bank -> multiple branch-scoped company accounts -> immutable audit events. Existing account IDs, branch/currency and payment relations are preserved. Existing bank/branch lookup indexes and unique fingerprint indexes serve bounded25-row paging; no plaintext-number search/index or export is introduced.

Additive v1 producer: GET finance/banks/:bankId/accounts/options and accounts?page; POST accounts with client requestId/branchId; PATCH accounts/:id with expectedVersion; POST accounts/:id/details for an audited uncached full-number read. Ordinary outputs contain masked identifiers only. Existing Finance APIs and clients keep their previous shapes. Native finance.read/master_data.read and bank manual access apply; management/full-number reads additionally require finance.account.manage. No grants are changed. Currency/bank/branch cannot be reassigned on edit. Missing identifiers preserve prior values; explicit empty/null clears one field, with at least one remaining identifier required. Exact strings preserve leading zeros; Persian/Arabic digits and separators normalize, card checksum and IBAN mod97 validate. Status changes use edit, not a power button. No permanent account deletion.

AES-GCM uses a separate HKDF purpose derived from the already-required MASTER_DATA_IMPORT_TOKEN_KEY_BASE64, bound to canonical branch/bank/account IDs. Keep this deployment secret and backups stable; changing it without a key migration makes saved identifiers unreadable. No new credential is committed. Audit includes masks/metadata only and is transactional with mutations; failed audit blocks full-number output.

Migration20261020160000 is additive with nullable fields and no backfill; apply it before API/Web rollout after backup and separate operational approval. Rollback is to the previous API/Web while retaining additive columns/audit and encrypted data; do not drop columns or published migrations. No live migration/deployment is included in this task.

Schema analyzer initially could not parse quoted PostgreSQL DDL, so a scoped JSON projection was checked. Its JSON warnings are deliberate for one authenticated ciphertext envelope and immutable audit snapshots, not arrays of accounts; naming remains compatible with existing Prisma tables. Its SQL/index parser does not fully represent quoted composite indexes; actual Prisma validation and disposable PostgreSQL tests are authoritative. Index optimizer's low-priority recommendations are already covered by the branch/bank lookup and account/time audit indexes, so no redundant indexes are added. No measured traffic/performance/SLO claim is made.

The skill migration-generator validate-only path also failed internally with `Object of type Column is not JSON serializable`; no generated SQL was used or claimed valid. Use Prisma schema validation and the actual additive migration/real PostgreSQL proof instead. The earlier projected analyzer does not replace those checks.

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

Current status: IN_PROGRESS. The owner reiterates immediate execution after explicit bounded transfer. PR998's published work record freezes schema on publication; the subsequent correction reopens Sales arithmetic only, explicitly without schema changes. PC-B now reserves the sole additive bank-identifiers migration scope under that direct owner instruction and notifies PR998. Preserve all PC-A allocation source and existing migrations; any new overlapping writer must coordinate. No operational migration, account mutation or deployment is authorized.

Existing modular monolith/PostgreSQL, authenticated UI and branch-scoped settlement-account identity are retained, not replaced. Existing use estimate is25 simultaneous staff; traffic forecasts and availability/RPO/RTO remain open project decisions (ARCHITECTURE section223), not fabricated guarantees. No infrastructure sizing, compliance certification, performance promise or operational launch is part of this change. Financial identifiers are sensitive: encrypt at rest, masked lists, audited authorized explicit detail reads; no CVV/expiry or card processing. Use existing design system and keyboard/label/error patterns, preserving mobile overflow.

## Required implementation evidence after handoff

Use existing branch-scoped financial account relationships and permissions; protect full identifiers at rest, default to masked output and audit authorized reads/changes without logging the identifiers. Validate and normalize identifiers, preserve leading zeros and existing accounts, reject unauthorized cross-branch access and stale edits, and prevent accidental repeated creation. Keep old API clients compatible. Migration must be additive and tested on a disposable database; no live migration without backup and explicit rollout authorization.

Exercise multiple accounts under one bank, independent banks/branches, valid/invalid/empty inputs, persistence round-trip, edit/clear behavior, access denial, concurrency and audit rollback. Run affected lint/types/tests/build and all exact-head hosted checks before the authorized develop merge. Report any unexecuted browser or operational checks rather than claiming success.
