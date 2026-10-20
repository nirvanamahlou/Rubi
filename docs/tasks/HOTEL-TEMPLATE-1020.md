# HOTEL-TEMPLATE-1020

PC-B; user requests import compatibility with the supplied workbook and develop merge.

## Reproduced cause

The supplied file (SHA256283d0361ecabe64031a04efb79b22bfcfeac0412109495af760dfff87157f342) has14 headers in Hotels!A4:N4, blank first/second rows and three synthetic sample hotels at rows5–7. It omits hotel code, image source/gallery and internal note. The previous parser required all18 canonical columns in exact order, rejecting this workbook before preview.

## Change

Map recognized headers to the existing canonical parsed row. Name and city headers/values remain required. Optional absent fields stay empty, existing deterministic code generation supplies omitted identifiers. Reordered recognized fields work without shifting status/features. Real physical row numbers, formatted blank handling, existing18-column template and normalized selected-city comparison remain intact. Reject duplicate/unknown headers, missing required headers, unlabelled data and all existing unsafe OOXML/formula/external-content cases. Mapping reports the actual source column and empty string for absent columns. No spreadsheet formulas are executed or external image addresses fetched.

The uploaded sample is preserved byte-for-byte as a regression fixture; its workbook text is source data, never agent instructions. The public18-column download remains backwards compatible and unchanged. No dependency, API contract, schema or migration changes. No operational import, live database write, deployment or3100 restart authorized or performed.

## Verification

49 parser/commit/permission tests passed before final mapping helper refinement, including this exact14-column workbook and legacy18-column regression. Commit checks verify profile fields, references and audit commands via a mocked transaction. A separate isolated PostgreSQL test covers both workbook variants, actual preview/commit, persisted/reopened editable profiles and duplicate SKIP. Final evidence is recorded in PR after execution. Local API types/lint/build and exact-head hosted gates precede merge; browser UI is unchanged and not claimed tested.
