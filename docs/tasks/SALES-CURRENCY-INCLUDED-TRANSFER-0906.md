# SALES-CURRENCY-INCLUDED-TRANSFER-0906 — PC-A

## Scope and compatibility

- Local-only follow-up from 0ded773; no producer branch edits, merge, IAM grant, migration, dependency change or public publication.
- Sales loads all pages of active currencies through Master Data's public API. Pricing and payment selectors persist the selected code, with searchable themed controls. Missing/inactive codes cannot pass the new-form preflight or final submit. IRR is a default only when registered and active; otherwise use the first active code, or no default if unavailable.
- Payment method and existing reference dropdowns reuse the Sales themed combobox, including keyboard navigation and active-option styling. Directly typed passenger counts remain unchanged.
- New-form payloads using service pricing mark TRANSFER metadata.includedWithoutCharge=true and emit an empty pricing array. Direction metadata and passenger allocation remain intact and continue into the existing reservation snapshot. Ticket output already prints TRANSFER INCLUDED with the chosen directions.
- Shared pricing derives no price component for an explicitly included transfer and rejects any attached price or using the inclusion flag for another kind. The API checks the supplied bill against this derived bill. An exclusively included-transfer contract may have an empty bill, but no payment plan.
- Compatibility is opt-in through existing metadata: historical unmarked transfers and legacy price components are unchanged; no existing rows are rewritten. Resumed new-form drafts drop stale transfer pricing from their payload, without changing other service prices.
- Hotel nightly/total math, ticket purchase ownership, Finance-confirmed settlement, branch/owner scope and authorization remain unchanged.

## Validation

- 41 public-contract tests, 91 Sales Web tests, and 44 Sales/Reservations API tests passed (5 optional database integration tests skipped). Existing ticket-output inclusion test remains passing.
- All 11 affected lint/typecheck/dependency gates and API production build passed.
- Production Web build passed for 36 routes. Web3100 and API4000 restarted with the existing environment and document encryption key preserved. Health/login and the newly served Sales bundle returned 200; Sales redirects unauthenticated users (307), the API denies unauthenticated access (401), and CORS permits the configured local origin. Prior Web retained in ignored tmp/currency-transfer-web-before-0906.
- COMPLETE_LOCAL: implementation commits 13baaf6 and aed55fc; task-specific reservations released. No public push.
- No authenticated visual walkthrough or real contract/customer creation for testing is claimed. No database migration or operational seed is needed.
