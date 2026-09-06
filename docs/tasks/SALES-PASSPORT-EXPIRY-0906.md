# SALES-PASSPORT-EXPIRY-0906

PC-A; user approved the persistent expiry field and Migration lock transfer.
Local branch: `codex/pc-a-sales-passport-expiry-0906`.

## Behavior

- The payer remains the editable customer row. The checkbox copies that row to passenger slot one without increasing passenger count. Edits stay synchronized while linked; the passenger copy is read-only.
- Replacing an occupied first slot requires confirmation. Unlinking restores its displaced draft. Organization customers cannot become passengers.
- Existing customers gain the passenger role only through the Customers public update API, preserving existing roles and optimistic version checks. No IAM grants or cross-module private queries.
- Sales shows passport number and expiry in the shared Customers entry table. Existing passport identity remains encrypted/masked in Customers. Explicit reading for contract verification uses the existing permission-protected, audited sensitive-read reason; it does not grant access.
- The new nullable `Customer.passportExpiryDate` is date-only metadata. Optional public request/detail fields preserve older clients; omitted updates do not clear the date. Invalid date-only values and non-person non-null expiry are rejected.
- Date metadata is returned with the permitted customer detail; raw passport numbers still require the existing sensitive-read authorization. No passport value is added to Sales localStorage or fabricated Documents files.
- Saved identities, contact-write versions and failure-review flags remain synchronized. Uncertain creates require checking existing records before retrying.

## Verification and rollout

- 211 combined Sales/Customers Web tests passed; final focused people-model run passed 11 tests, including existing-profile update, role preservation, checkbox restoration and failure handling. Web typecheck and scoped Web/API lint passed after corrections.
- 88 Customers API tests passed, including date persistence, omitted-update compatibility and invalid date rejection. API production build passed.
- All 38 migrations passed on isolated empty PostgreSQL and seed ran twice. A fresh backup was restored to an isolated upgrade database; the single additive migration passed with existing business counts and historical checksums unchanged.
- Real repository checks on the upgrade copy verified date round-trip, unchanged identity ciphertext, stale-version rejection and branch-scope rejection. The operational customer records were not used for test mutations.
- Backup/rehearsal tools and copies remain local and ignored by Git. No operational seed, permission changes, public push or producer worktree edits are authorized.
- Authenticated visual QA has not been performed.
- Final gates: 41 Contracts and 71 Database tests passed; the production Web build passed all 36 routes. The isolated upgrade-copy repository test passed.
- Operational activation: retained fresh backup `tmp/rubi-before-passport-expiry-live-0906.dump` (670545 bytes), applied only `20260906160000_customer_passport_expiry`, verified unchanged counts/checksums, restarted Web3100/API4000 with the existing document key and CORS settings. Login/new bundle/API health 200, unauthenticated contract 307 and Customers API 401.
- Prior Web retained at `tmp/passport-expiry-web-before-0906`. This task's scoped Migration, contract and documentation reservations are released on local completion; other producer review responsibilities are unchanged.
