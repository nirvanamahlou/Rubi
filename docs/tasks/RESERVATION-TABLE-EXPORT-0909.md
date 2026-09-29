# RESERVATION-TABLE-EXPORT-0909
PC-A. Reservations Web only; base local integration 5c3f6b5.

Replace the request cards with a dense RTL semantic table matching the supplied column order: contract, destination, English hotel, check-in/out, SGL/DBL/EXT/SUIT, total rooms, hotel request/confirmation, arrangement correction/date and status. Preserve full-row click/Enter/Space selection and action panel. New status colors only the first cell #FFC0C0; other workflow colors retained. Horizontally scrollable with sticky header and visible selection outline.

Fields come from the existing authorized public intake API; latest persisted arrangement overrides original commercial room counts. Correction flag/date specifically describes the persisted accommodation arrangement. Suite count has no dedicated source field and displays missing rather than fabricated zero. Boolean status indicators are read-only, not workflow mutations. Dates display Gregorian.

Public Master Data resolves unique hotel/city names with six concurrent workers and snapshot fallback. Filtering and XLSX use the same resolved projection. API pagination now loads successive authorized pages, fails rather than silently truncating at the 10,000-row safeguard, and detects duplicate IDs across pages. Request cancellations/errors discard incomplete result sets. No backend change.

XLSX export includes all filtered/sorted rows, not the current visual page. Browser-side OOXML stored ZIP uses existing repository codec primitives adapted within Reservations, literal inline strings (no formulas), XML escaping/control cleanup, RTL sheet, frozen header and autofilter. No external service or download-on-load. Unknown values stay missing.

Validation: 39 foundation tests including pagination beyond 100, latest arrangement, branch/status/date filtering across visual pages, zero vs missing and formula-like text safety; scoped ESLint/typecheck and 40-route production build passed. Isolated real React browser flow with synthetic data verifies table/row selection/status filter/download: 13 filtered records across two pages. Independent bundled openpyxl read verifies 14 rows including header, 15 columns, RTL/frozen header/autofilter. Synthetic screenshot visually checked; no operational contract or receipt data used. Artifacts under ignored tmp/reservation-table.

No API/schema/migration/IAM/data mutation. Local Web3100 refresh preserves PDF environment. Public push remains pending earlier explicit authorization; local commit only.
