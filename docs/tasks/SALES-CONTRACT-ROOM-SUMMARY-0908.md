# SALES-CONTRACT-ROOM-SUMMARY-0908 — PC-A

## User request and implementation

The screenshot identifies the per-passenger room column for removal and Other Services as the destination for purchased room totals. Print/PDF now excludes passenger accommodation labels and reallocates table widths to the remaining columns for both individual and agency contracts.

Other Services displays the saved `hotelSelection.roomCount`, `singleRoomCount`, `doubleRoomCount` and `extraBedCount`, for example: «مجموع 3 اتاق: 2 سینگل، 1 دبل، 2 تخت اضافه». Extra beds do not increment room count. The summary never derives purchased room quantities or room assignments from passengers; individual room placement is not printed. Hotel section still uses the Master Data room-product name (e.g. Standard/Deluxe), independently of purchased quantities.

Legacy contracts without a saved room breakdown show total rooms with an explicit unrecorded breakdown; no single/double type is fabricated. If a historical breakdown exceeds the saved total, the composition is marked for review. No hotel means no room-summary row.

## Verification and scope

- 181 Sales Web tests pass, including examples for single/double/mixed rooms, extra beds, legacy/inconsistent data, no hotel, both customer kinds, and independence from passenger accommodation.
- Scoped lint and Web typecheck passed.
- Three production-rendered synthetic PDFs inspected in full: six passengers and agency-six each one A4; 42 passengers two pages. All four pages retain table headings, amounts, hotel product type, QR, contacts, signatures and prior terms without clipping.
- Only output/template, tests and scoped docs changed. No API, migration, schema, dependency, passenger input/validation, financial calculation, permission or business-data mutation.
- Base 05c5945 on local branch codex/pc-a-sales-customer-pricing-0907. No producer worktree, main/develop, merge or public push. Existing downloaded PDFs need regeneration using the contract's PDF action.

Status: COMPLETE_LOCAL. Web production build passed (36 routes), updated server runs at localhost:3100, and Web login/API health return 200. Prior Web build retained under ignored tmp/contract-room-summary-web-before-0908. Changes committed locally; scoped reservation released. No public push.
