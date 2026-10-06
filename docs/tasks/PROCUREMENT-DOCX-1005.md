# PROCUREMENT-DOCX-1005 — PC-B

Status: IN_PROGRESS / owner clarification required before final delivery.

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
| 4 | Include the three companies in branch selection | Pending owner choice: separate legal-company context versus authorized existing branches. No artificial Branch or scope widening. |
| 5 | Optional organizational unit | Optional in UI and submission rules; supplied unit/requester consistency is still checked. |
| 6 | Create purchase category above dropdown | Added explicit entry button; category is persisted with the request and immediately added to reusable options. A separately persisted category catalog is not implemented. |
| 7 | Remove long supplier guidance | Removed from request form. |
| 8 | Optional need description | Optional in UI and API submission rules. |
| 9 | Remove goods description | Hidden for goods; service description, measurement unit and positive quantity remain validated. Historical goods descriptions are retained. |
| 10 | Remove attachments/notes from request form | UI removed; existing documents/notes are retained in the draft and record history. |
| 11 | Remove large draft/edit header | Removed visually, retaining a screen-reader heading and focus target. |
| 12 | Supplier logo beside name | Added authenticated owner logo preview using existing metadata/read and clean-file checks; refreshes after supplier save. Live upload appearance not verified. |
| 13 | Open matching forms/data on record click | Real record titles open matching request/section or supplier edit forms; operational histories expand real fields/lines/documents. Fixed fake preview values removed. Complete prefilled per-operation edit flows remain unfinished. |
| 14 | Choose recipient and accept/reject in their Workbench | Pending owner choice between policy-approved approver and employee follow-up recipient. No approval/permission policy bypass implemented. |
| 15 | Complete purchase order form/actions/documents | Approved requests appear in order list. Form includes supplier tied to selected quotation, delivery date/location, tracking and archived upload. Tracking/documents persist in order and version snapshot. Backend rejects mismatched supplier. Order amendment selection now restores the persisted supplier/currency as well as existing lines. Choices show payload-backed identifiers/amounts and stale cross-supplier options are excluded. Full individual order edit/delete icon flows are unfinished; no destructive financial history removal. |
| 16 | Remove invoice/finance section | Removed home navigation card and maps the old invoice-section URL to home. Existing API, historical invoice tabs and Finance integrations are retained. |

Additional defect repaired: supplier edit previously called create; the existing owner
record/version is now passed to `persistWithLogo`. Detail-load failures are shown in the
page, and supplier logo/profile queries are refreshed after save.

## Verification and boundaries

- Web Procurement tests: 10 files / 41 tests passed. Scoped ESLint and Web typecheck passed.
- API local Procurement unit tests: 57 passed; the ordinary run skipped its database-gated service/export suites (36 at that checkpoint). The service suite was subsequently run explicitly with 34 passing cases; the three export-database tests were not executed.
- Dedicated PostgreSQL18 service run: 34 passed, including optional-field publication,
  tracking/document persistence and mismatched-supplier transaction rollback.
- Temporary test database only: 119 existing migrations applied at the suite's exact
  localhost:55473 / procurement_001_api_test allowlist; no operational database mutation.
- API scoped lint/typecheck/build passed. Web scoped lint/typecheck and final production build passed (55 routes), including the final selection/prefill repair. Stale generated Database package caused
  initial API static failures; generated client/dist refreshed from unchanged schema.
- A concurrent heavy build made seven database tests exceed their five-second timeout;
  repeat with a 30-second harness timeout passed all 34. No business rule was weakened.
- Chrome did not expose a targetable window. No live UI, mobile/tablet, keyboard-focus,
  real logo upload or network-loss test is claimed.
- No schema/migration/dependency/IAM, approval policy, legal-company scope or Finance source
  changes. No payments, external messages, operational seed or service restart.
- Configured strong worker failed twice at service capacity before editing. Actual failure
  receipts recorded; explicit skill manager takeover owns the checkout. Usage is unknown;
  no worker assessment or independent reviewer approval is fabricated.

## Next work / release gate

Resolve owner questions #4/#14 before dependent implementation. Complete category catalog
and operation-specific prefilled edits/order actions under separately recorded boundaries
as needed. Approval/tenant authority changes require the skill's focused advice, frozen
contract and independent review. Do not label this whole document complete, merge it or
delete automation-2 yet. No PR/merge has been performed for this unfinished task.
