# HOTEL-TEMPLATE-IMPORT-1012

- Owner: PC-A, explicitly confirmed by the user; bounded Master Data work requested directly. Permanent module ownership remains PC-B.
- Branch: `codex/pc-a-hotel-template-import-1012`, base `origin/develop@08a7c20c`.
- GitHub actor: user explicitly confirmed `nirvanamahlou` for this task.

## Delivered behavior

The hotel import panel offers the exact supplied `hotel-master-template.xlsx` from `/templates/hotel-master-template.xlsx`. Its bytes, two sheets, styles, row-four headers, three sample hotels and formatted blank rows are preserved. SHA-256: `2b908b87d3078cc0d6f593d63a90fc9ca861aca3559ca561bb6274934cc156cb`.

The existing parser already supports this template. Regression coverage now reads the actual downloadable workbook and checks physical rows 5/6/7, all three hotel names, codes and active/draft status. A service regression verifies hotel creation and audit commands from that same workbook with a mocked database transaction; it does not insert the sample hotels into operational data.

Final commit uses the existing browser-compatible request ID helper, allowing imports from LAN HTTP where `crypto.randomUUID` is unavailable. A UI callback regression verifies the final API call and the parent list-refresh callback. The template action is translated in Persian and English.

## Usage and boundaries

Select the existing country and city, choose the completed workbook, review the preview and confirm registration. The sample rows use `کوش‌آداسی`; other imports must match their selected city. Existing duplicate handling, permissions, audit, file limits and atomic commit behavior are unchanged. Draft hotels remain inactive. Existing unsupported-field rules for images, refund rules and featured flags are unchanged.

No API production, contracts, schema, migrations, dependency or lockfile changes. No operational database imports, runtime rollout or merge. Existing dirty main checkout and accounting worktree were left intact. Work was completed directly without delegation.

## Validation

- Exact source/download SHA-256 equality.
- API parser and service tests: 33 passed, including the supplied workbook.
- Web template rendering and LAN commit tests: 3 passed; shared UUID test passed.
- English coverage: 3 passed.
- Scoped API/Web ESLint and Web typecheck passed.
- API typecheck passed.
- Web production build (`next build --webpack`) passed, including final TypeScript and 59 generated pages.
- Production HTTP template download on isolated localhost3219 returned200 and the identical SHA-256 with a synthetic access-cookie fixture. Unauthenticated requests retain the existing login redirect. Temporary smoke server stopped afterward; no API/database was connected.

Integration handoff: review the PR into `develop`, include the public XLSX in the Web deployment, and use the existing preview/commit flow. No migration is required. Runtime installation follows the repository approval rules.
