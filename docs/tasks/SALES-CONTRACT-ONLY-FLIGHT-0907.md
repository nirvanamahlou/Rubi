# SALES-CONTRACT-ONLY-FLIGHT-0907 — PC-A

Status: COMPLETE_LOCAL. Final runtime checks completed September 8, 2026.

## Scope and behavior

User requested a floating flight for one contract when no company inventory offer exists. The outbound and return columns now independently expose «افزودن بلیت شناور؛ فقط این قرارداد». The contract's selected Master Data origin/destination are reused (return reverses the route). Airline, flight number, departure/arrival in Tehran time and themed cabin choice are required. Switching a direction to manual clears its catalog identity; changing the route clears flight details. Catalog/manual combinations are supported. Existing hotel date suggestions also follow manual flight dates.

## Persistence and module boundary

Additive Sales public helpers encode a version-1 scalar metadata snapshot on the existing FLIGHT service row: `contractFlightVersion`, `direction`, `originId`, `destinationId`, `flightDepartureAt`, `flightArrivalAt`, `flightCarrierName`, `flightNumber`, `flightCabinClass`. UTC instants are persisted. No new Prisma field/migration/dependency is needed. This is a pending-reservation flight description, not inventory, a confirmed supplier booking, or an issued airline ticket.

Manual records require `NEEDS_RESERVATION_CONFIRMATION` and no `referenceId`. They never receive fake catalog offer IDs, never become `SalesContractTicketSelection` rows and never publish into Ticket Management. Confirmation bypasses the Ticket inventory reservation adapter when the catalog selection array is empty; in mixed contracts only actual catalog selections are passed. The versioned reservation request retains service metadata. Reservations reopening and Sales print/PDF consume the additive Sales public snapshot helper. Passenger allocations, branch/owner permissions, audit, optimistic locking, idempotency, pricing and Finance-confirmed settlement remain on their existing paths.

Server validation combines catalog and manual descriptions to reject duplicate directions/sources, wrong routes, malformed version/fields, reversed arrival times and returns before outbound arrival. This does not add a new backend Master Data existence lookup: selected city references use the existing public UI lookup and existing contract route boundary. No direct cross-module table access was added.

## Verification

- Public contracts: 59 tests, typecheck/build and scoped lint passed.
- API Sales: 54 tests, scoped lint, typecheck and production build passed. New tests cover server validation, JSON persistence/presentation, no manual inventory selection write, manual-only reserve bypass, mixed catalog-only allocation and reservation snapshot preservation, including permission denial.
- Web Sales/Reservations: 181 tests, scoped lint/typecheck and 36-route production build passed (final rerun September 8 after host restart).
- Synthetic real-browser interaction passed: independent manual editors, required dates, themed cabin selection, metadata payload, source switch and no mobile overflow. No real customer/contract was created.
- Production PDF renderer generated manual-only and mixed six-passenger synthetic contracts. Both final PDFs are one page and both pages were visually inspected. No layout/field/price redesign was necessary. Manual flights have an explicit pending-reservation label; ticket preview time now matches Tehran entry.

## Handoff / restrictions

Web3100 and API4000 are running the updated local production builds. Web login responds 200 and unauthenticated Sales remains 401. After the host restart, the existing Docker Desktop runtime was started; the existing PostgreSQL container became healthy and a read-only `SELECT 1` through the application's database client passed. Existing credentials/storage keys were reused without reading or changing them. No business record was submitted for testing. The previous Web build was retained under ignored `tmp/contract-only-flight-web-before-0907`.

Local integration worktree only, branch `codex/pc-a-sales-customer-pricing-0907`, based on `e1e8532`. No main/develop/producer worktree change, IAM grant, real-data write or public push. Public Git remote must not receive private CRM contents. Actual flight sourcing/issuance remains an operational reservation task; there is no supplier issuance integration in this work. Existing pending-server QR remains a placeholder, not contract verification.
