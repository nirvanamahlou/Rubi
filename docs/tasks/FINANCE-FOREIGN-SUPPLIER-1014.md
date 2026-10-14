# FINANCE-FOREIGN-SUPPLIER-1014

Owner: PC-A. The reference-PC user authorizes implementation and develop merge.

For every outgoing payment whose canonical currency is not IRR, select an active
Master Supplier as the payer. This is distinct from the beneficiary/supplier of
the purchase. IRR continues to select a same-branch active settlement account.
Never reinterpret a supplier identifier as an account identifier.

Covered paths: ticket purchase payments, procurement invoice payments,
Reservations service purchases and direct/payroll request payments. Optional
payingSupplierId is validated through the public MasterProcurementDirectory;
active collaboration is required. The lookup shares the Finance transaction.
Persist restrictive supplier FKs; capture the paying name as historical evidence.
Invoice payments also capture their currency because it can no longer be inferred
from an account. Existing account payments and existing API payload shapes remain
readable; new non-IRR commands require supplier selection.

Replay identity includes supplier ID for ticket payments; operational request
fingerprints already cover the complete command. Existing amount limits,
installment/version guards, branch permissions and successful-payment evidence
remain intact. History and receipt/Excel show account or paying supplier.

Migration20261014100000 is additive except relaxing the ticket account NOT NULL
and extending the operational payment CHECK to accept exactly one payment source.
No old payment is rewritten or deleted. Deploy migration/API before Web.
No operational database changes or server deployment are part of this task.

Verification: focused source and Finance tests, Web/i18n tests, API/Web types,
lint and isolated PostgreSQL apply-all-migrations plus foreign ticket payment,
supplier restriction and retry identity. Final quality/build/CI results belong
in PROJECT_STATUS and the PR before merge.
