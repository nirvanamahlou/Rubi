# WORKBENCH-021 — مخاطبان و پیام‌رسان واقعی

COMPUTER_ID=PC-B. User explicitly authorized the bounded IAM contact-directory and Messaging persistence slice, conditional on owner/Migration coordination. Coordinator confirmed the active Reservations PC-A migration lock has no recorded release and no reachable owner task on this host. No schema or API runtime changes made.

## Behavior

Contacts tab lists searchable eligible active internal CRM accounts with minimum id/displayName projection; selecting a person opens a direct conversation. Conversations persist messages after server acknowledgment. New group requires a title and selected eligible members; creator is included once. Each message supports forwarding via a destination picker and explicit send action, with forwarded label. Existing department/AI draft templates do not imply real department routing or external AI delivery.

## Additive v1 contract for coordination

IAM public port: listMessagingContacts(actor, query, cursor, limit) and validateMessagingRecipients(actor, ids). Return id/displayName only initially, without administrative roles/email/session/credential fields. Exclude disabled and agency-portal accounts. Proposed eligibility: shared authorized branch; cross-branch policy requires owner confirmation, no access grant inferred from arbitrary IDs.

Messaging module routes under /api/v1/messaging:
- GET contacts: bounded paginated IAM projection.
- GET conversations: only actor memberships and scoped latest-message previews.
- POST conversations/direct {recipientId}: canonical pair lookup/create with concurrency-safe uniqueness.
- POST conversations/groups {title, memberIds, clientRequestId}: atomic group and members; creator owner, deduplicated eligible IDs and bounded count.
- GET conversations/:id/messages?cursor&limit: stable timestamp/id cursor and membership check.
- POST conversations/:id/messages {body, clientRequestId}: bounded plain text, server-derived sender/time, unique retry key.
- POST conversations/:id/forwards {sourceMessageId, clientRequestId}: actor must read source and participate in destination. Server copies source body; never accepts forged sender or source body from client. Do not disclose source conversation/member list to destination.

## Additive storage to reserve

MessagingConversation: UUID, DIRECT/GROUP, title, creator User FK, nullable unique direct-pair key, UTC timestamps.
MessagingMember: conversation/User FKs, OWNER/MEMBER, joinedAt, unique conversation/user.
MessagingMessage: UUID, conversation/sender FKs, body, nullable forwardedFromMessage FK, clientRequestId, UTC createdAt; unique conversation/sender/clientRequestId; indexes for membership and message cursor.

Messaging owns these tables; IAM queries its own User/eligibility through public service. No direct cross-module table reads. No passwords/global permission changes. Migration must be reserved with the sole active owner before schema edits; no lock is claimed by this proposal. Member removal/history changes are not part of initial create-group scope and need a defined policy before implementation.

## UI and verification

Use existing Rubi theme/Select, search/loading/empty/error states, selected conversation, direct/group avatar, new-group dialog and forward preview/destination dialog. Keep unsent text on failure; only show success after server acknowledgment. Polling refresh must stop while hidden and reject stale responses after switching conversations.

Tests: disabled/portal/noneligible contacts; minimum projection; actor membership on every read/send/forward; source and destination forwarding authorization; no forged attribution; idempotent retries/concurrent direct creation; empty/oversized text/title; stable pagination; FK/transaction tests in isolated PostgreSQL. Browser checks with isolated test accounts only, no messages to real users. Validate persistence after reload, two-account delivery and group visibility. API cutover remains separate; do not retry or route around previously rejected API-process actions.

## Owner handoff request

Please record whether Reservations PC-A has completed/released its Migration lock, then reserve one additive Messaging migration plus User reverse relations for WORKBENCH-021. Confirm minimum IAM directory branch eligibility policy and shared contract/AppModule registration files. User authorized this bounded development, not overriding an active migration. After handoff, implement and test API/schema/UI end to end.
