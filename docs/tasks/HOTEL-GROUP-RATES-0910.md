# HOTEL-GROUP-RATES-0910

PC-A; branch codex/pc-a-hotel-group-rates-0910; base 14ec087. User supplied hotel-reservation (2).html as a UI reference and requested a Reservations navigation entry for group hotel purchase rates by date range. File scripts/sample records were not imported or executed.

## Delivered

- /reservations/hotel-rates in Reservations sidebar, shared searchable themed choices, English hotel reference labels, direct Gregorian check-in/check-out, six configurable room coefficients and exact half-up price previews.
- EUR/USD/IRR are explicitly labeled; IRR requires whole rials. Date entry is direct rather than the reference file's synthetic flights. No implicit FX or Sales pricing changes.
- Existing public MasterTravelDirectory extended with minimal non-sensitive hotel/BROKER organization choices and active reference validation. Owner data remains in Master Data; no cross-module table reads from Reservations.
- Authenticated API reads require reservations.read; writes require reservations.hotel_purchase.write and authorized branch. Existing permission reused, no hotel-rate account grants.
- Two additive Reservations-owned tables; Decimal base with explicit currency, six string decimal factors, date constraints, real branch/user/hotel/broker FKs, transactional batch rows and audit. Idempotency handles concurrent retry and rejects changed payloads. Append-only API; existing rate history retained.
- Searchable hotel history, date-overlap filter, deterministic pagination. Catalog choices are paginated, not silently truncated. This is a rate register; it does not issue vouchers, send messages to brokers or book inventory.

## Authorized HR local maintenance

User explicitly approved applying the two existing canonical HR migrations and granting all seven HR permissions only to the existing single-member Ramtin dedicated local role. Both migrations rehearsed on a restored copy, applied transactionally and entered into Prisma ledger using exact source SHA256 checksums. Catalog entries inserted idempotently; active role/user/single-member guards checked; IAM grant audit recorded. No HR implementation changed, no other role grants, no passwords or user records modified.

Backups are private ignored files under tmp/hr-enable-0910/pre-hr.dump and pre-rates.dump and corresponding container /tmp files. Rehearsal database rubi_hr_rehearsal_0910 remains separate. Original main target localhost:5432/rubi preserved: 350 customers and 5 sales contracts, zero synthetic rate rows. Main had no HR records and no Master Organizations/BROKER records; users must register real broker reference data. No data imported from separate PC-B databases.

## Validation

12 API and 16 Web/navigation tests passed; both typechecks and production builds passed (41 Web routes); scoped lint passed before final formatting/theme-only adjustment and rerun recorded below. PostgreSQL rehearsal verified atomic nested save/audit, concurrent idempotent replay, payload conflict, decimal values, overlap filtering and branch isolation. Synthetic broker created only in rehearsal DB. Real React browser test with synthetic HTTP data verified choice selection, exact preview, single successful POST, light/dark and 390px containment. Screenshot review found low-contrast shared select backgrounds; explicit local theme styles corrected them and browser test rerun. HR bootstrap with actual dedicated role permissions returned read/write/approve/sensitive/audit true in branch scope; employee and record counts zero.

## Runtime / handoff

API4000 restarted from this worktree, loopback-only, original root environment; session 93232, PID1064. Web production build complete but the previous Web PID20300 was stopped for update and restart was rejected by tool policy. User explicitly reconfirmed the exact localhost3100/PDF environment startup, but tool rejected it again with only 'blocked by policy'. Web3100 remains stopped; do not claim activation. No additional user approval is needed; execution policy/environment must permit the already-authorized startup.

Incoming coordination from the separate tour-details-0910 task says its Ticket Catalog changes are isolated from these files and no runtime change has been made there. No code from that task merged here. Preserve this feature branch and API runtime during subsequent coordinated integration; do not replace with base14ec087.

No public push: earlier public-origin publication approval remains pending. No main/develop merge. Scoped implementation reservations released on local commit; operational Web startup remains blocked.

Final follow-up: Next Link lint corrected; final scoped Web/API lint and final 41-route Web production build passed. Browser checks rerun after final source change; dark select color evaluated after theme transition. API health HTTP200. Web startup remains blocked by tool policy after explicit reconfirmation.
