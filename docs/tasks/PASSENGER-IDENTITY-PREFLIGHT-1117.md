# PASSENGER-IDENTITY-PREFLIGHT-1117 — PC-A

Owner requests a quick ERP passenger validation before moving from the website passenger form to review/payment, with inline errors before any bank charge. Owner clarifies that an existing identical passenger must reuse the existing ERP profile; another person's passport must still fail before payment.

## Contract and compatibility

Add authenticated POST sales/site-commerce/v1/:site/people/check with private/no-store response. Existing site binding, JSON write guard and native Sales authorization apply. Body contains 1–30 nested CustomerMutationDto passengers. Return only indexed valid/code results. No record IDs, names from stored profiles, encrypted identities or fingerprints leave Customers. No DB writes, contracts, holds, receipts or audit mutations occur during preflight.

Customers probes globally unique national/passport fingerprints with a bounded two-row read, including inactive/merged/cross-branch conflicts; unavailable identities return a generic review code. Same national-ID/passport profile passes and existing authorized syncWebsitePassenger reuses it. Preserve NSS-PASSENGER-IDENTITY-SYNC-1115: same-national-ID supplied name/DOB updates remain authorized; do not restore retired strict registration matching. Passenger validation and final DB uniqueness remain authoritative. Batch duplicate identities fail for both indexes.

Website consumer stages in passenger-preflight-1117: ERPClient check_people; create_booking checks before inserting new local order/link (paid/idempotent completed orders are not rechecked); payment prepare/start rechecks before capacity/token, including cached token paths. Initial form renders indexed fixed safe messages and focuses first affected passenger. Network/malformed replies fail closed. Bounded customer rate limit; no polling. Existing verified-payment reconciliation is unchanged.

## Validation and release

Synthetic ERP preflight/transport plus existing SiteCommerce/delivery tests: 54 passing on isolated runtime overlay. Formatting/lint passed; final typecheck/build and exact revised head gates pending. Website 9 isolated backend tests pass, including no order insert/commit and no amount/capacity/bank work after rejected identities. Website 78 existing frontend tests and typecheck pass; production build pending.

No migration, dependencies, financial/inventory writes or profile merges. Not deployed. Merge/deploy requires owner approval under root AGENTS. Existing bank-verified order22 remains ERP-pending until its conflicting passenger identity is corrected/reviewed; this feature does not fabricate or complete that contract.
