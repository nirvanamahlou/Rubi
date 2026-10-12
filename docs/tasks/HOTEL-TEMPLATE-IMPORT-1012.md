# HOTEL-TEMPLATE-IMPORT-1012

## Final scope after the user's profile follow-up (supersedes initial delivery below)

User explicitly authorizes push and develop merge for PR796. Imported hotels now persist all supported profile information: existing description/hotelRules plus seven nullable columns serviceLevel, internalNote, sourceDestination, sourceRefundRules, sourceMainImage, sourceGalleryImages and sourceFeatured. Source refund/image/featured values are descriptive metadata, not authoritative Procurement policy, Documents files or Sales statistics. URLs render as escaped text and are never fetched.

The profile shows these values and facility names and offers direct editing. The edit form hydrates existing values, permits completing missing data, supports multiline text up to each database bound, and clears explicit optional blanks while preserving omitted fields. Shared Master Data editable-field controls extend additively; permission/version/audit behavior remains enforced. Import also accepts a name-only row: a missing code gets a stable generated identity, blank city uses the selected canonical city, blank status defaults to published. Nonempty city mismatches remain invalid.

Migration `20261012140000_hotel_import_profile_fields` is additive and does not backfill or rewrite existing records. Apply it before API/Web rollout. Generic scalar attributes carry the new fields; no new endpoint, dependency or root contract export. No operational import, migration or shared runtime deployment was performed. Metadata discarded by earlier imports can be completed manually or restored through an explicit UPDATE reimport.

Validation: API Master Data527 tests and Web profile/import/catalog/validation/English22 tests passed before the final focused regression; API/Web typechecks and scoped lint passed. All147 migrations applied to isolated PostgreSQL18 `hotel_profile_test` on localhost55439. Final integration/build/CI evidence is recorded with delivery. Merge requires all checks on the exact latest head; main release is outside scope. Prior migration/source reservations release with the frozen review candidate.

## Initial delivery history

Final local validation: PostgreSQL integration passed with real preview/commit creating all three hotels, public profile reads, completing a missing note, persisting edits across reread and duplicate SKIP retaining those edits. All147 migrations succeeded; the first integration run hit60s while the host was building concurrently, and rerun passed in10.56s under a bounded180s integration allowance. Final parser32 tests passed. Shared Contracts143 tests passed. API production build passed; Web compilation passed with final build steps pending. The synthetic database is separate from operational data.

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
