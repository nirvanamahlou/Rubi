# REPORT-EXCEL-BIDI-1110 — PC-C

The agency performance XLSX exposed contextual bidirectional ordering: Persian rial labels mixed with Latin digits, neutral plus signs and currency symbols were displayed in the wrong visual order. Underlying report values were already correct.

The shared Reporting XLSX writer now applies a dedicated centered, left-to-right, wrapped style to recognized amount/currency strings. Left-to-right marks bound each pair and nonbreaking spaces keep the symbol attached to its amount. Column widths stay bounded; affected data rows reserve enough height for wrapping. The sheet remains RTL, B Nazanin remains the font and the report title remains16pt. Numeric cells retain their existing Excel numeric representation and15-digit precision guard.

Only XLSX presentation changes. Source values, contract/passenger counts, currency components, CSV, API and monetary aggregation remain unchanged. No FX calculation, schema, migration, dependency or production change.

Verification:167 targeted Reporting tests passed, including positive/negative decimal amounts, rial/euro/dollar and other ISO currencies, exact large values, OOXML style-count integrity, readable currency pairs and unchanged CSV/source values. A synthetic workbook was generated outside Git. Desktop Excel verification was attempted, but the UI automation could not reliably address the modal file picker; no visual acceptance is claimed. Hosted build/typecheck/full tests/PostgreSQL gates must pass on the final PR head before the owner-authorized develop merge. No deployment is authorized.
