# Combined hotel pricing navigation

User authorizes correcting the disabled first-step pricing navigation after adding additional hotels, and merging to develop after successful checks.

Root cause: automatic checkout for the primary hotel was derived from the return trip date, while additional stays require chronological, non-overlapping dates. Entering a second stay inside the trip therefore failed a boolean guard without a visible reason. The primary automatic checkout now derives from the first additional check-in. Existing provenance preserves manual/legacy entered dates; conflicting manual dates display a correction message. No dates in stored contracts are rewritten.

The shared hotel validation error preserves every previous rejection and provides the parent form with the same decision and explanation. Pricing, contracts/API, room/guest normalization, optional journeys, permissions and backend validation are unchanged. Six additive English translations cover the new messages. No schema/migration/dependency or production release.

Regression coverage includes automatic splitting and changed boundaries, preserved manual checkout, invalid or missing hotel/room dates and references, payload stay dates, and the rendered navigation button for hotel-only and flight+hotel. See PROJECT_STATUS for final validation and CI receipt.
