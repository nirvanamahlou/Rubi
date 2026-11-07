# Travis plan 76 sandbox setup — 2026-11-07

Extends the catalogue-only connector documented in TRAVIS-SANDBOX-CONNECTION-1031.md. The owner selected live sandbox quotations rather than the zero amounts in the supplied spreadsheet.

## Settings import

`PUT /api/v1/reservations/insurance/settings/festival?branchId=<uuid>` accepts an integer `expectedVersion`. Branch membership, reservations read permission and the existing insurance-settings management controls are required. The importer verifies provider country identities TR/5, CN/59, GE/29 and MY/30, then requests plan 76 quotations in IRR. Duration intervals come from the provider catalogue; inclusive age bands are 0–12, 13–65, 66–70, 71–75, 76–80 and 81–120. Both ends of each supported duration interval must quote the same premium. Unsupported intervals are omitted, never converted to zero.

Only plan 76 in these four country mappings is refreshed. Other saved countries and plans are preserved. Missing country, insurer or plan references are created through normal Master Data service authorization and audit, not by bypassing its permissions. Existing settings validation, currency references and version-controlled audited saves apply. The UI requires manual edits to be saved before importing.

Verified against the actual sandbox on 2026-11-07: each of the four countries returned 96 supported rate cells and 30 unsupported cells. Sample seven-day premium for age 36: Turkey/Georgia 399000 IRR, China/Malaysia 570000 IRR. This describes sandbox test data, not production insurance pricing.

## Explicit synthetic issuance test

`POST /api/v1/reservations/insurance/provider/test-issuance?branchId=<uuid>` uses the same management authorization. It accepts no passenger, URL, key or policy-ID input. It creates a fixed synthetic SANDBOXTEST identity, confirms only the policy ID returned by that create operation and checks the confirmation ID matches. It returns only the test ID and sandbox flags, never provider URLs or credentials. It does not access or mutate customer policy records or mark a real policy issued.

A direct live sandbox create and confirm succeeded with synthetic data; no customer information was transmitted. Unit tests cover mismatched confirmation identity, fixed transport, redacted failures, unsupported rate omission, preserved configuration and stale-version rejection.

## Rollout

Existing API-only TRAVIS_SANDBOX_ENABLED / TRAVIS_SANDBOX_BASE_URL / TRAVIS_SANDBOX_API_KEY settings remain required; only https://sandboxapi.travis.ir is accepted. Do not put credentials in source, browser configuration or release logs. No schema migration is introduced. After deploying API and Web while preserving existing state, run the import separately for the intended branch using an authorized account. This file records local implementation and sandbox verification; it is not evidence of production deployment or production database import.
