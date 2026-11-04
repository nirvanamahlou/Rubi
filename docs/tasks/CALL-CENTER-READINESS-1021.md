# Call Center provider-independent readiness — 2026-10-21

Owner: PC-C. Source: `codex/pc-c-call-center-readiness-1021`, based on develop
`550a5dd5`. The owner explicitly requests completion without real Issabel access,
localhost3000 activation, no change to the approved UI, and no technical/test panel.
The [UI preservation policy](CALL-CENTER-UI-PRESERVATION.md) applies.

## UI baseline and scope

Approved local Web build: `uLTV0_qicViVV1BxsDKHW`, from the KPI/report-trim work.
All nine contacts columns, centering, four KPI cards, filters, dossier, queue and
remaining reports are frozen. This unit changes no Web component, style, text,
route or popup. Audio delivery is an authenticated backend capability only; adding
a player or download control requires separate design approval. No test or
configuration controls are mounted. Existing Issabel dialer code is not activated.

## Completed backend contracts

- An already accepted canonical event can be retried after its clock window.
  Identity/payload collision still fails. New events still obey the connection's
  configured age/future bounds. Deactivation still rejects all ingress.
- Late earlier call facts correct the call occurrence time and contact ordering;
  terminal state, receipt time and operator business data remain intact.
- Real ingress defaults to 120 events/minute per connection; optional
  `TELEPHONY_EVENTS_PER_MINUTE` accepts 120–6000. Synthetic remains capped at120.
  Excess returns429 so a durable publisher retains and retries it.
- Completed WAV publication recovers on the existing minute maintenance loop,
  using a durable `RECORDING_PUBLISHED` audit receipt and the existing Inbox dedupe.
  A crash after publication but before the receipt is safe. The current clock
  policy still applies if a *never accepted* recording fact is too old; health
  reports it as unpublished and an authorized policy/recovery decision is needed.
- `GET /api/v1/integrations/telephony/recordings/:id/audio` requires current IAM
  authentication, Call Center read plus **recordings.read**, authorized branch,
  an active offer/claim permitted by the public Customer Affairs media port, and
  the exact recording reference on that session. Complete/unexpired audio only.
  Full and single byte-range reads are bounded by the existing20MiB limit; only
  required32KiB encrypted chunks are read. Range, chunk integrity, private/no-store,
  nosniff and per-user60/minute audit budget are enforced. No public URL, provider
  URL fetch or browser credential is introduced. Read history records actor,
  recording ID and byte bounds, never phone/audio. No live permission grant/seed.
- `GET /api/v1/integrations/telephony/health` requires existing integration-admin
  authority and Call Center read. Branch-scoped server aggregates report pending,
  retry, dead letters, oldest age, unknown commands, uploading/expired/unpublished
  recordings. It decrypts no call history and excludes synthetic connections.
  A60-second pending age raises PROCESSING_DELAY; other nonzero error conditions
  produce explicit alert codes. NO_INTERNAL_ALERT does not mean PBX verified.
  Existing operations response adds the same health object; old fields remain.
- Worker transport refuses public plaintext endpoints and redirects. PostgreSQL
  Outbox remains authoritative across Worker/Redis outages. Replay serializes on
  the Inbox row. No automatic retry of uncertain outgoing dial commands is added.

## Optional durable canonical publisher

`scripts/call-center/event-relay.mjs` is a provider-neutral transport, not an
Issabel API/payload guess and not historical CDR reconciliation. A verified
PBX-side adapter must supply the existing TelephonyEventV1 facts and stable IDs.
Do not enable a second publisher with conflicting identities for the same source.

Server configuration (private environment only):

```dotenv
TELEPHONY_RELAY_ENABLED=false
TELEPHONY_RELAY_CONNECTION_ID=<existing-active-real-connection-uuid>
TELEPHONY_RELAY_SECRET=<independent-random-secret-at-least-32-characters>
TELEPHONY_EVENTS_PER_MINUTE=120
```

