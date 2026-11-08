# Transfer count guard — 2026-11-08

PC-A; owner authorizes implementation and develop merge.

Owner clarification: infants do not consume flight seat capacity (flight pricing is unchanged). Existing Sales confirmation already reserves adults plus children only for both registered passengers and legacy aggregate parties; preserve this rule and verify the existing flight-capacity regression.

Removed the highlighted zero/count/room-night helper sentence. The quotation editor uses the canonical contract passenger limit and displays an error when either transfer leg exceeds it. Supplier-form saves and hotel purchase saves also validate server-side. Hotel purchases capture the booked limit before operational room overrides, so edited form occupancy cannot increase it.

Defaults exclude infants and the booked AGE_2_6 / CHD_2_TO_6 child band. The existing age-band boundary is six: room ages under six are free, ages six and above count. Contracts lacking room occupancy use their registered passenger bands; historical aggregate parties retain unknown child ages rather than inventing dates. Existing saved quotes and purchases are not rewritten.

Tests cover age boundaries, zero, each leg, fractional and excessive counts, removed passengers, UI error/removed copy and server rejection before writes. Focused contracts/Web/API checks pass; hosted final-head gates are mandatory before merge. No schema, dependency, migration, operational data or deployment change.
