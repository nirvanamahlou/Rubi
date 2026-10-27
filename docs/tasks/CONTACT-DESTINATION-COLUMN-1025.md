# CONTACT-DESTINATION-COLUMN-1025

PC-C; user requests contact-table header changes: unit becomes connected-to and source becomes acquaintance source. The connected-to cell now uses the same answerRecipient.label as the call form/history, falling back to the stored operator or unknown.

Paginated contact search enriches only its authorized latest-call summaries through existing provider-confirmed destination hydration, including old outbound calls lacking a full identity snapshot. Enrichment shares the read transaction and public HR projection; stored historical identities and shared-extension labels remain authoritative. No guessing a person from a manually editable operator field. Existing search filters and table alignment/other columns remain unchanged.

No migration/dependency/PBX change. Existing local runtime is replaced only after successful checks and ownership validation. Scope includes the prior missing-history fix and10-second prepared routing policy already on this branch.

Verification:27 isolated PostgreSQL tests,7 destination projection/transaction tests and15 Web model/transport tests pass (49 total). Scoped API/Web lint, affected API source/test typecheck and build pass. Initial full Web typecheck exposed stale linked local contract output from the older checkout; built this branch's contracts privately and assembled an isolated build copy with absolute dependency targets. Existing shared node_modules and other runtimes remain intact. Full Web build/browser acceptance recorded below.

Full Web build/typecheck65 routes passed in F:/DevData/Temp/contact-destination-web-v2-1025 using a private current-contract output. Web3000/PID25756 runs from that isolated build directory; API4000/PID26544 runs apps/api/.api-contact-destination-1025 in this checkout. Startup helper F:/DevData/Temp/start-contact-destination-v2.ps1. Existing popup flags, worker and private environment retained; no business-data write or migration.

Browser acceptance passed: both new headers visible, full staff title/name/extension appears for native calls including legacy outgoing rows. Screenshot F:/DevData/Temp/contact-destination-column-1025.png retained outside Git.49 tests, scoped lint, API source/test typecheck/build and Web65-route typecheck/build pass. No operational form was saved during verification.
