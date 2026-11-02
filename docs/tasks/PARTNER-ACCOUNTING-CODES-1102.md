# PARTNER-ACCOUNTING-CODES-1102

PC-B; branch codex/pc-b-partner-accounting-codes-1102. Implemented and activated on local Rubi3100; no production deployment.

## Behavior

- Readonly accountingCode on MasterOrganization, MasterSupplier, MasterBroker and BANK FinanceSettlementAccount. Existing business codes unchanged.
- Shared company sequence 3000001..3999999 across roles; separate bank sequence 5000001..5999999. Existing identities ordered by earliest createdAt across linked rows, with stable ID/kind tie breaks.
- Linked partners mirror their organization. Promotion of a standalone partner preserves its code. Sequences allocate atomically and never rewind after deletion.
- Optional additive output contracts; input whitelists do not permit client-assigned codes. Readonly displays in organization/agency/partner profiles and bank-account list/view/edit.
- This registers identification codes; it does not create ledger detail mappings or post vouchers.

## Validation

- API build/typecheck passed with 6GB Node heap (initial default heap exhausted memory). Web production build/typecheck, database/contracts builds and scoped API/web/contracts ESLint passed.
- API: 65 tests in five focused suites. Web display: three tests. English coverage: three tests.
- SQL fixture/assertions passed: ordering, shared roles, promotion, immutability, separate bank sequence and non-reuse.
- Full local database backup restored to isolated rehearsal DB before migration. Hashes of every existing column in all four tables matched before/after both rehearsal and local application.
- Local backfill: 160 organizations, four linked suppliers, two linked brokers; 3000001..3000160. Zero company bank accounts existed; no artificial bank rows created.
- Only migration 20261102120000_partner_accounting_codes applied locally and recorded in Prisma. Unrelated pending migration 20261031180000_package_publication_optional_flight_cost intentionally not applied.
- Runtime source overlay preserves peer hotel-access edits. Database client/contracts rebuilt, affected compiled API modules updated and API4192 restarted. Web3100 hot reload active. API health returns ok; browser shows accountingCode3000160 in actual organization dossier alongside its unchanged business code.
- Backup outside Git: C:/Users/admin/Rubi-backups/rubi-before-accounting-codes-1102.dump. No operational rows or credentials committed.

## Deployment

Back up the target, review pending migrations, apply the additive migration and regenerate/build database, contracts and API before restart. Never reset the database or copy the local data dump merely to assign codes. Each environment backfills its own identities; independently allocated codes across databases must not be assumed to identify the same company.

## Organization-code presentation follow-up

User requested that the seven-digit company number appear as the organization code, without a separate accounting-detail field. Company profiles, lists, partner views, shared selectors, delete descriptions and readonly edit/registration summaries now use the numeric display code. Bank display remains unchanged. Search and code sorting use accountingCode; company Excel exports show it. Excel reimport recognizes both the displayed and historical codes. Legacy code and IDs stay in write payloads, so existing relationships and contract identities are unchanged. No further migration or data rewrite.

Validation: 80 web tests (including legacy edit-payload preservation and numeric/legacy import lookup), 26 API tests (including search and XLSX), web typecheck and scoped lint passed. Browser on localhost3100 confirms only "کد سازمان 3000160" in the organization profile, and numeric codes in the list. API and web production builds passed. Updated API modules activated on port4192; web3100 serves the revised display.