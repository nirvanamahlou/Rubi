# Outbound first contact — 2026-10-25

User approves immediate incomplete outbound contacts, exclusive-extension popup on every authenticated page, and storage without popup for shared extensions. Based on approved locald22338f7; preserve panel design and technical-widget removal.

- Existing native DialBegin/DialEnd/Hangup adapter and durable Inbox/root deduplication are reused. No calls are originated by ERP.
- A new outbound contact is owned by the active eligible mapped originator at creation, with OWNER_ASSIGNED audit and ownerVersion1. Existing contacts are never silently reassigned by dialing. Technical call remains needsCompletion until the approved form is saved.
- HR shared-extension evidence suppresses recipient even if a stale explicit integration mapping exists. Missing/ineligible mappings store calls without offers. Unmapped contacts remain available according to existing managerial/legacy scope, not broadcast.
- ISSABEL_OUTBOUND_NOTIFICATIONS_ENABLED separately enables outgoing offers. Inbound notification hold remains unchanged. Replay/recovery retains its no-notification policy.
- Authenticated shell mounts the existing operational popup in outbound-only mode, opt-in with NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED=true. No floating technical widget or synthetic UI returns. Existing server tab lease, claims, permission checks and draft preservation apply. Polling remains every2 seconds while foreground; instantaneous telephony delivery is not guaranteed.
- Existing first-page contact list refreshes on a new outgoing popup; later pages retain pagination context. No contact fields or table columns change.

Local rollout: private approved staff mapping file was matched against active eligible accounts;18 exclusive mappings created through the existing audited service, with pre-change backup outsideGit. Shared203 has no active mapping. Read-only AMI inspection and user-confirmed404 external call verified source/root/dial peer structure. Private config limits external capture to the verified SIP trunk and22 approved staff extensions. No secret, personal directory or dialed numbers committed. No PBX configuration, migration or grant changes.

Operational live-call verification and exact build/test results are recorded below. No PR/merge/production deployment requested.

Validation: 12 PostgreSQL integration tests (including actual receive/process, duplicate root and shared extension), 11 adapter/state tests and 4 Web hold/draft tests pass. Affected lint and API typecheck/build pass; final Web production build passes all65 routes. No migration. Local API4000 PID9476 and Web3000 PID22588 started with scoped outbound flags; inbound notifications remain held. Real404 AMI DialBegin was verified before activation; a second post-activation call is requested for end-to-end storage/popup acceptance and is not yet claimed as passed.

Acceptance update: user explicitly confirms a second real404 external call was made and the outgoing popup opened after local activation (2026-10-25).
