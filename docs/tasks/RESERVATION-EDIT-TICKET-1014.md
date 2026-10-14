# Reservation flight amendment search

The ticket catalogue deliberately searches active future offers. An existing contract may retain a past, paused or otherwise unavailable ticket. An empty replacement search must not imply that its saved selection is missing.

The flight editor now initializes each direction from the saved flight's Tehran calendar date (including contract-only manual flight metadata). A missing return date no longer inherits the outbound date. For a saved ticket matching the current route, day and airline, an empty result explicitly says that no replacement is available and the current ticket remains. Changing those filters uses the ordinary empty-result message. Genuine request failures remain visible and the existing contract selection/validation are untouched.

Carrier filtering is now included when deciding whether the visible results are empty. No schema, API contract, migration, dependency or operational data change. English text is included and derived offline catalogs synchronized.

Validation: 16 focused tests pass across amendment search, contract preservation, pricing and ticket picker. Scoped ESLint passes. Full Web typecheck, production build (62 routes), formatting and offline English synchronization pass. No local runtime rollout.