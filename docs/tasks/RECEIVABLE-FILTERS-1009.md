# RECEIVABLE-FILTERS-1009 — PC-A

The Sales receivables card has independent inclusive From/To dates, contract-date or travel-date basis, searchable origin/destination route, agency/direct-passenger type, and searchable individual agency. Apply and Reset preserve the separate contract-list filters. Pending requests and failures never masquerade as a zero balance; stale responses are discarded.

`GET /sales/receivables` accepts additive `SalesReceivablesQuery` and returns `SalesReceivables`: signed outstanding totals by currency, matched contract count and authorized route/agency choices. It uses the existing Sales all/branch/own scope before loading contracts and aggregates all authorized matching rows, independent of list pagination. Confirmed Finance payments and exact Decimal arithmetic retain existing balance semantics, including credit balances; currencies are never converted or mixed.

Customers provides a non-sensitive internal ID/kind lookup for the authorized contract buyer IDs through its own repository. Organization buyers are classified as agency/B2B and person buyers as direct/B2C, consistent with the current Sales organization-customer flow. Missing customer references do not become person records. Existing dashboard/list APIs stay compatible; no new permission, migration, dependency, operational-data write or runtime rollout.

Owner explicitly authorizes develop merge after verification. 67 Sales/Customers API tests,23 Web/translation tests, scoped lint, API/Web typechecks and production builds pass. Full CI gates the final candidate. No authenticated runtime visual proof or local deployment is claimed.
