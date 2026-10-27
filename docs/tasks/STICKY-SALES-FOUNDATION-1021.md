# Sticky sales: SSH-independent foundation — 2026-10-21

PC-C; branch codex/pc-c-sticky-sales-foundation-1021, based on2efa0082.
Owner requests all feasible work before SSH: learn the actual answering extension,
retain private caller-to-last-answer history, prepare selection/fallback logic and
tests. Approved policy: prefer the previous available agent for10seconds, then
normal sales queue1002. No approved UI change or popup activation.

## Delivered implementation

Native AgentConnect accepts only the verified member Interface syntax
`Local/<2–10 digits>@from-queue/n`. QueueStatus on the real queue previously
confirmed this syntax for105,110,111,115,502. MemberName, caller number, dialplan
Exten and ringing alone never establish the answering extension. Other interface
formats remain explicitly unknown until verified. Missing Interface remains a
valid answered fact, but cannot supply an agent preference.

The existing canonical v1 extension field now carries this technical answer
evidence. Native ingress still unconditionally suppresses recipient lookup and
stores recipient=null, even when a matching active ERP mapping exists. No user
assignment, financial state, customer merge or popup is inferred from it.

First-answer identity remains backward compatible. Subsequent answered transfer
legs receive distinct stable IDs. Duplicate frames reuse the first accepted
payload; old accepted facts are not rewritten to infer missing agent information.
Root-call correlation and one-call projection are unchanged.

Additive Integrations table `integration_telephony_answers` stores one answer per
Inbox FK, with a real connection FK, queue, UTC answer time, HMAC phone fingerprint,
encrypted extension (possibly null), key version and receipt time. Answer and
Inbox/Outbox commit in the same transaction; a failed encrypted history write rolls
back the receipt. No plaintext phone or extension is added to this table. Unknown
callers retain technical answer evidence with a null phone fingerprint and cannot
be looked up as one shared anonymous caller.

Phone normalization reuses the existing Call Center function: Persian/Arabic
digits, Iranian local/+98/0098 formats and supported separators match. The HMAC is
scoped by connection and queue. A composite lookup index returns at most2 rows;
the preferred answer decrypts at most1 payload rather than whole contact history.
Timestamp ties conservatively fall back rather than selecting by UUID. A later
unknown answering extension blocks an older known-agent preference. Late events
with earlier source timestamps cannot replace the latest answer.

`TelephonyIntegrationService.preferredAgent` is a server-side admin/internal
preview port, not a public PBX endpoint or an automatic dial action. It validates
existing integration-admin and Call Center authority, authorized active real
connection, native capture mode and configured queue. No new permission grant.
The caller must provide a trusted server-collected membership/availability snapshot
for the exact queue, no older than5seconds and not future-dated. Browser-provided
availability must never be wired to this port as trusted evidence.

Decision results:

- PREFER: exact eligible extension, ringSeconds10, fallbackQueue1002 (or the
  explicitly configured authorized input queue in tests/other deployments).
- FALLBACK: invalid/hidden number, absent history, stale/unknown availability,
  missing/inactive/ambiguous member, busy/paused agent, ambiguous answer order,
  unknown answering extension or unreadable encrypted answer.
- Unauthorized requests fail, rather than revealing whether history exists.
  Database/transport errors must become normal-queue fallback in the future PBX
  boundary; this internal port does not swallow authorization failures.

This decision is a preference, not a reservation of an agent: availability can
change immediately. The PBX must recheck at dial time and honor fallback on any
busy/error/no-answer outcome. A phone number is not proof of customer identity;
shared/reassigned numbers do not merge people or grant access. Extension history
is not an ERP-user identity; reassignment of an extension requires reviewing or
invalidating its preference history before enabling real routing.

## Tests and migration

Migration20261021123000_sticky_sales_answers adds only the answer table/index and
FKs. No backfill or change to old call data. All181 migrations are applied on the
disposable PostgreSQL database; operational rollout applies only this migration.

