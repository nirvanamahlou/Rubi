# Tour definition controls — PC-A — 2026-11-09

Owner authorizes the requested tour UI changes and develop merge after successful final checks. Branch `codex/pc-a-tour-form-1109`, base `083cedb62`.

- New-tour action is grouped at the physical left of the RTL header.
- New definitions support multiple authorized branches. Each uses the existing independent branch-owned package command and a stable branch/payload idempotency key. Completed branches remain visible and are removed from the retry selection if a later command fails. Editing retains the existing package branch; no capacity, departure or financial records are shared or moved.
- Origin and destination cities default their respective airport codes. Airport selectors include the city airports first, then other airports in that country, excluding missing/invalid codes. Changing or clearing a city replaces/clears the default. Manual airport selection remains editable. Separate raw code inputs are removed.
- Optional `details.destinationAirportCode` and `details.isCombined` extend V1 compatibly. Existing definitions remain readable; the current API persists the descriptive JSON. The combined flag describes the tour and does not fabricate itinerary destinations or seat capacity.
- Master Data's public reference boundary verifies supplied airports are active and belong to the selected city's country. Country is read directly or through the airport city. Tour images remain branch-owned: multi-branch creation requires adding images later when editing each branch.

Validation: 8 focused Web tests and 49 API tests passed, including persistence/reload, country restriction, missing city, and partial branch creation/retry. Scoped lint, type checks and production build are enforced by the final-head hosted gates. No migration, dependency change, operational data mutation or deployment.
