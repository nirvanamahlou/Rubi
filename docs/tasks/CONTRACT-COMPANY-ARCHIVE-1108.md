# Contract company ownership and reversible archive

Owner-authorized scope: Sales, Reservations and contract-linked Finance. New contracts persist the company selected in the top switch. Reading another company never changes the owner or document letterhead. Aggregate reads retain their permission guard; creation requires one company.

The one-time migration hides contracts whose departure date is before 2026-10-23 (1405/08/01). For later existing contracts, any floating FLIGHT assigns Jahan Bastan; charter-only and no-flight contracts assign Niyayesh Seir Sahar. A floating hotel is not a floating flight. Earlier contracts retain their last documented preview issuer where available, otherwise Niyayesh. Missing issuer configuration aborts the transaction.

Sales owns the public ContractCompanyScope adapter and archive state. Legal Entities provides selected-company context and registers the adapter without importing the Sales runtime module. Reservations exposes only intake references through its public adapter. Finance consumes these references without accessing another module's tables. Company and archive predicates apply before paging, balances and FIFO receipt planning. Existing branch/permission checks remain. Receipt allocation cannot cross contract companies.

System > Sales exposes a paged archive with explicit selection and audited restoration. Restore updates only hiddenAt in a locked transaction. Amounts, payments, settlement entries, attachments and historical document snapshots are preserved. This is a contract-list archive, not financial cancellation or deletion; unlinked payroll/procurement and general ledger ownership are outside this change.

Validation includes real PostgreSQL boundary/classification/restore checks with synthetic data, selected-company creation, persisted output issuer, aggregate/restore permissions and contract-linked finance scope. Local typechecks pass. Final hosted quality, test, build and database gates are required before merge; production backup and reviewed migration impact are required before deployment.

Production rollback must retain the additive columns, migrated ownership and audit records; use the prior application image if necessary. Never reset the production database. Restoring selected contracts is the normal reversible operation.
