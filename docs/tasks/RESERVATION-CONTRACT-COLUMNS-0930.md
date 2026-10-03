# RESERVATION-CONTRACT-COLUMNS-0930

PC-A, branch `codex/pc-a-reservation-contract-columns-0930`, base `45ee590e`.

The Reservations request inbox and its Excel export now share the owner's exact 46-column order, from contract number to cancellation date. The existing hotel workflow controls remain at their requested positions. Four manual visa/flight flags use immutable workflow JSON revisions, authenticated actor IDs and server UTC timestamps; the queue resolves branch-scoped display names through IAM. Confirming requires the action flag, and clearing an action requires clearing its confirmation first. The same optimistic workflow version prevents concurrent overwrites. Cancelled Sales contracts reject further flag writes.

Correction opens the existing Sales-backed reservation contract editor. Cancellation asks for a reason and calls the actual versioned Sales cancellation endpoint. Checked values and dates reflect successful Sales audit/status records, not room arrangement edits or operational request cancellation.

## Sources and compatibility

- Contract dates, passengers, age groups at travel/check-in, actual amendment/cancellation, sale totals and discounts: new branch-scoped public Sales projection. Ages below 2, 2–5, 6–11 and 12+ are counted with birthday boundaries.
- Customer debt: Sales-owned payments with only `FINANCE_CONFIRMED` receipts deducted; projected only with an existing financial read/approval permission. IRR and every foreign currency stay separate, using exact decimal arithmetic.
- Commission: Ticket Catalog's public direct-sale commission revisions at contract creation, scoped to the selected offer and optional return pair. Values retain their registered percent unit. Old Sales records do not store a selected package pricing publication/room row, so a tour commission with no exact historical link stays unavailable. Current package pricing is never inferred as a past contract's commission.
- Purchase cost: latest public Reservations service purchases, grouped exactly per currency, with legacy hotel purchase fallback when no current HOTEL purchase exists; hotel purchases are never double counted.
- Hotel, meal service and stars: existing snapshot/arrangement and authorized Master Data lookup; transfer, guide and excursion: voucher settings or service metadata. Missing values display `—`; no guessed supplier or historical price values.
- Return date is an actual selected return leg or hotel checkout; the earliest permitted return bound is not shown as a booked return date.

Shared Travel additions are optional and preserve legacy workflow/client compatibility. No Prisma migration, lockfile/dependency change, operational account update or runtime deployment.

## Validation

65 Reservations Web tests and 17 focused API tests passed, including exact column/Excel ordering, age boundaries, currency totals, financial visibility, historic commissions, server actor/time persistence and operation denial. API/Web typecheck, API build and 55-route Web production build passed. Full application lint was rechecked after correcting type imports. Browser verification with a real operational account and database integration tests were not performed in this isolated checkout. Owner authorized merge to develop; merge waits for repository checks.
