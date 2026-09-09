# B2B-DOSSIER-REPORTS-001 — PC-B

## Scope and behavior

- User requests working reports for all activity in the agency 360 dossier. Branch `codex/pc-b-b2b-dossier-reports` starts from df19788 and retains the PR146 stack, existing database and owned Web3100/API4191 runtime.
- Reports/Audit/Export now load the actual persisted B2B, Master Data and Documents audit streams. Summary counts, chronological rows, actor names, outcome, changed-field labels and details are available. Branch, category, source, outcome and inclusive Tehran-day date filters work. The existing Persian date picker and Rubi typography are reused.
- The B2B projection includes operational profiles/account manager, contract revision lifecycle and embedded guarantees/credit policies, legacy credit policies, rates/discounts/commission, signatories and agency users/grants. Master Organization supplies organization identity/roles and contact/address activity, including deleted-child history. Documents supplies upload, scan, metadata, preview/download, archive/restore and access audit events for exact organization primary-case relations and authorized domains.
- `GET /api/v1/b2b/agencies/:organizationId/activity` uses existing agency-read and per-source permissions; organization, branch and agency-portal boundaries are checked server-side. Master Data/Documents are accessed through their public owner services. No IAM grants, shared permission additions, schema, migration or dependency changes.
- Each owner returns at most 51 events; the combined API page returns 50 and a timestamp/key cursor. Client fetches every page at one upper timestamp, aborts obsolete requests and fails the entire result on a source/page error. Excel exports all selected events as inline strings, not spreadsheet formulas. No hidden first-page-only export.
- Raw snapshots, private contact values, credential fields, notes and file contents are not returned. Missing source permissions are explained in the page. Finance is still a labelled UI preview and excluded from actual activity. Unlogged attempts/clicks and previously purged events cannot be reconstructed.

## Audit retention correction

Documents permanent deletion previously erased its audit rows. The owner now retains a minimal DELETED tombstone and source identifiers for audit scope, removes version rows and payload metadata, clears version FKs on retained audits, and atomically appends a deletion event. Detail/list/file/restore APIs exclude deleted documents. Optimistic version claiming prevents duplicate deletion. No existing local documents or business records were deleted during implementation; deletion tests use disposable PostgreSQL only.

## Verification

- Targeted API projection/permission/date/redaction and Documents unit tests: 36 passed. Organizations model/export tests: 95 passed. Full affected module suites and final build results follow below.
- Disposable PostgreSQL18: 19 tests passed, including all prior B2B persistence tests plus owner projections, 65 tied events across two pages, organization/branch/permission/date isolation, deleted-contact recovery, confidential document filtering, and permanent-deletion history/version removal.
- Read-only live owner-service smoke derives the existing Nirvana operator's actual permissions and returns 22 events for synthetic افق سفر: B2B10, Master Data4, Documents8. No missing source permissions; source/date filters pass. Private evidence: `C:/Users/admin/AppData/Local/Rubi/b2b-agencies-runtime/activity-smoke-data.json`.
- Actual React components in isolated fixture browser: report home, 22-event table, eight-document filter, contract details including guarantee/credit changes, future-date empty state and reversed-range validation work. Existing stored events supplied the fixture; live backend projection was separately verified. No staff login bypass.
- Production build, runtime IDs and draft PR/CI are recorded below. No merge.

## Final validation and runtime

- All 613 affected B2B/Master Data/Documents tests and 95 Organizations tests pass; API/Web lint/typecheck pass. The final contact-transfer correction additionally passes 17 owner repository/identity tests and all 19 disposable PostgreSQL tests. Historical events resolve the organization at the event time; future contact deletion audits preserve organizationId without contact values. Transfer tests prove later deletion history is absent from the former organization and present in the new one.
- Web source `01ff6d131b931cd0174d80ab8009fa9af06b1b8d` builds all 41 routes and runs on Web3100 PID19116, version `hr005-e8ec9ec662bd3909`. `/api/hr-runtime` matches. The final change is backend-only: API source `63bad33b80e0dc1c1ff9252d405f5e314a175859` was built and restarted separately on API4191 PID28340, preserving the unchanged Web build. Health is200 and unauthenticated report access is401.
- A second live public-service smoke returns the same 22 existing synthetic dossier events with valid filters and no missing permissions. Browser recheck covers final Persian action labels, all three tabs and Excel action. Temporary QA3196 stopped; browser returned to the normal `/organizations` login flow without bypassing authentication.
- [Draft PR147](https://github.com/nirvanamahlou/Rubi/pull/147) targets develop. Initial source CI34469370053 and [final source CI34469825061](https://github.com/nirvanamahlou/Rubi/actions/runs/34469825061) pass all four gates: quality, full tests, PostgreSQL18 migration/seed and production build. No merge, migration, dependency, IAM grant or local business-data mutation. Release implementation reservations; coordinate future runtime changes.
