# CALL-CENTER-ANSWERED-ACCESS-1029

COMPUTER_ID=PC-C. User explicitly requests completion of trusted-answer visibility and employee/unit-manager/executive/demo tests while VPN details are pending. Base origin/develop8a1acec9c. Source implementation and disposable testing only; no production migration, account grant, HR write, provider activation or UI change is performed by this work item.

## Final policy and ownership

Only canonical ANSWERED events from a configured real provider establish contact responsibility. Ringing, TRANSFERRED without an answer, endReason=COMPLETED, popup offers/claims, manual outcomes and manual owner assignment are insufficient. Every answering account retains responsibility after transfers; repeated and out-of-order receipts keep the earliest answer for each call/account. A prior answer grants the contact dossier including its history; it is not restricted to a single call row.

HR owns actual employee/account/extension linkage; IAM owns account activity, branch membership and unit identity. New answers snapshot all linked active ERP accounts on the physical extension at ingress, independently of popup rollout or single-recipient routing. Shared extensions include all eligible linked accounts; multiple extensions may map to one employee. Missing accounts are never created. Private display-name bootstrap files never confer entitlement.

Customer Affairs owns CallCenterAnswerResponsibility: real restrictive FKs to call, user and immutable integration inbox receipt, UTC answeredAt/createdAt, primary key(callId,userId), indexes(userId,callId) and inboxId. The call's existing contact/branch FK supplies scope. No duplicate ownership/contact payload is stored; manual owner CAS/audit and request execution ownership are preserved.

Employees see contacts with an answer responsibility. Managers also see responsibilities belonging to users in their current active unit, using exact branch/unit IDs rather than matching unit/company names. An account with team permission but no unit retains only its own answer access; no manager or company is inferred from a display label. Account/branch eligibility and ordinary route/write permissions still apply.

## Executive/demo and scope isolation

Set CALL_CENTER_GLOBAL_USER_IDS to the privately verified active ERP user UUIDs of the approved executive and demo accounts. There are no hardcoded names, fuzzy matches or implicit administrator exemptions. The allowlist is inactive outside the answered policy; inactive/B2B/missing accounts are rejected. Old CALL_CENTER_REQUEST_GLOBAL_USERNAMES does not bypass the strict production rule.

A guard installed only on Call Center controllers and recording-read controllers creates a request-local Call-Center-only permission/active-branch scope before PermissionGuard. No persisted role, login session, shared actor object or non-Call-Center endpoint gains permissions/branches. Customers public-port calls restore the original native actor scope from a private WeakMap; full Call Center visibility is not a Customers branch grant. Global Call Center scope does not grant Integration configuration/reprojection privileges.

The deployed accounts still require normal IAM screen/navigation access; reconcile their effective grants through IAM during rollout. The source allowlist is not a substitute for verifying the real accounts, and automated fixtures do not claim their production grants have changed.

## Production/local modes

Production defaults to strict answered access. Explicit CALL_CENTER_ACCESS_POLICY=ANSWERED enables the same policy in isolated tests. The trusted server-only mode CALL_CENTER_ACCESS_POLICY=LOCAL_TEST preserves the existing unrestricted/legacy localhost testing behavior even for a locally built production image. Never set LOCAL_TEST on the company server. No request Host, forwarded-host, browser flag or user-supplied account ID selects a mode. Default nonproduction behavior remains compatible with pre-existing manual scopes.

Before company rollout: apply the additive migration, verify HR/account/company/branch identities and actual effective IAM route grants, set the two exact global account IDs, confirm ANSWERED mode, preview historical evidence, then activate the reviewed application version. Do not apply test fixtures or inferred account links to production. During a rolling deployment, stop legacy telephony writers or drain queued old envelopes before enabling the strict read policy; old receipts without snapshots require the conservative historical path below. Retain the additive table on application rollback; never delete responsibilities or rewrite ownership to simulate rollback.

## Historical projection

POST /integrations/telephony/answer-access/reproject uses existing authenticated Integration-management authorization, not the Worker credential or the global Call Center allowlist. Body: optional after UUID, limit1..200 (default100), apply boolean (defaultfalse). Follow the opaque next cursor until null, separately per authorized branch scope. No public UI is added. Applying is refused in the local legacy/LOCAL_TEST policy.

Only retained DONE, non-synthetic, branch-authorized canonical answer receipts are considered. New receipt-time account snapshots are authoritative. For older receipts, HR/account links may be resolved only when the employee and internal-contact records existed and have not changed since the answer; uncertain/changed/missing mappings grant nobody. This conservative rule can omit valid old answers after unrelated HR edits, which must remain unresolved rather than inventing ownership. No technical display label, claimant, current replacement employee or manually entered outcome is used as fallback.

Dry-run performs no writes. Apply adds/retains responsibility through the public Customer Affairs port and records a sanitized ANSWER_ACCESS_REPROJECT audit with provenance/counts. It never calls the full event projector, replays PBX commands, sends popups, edits call payloads or changes manual ownership. Repeated application is idempotent for responsibility. Unavailable encrypted payloads and unresolved identities are reported explicitly; the existing inbox payload retention can prevent older recovery. A successful backfill is not evidence of missing source history being recovered.

## Read coverage

Prisma contact authorization and raw SQL contact/report/KPI predicates share the same responsibility scope. List/search, contact/call detail, notes/call history, KPI modal lists, request contact access and authorized recording byte/range reads use it. Manual owner-management endpoints can no longer bypass contact authorization merely because a contact is unassigned. Existing per-request execution-owner restrictions remain separate. The live offer/popup port retains its already approved call-specific offer authorization; it does not grant historical dossier access before an answer.

## Validation

Fresh disposable PostgreSQL18 on loopback59630 accepted all199 current-source migrations, including20261029120000_call_answer_responsibilities. The existing localhost operational database and production database are not test-write targets. API tests use locally generated database/contracts outputs and isolated dependency links so other checkouts' generated clients remain unchanged.

Validation results and publication evidence follow below.

## Verified source result — 2026-10-29

Final candidate: all226 tests across30 Call Center/Issabel/HR files pass, including15 new trusted-answer PostgreSQL scenarios and existing access/workflow/history/recording compatibility proofs. Full API TypeScript check and Nest production build pass. Scoped ESLint/Prettier and schema generation/formatting pass; all199 migrations apply successfully to a fresh disposable PostgreSQL18 database. No Web source/UI was changed.

New proofs cover real byte download for both answering employees on a shared extension, their unit manager and configured executive/demo, with foreign-unit/no-unit and missing-recording-permission denial; SQL KPI/modal/report isolation; late/concurrent answers; unlinked-extension denial; exact manual-create retry receipts without dossier entitlement; receipt-time mapping surviving changes before Worker processing; conservative legacy backfill and unavailable-payload reporting; inactive global rejection, foreign-branch/header-spoof rejection and explicit server-only LOCAL_TEST behavior. Every answering account survives a transfer; source creator, offer/claim, manual owner/outcome and COMPLETED-only facts confer no entitlement.

A preparatory combined run hit one existing5s test budget while API compilation was also running. Bounded backfill test fixtures now exercise one deterministic cursor page per retained receipt rather than repeatedly reprocessing every prior fixture; no timeout, assertion or production policy was weakened. The final full226-test run passes. Earlier fixture setup/type issues were repaired before this result, not counted as successful runs.

Publication is a source candidate. The company server and localhost operational databases, effective user grants and HR records remain unchanged. Real executive/demo UUID configuration and normal IAM navigation access are rollout prerequisites. The current server cannot acquire this policy merely from source publication; migration/release/configuration must be verified separately before enabling company staff access.
