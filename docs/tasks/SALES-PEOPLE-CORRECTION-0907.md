# SALES-PEOPLE-CORRECTION-0907

PC-A; base 0cc22a0; codex/pc-a-sales-customer-pricing-0907. COMPLETE_LOCAL.

## User-authorized behavior

The previous recovery guard required restoring the national ID from an uncertain creation. This trapped a corrected row. Confirmation now reads the prior attempted identity without changing it, then resolves the currently entered national ID. Any earlier registration remains intact, with a nonblocking notice if it was found.

An exact accessible current-ID match is adopted into the row and updated through the existing Customers public update API, with its current version and existing permissions. A duplicate creation conflict resolves and resumes during the same confirmation instead of requiring manual selection. Blank optional fields in a new row preserve existing contacts/passport; entered nonblank details are applied. No fuzzy matching, automatic merge, deletion, or cross-module table access.

## Public contract / safety

CustomerRegistrationLookupRequest adds optional matchByNationalId (boolean). Omitted/false preserves the previous strict name/date matching behavior; true permits explicit corrections after exact national-ID fingerprint matching. Read and sensitive-read permissions, active/unmerged person filter, branch scope, no-store POST body, and sensitive-read audit are unchanged. Lookup itself never writes; update permission and optimistic locking still apply. Inaccessible/failed lookup does not trigger blind repeated creation. Pending national ID is in-memory only.

No schema, migration, seed, IAM, dependency or real-customer data change. No publication to the public remote, merge, or unrelated worktree edits.

## Verification

- 249 combined Web Sales/Customers tests passed; final focused people model: 25 passed.
- 93 API Customers tests and 48 Contracts tests passed.
- Scoped ESLint and Web/API/Contracts typechecks passed; API production build passed.
- Tests cover changed IDs with and without a retained prior registration, current-record update using its version, preservation of optional data, duplicate recovery on one confirmation, inaccessible duplicates without retry loops, and permission/audit compatibility.
- Web production build passed (36 routes). Web3100 login and API4000 health return 200; unauthenticated registration lookup remains 401. Both local services restarted with the new build; previous Web build retained at ignored tmp/people-correction-web-before-0907.
- Scoped public-contract and central-doc reservations released; local commits only.

## Operator note

The old open page needs the new bundle. Preserve unsaved people entries before refreshing: they are intentionally in memory only. This release has not modified the user's actual passenger record or performed an authenticated real-data walkthrough.
