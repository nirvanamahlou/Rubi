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
- Production build, runtime IDs and draft PR/CI will be recorded at completion. No merge.
