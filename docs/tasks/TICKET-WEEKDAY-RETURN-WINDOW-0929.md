# TICKET-WEEKDAY-RETURN-WINDOW-0929

PC-A · branch `codex/pc-a-ticket-weekday-window-0929` · owner-requested Ticket Catalog / Sales change.

The owner's final clarification supersedes the original occurrence-count interpretation: **the number beneath a weekday is stay length, not repetition count**. Every selected weekday in the inclusive outbound start/end range creates an outbound flight. For round trips, each departure creates a reverse flight that many calendar days later, including returns after the outbound end date. For example, 2026-10-01 through 2026-10-30 with Saturday/Sunday and stay=2 creates eight outbounds and eight returns. Identical reverse dates with the same return-row facts create one shared offer.

The creation dialog first asks one-way or round-trip. A compact route/date/airline header, weekday checkboxes and stay inputs precede a flight table. Round-trip reveals a second row for the return flight number, aircraft, baggage, departure/arrival time and arrival-day offset. Explicit arrival-day offset supports overnight flights. Capacity, cabin class, supply and manifest remain selectable. Existing train, bus, combined-route and single-offer edit flows remain available. Preview shows all outbound/return dates before publication. Publications settle in groups of eight and keep their idempotency identities for unchanged retries; the batch is not one database transaction, so a partial failure is reported with instructions to retry the same draft.

## Public contract and persistence

- Producer: Ticket Catalog publication, managed projection, search and reservation public service.
- Consumers: Sales return picker and reserve/revalidate, ticket-price pair picker and bounded Tour load selection/public validation.
- `TicketOfferV1` and `TicketOfferCreateV1` add optional nullable `returnMinDays` / `returnMaxDays`. Values are integer 0..365 with Min <= Max when both exist; each absent bound is unrestricted. Legacy rows remain null. Revising through an older client that omits the fields preserves the stored limits; linked offers cannot change their limits.
- `TicketOfferSearchV1.outboundOfferId` is optional. When supplied, the service authorizes the outbound branch, requires the reverse route and constrains calendar bounds **before pagination**. Eligibility uses Tehran calendar dates, includes both Min and Max and requires return departure after outbound departure and no earlier than arrival. Trip group and original automatic pair do not restrict eligible alternatives.
- Modern Tehran calendar bounds use UTC+03:30. Flight wall times use selected airports' IANA zones and are stored as UTC.
- Additive migration `20260929120000_ticket_return_window` adds two nullable Int columns and a SQL CHECK. No backfill, destructive migration, dependency changes or operational-data edits.
- Both browser/domain proposal models stay mirrored; saved offers expose limits after reload and existing offer edit/details can view or revise them.

## Validation and rollout

Completed: API full suite 1798 passed / 175 skipped, including the three new PostgreSQL policy tests and two management lifecycle/HTTP tests on a fresh isolated database after all 102 migrations. Focused Web Ticket Catalog regressions, final API/Web/contracts lint, strict API/Web types, API build and Web production build (55 routes) pass. Prisma validate and a formatted temporary schema comparison pass without shared schema formatting changes. Source formatting and diff checks pass. The owner explicitly approved correcting inherited blank-line formatting in the shared status/data-model documents; those whitespace-only corrections are complete. No previous task text or status has been altered.

Targeted calendar, generation, boundary, forged-selection and PostgreSQL lifecycle regressions cover the clarified October example, inclusive endpoints, returns beyond the range, independent weekday stay lengths, deduplicated reverse offers, overnight arrivals, unrestricted legacy limits, later-week returns, branch/route authorization, atomic capacity rejection and SQL/linked-offer protection. Required lint/typecheck/build checks run for affected packages. Visual browser QA could not complete because the browser/desktop helper failed; the temporary fixture page and processes were removed without changing authentication rules.

This delivery has **not applied a migration to the operational local database**. Deploy the additive migration before activating the API/Web together: `pnpm --filter @nora/database exec prisma migrate deploy`; generate/build the database package and rebuild the affected applications. Ticket creation does not assign sale prices; Sales pricing remains the owner of standalone and round-trip fares.
