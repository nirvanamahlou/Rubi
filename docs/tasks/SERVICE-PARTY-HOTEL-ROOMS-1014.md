# Service parties and hotel room breakdown

Owner: PC-A. Branch: codex/pc-a-service-party-hotel-rooms-1014.

## Required behavior

- Show the existing adult/child/infant party when flight or transfer is enabled. Flight and transfer share that party, with infants not consuming flight seats.
- Visa gets its own adult/child counts and child ages. The passenger identity step must map applicants to the entered count; silently assigning visas to arbitrary travelers is unsafe. User confirmed explicit applicant selection.
- On the route/services page, selecting hotel opens destination hotel selection and room count. Each room has an independent canonical room type, adult count, child count, and one age field per child. Show configured capacity for that room type.
- Room counts, not a requirement to assign named travelers to individual rooms. Validate aggregate guest identities and child ages against the hotel party without asking which traveler sleeps in which room.
- Different room types may coexist at one hotel. Validate each room separately, including rates for every night; aggregate Decimal amounts only within the same currency. Never validate heterogeneous rooms by multiplying the first room's capacity or rate.

## Persistence and compatibility

Add normalized Sales-owned room rows under the existing hotel selection: stable ordinal, canonical room type FK, snapshot name, adult count and child ages. Preserve the existing hotel selection as a compatibility summary; legacy selections without room rows retain their existing behavior. Use additive migration only; no live migration is authorized by this source task.

Sales producers: create, detail, amend, reservation-request snapshot and contract output. Reservations consumers: capacity/rate validation through its public rate service, form/voucher previews and PDFs, purchase context. Preserve branch permissions, optimistic versions, immutable previously issued documents and source ownership.

## Acceptance checks

Two rooms of different types (2 adults + child age 5; 1 adult), independent visa party, flight/transfer shared counts, toggling services and removing rooms clears stale fields. Reject invalid ages, unknown room types, excess occupancy, uncovered nights and mismatched guest totals on the server. Verify legacy create/amend/read and all three document outputs. Full lint/typecheck/test/build and exact-head CI before develop merge.

## Implemented and validation

Service-dependent first-step controls, explicit visa identity selection, normalized independent room products, per-room rate/capacity checks and same-currency Decimal totals are implemented. Contract, reservation form and voucher render the room breakdown. Legacy selections retain their existing path; purchase reference comparison requires one complete source batch for all rooms.

Targeted checks passed: 70 API tests, 45 Sales/reservation model tests, 4 service-party rendering/change-handler tests. Prisma validation passed. The additive migration passed disposable PostgreSQL 18.1 checks on port55483: distinct room ages, canonical FK rejection, unique ordinal, delete restriction and parent cascade. The disposable container was removed. No operational migration or runtime activation was performed. Full CI migration/seed/build gates are required before develop merge.
