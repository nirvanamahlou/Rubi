# CUSTOMER-CODES-1102

User requests the workbook customer pattern below national ID and backfill of existing customers. Customer.customerCode starts4000001 and is allocated globally by original createdAt/id for existing records; future inserts receive a sequence value. Field is readonly and omitted from write DTOs. API summary/detail exposes an optional additive customerCode. No customer IDs, contracts or other existing values are changed.

## Validation and local activation

- Database/contracts/API/web builds and typechecks passed; scoped ESLint passed.
- 53 repository/service tests and44 customer-workspace/i18n tests passed.
- Isolated SQL fixture verifies chronological/tie ordering, inactive inclusion, automatic inserts, immutability, ordinary edits and non-reuse after deletion.
- Full local backup restored to rehearsal database before apply. Both rehearsal and actual local database retain the same hash over all old customer columns (three rows). Codes4000001..4000003 assigned.
- Applied only20261102140000_customer_codes and recorded it with Prisma; unrelated pending migration left alone.
- Runtime Rubi database/client/contracts updated; affected API repository compiled output activated on4192, preserving peer modules. Web3100 customer dossier visibly shows4000001 below national ID. Health200.
- Backup outside Git: C:/Users/admin/Rubi-backups/rubi-before-customer-codes-1102.dump. No operational customer data committed.

## Server deployment

Not deployed to production. Back up the server database, review pending migrations and apply this additive migration before deploying/regenerating the matching Prisma client, contracts and API. Use the normal Prisma migration workflow; never reset or copy local customer rows. The server assigns codes to its own existing records chronologically. Existing relations are retained. Sequence gaps after rolled-back inserts are intentional; deleted codes are not reused.
