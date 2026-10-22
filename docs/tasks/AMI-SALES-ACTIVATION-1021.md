# Sales queue1002 local activation — 2026-10-21

Owner PC-C; branch `codex/pc-c-ami-sales-activation-1021`, base `d04ad9b2`.
The owner explicitly approved queue1002 and subsequently approved storing the
shared sales team's calls once under the existing HQ branch for this pilot.
This does not introduce branch-independent visibility or grant user access.
Keep the [approved UI unchanged](CALL-CENTER-UI-PRESERVATION.md).

## Active local runtime

- Web3000 remains PID14544, approved build `uLTV0_qicViVV1BxsDKHW` in
  `F:/Projects/Rubi/.worktrees/call-center-durable-runtime-1018`.
- API4000 is PID14412 in
  `F:/Projects/Rubi/.worktrees/ami-sales-runtime-1021/apps/api`.
- Worker4409 remains PID9092 in the readiness runtime.
- The new artifact copies the compatible API from
  `F:/Projects/Rubi/.worktrees/call-center-readiness-runtime-1021`, retains its
  compatible packages, and overlays only telephony.service.ts and Issabel
  config.ts, issabel.service.ts, native-events.ts from d04ad9b2.
- Private environment is outside the task Git worktree, with file ACL restricted
  to the local user and SYSTEM. No credential, caller number or raw event is
  committed. Runtime provenance is recorded alongside the artifact.

The real connection was configured and activated through the existing Integrations
services with amin's actual effective permissions and branch membership; no grant,
mapping, schema or migration change. Collector mode is NATIVE_QUEUE_CAPTURE with
the sole inbound queue1002; relay and synthetic ingress are disabled. It sends
AMI Login/Ping only. Native mapping resolution is suppressed independently of
mapping availability; recipient is null and no popup offer is generated.

## Live acceptance evidence

The owner made and confirmed an external call through sales. At 11:30:20 UTC:

- Four canonical events for queue1002: RINGING, RINGING, ANSWERED, ENDED.
- All four Inbox rows DONE on their first processing attempt; no pending dispatch.
- Exactly one real INBOUND TELEPHONY call, technical state ENDED, stored under HQ.
- All four encrypted envelopes have recipient=null. Zero offers for this real
  connection, zero active mappings, no claimed user.
- Operational call count changed7→8; global offer count stayed1 (an existing
  synthetic offer, preserved). Business details remain needsCompletion=true.
- Independent fresh database reads confirmed persistence. No authenticated browser
  refresh/visual acceptance is claimed; approved Web bytes were not changed.

Candidate health was checked on4001 with ingress disabled before replacement.
Current Web3000, API4000 and Worker4409 health checks return200. AMI socket remains
established and successful receipt/processing confirms authenticated delivery.
API build, build-scope typecheck, scoped lint and10 native/parser/socket tests pass.
No source implementation changes were needed. A pnpm invocation initially triggered
automatic dependency verification; it was stopped and checks used installed tools
directly. No tracked dependency or lockfile changes are included.

## Boundaries and rollback

This is local company-network activation, not production deployment. API and
Worker must remain running and connected to the company network. Do not start
another collector for this connection. Current coverage starts at sales-queue
entry; direct/outbound calls, historical reconciliation, recorded audio retrieval
and popup delivery are not enabled. Accepted events are durable, but AMI events
missed during network/process downtime are not replayed by this adapter.

Production TLS/transport hardening and service supervision remain separate work.
Future extension mappings alone must not enable native popups without a bounded
approved routing change. Future shared multi-branch visibility needs an explicit
access-model change; this pilot uses existing HQ authorization.

Rollback: verify API PID/port ownership, stop only the new API collector, set its
private ISSABEL_ENABLED=false, and restart the previous readiness API using its
unchanged private environment and dist/main.js. Keep Web and Worker running and
preserve accepted calls/Inbox. Do not roll back the database or delete call data.
No PR, merge or production deployment is performed by this unit.
