# PACKAGE-TEMPLATE-GALLERY-1012

PC-B adds the six supplied distinct posters to the Package Generator's package tab: Iran → Kish, Qeshm, Mashhad; Vietnam → standard and luxury; China → four-city tour. The duplicate Mashhad attachment is not repeated.

Selecting a country exposes its designs. The original image is retained until a field is edited. Users click text to edit inline or select it in the side panel; size, color, alignment and local Rubi/Tahoma/Arial font are configurable. Hotel and destination photos and logos can be replaced locally. Reset restores the original field. Changes remain separately in memory for each design while switching to other designs or the existing spreadsheet editor. PNG and PDF use the same dimensions and layout as the preview, including the two landscape references.

This is a presentation editor for the supplied sample templates. It does not import those printed values as real package prices, connect new Excel layouts, convert currencies, persist changes, or call Documents. Existing route permissions and the existing spreadsheet editor are preserved. No shared contract, API, schema, migration, dependency or lockfile changes.

Validation includes all six actual browser renders; direct-click price edits, template switching/state preservation, return to the old package editor, and real PNG/PDF generation at twice the original pixel dimensions. Focused tests check original image hashes, country grouping, unique field IDs and all field bounds. Final lint/typecheck/build and CI evidence is recorded with publication.

Final local checks (2026-10-12): Web lint and typecheck passed; production build passed (59 pages); pricing-management Vitest passed 14 files / 52 tests; node syntax checks and git diff --check passed. Scope scan contains only Package Generator assets/editor, focused tests and own documentation entries. Secret/PII pattern scan found no credentials or traveler identifiers. Existing public agency contact details come from supplied template artwork. All six browser PNG/PDF exports are real; no Documents service or fake artifact is used. Gallery edits are session-only; no server persistence.

