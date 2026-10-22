# CALL-CENTER-REQUEST-FLOW-1022

Owner-authorized request flow on approved965e7cd2 local stack.

- New request uses NEW (Persian: باز), hides status selection and asks for a responsible operator. Existing NEW-only server creation guard remains. Legacy enum values are retained.
- Queue click carries the specific request ID to the branch-scoped, paginated request API; it no longer depends on that request being in the first page of contact requests.
- Dialog includes latest caller identity, phone, subject, source, unit, call time/result and database call count. Existing request fields, history, actions, status and completion editor remain available.
- Completion result is stored inside existing encrypted request payload/history; no schema migration. Existing clients omitting result preserve stored content. New form requires result for closing, and explicit empty closing results are rejected on server. Existing open follow-ups must be completed/cancelled before closing.
- Save refreshes the local queue without a full page reload. Version, command replay and transaction guards remain.

## Closure notifications

Owner deferred identifying sales manager recipients. No operational recipient is configured or inferred from request creator. Server-only CALL_CENTER_CLOSURE_MANAGER_IDS accepts explicitly approved ERP user UUIDs, comma-separated. IAM public directory filters active, branch-authorized Call Center read/workflow users; duplicates are removed. Empty setting sends none. No retrospective delivery is implied.

Closing an existing open request creates manager notifications in the same transaction. Replaying the same command or editing an already-closed request produces no extra closure notification. Reopening and subsequently closing is a new transition. Notification actor is the actual user performing closure, not an assumed assignee.

Notification text is deliberately generic and links to Call Center; the private request title and completion remain encrypted and are shown inside authorized request details. No private subject/phone/result is copied into plaintext notification storage. Exact subject in the notification itself requires a permission-aware encrypted rendering contract, not copying private text to a new store.

## Validation and limitations

15 isolated PostgreSQL workflow/DTO tests and12 Web client/form tests pass. Covered selected-request scope/count, result persistence, empty result rejection, configured/absent/ineligible recipients and idempotent notification. Earlier fixture-order and HTML attribute-order assertions corrected without weakening production checks. Build/runtime evidence recorded in PROJECT_STATUS.

No permissions, extension mappings, PBX, automatic telephone popup or other panel design changed. Authenticated visual acceptance remains for owner login. Manager notification delivery remains disabled until recipient configuration is supplied. No PR/merge/production deployment.
