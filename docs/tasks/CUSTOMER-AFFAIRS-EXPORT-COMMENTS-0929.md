# CUSTOMER-AFFAIRS-EXPORT-COMMENTS-0929

Owner: PC-B. Base: `origin/develop@24f07449`. Branch: `codex/pc-b-ca-exports-comments-0929`.

## Scope and contract

- Customer Affairs request/ticket XLSX exports use the same authenticated, branch-scoped list service and filters as the on-screen list. Export is capped at 10,000 records, uses inline-string cells and neutralizes formula prefixes. No customer identity/contact fields are exported.
- Report summary is calculated from Customer Affairs records (requests, tickets, satisfaction and corrective actions), now constrained by the selected creation-date range. The PDF control downloads a searchable A4 PDF generated client-side from those same report values, including priority/category breakdowns. It is not an archived server-side document.
- Website comment intake is additive: `POST /customer-affairs/sites/:site/tickets/:externalId/comments`, with `externalCommentId` (1–160 safe characters), `text` (2–2000 characters), and ISO `occurredAt`. Producer is Customer Affairs; consumers are the existing `jahanbastan` and `nystkt` site adapters. The existing site/IAM binding authenticates the connector and requires `customer_affairs.ticket.update`; it cannot alter status, owner, priority or customer references. External ticket ID must belong to the bound site and branch. A unique, site/ticket/comment-scoped delivery key makes retries idempotent; conflicting content is rejected. Response contains only `{ accepted, replay }`.
- Compatibility: old ticket creation/status routes and list/report response shape remain valid. Websites need their own connector configuration and a new `ticket.update` permission before posting comments; this task does not configure secrets, call either live website, send messages or modify real user data.

No schema/migration, dependency/lockfile, IAM grant or cross-module database access changed.

## Verification

Targeted API and Web tests, lint, typecheck, production build and local runtime smoke are recorded in `docs/PROJECT_STATUS.md` on completion.
