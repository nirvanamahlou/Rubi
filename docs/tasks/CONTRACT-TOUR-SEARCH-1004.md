# CONTRACT-TOUR-SEARCH-1004

PC-A, branch codex/pc-a-contract-tour-search-1004, base origin/develop@ee053ecc. User explicitly confirmed synchronized horizontal scrollbars above/below the Sales contracts table and authorized develop merge.

The Sales table has one content table with two RTL horizontal scrolling surfaces. Native scroll positions synchronize in either direction; ResizeObserver follows the table/container width and listeners are cleaned up. Existing pagination, actions and table dimensions remain unchanged.

New-contract tour selection uses the established SearchCombobox. Opening loads the public Ticket Catalog departure list and offers five initial suggestions. Search filters the loaded full list before applying the five-result limit, normalizing Persian/Arabic characters and matching substrings in displayed tour names, dates and airline aliases. Active outbound and return offers are required; insufficient capacity disables selection. Selection keeps the existing versioned tour reference and fills the existing contract/flight/hotel/insurance/service fields. Errors and loading are visible; abandoned list responses cannot update state. The existing public departure API's branch/date/200-row cap remains unchanged.

Shared search implementation already uses normalized includes, and Sales/Master Data server search already uses contains; prefix checks found in routing, permissions, dates and identifiers are unrelated to text search and remain unchanged. The shared lookup regression now treats Tour as an initial-suggestion control. No backend, shared API, schema/migration, dependency, permissions or operational data change.

Tests: Sales and shared lookup/combobox regression suites: 281 passed, one skipped across 46 files. Focused checks include initial five, a middle-name result beyond that list, airline substring, active return/outbound statuses, capacity and accessible RTL table wrapping. Typecheck/lint/build final results are recorded in the work assignment. No authenticated browser or shared-local-runtime rollout is claimed.

Final validation: scoped ESLint, formatting and Web typecheck pass; the production webpack build emits 55 routes. Final focused regression (four tests) passes. Scoped locks released for PR/develop integration.
