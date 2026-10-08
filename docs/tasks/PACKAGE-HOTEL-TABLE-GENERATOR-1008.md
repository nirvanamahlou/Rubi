# PACKAGE-HOTEL-TABLE-GENERATOR-1008

PC-A; codex/pc-a-package-hotel-table-generator-1008, base ce960122. User explicitly authorizes implementation and develop merge. Confirmed: prices per person; child-with-bed from the difference between occupancy tariffs.

## Behavior and compatibility

Remove the publication-basis explanation and editable family occupant controls. Select actual hotel/broker rate rows by checkbox; selected rows automatically show single, double and child-with-bed prices. Exact public occupancy quotes must cover every travel night. Select the cheapest valid room type for each composition within one currency/board context. Double totals divide by two. Child chooses the cheapest complete two-adult-plus-child room tariff, then subtracts the two-adult tariff of that same room type. Fixed room fees/markup/commission cancel in the child difference; child flight/cost and percentage effects remain. Exact BigInt currency arithmetic preserves independent currencies and amounts above JS safe integers. Child bands start at6 or carry explicit with-bed wording; no-bed tariffs and room capacity alone do not fabricate child prices. Multiple currency/board contexts, missing or conflicting nightly quotes are unavailable, not zero. Legacy explicit composition factors remain supported.

Optional selectedHotelRateIds opts into this new calculation. Validate unique current rate-row IDs in the authorized tour/batch before save and recheck at publication. Omitted legacy commands preserve stored selection; null historical drafts/publications keep original room-total semantics. Explicit [] remains empty. Maker/checker, branch scope, CAS, advisory locks, actual paid flight sources, real rate FKs and immutable publication history remain authoritative. Selected hotels must have all three prices before publishing.

## Generator

Only selected immutable published sale prices, names, dates, room types and board cross the same-origin iframe boundary. No purchase costs, profit, broker identity, credentials, PII, requests or persistent storage are transferred. Bounded allowlist validation and parent-window/origin checks reject unrelated messages. The existing Pack Generator provides native template choice and PNG/PDF export. Changing a template retains imported hotel prices. ISO-currency parts render as exact strings without floating-point conversion; amounts from different currencies are displayed separately. Existing standalone XLSX/DOCX imports remain unchanged.

## Data and rollout

Add nullable selectedHotelRateIds JSON to Package Pricing draft/publication and nullable room name/board/child age metadata to published price rows. No destructive SQL or historical backfill. Apply the additive migration before API/Web deployment. No operational database writes or local runtime rollout in this task. Locks release with the final review candidate.

## Verification

Focused tests cover exact prices, varying nights, incomplete/context-ambiguous tariffs, same-room child difference, fixed cancellation, large integers, legacy factors, selection persistence/clear and immutable publication, unchecked hotel exclusion, sale-only transfer, spoofed messages and native exact currency rendering. Scoped lint/typechecks, API/Web production builds and exact-head CI are merge gates. Browser authentication/operational writes are not claimed.
