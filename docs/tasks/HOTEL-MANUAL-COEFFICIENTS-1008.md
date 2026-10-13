# HOTEL-MANUAL-COEFFICIENTS-1008

PC-A; owner-authorized implementation and CI-gated develop merge.

## Interface and calculations

Country → city → searchable hotel uses existing public Master Data choices, vertically stacked. Each selected hotel retains its unsaved panel while switching hotels. Its coefficient disclosure starts with double, single and child-with-bed rows. Adults, children and each child's minimum/exclusive maximum ages are themed choices, not free-text composition strings. Double starts at2 per the owner's example; other coefficients stay blank until explicitly supplied. Blank rows do not become fabricated rates.

Each real hotel room type has its own base/night and a composition purchase/sale table. Purchase = room base × coefficient. Select individual rows, all priced rows, or one composition across rooms; fixed/percentage increases and decreases are always relative to purchase. Set-sale supports an exact override. Reapplying a rule does not compound markup. Room base, coefficient, dates or currency changes regenerate valid metadata; invalid drafts cannot silently save previously valid prices. Invalid bulk changes are atomic, with no partial application.

Manual child ranges are below15 and respect exclusive upper bounds. Missing room types require Master Data setup. At least one priced room and composition plus the existing broker are required. The existing write permission/branch scope,90000-byte client guard, versions, CAS and replay-safe keys remain. This is not a new broker identity or grant.

## Compatibility and removal boundary

Only the old manual grid and coefficient editing are replaced. Old manual factors are not converted; the user supplies new bases and factors, then saves a new version. Saved manual prices show purchase and sale and reopen the new panel instead of allowing direct edits that would contradict metadata. Original history is retained. Imported Excel tariffs and their editor remain unchanged; the manual panel refuses to convert them. Mixed imported/legacy revisions keep compatibility behavior. Tour-linked packs are directed to existing Package Pricing Management instead of being silently detached into independent packs.

The optional contract fields are stored in the existing nullable occupancy JSON with no schema/migration/dependency change. Reservations is the producer; Sales reads the public projection and opts into SALE quoting. The default quote remains PURCHASE; absent sale fields fall back to the imported/legacy amount. Deploy API/Contracts before Web. Older editors attempting to modify manual derived amounts receive validation failure rather than corrupting stored metadata.

## Verification

Focused model, interaction, rendering, validation, persistence/replay and public-projection tests cover independent room bases, common hotel coefficients, selected-only adjustments, non-compounding, currency rounding, date changes, invalid ages, duplicate combinations, atomic negative rejection, server recomputation and unchanged source rates. Synthetic fixtures contain no operational data. Full affected suites, lint, typechecks and production builds plus exact-head GitHub quality/test/build/PostgreSQL migration-seed checks gate merge.

No authenticated browser, operational import, historical purge, runtime restart or deployment is claimed.

Local results:464 Web/Sales/hotel-rate/localization tests passed (one existing skip),315 API Reservations/Sales passed (seven opt-in skips),120 Contracts passed. Scoped ESLint, formatting/offline catalogue consistency, Web/API typechecks and production builds passed (56 Web routes). Refreshed generated Database declarations after two pre-existing develop schema changes; generation used a nonconnecting synthetic URL, not an operational migration. Fixed a shared test-fixture mutation; an existing rendering test timed out under simultaneous build load and passed on isolated suite rerun. Exact-source-head remote CI remains mandatory after integrating current develop.
