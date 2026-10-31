# Call Center information-independent operations — 2026-10-21

PC-C; branch `codex/pc-c-call-center-operations-1021`, based on7deea673.
Owner authorizes completing work possible with the supplied information, with no
approved UI changes and no popup before extension mapping. This unit builds on
the [accepted local sales capture](AMI-SALES-ACTIVATION-1021.md) and
[prior readiness implementation](CALL-CENTER-READINESS-1021.md).

## Implemented

- Append-only Integrations audit records for AMI collector start, authenticated
  connection, disconnection, ingress/buffer failures and graceful stop. Records
  contain only fixed reason codes and server timestamps, never provider frames,
  phone numbers, channel names, passwords or business text.
- Repeated identical incident writes are serialized/deduplicated within the
  collector. A failed audit does not poison later writes. Database failure still
  prevents guaranteed persistence; the in-memory gap flag remains conservative.
- Restart retains unresolved coverage gaps. Restart after a previously journaled
  collector is a gap even if the old stop was graceful. Adoption over an older
  collector with accepted Inbox receipts also records a legacy coverage gap.
  No API falsely clears these gaps; actual source reconciliation is still needed.
- Existing authorized Issabel status includes continuity timestamps, queued frame
  count and popup-delivery mode. Unauthorized branches receive no continuity
  information. No new UI, route, permission or schema is introduced.
- Graceful application shutdown hooks stop new AMI frames, finish the in-flight
  connection tick, then allow up to30seconds for queued frames to commit through
  canonical ingress, including bounded transient retries. A drain timeout is a
  coverage incident. Force-kill, OS crash, or unresponsive database cannot be
  treated as graceful shutdown and still require reconciliation.
- The existing operator CLI now requires authenticated provider CONNECTED status,
  known continuity and no backlog alerts before reporting operationalReady=true.
  A successful API response alone is not enough. Live business acceptance remains
  explicitly separate from a point-in-time health check. No cookie is printed.

Native queue1002 capture and null-recipient defense are unchanged. No extension
mapping, account grant, outbound activation, PBX command/configuration change,
schema/migration, dependency change or synthetic operational call is introduced.

## Acceptance matrix

| Scenario | Evidence / boundary |
| --- | --- |
| Simultaneous roots and duplicate delivery | Loopback AMI and disposable PostgreSQL tests; isolated calls, no duplicate business projection |
| Abandoned / unanswered call | Ends without fabricated business outcome; unknown technical cause remains UNKNOWN |
| Ringing multiple members / transfer leg | Member hangup does not terminate root; root hangup terminates it, no extra contact call |
| Disconnect/reconnect | Real loopback sockets, accepted root reused, gap retained across journal restart |
| Temporary ingress failure during shutdown | Shutdown waits for pending receipt and retries before returning |
| Connection deactivation | New frames rejected; no PBX write or popup recipient |
| Branch/permission change | Real PostgreSQL-backed status test denies unauthorized scope and absent permission |
| No popup despite an existing mapping | Existing native PostgreSQL regression retained and rerun |
| Worker/Redis restart, replay, recording publication/range authorization | Existing readiness acceptance remains applicable; Worker/media code unchanged |
| Real external call through queue1002 | Earlier owner-confirmed live acceptance retained; new concurrency/recovery tests are synthetic in isolated infrastructure, not a claim of another real PBX pilot |

Tests use only test identities and disposable nora_ci database. Operational calls
and Inbox are never modified to manufacture a successful test. Existing Web build
`uLTV0_qicViVV1BxsDKHW` stays unchanged.

## Sales usage and unresolved gates

Current automatic capture creates a durable call awaiting completion. Staff use
the existing panel to supply name/subject/business result, confirm customer
identity where needed, and connect the call to a request/follow-up. Technical
ANSWERED does not mean a completed sale or business outcome. Access still follows
the approved temporary HQ storage and existing user permissions.

The following cannot honestly be completed from the current information:

1. Popup activation: confirmed extension-to-ERP-user mapping and approved routing
   are missing. This unit keeps native popup delivery disabled even if a mapping
   is accidentally added.
2. Actual audio retrieval and CDR backfill: direct read-only source connection,
   verified table/column identities and file access transport are missing. The
   provided filesystem path does not provide a transport or authorize guessing
   a schema. Adminer restrictions are not bypassed.
3. Direct/outbound call scope and final shared-team authorization: business
   decisions are missing; capture remains sales-queue inbound only, under HQ.
4. Production rollout: host, network/TLS arrangement and supervision/backup
   destination are missing. Do not install an arbitrary startup task, run multiple
   collectors or claim production availability. A single active collector remains
   required; no cross-host collector lease is claimed.
5. Organization-scale SLA, real failover/transfer/audio pilot and operator signoff
   require the deployment environment and participating staff. Automated scenarios
   provide regression evidence, not a real end-user acceptance substitute.

Existing readiness scripts, encrypted spool/uploader, backup/restore evidence and
runbooks are reused rather than replaced with parallel infrastructure. A healthy
collector does not recover events never accepted into Inbox during a network gap.
Do not erase incidents or mark stale sessions ended just to make monitoring green.

## Operational handoff

Use the existing readiness CLI with a private authorized ERP session to inspect
health; its output contains no caller details. If it reports GAP, keep collecting
new calls and retain the incident timestamps for future CDR comparison. Missing
authentication is a failed check, not a reason to mint a session or weaken guards.
Use existing authorized dead-letter replay only after resolving its actual cause.
Native popups remain off throughout recovery.

The local compatible candidate is
`F:/Projects/Rubi/.worktrees/call-center-operations-runtime-1021`; it overlays only
API main.ts, Issabel service and continuity helper on the prior sales runtime.
The previous artifact and private environment remain available for rollback.
Rollback must preserve all accepted calls/Inbox and avoid a second collector.
No PR, merge or production deployment is included in this unit.

## Final verification and local rollout

- 24 tests pass across native/operations/AMI/security and actual PostgreSQL suites,
  plus4 Node readiness-CLI tests (28 total). The first root-directory Vitest run
  was interrupted while loading; the final API-directory run with one worker
  passed all selected tests, including the final legacy-restart behavior.
- Full API typecheck, scoped lint and compatible API Nest build pass. Diff checks
  pass; no migration or dependency change, no Web rebuild or UI modification.
- At11:48:05 UTC the replacement API authenticated to AMI and persisted its
  AMI_CONNECTED transition. Its PID is23700 on4000. No active call was present
  at the pre-replacement check. The old runtime lacks the new shutdown hooks;
  the deployment interval is conservatively recorded as LEGACY_COLLECTOR_RESTART,
  not claimed as loss-free. Future Windows Stop-Process also remains forceful.
- At11:48:11 UTC a fresh DB read still shows the single earlier real ENDED call,
  four DONE Inbox rows, zero pending dispatch, zero offers for this connection,
  null assignee and needsCompletion=true. No new real call is claimed in this unit.
- Candidate health on4001 passed with AMI disabled; anonymous Issabel status401.
  Active API4000 and Worker4409 health200. Web3000 login200 still includes the
  exact approved build ID. WebPID14544 and WorkerPID9092 are unchanged.
- The private configuration remains queue1002, native capture, HQ, no mappings,
  relay/synthetic disabled. Existing caller ciphertext and business data were not
  rewritten. Runtime provenance is stored with the compatible artifact.
- GAP now intentionally remains visible in authorized technical status until
  reconciliation is actually implemented/performed. This is honest coverage
  reporting, not a stopped collector; new calls continue to be collected.
