# TOUR-PACKAGES-0908

PC-A. Requested tour bundle consists of a name, route, hotel options and included travel services. A reusable package is separate from its dated departures. A departure references real published outbound/return ticket offers; those same offers remain individually sellable. Availability is the minimum remaining linked ticket capacity. Only existing ticket reservation transactions consume seats. Infants follow the existing seat policy.

Package and departure records must be branch-scoped, permission checked, versioned and idempotent, with an audit trail. Repetition creates another dated departure and new ticket occurrences or explicitly selects existing offers for that date; it must not copy allocations or edit the old departure. Sales stores a versioned execution snapshot. No independent tour stock and no fabricated availability.

Delivery gates: validation and branch/permission tests, shared-inventory concurrency tests, repeat immutability/idempotency tests, isolated PostgreSQL migration and restore rehearsal, affected lint/typecheck/build and UI checks before local cutover. Existing public push gate remains closed.
