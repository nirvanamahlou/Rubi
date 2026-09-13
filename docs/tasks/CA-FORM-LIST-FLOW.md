# CA creation form and row-list flow — PC-B

2026-09-13, baseline3f3f33c4; CA-only changes preserve report layout and HR panel removal.

- Removed sourceReference and queueCode visible inputs from the travel-request creation popup. Backend contract remains unchanged: manually created requests use `ثبت مستقیم در امور مشتریان` and the existing `customer-affairs-front-office` queue. Existing source/queue data and edit APIs are not erased.
- Added items-start to creation grids: shared FormField grid no longer stretches its internal rows to the adjacent staff picker's height. No shared form-control changes.
- Successful request/ticket creation closes the popup, refreshes data and navigates to the corresponding first-page row list without detailId, board layout or old filters. Explicit row opening still provides full detail and operations. Legacy workspace callbacks also stop automatically opening new records.
- 53 CA tests passed across12 files; new regression tests cover removed controls, retained valid defaults, start alignment and post-create callback wiring. These source-contract tests are not a live save E2E claim.
- No API/schema/dependency, permissions or existing-data changes. Pre-existing internal checkpoint fetch error persists; no refs removed.

Frontend skill used existing Rubi controls and scoped alignment. Production build and runtime/browser results are appended after completion.
