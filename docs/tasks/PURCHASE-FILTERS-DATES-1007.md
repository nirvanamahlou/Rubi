# Purchase status and date filters — 2026-10-07

PC-A, codex/pc-a-purchase-filters-dates-1007, base origin/develop@7678ead9. Owner explicitly requests filters, date sorting and develop merge.

## User behavior

The contract purchase hub keeps five categories and adds registration status (All, Recorded, Not recorded), an inclusive date range, date basis and oldest/newest direction. Category/search navigation preserves filters in the URL and resets pagination. The visible date column shows the chosen basis. The same settings apply to the existing flight inventory list; successful flight saves refresh contract statuses.

Entry means Reservations intake receipt for contract services, or original inventory purchase-request creation for independent inventory rows. Departure uses the exact selected flight snapshot (outbound and return independently); check-in uses the selected hotel snapshot/metadata. Purchase date means the latest matching purchase/cost revision creation, never Finance payment. Missing dates remain unknown, sort last in either direction and are excluded by date bounds; no fallback dates are invented. Day bounds and displayed date instants use UTC; date-only hotel/flight days retain their canonical day.

Mixed contracts are filtered per service. Shared outbound/inbound transfer purchase coverage marks both matching keys, without duplicating monetary totals. Registered means a saved purchase/cost, regardless of payment stage. Unavailable unauthorized flight purchase state remains UNKNOWN and is excluded from recorded/not-recorded filters rather than being fabricated as missing.

## Public contracts and ownership

Reservations GET /reservations/requests/purchases adds optional status (ALL/REGISTERED/UNREGISTERED), dateBy (ENTRY/DEPARTURE/CHECK_IN/PURCHASE), from/to ISO dates and direction (ASC/DESC). Defaults remain All statuses, entry date descending. Repeated/nonstring/invalid filters, impossible dates and inverted bounds reject before reads. Returned original intake data is unchanged; additive meta.services descriptors provide selected keys/status/dates in global row order. Pagination is25 service rows with look-ahead and stable intake/key ties, followed by branch-scoped hydration. The Web consumer uses descriptors directly; legacy responses without them remain renderable.

Finance public TicketPurchaseInboxItemV1.cost.createdAt is optional nullable, exposing the latest cost revision timestamp. Existing producers/consumers remain compatible when absent. Reservations composes only FinanceTicketCostService.purchaseInbox authorized by existing Procurement read permissions and preserves original producer actor/branch/own scope. SQL reads only Reservations-owned tables and receives bounded public projection values, never joins another module's tables. Finance supplies timestamps from its owned records; no Procurement command changes, grants or payment mutations.

## Verification

Actual bound PostgreSQL selection runs against temporary synthetic tables in rollback transactions. Tests cover more than one page, an unpurchased and purchased service in one contract, exact service keys, shared transfer coverage, legacy hotel purchases, latest-version purchase timestamp, inclusive day endpoints, entry ordering before pagination, null dates and authorized/unknown flight state. HTTP tests prove denied access and filter validation before public flight reads. Client tests cover selected URLs, English rendering, global server service ordering and flight date/status filtering without input mutation.

Affected lint/typechecks, English inventory/derived catalogue checks, Web/API production builds and complete exact-head CI gate the owner-authorized develop merge. Visual proof uses labeled synthetic data. No authenticated purchase/payment, migration, dependency change or operational runtime rollout is performed.

Local verification: affected Web292 passed /2 existing skips; Finance and actual purchase-selection PostgreSQL25 passed /2 opt-in skips; purchase query validation9 and HTTP7 passed. Scoped lint, Web/API typechecks and both production builds pass (Web56 routes). English completeness and derived catalogue checks pass. Synthetic screenshot validates five filter controls and the chosen-date column. Full exact-head CI remains the merge gate.
