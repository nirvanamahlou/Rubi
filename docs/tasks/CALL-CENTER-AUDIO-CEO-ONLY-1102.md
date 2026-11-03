# CEO-only call recording downloads — 2026-11-02

COMPUTER_ID=PC-C. Work item CALL-CENTER-AUDIO-CEO-ONLY-1102. Owner explicitly requests implementation only: **DO NOT DEPLOY OR CHANGE SERVER CONFIGURATION**.

## Policy

Only Danial Altafi's active internal IAM account may retrieve call audio. Match the immutable account ID in the single server-only `CALL_CENTER_RECORDING_DOWNLOAD_USER_ID` setting and the verified account username `danial`. Display name, job title, manager permissions, demo access and shared phone extensions are insufficient. Missing/invalid/multiple IDs deny everyone. Never populate this from a request, browser field or shared global-user list.

IAM removes the effective audio permission from other Call Center actors even if persisted legacy roles grant it; generic executive/demo access no longer adds it for demo. Stored roles and sessions are unchanged. Customer Affairs exposes an explicit authorization port; Integrations checks it before listing files, full download and ranged playback. Existing branch/contact authorization, retention, integrity, media-read auditing, uploads and pruning remain intact. Direct service calls also fail closed, independent of controller permission guards.

The existing download action is hidden until the authenticated, no-store capability endpoint returns an explicit true boolean. No audio/file URL is requested to discover access. Capability requests abort on context change and stale results cannot enable another call's action. Backend checks remain authoritative after capability resolution.

## Future activation (not performed)

Before a separately authorized deployment, resolve and independently verify Danial Altafi's existing IAM ID and username `danial`, set exactly that ID in the API's private environment, then deploy compatible API/Web code under the shared lock. No new role, account, schema migration or database grant is needed. An omitted setting intentionally disables all audio access. Verify CEO downloads and403 for employee, unit manager, administrator and demo on list, direct audio and Range URLs. Do not alter call visibility, popup recipients or recording ingestion.

## Validation

29 focused API tests and17 Web tests pass. Scoped lint and API/Web TypeScript pass. API production build passes. Full Web production build also passes in an isolated same-drive validation directory; the initial worktree webpack attempt was blocked by Windows C:/F: dependency junction paths. PostgreSQL integration assertions were updated to the new policy; their isolated database execution remains a hosted-gate requirement, not a production test. No server command, deployment, configuration or operational data mutation was performed for this work item.

