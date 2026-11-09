# Customer dossier connections

PC-A. User explicitly authorizes implementation, security tests and develop merge
for all nine customer dossier sections. Reserve additive owner public read ports
in Sales, Reservations and Customer Affairs, a Customers aggregation endpoint,
shared response contract, dossier UI and focused tests. No schema, dependency,
credential, grant or production data changes. Exact customer IDs only; no name or
phone matching. Contract company/archive and branch scopes remain mandatory.
Financial data belongs to the buyer/payer, not every passenger on the contract.
Sources without permission return forbidden; failures never become empty success.
No raw workflow snapshots, payment identifiers or provider URLs in responses.

Implemented nine live read categories with at most50 displayed rows per category.
Reservation scope is capped at1000 linked contracts/intakes and fails explicitly
unavailable on overflow, rather than claiming complete empty results. Vouchers
require latest recorded voucherIssued=true. Requests/support exclude internal
Workbench and call-center storage categories, matching the owner's existing list.
Security tests cover scope construction, denied-source no-query, buyer/payer-only
finance, exact passenger documents, nonexistent customer, query overflow, source
failure isolation, UUID and HTTP guards/no-store. UI tests cover stale-customer
suppression, all nine states and escaping. No production runtime activation.
