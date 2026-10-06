# Procurement order lifecycle cleanup — PC-B

Branch: `codex/pc-b-procurement-orders-cleanup-1006`.

The request dossier now groups its ten record types under sourcing/orders, delivery/control, invoice/finance and history. Each record still uses its original API endpoint, permission and command; no business records or audit trail were merged or deleted. Opening a dossier starts with sourcing instead of audit.

Editing or cancelling a selected order stays on that order and action. The amendment form removes redundant supplier/currency/order selectors, locks item references and quantities, retains versioned commercial price amendments, and reduces spacing and explanatory copy. Required reasons and actual errors remain.

AMEND_ORDER rejects a supplier or currency inconsistent with the persisted selected quotation. Omitted commercial lines preserve current lines, enabling metadata-only amendments. Delivery metadata, archived document versions, dependency guards, authorization, optimistic concurrency and approval re-entry remain intact.

No migration, dependency, IAM, operational data, payment, external dispatch or runtime change. Automated test/build results and PR are recorded in the status/assignment entries. Authenticated browser visual QA and local database integration were not executed; PostgreSQL CI remains required before merge.
