# PROCUREMENT-DOCX-1005 — PC-B

Status: COMPLETE / merged to `develop` through PR #669 (merge commit `747c42e4`, 2026-10-06).

Scheduled start: 2026-10-05 07:00 UTC (10:30 Tehran). Source: the owner's
`پراپمت های خرید و تامین.docx`; all 43 paragraphs and four embedded images
were inspected. No tracked changes, tables or comments were present.

Checkout: `C:\Users\admin\Rubi-master-data-rate-geo-0929`.
Branch: `codex/pc-b-procurement-docx-1005`, based on develop after PR657.
The dirty original `C:\Users\admin\Rubi` and its running services were preserved.

## Ordered document outcomes

| # | Request | Current result |
|---|---|---|
| 1 | Redesign request detail/actions/history | Implemented compact summary cards, tinted action surface and expandable persisted record details; real browser appearance remains unverified. |
| 2 | Remove “My follow-ups”; compact filters | Heading removed; labeled filters span the record panel with responsive columns. |
| 3 | Optional HR requester | Removed UI save blocker; the authenticated creator remains the audit/requester user when no HR employee is selected. |
| 4 | Include the three companies in branch selection | Owner chose actual authorized branches only. The form uses HR's branch candidates already constrained by exact IAM-authorized branch IDs; legal entities are not presented as branches. |
| 5 | Optional organizational unit | Optional in UI and submission rules; supplied unit/requester consistency is still checked. |
| 6 | Create purchase category above dropdown | Added a Procurement-owned, persistent category catalog scoped to actual authorized branches. Existing request categories are included as legacy options without migration/backfill. Duplicate labels are Unicode-normalized and blocked per branch; API requires `procurement.request.create` and branch authorization. |
| 7 | Remove long supplier guidance | Removed from request form. |
| 8 | Optional need description | Optional in UI and API submission rules. |
| 9 | Remove goods description | Hidden for goods; service description, measurement unit and positive quantity remain validated. Historical goods descriptions are retained. |
| 10 | Remove attachments/notes from request form | UI removed; existing documents/notes are retained in the draft and record history. |
| 11 | Remove large draft/edit header | Removed visually, retaining a screen-reader heading and focus target. |
| 12 | Supplier logo beside name | Added authenticated owner logo preview using existing metadata/read and clean-file checks; refreshes after supplier save. Live upload appearance not verified. |
| 13 | Open matching forms/data on record click | Real record titles open matching request/section or supplier edit forms; operational histories expand persisted fields, lines and documents. Order edits now open a prefilled, versioned amendment form. |
| 14 | Choose recipient and accept/reject in their Workbench | Request creators can select an active, same-branch buyer who already has `procurement.quote.manage`. The recipient receives a follow-up task in the existing Workbench requests tab; the Tasks service filters by authenticated assignee and authorized branches. If procurement approval policy names an approver, a separate approval task is created. Assignment never grants approval, and DECIDE remains restricted to the actor in the snapshotted approval step. |
| 15 | Complete purchase order form/actions/documents | Approved requests appear in order list. Form includes supplier tied to selected quotation, delivery date/location, tracking and archived upload. Tracking/documents persist in order/version snapshot. Backend rejects mismatched supplier. Editing preloads the selected issued order and its commercial lines into the versioned amendment flow; cancellation requires a reason and retains the audit trail. Cancel is blocked by the backend once a receipt, service acceptance or invoice exists. These controls do not physically delete financial records. |
| 16 | Remove invoice/finance section | Removed home navigation card and maps the old invoice-section URL to home. Existing API, historical invoice tabs and Finance integrations are retained. |

Additional defect repaired: supplier edit previously called create; the existing owner
record/version is now passed to `persistWithLogo`. Detail-load failures are shown in the
page, and supplier logo/profile queries are refreshed after save.

## Verification and boundaries

- Web Procurement/Workbench focused tests: 11 files / 45 tests passed. Full Web ESLint and Web typecheck passed.
- API focused Procurement/Tasks/Workbench run: 60 passed; 37 database-gated tests were skipped in that local-only run. A separate run against the dedicated database exercised the service and export suites.
- Dedicated PostgreSQL18 service/export run: 40 passed, including optional-field publication,
  tracking/document persistence and mismatched-supplier transaction rollback.
- Temporary test database only: 119 existing migrations applied at the suite's exact
  localhost:55473 / procurement_001_api_test allowlist; no operational database mutation.
- Full API/Web ESLint and typecheck, API build and Web production build passed (55 routes), including the final selection/prefill repair. Stale generated Contracts dist caused
  initial API static failures; generated client/dist refreshed from unchanged schema.
- A concurrent heavy build made four database tests exceed their default five-second timeout;
  repeat with a 15-second harness timeout passed all 40 service/export tests. No business rule was weakened.
- PR #669 Full quality, Full test suite, PostgreSQL18 migration/seed and production build
  gates passed in both CI runs; PR merged to `develop` as `747c42e4`.
- Chrome did not expose a targetable window. No live UI, mobile/tablet, keyboard-focus,
  real logo upload or network-loss test is claimed.
- The only schema change is the additive, branch-scoped ProcurementCategory model/migration;
  no dependency, IAM, approval-policy, legal-company scope or Finance source changes. No
  payments, external messages, operational seed or service restart.
- Configured strong worker failed twice at service capacity before editing. Actual failure
  receipts recorded; explicit skill manager takeover owns the checkout. Usage is unknown;
  no worker assessment or independent reviewer approval is fabricated.

## Next work / release gate

The owner resolved #4 in favor of actual authorized branches and #14 as employee
follow-up with approval only through the approved procurement policy. All 16 ordered
items and release checks are complete; PR #669 is merged. No approver was inferred and
no approval permission was granted.
