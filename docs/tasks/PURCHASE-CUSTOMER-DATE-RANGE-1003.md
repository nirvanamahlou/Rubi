# PURCHASE-CUSTOMER-DATE-RANGE-1003

PC-A; branch `codex/pc-a-purchase-customer-date-range-1003`, base `origin/develop@94b21f53`.

## Behavior

Sales new-contract customer step has buyer name, phone, address and ten-digit postal code above the passenger table. The buyer can remain the first passenger or be a separate canonical Customers person, selected/created through its public API. Separate buyers do not need passenger passport or birth-date fields; existing national-ID validation and identity/role checks still apply. Buyer identity is both `customerId` and `payerCustomerId`. Passenger identities, composition, service allocations and organization selection remain separate.

The four entered values belong to the contract snapshot. A nullable `sales_contracts.buyer_contact` JSONB column stores an AES-256-GCM envelope, using a domain-separated key derived from the existing configured Customer contact key/version. There is no plaintext contact JSON and no new secret/configuration. Sales scoped detail decodes the envelope; authorized contract output prints the saved buyer name, phone, address and postal code. Later Customer profile edits do not change these values. Older contracts keep null and their previous address fallback. Old-client updates preserve the snapshot when the buyer remains the same and clear it when the buyer changes. New contacts use ordinary versioned Customers public mutations; registration retry behavior is retained.

Catalog ticket retrieval is gated by a complete valid confirmed date range. Outbound and return queries use the selected upper bound; return also respects arrival/future lower bounds. Changing the range clears both catalog choices and their catalog flight quotes while preserving unrelated services. Manually entered contract flights and tour ownership stay intact.

## Compatibility and rollout

Producer Sales API; consumer Sales Web; additive optional SalesBuyerContactV1 request/detail/output fields. Schema migration `20261003160000_sales_buyer_contact_snapshot` adds only a nullable JSONB field. Apply migrations before starting the updated API, rebuild Contracts/Database, then API/Web. Reuse existing configured Customer encryption root/version; key-rotation support follows existing contact-key availability policy. No dependency/lockfile, permission or operational database/runtime change is part of this task. Dirty primary checkout was preserved in an isolated writable worktree. No merge is authorized by this new request.

## Validation

- Sales API suite: 87 tests passed, including input validation, output snapshot selection, ciphertext round-trip/tampering/version protection and existing public-boundary checks.
- Web Sales suite: 266 passed / 1 skipped; full affected Web/API typechecks, Sales ESLint and both production builds passed (55 Web routes). The Windows junction worktree uses Webpack for the local build; CI keeps its normal build command.
- Prisma schema validated and client generated; all 113 migrations applied successfully to a new disposable PostgreSQL 18 database.
- PostgreSQL nullable-legacy/opaque-snapshot persistence regression passed; transaction rolled back and disposable container removed.
- Existing output escaping tests cover all four buyer values; date-gate tests verify no fetch before confirmation and correct bounded requests afterward.

No authenticated browser/runtime QA or local rollout was performed. The disposable PostgreSQL fixtures are synthetic and transactional; no actual customer data was exported or committed.
