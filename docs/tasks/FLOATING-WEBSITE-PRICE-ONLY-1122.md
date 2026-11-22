# Floating website products: price display only

The owner requires both floating standalone flights (`flight.supplyType=FLOATING`)
and floating tour products (`kind=floating-tour`) to display their published prices
without accepting new website reservations, for every connected site.

The existing catalog flags are authoritative: `enabled=true` retains visibility,
`previewOnly=true` requests a price-only presentation, and `salesStopped=true`
disables checkout. Fare data and floating hotel/room rates remain present. This
policy is derived at export time, including publications saved before this change;
it cannot be cleared using the publication's manual continue-sales switch.

Consumers, including Niyayesh, must hide reserve/add-to-cart buttons and passenger,
room, and +/- selection controls on these products. They should continue rendering
prices and itinerary details. No new protocol field or migration is required.

The producer rejects floating flight booking quotes in either direction and new
floating-tour previews, holds and draft creation. Existing recorded orders retain
their status/recovery and payment-reconciliation paths.

Site coordination was sent to the Niyayesh site task as explicitly requested by
the owner. Online deployment is separate from merging this code.
