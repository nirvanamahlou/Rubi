# Customer Affairs registration-date filters — PC-B

Scope: requests, tickets and their handoff/followup/queue list views. Aggregate overview/report cards are not date-filtered by this slice. Shared Nora DatePicker is reused unchanged, default Persian with existing month/year grids and Gregorian switching.

UI uses explicit Apply and Clear controls; date values persist in URL as createdFrom/createdTo, reset pagination and coexist with search/status/site filters. End day is included completely. Browser-local midnight boundaries are converted to UTC (next local midnight for the end), avoiding fixed 24-hour assumptions across daylight-saving transitions.

Additive API query contract on GET leads and tickets: createdFrom inclusive and createdBefore exclusive ISO instants with timezone. Both optional. DTO validates dates, service rejects reversed/equal ranges and applies createdAt to the shared repository where used for list/count. Branch scope and other predicates remain intact. Existing URLs/API callers without dates retain behavior; no database migration, dependency or grants.

Tests cover boundaries, one-sided/empty queries, invalid ranges, both service list predicates with branch/pagination, client serialization and rendering of shared calendar controls. No business records or SMS are created by verification. Runtime activation uses the existing combined Web3100/API4190 and same local configuration, not another checkout.

Verification complete: API84 and Web46 tests, scoped ESLint and both production builds/typechecks passed. Active local runtime: source758ad5b6, Web22416 on3100, API30152 on4190; Web identity/HTTP200 and unauthenticated filtered API401 verified. No new authenticated browser visual QA claimed; date picker grids reuse the unchanged project component. No automatic merge.
