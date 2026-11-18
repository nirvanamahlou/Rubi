# Floating tour sale import

This is a sales-only catalog under `/sales/pricing/floating`. A tour is created through the existing definition editor with `details.isFloating = true` and appears in this catalog without requiring an inventory ticket or a supplier hotel purchase. Existing charter tour departures and supplier costs are not modified by this importer.

## Import

Select the tour, explicitly enter nights (1–365), choose dated or monthly mode, then upload XLSX (5 MB, 2,000 data rows). Preview is read-only. Final confirmation reparses the file, revalidates references and matches the preview digest, definition version, catalog version and FX snapshot. A database transaction locks the definition and saves the catalog and immutable import audit together. Concurrent changes require a fresh preview. Raw files are not retained.

The standard downloadable workbook is the supplied `tour-price-template-latest.xlsx`, retaining its guide. It uses `departure_date`, `hotel_name`, `loc`, `room` (`ROOM TYPE` also accepted), `service`, `DBL`, `SGL`, `CHD W BED`, `child no bed`, `infant`, `flight per person`, `flight child w bed`, `EXTRA`; optional `commission` is retained separately. Only registered active saleable hotels in the tour destination(s) resolve. Names are whitespace/case normalized; ambiguity fails. Room/service are separate; a leading star is removed from service. Blank rooms inherit only a single unambiguous previous room for that hotel/date/night count.

All prices are per person. DBL/SGL/EXTRA add adult flight. Child bed and foreign no-bed prices add child flight (adult fallback); Toman/IRR no-bed remains a final price. Infant remains final, including explicit mixed money. Blank category cells remain absent even when flight has a price. No currency means Toman, converted exactly to IRR; USD/EUR/TRY text or numeric formatting is supported. Mixed IRR and one foreign currency stay separate; incompatible foreign currencies fail. Commission is never subtracted automatically. Sale prices are neither halved for DBL nor recorded as purchase costs.

Dates accept Persian YYYY/MM/DD, Gregorian YYYY-MM-DD and Excel serial dates. Each date/night combination is an independent floating sale period with return date derived from its selected nights. Reimport replaces the full set of rows for touched date/night combinations, preserving other periods. Monthly import ignores row dates and replaces the monthly set; only calendar and month numbers are stored, never an invented year or discount.

Sort is by exact IRR-equivalent DBL per-person price using the current approved FX rates, then hotel names; missing rates fail rather than invent a conversion. FX values are snapshotted in the import audit. Display amounts round up; stored sale amounts remain exact.

## Combined templates

Standard paired-row mode requires two consecutive distinct hotels for the same date, identical shared prices and commission, and destination order/night splits from the combined tour itinerary. The total nights must match the selected import nights. Shared price is kept once.

The dedicated downloadable combined template uses one row per package, `hotel_name_1/2`, `room_1/2`, `service_1/2`, `loc_1/2`, `nights_1/2` plus the price columns. Night counts must sum to import nights. Optional `add_flight_dbl`, `add_flight_sgl`, `add_flight_extra`, `add_flight_chd w bed`, `add_flight_child no bed`, `add_flight_infant` accept YES/NO (default YES; infant never adds adult flight). It reuses the same price rules and stores a shared price once.

## Access and data

Read uses `package_pricing.read`; preview/commit require `package_pricing.period.manage`, and all queries are restricted to actor branches. The new screen inherits access from the existing package management screen. `FloatingTourSaleCatalog` is a versioned current view; `FloatingTourSaleImport` retains actor, digest, options, resolved rows and FX snapshot. Foreign keys prevent deleting referenced tour definitions. Route/service changes after sale prices exist are rejected; defining another tour preserves history. Workbook formulas, external links, active content and ZIP expansion overflow are rejected.
