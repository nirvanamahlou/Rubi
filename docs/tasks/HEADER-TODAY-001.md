# HEADER-TODAY-001

PC-B, branch `codex/pc-b-header-today`, base `origin/develop@130606d`.

## Request and scope

The owner requests today's date in the top header, push/merge and receiving current Git changes. The owner also explicitly approves merging PR #115 (current HR and Agencies). The date change remains a small independent PR; existing producer branches and data are preserved.

- Persian weekday/day/month/year with Persian digits; canonical date uses Asia/Tehran, not the workstation timezone or login timestamp.
- The server and first hydration render use a stable placeholder. The client computes the date; no build timestamp, session/PII access, API call or persistent storage.
- Minute-aligned updates include Tehran midnight. Focus/visibility events immediately refresh after sleep, and all timers/listeners are removed on unmount.
- A compact separate header row inherits the active company foreground color. It remains visible on mobile without taking space from the authenticated user, company switcher, search, notification or navigation controls.
- No new dependency, migration, schema, seed, IAM grant, password or key. Current HR/Agencies database and Documents storage must remain the runtime source; operational replacement requires the received HR owner handoff and successful combined validation.

## Verification

Focused tests cover Tehran midnight, Nowruz, Persian digits, timer/listener cleanup, server output and preserved shell controls. Run Web lint, typecheck, production build and CI before merge. Browser verification requires a real authenticated session; do not fabricate an identity or claim an unperformed smoke test.

Local results: 12 focused tests passed (date, existing user menu and company branding), Web lint and production build passed. The separate PR #115 integration preserves both HR and Sales schemas/permissions; existing migration histories are never rewritten to hide local checksum differences. Changes from PC-A PR #116 were received at `130606d`.