The endpoint is `POST /api/v1/internal/telephony-relay/events`; disabled by default,
separate credential, one server-selected connection, strict v1 validation,16KiB
payload and existing ingress budget. It cannot choose a user/branch or submit AMI
commands. Worker, recording and AMI credentials cannot substitute for the relay
credential. Keep it behind private TLS/network ACL and edge request-size limits.
Acknowledgment occurs only after the real encrypted Inbox/Outbox transaction.

Publisher environment, on the trusted machine holding the event source:

```dotenv
TELEPHONY_SPOOL_DIRECTORY=<private-local-directory>
TELEPHONY_SPOOL_KEY_BASE64=<independent-32-byte-key-base64>
TELEPHONY_SPOOL_RETENTION_DAYS=<approved-1-to-365>
TELEPHONY_RELAY_CONNECTION_ID=<same-connection-uuid>
TELEPHONY_RELAY_API_URL=https://<private-erp>/api/v1/internal/telephony-relay/events
TELEPHONY_RELAY_SECRET=<same-independent-relay-secret>
```

Use Node24. Feed one canonical JSON event on stdin to `node event-relay.mjs enqueue`.
Run `node event-relay.mjs flush` from the organization's supervised scheduler.
The source must retain facts until enqueue confirms success. Files contain
AES-256-GCM ciphertext, names are HMAC identities, writes are flushed then
atomically published without overwrite. Enqueue collision fails. Flush sends at
most50 files, uses15s requests and refuses redirects/nonlocal plaintext. A network,
429 or authentication failure retains the event. Only a valid durable receipt
removes it.400/409/422 quarantines encrypted data for operator review. Capacity is
10000 records; the source must retain events if that bound is reached. Quarantine
and pending data expire according to the explicit configured retention policy.
Monitor nonzero exit codes and counts; never treat rejected/expired data as delivered.

Deploy the spool on a trusted local filesystem with restrictive OS ACLs. POSIX
mode bits are set, but Windows ACLs remain an operator responsibility. An encrypted
spool protects queued payloads; it cannot recover an event never published by the
PBX or guarantee physical-disk survival. Include its independent key and directory
in the approved backup plan. Temporary files from an interrupted enqueue are not
deliverable; the source retries enqueue. Do not delete pending/dead records merely
to clear an alert, and do not send real source JSON to logs or chat.

## Operator checks and recovery

`node scripts/call-center/readiness-check.mjs` probes the configured
`TELEPHONY_CHECK_API_URL` (defaults local API) and confirms anonymous health access
is401. Optional `TELEPHONY_CHECK_COOKIE` is a current authorized ERP session from
a private environment file; never put it in CLI arguments or Git. Authenticated
checks report only safe counters and provider coverage. Missing authorization,
alerts or transport failure produce a nonzero exit. It always reports live PBX
acceptance as pending. This is a CLI/runbook, not a new operational panel.

| Condition | Action | Recovery evidence |
| --- | --- | --- |
| PROCESSING_DELAY / API/Redis outage | Restore API/Redis and Worker; keep Inbox/Outbox | Pending ages decrease; one root-call projection |
| DEAD_LETTER | Diagnose INVALID_DATA/CONFLICT/TEMPORARY; fix cause; authorized replay | Audit REPLAY and eventual PROCESSED, no duplicate call |
| COMMAND_OUTCOME_UNKNOWN | Verify actual PBX state before any human redial | Never resend uncertain Originate automatically |
| RECORDING_PUBLICATION_PENDING | Restore ingress/configuration; maintenance retries | One publication receipt and linked recording |
| RETENTION_OVERDUE | Check maintenance/DB availability and approved policy | Expired metadata/chunks removed together |
| Relay quarantine / expired event | Review policy/identity/clock with PBX owner | Explicit resolution, no false delivery claim |
| Unknown/internal routing | Authorized operations review and existing mapping API | Correct recipient; no unrelated broadcast |
| AMI GAP/LIVE_ONLY | Retain incident interval and reconcile with verified PBX source | Requires actual provider-specific implementation |

## Backup and rollout procedure

1. Record source commit, deployed API/Worker artifacts, unchanged Web build ID,
   environment *names*, applied migration names and safe aggregate call counts.
2. Take an encrypted PostgreSQL backup before any operational additive migration;
   retain the appropriate versioned field-encryption keys separately. Do not seed
   fixtures or change accounts. Verify backup readability and a separate restore
   drill before production rollout.
