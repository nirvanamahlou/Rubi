# Call Center frontend — PC-C

User delegates the reference-image implementation and confirms PC-C. Base:
origin/develop@73e60ef1; branch codex/pc-c-call-center-1018.

The last Sales/Customer Relations entry opens `/customer-affairs/call-center`.
It uses the existing Lucide sidebar style with a distinct Headset icon and
inherits Customer Affairs route/screen access, with no new grants.

The RTL layout includes KPI cards, combined filters, a newest-call-first contact
table, per-phone timeline, notes, follow-up ranking, operator counts and source
chart. Native audio controls display received recording URLs. The accessible
Radix dialog supports initial and follow-up calls, required fields and phone
validation. The explicit incoming simulation opens a known contact's popup.
Repeated normalized numbers share history. Event IDs are replay-safe in the
module-local model. Pagination applies after combined filters.

This is a frontend preview with fictional, labeled fixtures and memory-only
edits. Reload/navigation resets edits. No real API, webhook, realtime connection,
customer lookup, durable notes or recording storage is implemented. No secrets,
customer records, database or migration is involved. Response-time and answered
rate cannot be derived from the requested API fields; no invented success rate
is displayed. Counts and charts derive from the same synthetic data.

Backend handoff: Customer Affairs owns the future contact/call persistence;
Integrations owns provider verification and delivery. Agree versioned authenticated
branch-scoped event IDs, UTC time, normalized telephone, direction and protected
recording references before integration. API receives must open queued dialogs
globally in ERP and survive dismiss/reconnect; current simulation is page-local.
Provider answer/wait timestamps are prerequisites for response KPIs. Audio URLs
must be authorized by the owning Documents/Integration service. No production
contract or automatic provider connection is claimed by the local TS interface.

The subsequent user request authorizes local Web deployment only. Existing ERP shell,
sidebar branding, runtime and other worktrees remain intact.

## Verification

Validation: 23 focused tests pass; scoped ESLint, Web TypeScript, Prettier and production Web build pass (65 generated pages). Production-browser QA with synthetic intercepted IAM/API responses verifies final sidebar position, incoming popup, repeat-call save, new-contact save, empty search/reset, source filter, notes, pagination and desktop/mobile/dark rendering. Mobile document width equals viewport390px. Screenshots inspected; no live backend integration asserted. No Migration. Scoped source locks released with review candidate; other PCs can fetch the branch and review before any integration.

## Local activation — 2026-10-18

Local activation complete: runtime branch codex/pc-c-call-center-runtime-1018@c0c51d56 uses the exact previous Web base93cd3dd0 plus only11 Call Center Web files. Production build8gCVhvWaoWv4-oO4vsZDF is served on localhost:3000 by PID41064. Existing API4000 PID22396 and assistant4300/4301 PIDs31032/27952 are unchanged; health endpoints return200.23 focused tests and runtime production build passed. Real existing IAB session opened the panel and registration dialog without API interception or business writes; dialog left open for user review. Preview4318 stopped. Rollback: stop only verified Web3000 PID41064 and start preserved assistant-deterministic-1014/apps/web with NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1 and ASSISTANT_SERVICE_URL=http://127.0.0.1:4300, next start --port3000 --hostname127.0.0.1; old build uz5cQ3Jm9hliuC1An_jCJ retained. New startup script/logs are in runtime node_modules/.cache/call-center-runtime. No schema/migration/data/grant or remote merge; only local Web activation authorized.
