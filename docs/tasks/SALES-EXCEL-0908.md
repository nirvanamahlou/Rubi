# SALES-EXCEL-0908

PC-A; branch codex/pc-a-sales-excel-0908 from integrated runtime ac063f5. User requested Excel beside the contract list, preserving the existing tours, pricing and payment rules.

## Delivered

- Additive `GET /api/v1/sales/contracts/export.xlsx`; same applied search (including authorized payment-reference search), settlement filter and sorting as the current list. Pagination is omitted. This version accepts only the list UI's search/settlement/sort controls; unsupported keys fail validation.
- Requires existing `sales.export` plus existing own/assigned/branch/all contract-read permission. No grants or changed visibility. Workbook only includes customer display name and listed contract summary; no passenger identity/contact/document or payment evidence/reference contents.
- One bounded ordered query, 2,000-contract maximum with explicit refusal if exceeded, never silent page-only/truncated export. XLSX is transient, private/no-store, no public share/archive.
- Persian headings, navy theme, RTL, frozen headings, native filters, print headings, sortable Gregorian dates (last-change calendar day in Tehran), typed and grouped amounts. Each row represents one contract/currency; no cross-currency sums. Amount/confirmed-paid/outstanding use the existing Sales presentation and Finance-confirmed balance calculation.
- Excel cannot preserve more than 15 significant numeric digits; exceptional amounts remain exact text with a visible note. Names and other input are escaped inline strings, not executable formulas or hyperlinks.
- Successful output records one existing Sales audit entry per contract with only format/version metadata. Audit failure prevents download. No schema/migration/seed/dependency change; no producer-module imports or direct queries.
- UI provides loading, no-results disable, download status and permission/network error feedback. The applied list query is used, not unsubmitted search text or the currently viewed page.

## Validation

67 Sales API tests (including actual HTTP route with real AuthGuard and synthetic IAM response), 198 Sales Web tests, scoped lint, API/Web typechecks. XLSX checked through Artifact Tool and independent openpyxl reader for cell types, precision, dates, RTL, filters, frozen headers and absence of formulas; synthetic preview inspected. Production build/activation final result recorded in PROJECT_STATUS.

No real contract was created/modified for QA; no real export or authenticated browser walkthrough claimed. Private synthetic QA artifacts are ignored under tmp/sales-excel-qa. Prior Web build retained under tmp/sales-excel-web-before-0908. Existing local database and PDF/document settings are unchanged. No public push, PR or merge under the existing unresolved publication gate.
