# Call recovery — 2026-10-24

PC-C; branch `codex/pc-c-call-recovery-1024`, base develop `1293550e`.
User approves automatic recovery, first activation seven days back, five-minute
overlap thereafter, no duplicate calls, no historical live popup, and no guessed
employee/destination. Read-only CDR access is not yet known; server deployment is
performed on another PC. UI-preservation policy remains unchanged.

## Implemented

- Provider-independent recovery source port and automatic polling coordinator.
  No source provider is installed by default. Even with the environment flag,
  missing adapter means no polling, provider connection or business-data write.
- Durable append-only Integrations audit checkpoint; initial start does not slide
  forward after process restart. Transaction advisory lock and compare-and-set
  protect concurrent progress. Audit stores UTC checkpoint only, never call PII.
- One-hour catch-up windows with five-minute overlap and bounded pagination.
  Checkpoint moves only after every recovered receipt is actually projected.
  Partial failure, dead letter, timeout or retention gap preserves the checkpoint.
  Recovery resumes by retrying the window, not by discarding failed records.
- Private recovery ingress retains normal validation, provider activation checks,
  rate limiting, encrypted Inbox/Outbox, collision checks and normal domain
  projection. Only historical age is relaxed on this port; live clock policy is
  unchanged and future recovery timestamps are rejected.
- Separate deterministic `cdr-recovery:` event namespace avoids reusing a live
  notification envelope. Identical PBX linked/root identity joins live/recovered
  events to one existing call. Recipient is always null for historical envelopes;
  no popup offer is created. Existing live offers are not deleted.
- Confirmed unanswered facts reuse the existing NO_ANSWER/needsCompletion history
  behavior. Recovery never invents an answering employee or updates sticky routing
  from old evidence. Existing operator-saved business results retain their rules.

## Remaining source/activation contract

Supply an in-process `ISSABEL_RECOVERY_SOURCE` implementation of `RecoverySource`
only after inspecting the real read-only CDR/CEL/queue source. There is no guessed
SQL schema, public ingestion/upload URL, downloaded secret or fabricated CDR API.
`ISSABEL_RECOVERY_ENABLED=true` is a necessary switch, not a complete connection.

The adapter must:

1. Implement `ready()` using verified source connectivity and the final access/
   organizational policy. Stage-two CEO/demo-only unknown routing and destination
   manager scope are NOT implemented by this task and are activation dependencies.
2. Convert actual provider times to UTC with verified timezone, not host timezone.
3. Query finalized calls by end time `[from, through)`, so calls beginning before
   the recovery window but ending inside it are not missed. Provide stable paging
   and a truthful finalized watermark accounting for delayed CDR writes; never
   mark a partial source response complete. The retention lower bound must be real.
4. Preserve exactly the same linked/root IDs as live capture, stable per-event IDs
   across retries and complete known legs. If correlation cannot be established,
   fail the window for investigation rather than create a second guessed call.
5. Normalize only approved external inbound/employee external outbound calls.
   Do not import internal-only calls. Infer neither answered extension from ringing
   nor destination unit from CallerID. Root ENDED is required for recovered calls.
6. Use bounded read-only network/database operations and do not log raw records or
   credentials. No automatic recording-file fetch is included.

Polling retries every minute while unavailable or caught up; catch-up continues
after one second on completed windows. Source waits are bounded by a 30-second
run budget. A dense window that repeatedly exceeds budget needs provider/batch
tuning before activation; it must not be falsely acknowledged. Existing AMI gap
audits are deliberately not cleared: CDR completion alone does not prove CEL/queue
event coverage or recover every intermediate transfer.

## Validation and handoff

Targeted tests include real isolated PostgreSQL history deduplication, live/root
coalescing, zero historical offers, payload-tombstone retry and concurrent durable
checkpoint initialization/advance. Only generated fixtures are written to the
disposable `nora_ci` database; operational local/production data is untouched.

Before production: implement/verify the actual source adapter; complete stage-two
authorization and stage-three capture integration; test real disconnect/reconnect,
restart, retention loss, long call, transferred call and simultaneous live/recovery
arrival (manual test). Verify employee/manager/CEO/demo history scopes (manual test).
No UI changes, migration, dependency changes, runtime restart, deploy or merge.

Initial PostgreSQL run exposed Prisma's inability to deserialize a void advisory
lock result; corrected the query to return a scalar and reran the tests. Typecheck
uses current locally built Contracts through a temporary external tsconfig path
mapping, rather than stale declarations in reused node_modules. No type suppression.

Validation: 97 related tests pass with PostgreSQL enabled; expanded recovery suite
13 tests passes separately. Scoped lint, full API typecheck and TypeScript build
pass. Source locks release on publication; actual source activation remains blocked.
