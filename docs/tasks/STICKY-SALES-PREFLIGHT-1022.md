# Last-answerer routing: SSH-independent preparation

2026-10-22, PC-C. Continues the approved local stack at d83600a3; no rebase or
integration of unrelated develop changes. See STICKY-SALES-FOUNDATION-1021.md and
CALL-CENTER-UI-PRESERVATION.md. The later dossier-card UI is a separate completed
branch/runtime artifact and was not overwritten.

## Delivered

- Existing encrypted, connection/queue-scoped last-answer history remains the
  authority. Ringing is not an answer; unknown latest answers and equal-time
  ambiguity do not fall back to an older known agent.
- AmiClient.queueSnapshot issues only read-only QueueStatus. Correlated success
  plus complete list/count and exactly one queue header are required. Missing,
  stale, truncated, mismatched or changing membership cannot prefer an agent.
- Only the previously verified Local/digits@from-queue/n member interface is
  understood. No inference from names. Unknown interface shapes fail closed.
- Status must be NOT_INUSE, InCall=0, Paused=0, with valid last-call/wrap-up facts.
  Duplicate extension memberships remain ambiguous. QueueEntry private caller
  fields and member display names are not retained by this projection.
- One concurrent snapshot per AMI client, maximum2048 list entries and750ms
  deadline. Timeout/rejection cleans listeners and does not close the existing
  call-capture transport. Login/Originate timeout behavior is unchanged.
- IssabelService.previewPreviousAgent is an internal method only: existing
  permission/branch/active-connection/configured-queue checks run before AMI and
  again for history. Only a server-collected snapshot enters the selector.
  Disconnect/replacement/shutdown invalidates the result, including during DB lookup.
- Decision deadline1000ms, at most8 outstanding operations including timed-out
  database work. Late results have no side effects; dependency failures return
  sanitized fallback reasons. Permission failures remain errors. No caller data
  or exception payload is logged.
- Candidate decision retains ringSeconds10 and fallbackQueue1002 for sales.
  This is a decision contract, not an installed10-second telephone timer.

## Explicit unknown policy / configuration

Asterisk16 QueueStatus reports member wrapuptime, but does not report inherited
queue wrapuptime. Zero on the member means inheritance, not proof of zero rest.
`ISSABEL_STICKY_QUEUE_WRAPUP_SECONDS_JSON` is an optional private server-side map
from exact queue name to its **verified** inherited wrap-up seconds (integer0..86400).
Absent/malformed/missing queue entry => QUEUE_POLICY_UNVERIFIED and no AMI query.
No value was guessed or configured in an operational environment by this task.
An example for a synthetic test only is `{"1002":0}`; do not copy it as actual policy.

Primary protocol reference inspected:
[Asterisk16 app_queue implementation](https://github.com/asterisk/asterisk/blob/16/apps/app_queue.c)
(manager_queues_status and get_wrapuptime). Conservative parsing deliberately
rejects older/different payloads missing required facts; installed PBX behavior
still requires verification. Multi-queue wrap-up/penalty/device policies must be
checked on the PBX at dial time; the preview is not an availability reservation.

## Verification

Synthetic TCP tests exercise the actual AmiClient framing/action path: coalesced
responses, completion correlation, denial, missing completion, timeout, disconnect,
concurrent requests, listener cleanup and preserved capture connection. No PBX
mutation or actual dial command occurs.

Projection tests cover unknown/busy/ringing/paused states, inherited/member wrap-up
boundaries, future/missing timestamps, unknown interfaces, changing membership,
duplicate members, list bounds and private field exclusion. Coordinator tests cover
timeouts, abort signal, late completion, errors and bounded unresolved work.
Service tests cover permissions, absent policy and transport generation changes.

Real disposable PostgreSQL suite covers encrypted answer history, duplicates,
out-of-order/transfer answers, equivalent phone formats, tenant/queue isolation,
ambiguous or unknown agents and zero popup offers even when test mappings exist.
Synthetic records were confined to local nora_ci; operational data was not modified.

## SSH handoff and activation gates

1. Authenticate the actual192.168.100.200 host using its own verified host key;
   the Parspack cloud console fingerprint is not the PBX fingerprint.
2. Read/back up actual inbound sales route, queue1002, inherited/member wrap-up,
   internal channel/state interfaces and recording hooks. No generated config overwrite.
3. Select the supported prequeue hook and authenticated private bounded lookup
   transport based on those facts. There is deliberately no public routing endpoint
   or guessed dialplan context in this preparation. Define stable ERP service reachability
   from PBX; a developer localhost is not a production service destination.
4. Preserve canonical call capture on the preferred path: direct Dial before Queue
   bypasses existing QueueCallerJoin/AgentConnect observations. Do not activate until
   the selected hook preserves or explicitly projects equivalent root/leg facts,
   answer ownership, unanswered calls and recording correlation exactly once.
5. Recheck member/availability at dial time; try preferred member at most10 seconds.
   Busy/offline/no-answer or unavailable lookup goes to the original sales route1002
   once, without a loop. Caller hangup ends processing; answered calls are not queued.
   No queue-global penalty, membership, pause, redirect or preference mutation.
6. Test real new/repeat calls, unavailable agent,10-second no-answer, caller hangup,
   transfer, concurrent callers, ERP disconnect, recording continuity and rollback.
   Only a successfully answered sales conversation may update last-answer history.
7. Rollback restores the backed-up original sales destination. No popup activation:
   ERP recipient mappings and separate explicit enablement remain pending.

No Web changes, migration, dependency change, runtime restart, PBX write, PR/merge
or production deployment. Actual physical routing and its timing remain unverified
until SSH installation and controlled real-call acceptance.

### Executed checks

-57 distinct tests passed:42 transport/projection/budget/native/continuity cases,
  10 isolated PostgreSQL cases and5 internal service integration cases. Modified
  transport/service suites rerun after final disconnect guard:11/11 pass.
- Scoped ESLint passes; TypeScript noEmit and Nest production build pass (final
  rebuild verification recorded at task completion).
- Disposable test container stopped afterward. No live-PBX acceptance claimed.

2026-10-25 policy update: user shortened the preferred-agent ringing budget from20 to10 seconds; fallback queue1002 and SSH/real-call acceptance requirements remain.