26 targeted native/socket/operations/security/PostgreSQL tests pass, including
equivalent phones, ringing versus answering, duplicate frames, multiple answered
legs, late older facts, equal timestamps, unavailable/removed members, unknown
latest answer, cross-branch/permission denial, atomic rollback/retry, encrypted
storage and zero offers despite an active mapping. API types/lint and compatible
API/database builds pass. Test facts use fictitious identities only.

## Installation and rollback handoff (not installed on PBX)

1. After SSH is available, verify installed Asterisk/Issabel configuration and
   backup the actual current inbound sales route, queue options and recording
   hooks. Do not guess contexts or replace generated Issabel configuration.
2. Identify a supported prequeue integration point with IT. Specify a private,
   authenticated, bounded-time lookup transport and server-sourced live member
   snapshot. Do not expose the admin/internal preview as a public phone directory.
3. Preserve actual event capture and recording for the preferred-agent path.
   Calling an extension directly before Queue1002 can bypass QueueCallerJoin and
   AgentConnect, so simply adding Dial() would break current ERP capture. Either
   preserve the queue event path or implement/test explicit canonical facts for
   that path before activation. No invented dialplan payload is installed now.
4. Prefer only a current sales member; recheck availability, attempt at most10s,
   then invoke the verified original sales route. No history, timeout, unavailable
   ERP or ambiguous data must continue to normal queue1002 without looping.
5. Test two calls from a controlled number, busy/paused/offline/no-answer cases,
   transfer, simultaneous arrivals, recording and exactly-one ERP call; confirm
   no popup. Keep normal queue distribution for all unrelated callers unchanged.
6. Rollback PBX routing by restoring the backed-up original inbound sales target;
   keep capture active and retain history. Do not change global member penalties,
   remove other queue members or rewrite other callers' routing to implement one
   caller's preference. No live Redirect/Setvar/DBPut is sent by this foundation.

The exact install file cannot safely be finalized before inspecting the real
dialplan. This is a concrete application foundation and deployment procedure,
not a claim that sticky calls are routed already. Missing historical agent data
is not fabricated. If AMI provides no Timestamp, the existing adapter's observed
time fallback remains; CDR reconciliation is still needed for outage/clock gaps.
Production retention/extension-reassignment policy and real PBX acceptance remain
explicit gates. No UI technical panel, PR, merge or production deployment.

## Local rollout evidence — 2026-10-21

All26 targeted tests passed (native events, lifecycle, PostgreSQL, security, AMI);
API typecheck/scoped lint, Prisma generation/database build and compatible API
Nest build passed. Disposable database applied181 migrations; stopped only the
owned test container afterward. No Web source change.

Before the additive operational migration, an AES-GCM encrypted local pg_dump
backup was created with separately ACL-protected key; decryption equality and
pg_restore archive listing passed (not a full restore drill this turn). Only
20261021123000_sticky_sales_answers was applied/marked; no unrelated migrations.

Compatible runtime sticky-sales-runtime-1021 API4000 PID14280 replaced the old
API after observing zero active stored sessions. API /api/v1/health and Web login
return200. Web3000 PID14544 and Worker4409 PID9092 were retained unchanged.
AMI_CONNECTED/AUTHENTICATED persisted at12:56:30 UTC; restart coverage gap is
recorded explicitly, not claimed lossless. One existing real ENDED call, four
DONE receipts, zero pending dispatch and zero real offers remain unchanged.
Answer history count is zero: no old missing extension was fabricated and no new
real answering call has yet validated the new history end-to-end. Synthetic tests
ran only against isolated infrastructure. Rollback API to the preserved operations
runtime if needed; retain the additive table/history, do not reverse data writes.

Actual preferential PBX routing remains inactive, pending SSH/config inspection
and real acceptance. No popup, Web change, grant/mapping, PR/merge or production
rollout. Source/schema reservation released on commit and push.

2026-10-25 policy update: user shortened the preferred-agent ringing budget from20 to10 seconds; fallback queue1002 and SSH/real-call acceptance requirements remain.
