# Hotel room types from the rate editor

The manual hotel purchase-rate editor can now define a canonical room type inline
and attach it to the selected hotel. Users with Reservations write access and
Master Data read/update access can open the action; Master Data create permission
is checked only if that room type does not already exist. Existing room links are
preserved with the hotel's current version check. The new type appears as an empty
room-rate row so its occupancy and prices can be entered immediately.

The implementation consumes the public Master Data API client and does not add a
contract, schema, migration, permission grant, dependency, or operational data
change. English labels are included in the Web overrides.

Verification: focused hotel editor, interaction and registration tests pass (19
tests); scoped ESLint, full Web typecheck and production build (62 routes) pass.
Exact-head CI is required before merge to `develop`. No local 3100 activation was
requested as part of this work item.
