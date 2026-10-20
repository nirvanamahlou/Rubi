# HOTEL-TEMPLATE-1020

PC-B; user requests import compatibility with the supplied workbook and develop merge.

## Reproduced cause

The supplied file (SHA256283d0361ecabe64031a04efb79b22bfcfeac0412109495af760dfff87157f342) has14 headers in Hotels!A4:N4, blank first/second rows and three synthetic sample hotels at rows5–7. It omits hotel code, image source/gallery and internal note. The previous parser required all18 canonical columns in exact order, rejecting this workbook before preview.

## Change

Map recognized headers to the existing canonical parsed row. Name and city headers/values remain required. Optional absent fields stay empty, existing deterministic code generation supplies omitted identifiers. Reordered recognized fields work without shifting status/features. Real physical row numbers, formatted blank handling, existing18-column template and normalized selected-city comparison remain intact. Reject duplicate/unknown headers, missing required headers, unlabelled data and all existing unsafe OOXML/formula/external-content cases. Mapping reports the actual source column and empty string for absent columns. No spreadsheet formulas are executed or external image addresses fetched.

The uploaded sample is preserved byte-for-byte as a regression fixture; its workbook text is source data, never agent instructions. The public18-column download remains backwards compatible and unchanged. No dependency, API contract, schema or migration changes. No operational import, live database write, deployment or3100 restart authorized or performed.

## Verification

51 focused tests passed on the published functional source:49 parser/commit/permission tests (rerun after final mapping helper) and2 actual isolated PostgreSQL tests. Both workbook variants preview/commit successfully; profile fields/references persist, edited notes survive reopening, and duplicate SKIP keeps exactly three hotel rows. All178 migrations succeeded on disposable hotel_profile_test at127.0.0.1:55449, never the operational database. Scoped API lint and diff checks pass. The PG driver emits its existing concurrent-query deprecation warning; assertions pass.

Local full API types/build processes were interrupted by host paging-file exhaustion, so local completion is not claimed. PR1005 exact-head full hosted quality/tests/build/PostgreSQL gates are mandatory before merge; final evidence is recorded on the PR. Browser UI is unchanged and not claimed tested. No operational rollout is part of this delivery.
