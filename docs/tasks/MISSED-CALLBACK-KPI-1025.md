# Missed callers requiring callback — 2026-10-25

Fourth Call Center KPI counts unique known caller contacts in the selected branch with an unresolved missed inbound call. Each normalized number is counted once through the existing branch/phone fingerprint identity. A strictly later answered inbound or outbound conversation removes it; a subsequent missed inbound call reopens the need. Equal timestamps do not establish a later conversation. Busy/failed/unanswered outbound attempts do not resolve it. Unknown/hidden numbers, synthetic calls and future events are excluded.

Provider sessions use encrypted monotone technical facts (ENDED + unanswered and no answered evidence); editable business outcomes never override these facts. Manual calls without sessions use explicit NO_ANSWER/ANSWERED outcomes. TELEPHONY records lacking technical evidence are not guessed. Answered provider calls resolve the need even if the commercial form is incomplete. Out-of-order answer evidence wins over missed ringing legs.

Existing branch/contact/report scope governs eligible missed calls. Later successful calls for the same authorized contact can resolve the need even if another employee answered; no identity or history is returned by this aggregate. Repeatable-read transaction and bounded 100-contact / 500-call batches avoid loading all private records at once. Technical ciphertext and candidate phone fields are decrypted only in the API; no private values are logged or returned. No cross-module table reads, schema/migration, dependency, popup or telephony configuration change.

Compatibility: needsFollowUp numeric response key retained; basis metadata and Persian/English card copy now describe callback callers. Existing layout, other KPI definitions and missing-outcome modal remain unchanged. This task changes the KPI, not a new drilldown or outbound dialing action.

Validation pending final build/runtime verification.

Validation complete:15 PostgreSQL tests and5 Web tests pass; scoped ESLint and API TypeScript build pass. Web webpack build, typecheck and65 routes pass (Turbopack cannot follow the existing external node_modules junction). Authenticated browser verifies new title/subtitle and current count1. Local Web3000 uses .next-missed-callback-1025; API4000 uses .api-missed-callback-1025 with original development-only company-network AMI settings restored. Prior build artifacts preserved. No real business data edited, no PR/merge/production deployment.