3. This unit creates no migration. The previously reviewed
   `20261020150000_issabel_adapter` is required for the three recording/command
   tables. Local runtime may receive only this prerequisite after backup; do not
   apply unrelated pending Sales/Finance/HR migrations as a shortcut.
4. Build and smoke-test a compatible API candidate before replacing the current
   process. Preserve current environment/key material. Keep Issabel and relay
   disabled until actual source configuration and approval. Start the existing
   Worker with private machine transport and a distinct queue name.
5. Verify health, protected-route401, existing list/KPI contracts, persisted-data
   counts and unchanged Web artifact. Rollback code/processes to recorded artifacts
   if smoke fails; retain additive tables and data, never drop them to roll back.

## Tests and remaining gates

Automated coverage includes receipt
replay beyond clock window, identity collisions, late-ring timestamps, real
PostgreSQL audio publication recovery/range reads/branch and recipient denials,
expiry, health scope, relay enablement, encrypted publisher outages/concurrency,
mixed MANUAL/TELEPHONY KPI semantics and existing large-history/pagination tests.

Still dependent on real access or an organizational decision: installed PBX and
dialplan hooks, line/queue/extension mapping, authorized real users/retention and
capacity, actual audio format, historical reconciliation, measured ringing-to-popup
latency, organization-scale load target, operator pilot and production deployment.
UI audio playback requires separate approval. No real call, recording, integration
credential, production migration or production-readiness claim is part of this unit.

## Final verification and local activation

- 104 targeted tests pass: 48 real PostgreSQL, 15 protocol/security/state,
  7 HTTP, 4 Worker, 20 existing Call Center Web, 4 contracts and 6 relay/uploader.
  The HTTP mock was corrected to use the real IAM permission assertion before
  its successful rerun; no access guard was relaxed.
- A real Redis/BullMQ-to-Worker-to-HTTP-to-PostgreSQL smoke passes stopped-worker
  recovery and duplicate suppression. All 180 migrations apply on disposable
  PostgreSQL18.1. Scoped lint, affected typechecks, API/Worker builds and diff
  checks pass. No Web rebuild is needed: zero Web source changes.
- The large-history test uses 1001 calls and 1001 notes for a contact. A20-summary
  response performs at most20 private decryptions and remains below30000 bytes;
  one local measured query took58ms. This is test evidence, not a production SLA.
- Before the local prerequisite migration, an encrypted PostgreSQL backup was
  taken with its key stored separately in ignored local files. A real restore
  into a disposable database succeeded. Counts and call ciphertext matched:
  7 calls, 5 contacts, 2 notes. These same counts remained after activation.
- Only existing additive migration `20261020150000_issabel_adapter` was applied
  to the local operational database. No new migration, unrelated migration,
  account grant, permission seed or synthetic business record was applied.
- Local API4000 (PID7756) and Worker health4409 (PID9092) return200. The private
  authenticated Worker pending route returns200; anonymous integration health
  returns401. Web3000 (PID14544) returns200 and its served HTML still identifies
  approved build `uLTV0_qicViVV1BxsDKHW`. No newly authenticated operator browser
  session or real PBX acceptance was exercised in this run.
- The API/Worker artifact lives at
  `F:/Projects/Rubi/.worktrees/call-center-readiness-runtime-1021`, based on the
  existing compatible runtime with bounded backend overlays and the IAM service
  prerequisite needed by the previously delivered Issabel adapter. It avoids
  requiring unrelated pending schema changes. Original runtime files and the
  approved Web artifact remain untouched. Local provenance is recorded alongside
  the artifact; private environment and backup files are excluded from Git.
- Issabel, relay and synthetic ingress remain disabled. Startup retry warnings
  during API cold start resolved once the API became healthy. Rollback uses the
  preserved original runtime API artifact; do not drop additive tables.

These results authorize local review, not production acceptance. Finish actual
provider contract verification, approved mapping/retention, real-call and audio
tests, measured popup latency, production capacity and operator pilot when access
and organizational decisions become available. Task publication is commit/push
only; no PR/merge/production deployment is performed by this unit.
