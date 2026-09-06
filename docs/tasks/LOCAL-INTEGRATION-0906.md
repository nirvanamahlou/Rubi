# Local integration — PC-A — 2026-09-06

## Authorization and scope

The user explicitly approved a separate local integration branch combining the latest
module changes and preserved passport work, retaining Sales. No source branch,
main/develop, remote PR or public publication is changed.

Branch: codex/pc-a-local-integration-0906. Base: local Sales 2cc7a9c.

Integrated tips:

- develop 092109d (includes current Documents/Customers agency reconciliation).
- Agency B2B 2003561; Marketing communications a13fb22; HR foundation 2c8350d.
- Shared calendar viewport 4501545, retaining Sales English Gregorian mode.
- Passport preservation 75afc50, reconciled against current Documents.
- Customer connections 2014d01, retaining current Master Data reference loader,
  encrypted passport input, staged document uploads and masked/audited reveal.
- Ticket remaining-capacity, Master Data local-complete/catalog-usability,
  Documents archive-actions and Customer Affairs foundation tips already ancestors.
  Obsolete/demo branches are not blindly reintroduced.

Docs merge resolutions preserve both handoffs. This worktree does not transfer
producer locks or authorize future changes to their branches.

## Validation

- Full lint and full typecheck passed after all merges.
- Full test command passed: Web 719, API 876; API 74 conditional tests skipped.
  Contract/database/config/worker suites passed as part of the full command.
- Full monorepo build passed. Direct Next production build repeated with ignored
  local public API URL, bypassing stale Turbo environment cache: 36 routes.
- All 34 migrations passed on new PostgreSQL database rubi_integration_0906_check.
- Seed ran twice there; counts stable: 84 permissions, 6 roles, 2 synthetic customers.
  No operational seed was run.
- Authenticated browser/real document upload QA is not claimed.

## Runtime blocked: operational migration history

The existing local rubi database already has the passport migration. Its old API/Web
remain running; no process replacement or operational migration was performed.
Before any upgrade, a custom-format pg_dump backup was created and its archive list
read successfully: tmp/integration-backup-0906/rubi-before.dump (621123 bytes).
The backup is ignored by Git and remains local; no data/key is published.

Of 33 applied migrations, 26 match exact checksums and five differ only in LF/CRLF.
Two match neither current files nor historical Git versions, even after EOL normalization:

- 20260823084001_master_data_foundation
- 20260825123000_legal_entity_context

Read-only Prisma schema diff additionally shows legacy default/index-name differences
besides the expected new B2B tables. Its generated SQL was NOT executed. No checksum
was rewritten, migration reset/resolution forced, or existing data removed.

Next: reconcile the operational migration history and test an upgrade on a restored
copy of this backup before authorizing runtime replacement. Preserve the existing
Documents storage path/key; do not run the recovered launcher with a newly generated key.
The recovery provides optional passport number/files for local use, not a completed
production passport/visa/expiry domain or a resolution of DEC-OPEN-006.
