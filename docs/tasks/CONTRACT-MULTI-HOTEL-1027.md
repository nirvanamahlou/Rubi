# Contract multi-hotel stays

PC-A;2026-10-27. User authorizes a hotel-combination checkbox, searchable hotels across cities, independently entered stays and per-hotel room/guest composition, correct contract print output and develop merge.

The Hotel service owns visibility, for both hotel-only and flight+hotel contracts. Multi-hotel selection does not change flight destinations. Primary room allocation remains canonical; additional hotels have their own ordered room rows with actual MasterRoomType FKs, adults and child/infant ages. Each stay retains explicit chronological dates. Additional room counts cannot exceed the contract's primary hotel guest count. Existing primary commercial totals remain unchanged; this does not create duplicate charged services or automatic supplier bookings.

Sales owns the optional additive rooms field on SalesHotelStayInput. Master Data references validate hotel/city and linked active room types through the existing public service. Create/update transactions write the room children; presenters and reservation snapshots carry the saved room composition, and contract HTML/PDF uses escaped hotel/room snapshots and each hotel's dates. Updates omitting existing room fields preserve saved data; explicit invalid or empty supplied rooms are rejected. Existing historical itinerary rows without composition remain readable.

Apply additive migration20261027120000_sales_hotel_stay_rooms before deploying the API. It adds a child table with parent cascade, restricted real room-type FK, ordinal uniqueness and guest/JSON bounds; it does not change old columns or data. Keep this table on application rollback. No operational migration or runtime/deployment is authorized by this task.

Validation covers cross-city choices, room-type ownership, independent dates, hotel-only/flight+hotel/flight-only visibility, payload restoration, escaped printed room composition, transactional writes and real PostgreSQL constraints/cascade in the existing disposable database CI gate. Exact-head full lint/types/test/build/PostgreSQL checks must pass before owner-authorized merge.
