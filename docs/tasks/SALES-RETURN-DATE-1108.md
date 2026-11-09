# Sales return-only contract dates — 2026-11-08

PC-A; codex/pc-a-sales-return-date-1108 from develop de4a68e3b. User authorizes correction and develop merge after tests, no deployment.

The contract list already renders outbound/return dates independently. Its Sales projection previously examined only ticketSelections, so a floating/contract-only return flight was ignored and the contract departureDate fallback appeared as outbound. Use the existing public salesContractFlights reader for both catalogue and contract-only snapshots. Preserve explicit direction, Tehran travel day and each service's recorded calendar; any actual flight suppresses hotel/general-date fallback for missing flight directions. No data rewrite, schema, dependency, API shape or permission change.

Tests cover contract-only outbound/return with midnight Tehran rollover, an unrelated hotel interval that must not create the missing flight, existing catalogue return-only and round-trip direction/calendar behavior, hotel-only fallback and passenger counts. Final-head quality, test, production build and PostgreSQL gates precede merge.
