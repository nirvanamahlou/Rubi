# SALES-RUNTIME-INTEGRATION-0908

- COMPUTER_ID: PC-A. User explicitly approved local integration and activation of latest Sales with current CRM, preserving customer changes and grouped navigation.
- Branch: codex/pc-a-sales-runtime-integration-0908 in local-integration-0906; original Sales5380719 and current-CRM source branches remain intact.
- Normal merge bd4fb50 combines Sales with grouped-sidebar93a4c0d/f2cc52a/current develop. Merge a9223e0 additionally preserves the final sidebar0f9ff4e icons/row-size follow-up. Both sidebar commits were handed off by their owner before cutover. No remote merge, push, new PR, force push or main/develop change.

## Resolution and compatibility

- AppModule includes both Sales and Notifications; public exports include Sales/Travel and Notifications. Both histories/status entries retained in central documents. Automatic Customers/schema merges preserve the two branches' additions.
- Sales output company code now consumes public LegalEntityCode instead of duplicating the former two-company union. Two new output/audit tests cover JAHAN_ACADEMIA and GHESATI_RO. Brand selection remains the existing public branding implementation.
- Updated an old sidebar source assertion for wrapped, breakable labels instead of mandatory truncation. No business logic, permission grant, seed or dependency changes.

## Verification

- API: 934 passed / 81 optional integration tests skipped; final targeted output suite7 passed, including both added company cases. API typecheck/build and lint pass. Public Contracts60 tests and build pass.
- Initial Web suite899 passed with one obsolete sidebar assertion. After correcting it,209 Sales/navigation/foundation tests and final15 sidebar/foundation tests pass. Web source ESLint, typecheck and final production build36 routes pass. Full Web lint also traversed ignored local generated QA bundles under apps/web/tmp and failed there; these are not repository production source and were not deleted or committed.
- Final full Web rerun passes:900 tests in131 files on the final integrated source.
- Existing local rubi database lists all42 migrations. An early historical checksum differs for 20260823084001_master_data_foundation; history was not rewritten. Read-only Prisma schema comparison shows index/FK-name differences and existing UUID/array default differences, no missing Sales/Customers/Documents/Notifications tables or columns. Read-only ORM checks for those four modules pass. No migrate deploy, schema push, reset, seed, real-data mutation or document-key rotation performed.
- PostgreSQL listens on IPv4 loopback. API launch uses the existing root .env without printing its values, maps localhost to127.0.0.1 for this same database, preserves existing absolute document-storage root/key and allows existing localhost3100 CORS. Nothing is written back into the env file.

## Active local runtime

- API first passed isolated4100 startup/health. After owner handoff, only verified old Web6252/8140 and API8892 were stopped. The temporary4100 process was stopped after its check.
- Web3100 is the final production build in this integration worktree, PID6288 at verification. API4000 is its compiled API, PID13040. Prior source checkout pc-b-sync-0908 is preserved, not restarted or overwritten.
- Web login and contract-new route respond200; API health200. Unauthenticated Sales/Notifications requests correctly return401. No authenticated real-contract creation/payment/PDF action was performed during cutover.
- Existing Chrome/B Nazanin PDF runtime paths supplied to Web. Database, documents, credentials, account permissions and old saved contracts are unchanged.
- Future local work must coordinate this runtime, not restart the old pc-b-sync checkout over3100. Public push remains blocked by the existing destination-approval gate.
