# FIN-CODING-001 — Accounting detail type definitions

On the Define Detail Type screen, a user with Accounting Account Management permission can add the four system definitions to the current ledger. The action adds only missing types. If a normalized title already belongs to a custom type, the screen identifies that title and keeps the original record. New ledgers receive the four definitions at creation.

| Type | Prefix | First code |
| --- | --- | --- |
| پرسنل | 2 | 20000001 |
| مشتریان حقوقی | 3 | 30000001 |
| مشتریان حقیقی | 4 | 40000001 |
| حساب‌های بانکی | 5 | 50000001 |

In the Accounting detail form, personnel and both customer types show the first available code as a placeholder. A new detail can use a manually entered code of eight digits with the assigned prefix and a suffix from 0000001 through 9999999. Leaving the code field blank assigns the first available code when saving. Bank details continue automatic issuance. The detail type and issued code of a saved record are fixed. Each type's series is shared across all ledgers and companies.

Accounting calls the internal System Management allocator within the existing command transaction. A PostgreSQL transaction lock serializes requests for the same prefix. The three editable series share a first-gap lookup between preview and automatic issuance. It reads permanent issuance history and all saved detail codes, including inactive and legacy details. Preview requires the Accounting manage permission and access to the selected ledger and type. Issuance occurs only when saving. Save rechecks availability, records the issued value permanently and rejects attempts to duplicate or modify it. The standard Accounting request key handles safe retries and the transaction rolls back related writes on failure.

This work defines types and issues codes for Accounting details. Dedicated title forms and links to the native HR employee, customer and bank account records are a later phase. Their existing business code columns have their own formats. The change uses the current schema without a migration or backfill. It does not change existing detail, party or bank codes, financial documents or sales contracts.

The main implementation is in `packages/contracts/src/finance-coding.ts`, `apps/api/src/finance/accounting/finance-coding-types.ts`, `apps/api/src/system-management/finance-coding.public.ts` and the Accounting detail command and editor. The focused PostgreSQL spec uses a fresh disposable local database named `fin_coding_test_<digits>` and refuses operational endpoints.

Verification passed locally: three real PostgreSQL cases, sixteen API tests, twenty Web tests and four shared contract tests. API and Contracts type checks, Web and API builds, scoped lint and formatting passed. The HTTP tests cover ledger setup before a fiscal year exists. No operational database or deployment was used.

The task branch started at `origin/PC-D-Integration` and fast-forwarded to its descendant `origin/develop@9d11dbc7e` to use the current Accounting editor and model.
