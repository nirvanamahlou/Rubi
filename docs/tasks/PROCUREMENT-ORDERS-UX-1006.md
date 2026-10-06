# Procurement order and record previews — 2026-10-06

## User intent
In Purchase & Supply, show an uploaded supplier logo beside its name, let users open saved record data in a preview across sections, and provide an end-to-end purchase order form and polished record view.

## Accepted behavior
- Use the authenticated Master Data logo/document preview. Do not expose unscanned or inaccessible files; show a neutral fallback.
- Each real saved record in Procurement sections has an explicit view action. The preview is read-only and shows the persisted values, line items and linked Documents references for that record.
- Create a purchase order by selecting a request that is already approved under its current workflow policy. The chosen supplier/source must satisfy the existing request/order consistency validation. Capture expected delivery date, location, tracking code and supporting file references with the existing Documents service.
- Existing order edit uses versioned amendment. The trash control is the reasoned cancellation command (history-preserving) and keeps all existing receipt, invoice, payable and approval guards. Do not hard-delete or create/issue/send an order from preview.
- Lead-frozen API extension: versioned `AMEND_ORDER` persists expected delivery date, delivery location, payment terms and tracking code already exposed by the UI. Preserve the ISSUED-only, unchanged-quantity, no receipt/service-acceptance/invoice, required reason, request expected-version, idempotency, immutable-version and approval re-entry guards. Omitted optional extension fields preserve existing values. Existing exact document/version references are read-only and preserved on amendments; attachment editing/removal is out of scope. No schema/migration, IAM/permission, cross-module-table, payment or dispatch changes.
- The order picker shows only APPROVED/SOURCING requests with a current eligible unexpired selected quotation and matching active supplier, and still relies on server validation. A request without the prerequisite directs the user to the quotation/selection step; no arbitrary supplier or automatic dispatch.
- Respect current server permissions, actor identity, branch scope, supplier contracts, scan and document access. No IAM grants, schema/migration, payment, external order dispatch, operational seed or runtime changes.

## Required verification
Focused Procurement API/Web tests; API/Web lint, typecheck and production build; inspect exact diff and neighboring permission/document flows; independent final review of the frozen contract; exact-head CI. Regressions cover amendment metadata and omitted-field/document preservation, immutable prior versions, fresh approval, existing permission/stale-version/dependency guards, eligible requests/quotes/suppliers, read-only previews, and document access/scan. If available, test in the actual authenticated 3100 browser, including RTL and file-reference display. Report any runtime test not performed.

## Evidence
Latest upstream at task start: origin/develop 6c631406. DOCX PR #669 already implemented the underlying approved-request order command, supplier consistency, tracking, archived attachments and versioned amendment/cancellation. Current UI review found a per-request operation form and expandable inline RecordCard, but no clearly available section-level approved-request picker or dedicated view action; supplier list calls the authenticated logo preview for real Master Data suppliers.
