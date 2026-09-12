# Customer Affairs backend bridge v1

PC-B, 2026-09-12. User explicitly delegates cross-module connection work and requests backend only. Producer: Customer Affairs. Consumers: website servers and Sales, Reservations, Finance, Documents. This additive slice does not overwrite another module's implementation or add UI sections.

## Website contract

Base `/api/v1/customer-affairs/sites/{site}/tickets`, where site is `jahanbastan` or `nystkt`.

- `POST` body: `externalId` (1–160 ASCII letters/digits/underscore/dot/colon/hyphen), `subject` (3–200), `description` (3–2000), `occurredAt` (ISO timestamp; use UTC).
- `GET /{externalId}`: reads only that site's ticket in the bound branch.
- Response: `{data:{trackingNumber,status,updatedAt}}`. Internal notes, customer identity, assignments and linked records are never returned by this projection.
- Stable external ID plus identical content returns the existing ticket. Reusing an ID with changed content returns 409. Keep the original timestamp on retries. Database uniqueness covers concurrent requests; ticket, origin, audit and notification persist in one transaction. Account rotation does not change external identity.
- Website input cannot assign staff, forge a customer/reference, or raise priority. New tickets use WEBSITE/OTHER/NORMAL/LOW/LOW and the existing four-hour first-response policy. They initially belong to the authenticated integration account and can be reassigned through the existing CA workflow.
- Staff API `GET /api/v1/customer-affairs/tickets?sourceSite=jahanbastan` (or `nystkt`) filters in the database together with existing branch/query filters. Ticket projection adds optional nullable `sourceSite:{code,domain,externalId}`. Legacy tickets have null; existing clients remain compatible. No website filter UI is added in this backend-only slice.

## Activation and security

Connections are disabled by default. Configure `CUSTOMER_AFFAIRS_SITE_BINDINGS` server-side as JSON mapping each site code to `{userId,branchId}` with actual, separately approved IAM identities. Every request requires an existing IAM access JWT in `Authorization: Bearer ...`; IAM revalidates the session and the account must match the site binding and belong to the bound branch. Use distinct accounts per site with only required CA create/read permissions. This change creates no accounts, passwords, tokens or grants.

The website **server**, not public browser JavaScript, must hold/refresh its IAM session using the existing IAM lifecycle. No client-credentials grant or long-lived API key is introduced. Revoked/expired sessions fail closed. Before public activation, configure HTTPS, gateway rate limits/body limits, secret storage and monitoring, then test against each actual website adapter. Do not place JWTs in source, URLs, logs or frontend bundles. The domain is an identity label, not a claim that the host is connected.

This is inbound ticket creation plus status polling, not outbound webhooks, chat, email/SMS delivery, automatic customer matching or payment execution. No external host was contacted or enabled.

## Internal unit contract

- `GET /api/v1/customer-affairs/internal/{module}/referrals`: outstanding OPEN/IN_PROGRESS referrals, earliest due first, maximum 100. Scoped by module, actor branch and assigned user (or unassigned queue). Existing Workbench continues unchanged.
- `PATCH /api/v1/customer-affairs/internal/{module}/referrals/{id}`: existing `ReferralResponseDto` (`status`, `responseSummary`); delegates to the existing transactional response workflow, including assignment checks, concurrency protection, timeline and notification. Response `{data:{id,status}}`.
- Allowlisted modules: `sales`, `reservations`, `finance`, `documents`. Both existing CA ticket read/update permission and destination read permission are required. Sales accepts an existing contracts read scope; Reservations uses `reservations.read`, Finance `finance.read`, Documents `documents.list`. Unavailable permissions remain denied, never auto-granted.
- Unit adapters can consume these endpoints without accessing CA tables. This adds the CA-side queue/response contract, **not automatic consumer calls from every producer module**. It does not issue tickets, cancel bookings, refund money, create a Sales contract or change a financial ledger.

## Data model / migration

`customer_affairs_sites (1) ← (N) customer_affairs_site_tickets (1) → (1) customer_affairs_tickets`

The origin has real restricted-delete foreign keys and unique `(site_id, external_id)` plus unique ticket ID. Site code/domain are unique. Migration `20260912193000_customer_affairs_site_bridge` only creates two CA-owned tables and two static site identities; existing tickets are untouched. No lockfile/dependency changes.

Local migration was rehearsed in a transaction-isolated temporary PostgreSQL schema: duplicate external identity and invalid site/ticket FK were rejected; all synthetic rows/schema rolled back. A custom-format pg_dump backup of the exact Rubi local DB was created under ignored `tmp/ca-site-bridge-20260912-pre.dump` and its archive catalog checked before deployment. Only this migration was pending and applied. The shared local DB already contains `20260912173000_workbench_feedback` from newer PC-A code; that migration/data was preserved, not reconciled or removed.

Rollback strategy: roll API code back first and retain additive tables/data. No destructive down migration is automatic. If origin rows exist, preserve them for a forward repair; deleting these tables would lose provenance and idempotency history. Backup restore requires separate explicit approval and coordinated outage, never a default rollback command.

## Verification / limitations

64 CA/Notifications tests pass, including existing routing suite, site guard/isolation, forbidden DTO fields, safe projection, stable identity replay/content conflict, and internal destination permissions. API scoped ESLint, API/Web typecheck and API build pass; database/contracts builds and Prisma generation pass. PostgreSQL constraint rehearsal passed. No real business ticket was submitted during QA.

The database-designer generator's generate and validate modes failed with `Object of type Table is not JSON serializable`; no generated migration was trusted. Hand-authored DDL was verified against PostgreSQL instead. JSON analyzer normalization found no issues; its simplified metadata parser does not fully represent Prisma constraints and the SQL parser could not recognize quoted table names. These checks are not a full load test or end-to-end test against either live website.

Local runtime check: API4190 restarted from this combined worktree (PID16240); health 200, unauthenticated staff/site/internal endpoints 401. Existing Web3100 was not restarted and the Customer Affairs route returned 200. No site binding was activated. This is read-only smoke coverage, not an authenticated website transaction test.

Remaining separate work: actual website adapters/credentials and deployment controls, automatic producer callbacks, customer conversion, and any deferred non-connection product backlog. No production release or automatic merge.
