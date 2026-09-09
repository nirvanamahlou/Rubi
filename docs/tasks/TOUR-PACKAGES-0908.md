# TOUR-PACKAGES-0908

PC-A. Requested tour bundle consists of a name, route, hotel options and included travel services. A reusable package is separate from its dated departures. A departure references real published outbound/return ticket offers; those same offers remain individually sellable. Availability is the minimum remaining linked ticket capacity. Only existing ticket reservation transactions consume seats. Infants follow the existing seat policy.

Package and departure records must be branch-scoped, permission checked, versioned and idempotent, with an audit trail. Repetition creates another dated departure and new ticket occurrences or explicitly selects existing offers for that date; it must not copy allocations or edit the old departure. Sales stores a versioned execution snapshot. No independent tour stock and no fabricated availability.

Delivery gates: validation and branch/permission tests, shared-inventory concurrency tests, repeat immutability/idempotency tests, isolated PostgreSQL migration and restore rehearsal, affected lint/typecheck/build and UI checks before local cutover. Existing public push gate remains closed.

## Delivered workflow

1. Ticket Management → تعریف تور و نوبت برگزاری → تعریف تور جدید: name, branch, origin/destination, hotel options in destination, registered insurance, outbound/return transfer and visa.
2. Choose a package and start/end dates. Select real published offers for the respective Tehran calendar days, or explicitly publish a new real flight with times and purchased capacity. Publishing also makes that offer available in standalone Sales.
3. Save a departure. Remaining capacity is the minimum available linked-ticket capacity. Defining a package/departure itself consumes no seats.
4. Repeat for next week opens new dates; flight publication prefills the prior carrier/number/times/total capacity, all editable before explicit confirmation. No automated weekly job is created.
5. New Sales contract → تور → existing departure: expands linked flights and included services, limits hotel choice to package options, preserves existing passenger/price/payment workflow. There is no additional TOUR charge. Public selection validation rejects altered branch/route/version/ticket/service linkage; final seat reservation still uses the original atomic ledger.

Definitions/departures are immutable in this slice: create a new definition for a changed bundle. Existing browser-preview ticket products were not misrepresented as persistent stock; this feature uses the server's published-offer contract. No insurer issuance connection, provider booking or purchase-cost integration is fabricated.

## Verification and local activation

Backend commits fd325c7, UI7844907, tour-first flow3949878. Tests:22 isolated travel/tour PostgreSQL/domain,58 targeted Sales/Master,291 final affected Web,60 Contracts,73 Database; full Web900 plus new provenance test. Full API948 passed/83 optional skipped/one Customers hook timeout, then that entire13-test file passed separately. Affected lint/typecheck, Prisma generate/validate and production API/Web36 routes passed. Browser fixtures verified desktop/mobile, city filtering, themed selectors, template save, repeat flight prefill and Sales linkage; fixtures and images are ignored, synthetic and not production data.

Private rehearsal backup: tmp/rubi-tour-before-rehearsal-0908.dump. Isolated databases rubi_tour_empty_0908 and rubi_tour_restore_0908 preserved. Empty43 migrations and seed twice passed; restored-copy upgrade preserved existing business counts/checksums. Fresh live backup tmp/rubi-tour-before-live-0908.dump preceded the single additive migration on local rubi. No historical migration rewrite, live seed, IAM grant or business-record creation. Known older migration checksum provenance differences were preserved, not reset or hidden.

Web3100 and API4000 are running from this worktree; pages/health/new tour bundle200, protected tour routes401 unauthenticated, CORS204 for3100. Prior Web build retained in tmp/tour-web-before-0908. Existing document configuration and PDF Chrome/B Nazanin paths preserved. No public push, merge, server deployment or live authenticated walkthrough claimed. Task-specific shared reservations released.
