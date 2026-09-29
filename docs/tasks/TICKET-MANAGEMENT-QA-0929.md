# Ticket management QA — PC-A — 2026-09-29

Both flight lists now derive from managed server offers, including ten independent offers with the same schedule. Twelve cards fit the first page; counters and route filters use the same projection. Existing local ground-ticket definitions remain supported. Exact server identity selects edit, status, repeat, capacity and delete operations. A fresh browser can edit persisted core fields. Remaining capacity reflects holds. Stable publication IDs prevent duplicate retries and submission guards prevent double clicks.

Archiving retains fare and commission history, hides archived round-trip partners and forbids later edits. Reserved offers cannot be archived. No schema, migration, dependency or operational passenger/ticket changes.

Validation: 136 Web Ticket Catalog tests, 140 API Ticket Catalog tests (15 environment-gated skipped), and two real isolated PostgreSQL/HTTP lifecycle tests passed. The latter create ten synthetic offers, edit with optimistic versions, pause/activate, hold/release, archive, check permissions, idempotency and retained price/commission records. API and Web typechecks and production builds passed; final integration checks recorded in PR. Authenticated browser clicking is not claimed.
