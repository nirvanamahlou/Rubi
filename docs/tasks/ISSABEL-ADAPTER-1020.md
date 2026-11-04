# Issabel integration infrastructure — 2026-10-20

## Scope and documented choice

Integrations owns an optional native Node AMI client inside the existing Nest API.
It feeds the existing encrypted inbox/outbox and public Customer Affairs port.
Redis carries only inbox IDs in the existing Worker. No PBX database access, new
dependency, browser SIP/WebRTC, audio player, arbitrary AMI action, or LLM input
is added. The original local Call Center worktree and a separate approved source
snapshot remain intact; reviewed develop PR1003 supplies the implementation base.

Primary documentation:

- [Issabel interfaces](https://ccmanual.issabel.com/en/api/ami-agi-ari.html)
- [Issabel PBX REST API](https://ccmanual.issabel.com/en/api/issabel-api.html)
- [Issabel statistics API](https://ccmanual.issabel.com/en/api/call-data.html)
- [AMI v2 specification](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-v2-Specification/)
- [Originate](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Actions/Originate/)
- [MixMonitor](https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/MixMonitor/)

AMI is the event/click-to-call interface. PBX REST is for configuration; the
statistics REST example requires Asternic PRO and is not assumed installed.
Deployment compatibility must be verified against the actual Issabel/Asterisk
versions, channel technology and custom dialplan. No real PBX has been supplied.

## Private API configuration

Put these variables in a local ignored environment file/secret manager, never Git:

```dotenv
ISSABEL_ENABLED=false
ISSABEL_CONNECTION_ID=<existing-real-connection-uuid>
ISSABEL_AMI_HOST=<private-pbx-dns>
ISSABEL_AMI_PORT=5039
ISSABEL_AMI_TLS=true
ISSABEL_AMI_USERNAME=<dedicated-manager-user>
ISSABEL_AMI_SECRET=<private-password>
ISSABEL_CHANNEL_TECHNOLOGY=PJSIP
ISSABEL_OUTBOUND_CONTEXT=nora-erp-outbound
ISSABEL_ALLOWED_PREFIXES=09,021
ISSABEL_RECORDING_UPLOAD_SECRET=<separate-random-secret-at-least-32-characters>
ISSABEL_RECORDING_RETENTION_DAYS=<approved-integer-1-to-365>
```

Optional `ISSABEL_AMI_CA_PEM` supplies a private CA; certificate verification is
never disabled. Plain AMI is accepted only on loopback, e.g. a separately secured
local tunnel. Restrict PBX manager ACL/firewall to the API host. Use dedicated
manager credentials with `read=call,user` and `write=originate`, appropriate
event filters and no `command`, `config`, `system` or administrator grants.
Verify exact privileges/event availability on the installed version. Keep the
internal recording endpoints private behind HTTPS/network ACL and request limits.

1. Apply reviewed additive migration with backup and preservation of existing rows.
2. Configure an inactive real connection and existing extension/operator mappings
   using the already protected `/integrations/telephony` routes.
3. Configure the private environment; restart API only after preserving all its
   existing environment files. Issabel errors do not stop unrelated ERP routes.
4. An authorized integration administrator explicitly posts
   `/integrations/telephony/issabel/activation` with connectionId/version/active.
5. Check `/integrations/telephony/issabel/status`; the dedicated Call Center dialer
   appears only for the matching authorized branch and required call permissions.
6. Test a designated internal phone and synthetic external test destination first.
   No automatic production calls are made by installation or tests.

## Canonical PBX event hooks (version 1)

The adapter deliberately does not infer human answer from IVR channel `Up`, or
whole-call completion from a single ring-group/transfer leg `Hangup`. A PBX admin
must publish documented `UserEvent: NoraCall` facts at verified custom dialplan
hooks. Do not edit generated Issabel configuration files. The adapter accepts:

```text
Event: UserEvent
UserEvent: NoraCall
SchemaVersion: 1
Kind: RINGING
Direction: IN
ExternalCallId: 1792490000.17
RootCallId: 1792490000.17
OccurredAt: 1792490000
Caller: +12025550123
Destination: 02100000000
CompanyLine: 02100000000
Extension: 101
Queue: 600
TerminalForCall: 0
```

`ExternalCallId` is the channel uniqueid; `RootCallId` is linkedid throughout
transfers. Timestamp is epoch seconds. Kind is RINGING/ANSWERED/ENDED/TRANSFERRED;
direction IN/OUT must remain stable for the root. An unavailable caller is UNKNOWN
or WITHHELD, never an invented number. `EndReason`, only for ENDED, is COMPLETED,
NO_ANSWER, CANCELLED, FAILED or UNKNOWN. `TerminalForCall=1` is legal only for ENDED
and only after proven linked-call completion. Each offered agent needs its own
extension/leg RINGING fact; map the eventual responding extension on ANSWERED.

Custom hook example (illustrative, adapt and test with the PBX administrator):

```asterisk
[nora-event]
exten => s,1,UserEvent(NoraCall,SchemaVersion:1,Kind:${ARG1},Direction:${NORA_DIRECTION},ExternalCallId:${UNIQUEID},RootCallId:${CHANNEL(linkedid)},OccurredAt:${EPOCH},Caller:${CALLERID(num)},Destination:${NORA_DESTINATION},Extension:${NORA_EXTENSION},TerminalForCall:0)
 same => n,Return()
```

Wire inbound/agent answer/transfer/linked-call completion to existing routes;
the exact hook locations cannot be guessed without the actual PBX configuration.
Root-terminal facts require a verified final-call signal (e.g. CEL LINKEDID_END
via a PBX-side publisher). The example above never claims root completion.

Outgoing Originate rings `PJSIP/<mapped-extension>` or `SIP/<mapped-extension>`
first, then runs the approved `nora-erp-outbound` context with the validated
destination as Exten. The context must exist, enforce the same outbound policy
and publish OUT facts. The adapter supplies inherited NORA_COMMAND_ID,
NORA_EXTENSION and NORA_DIRECTION variables. Do not accept client channel,
context, caller ID, dialplan, URL or extension overrides. Configure a finite
approved prefix set; emergency/premium/international destinations need explicit
PBX policy and must not be admitted by overly broad prefixes.

## Commands and uncertainty

`POST /integrations/telephony/issabel/commands` accepts id (UUID replay key),
connectionId and number only. Current actor/branch/create/workflow permissions,
exactly one active extension, current IAM eligibility, prefix policy and 3/minute
per-user budget are enforced. Dispatch rechecks live mapping/IAM and expiry.
The database transitions QUEUED -> DISPATCHING before the socket write. Multiple
API processes cannot claim the same command. No send is automatically retried.
Lost replies/crashes become UNKNOWN; stale queued commands expire after 60s.
AMI immediate acceptance is ACCEPTED; asynchronous OriginateResponse settles
SUCCEEDED/FAILED, where SUCCEEDED means the first/internal origination succeeded,
not proof that the external customer answered. Call facts record real progress.
User reads can see only their own authorized-scope command status, never targets.

## Actual audio in PostgreSQL, without a player

Run `scripts/call-center/upload-issabel-recording.mjs` on a trusted PBX-side host
after StopMixMonitor closes the WAV. No shell post-command is constructed from
caller data. The uploader needs Node24, an approved recording directory, the
private HTTPS API URL ending `/api/v1/internal/issabel/recordings`, and the separate
recording secret. It accepts a basename, root uniqueid, leg uniqueid and IN/OUT.
It rejects symlink escapes, unsupported sizes and changing files; never deletes
the PBX original. Retry the same file after an outage. Stable recording UUID and
chunk identities make the bounded retries idempotent.

The API stores **actual audio bytes**, base64 encoded inside authenticated
AES-256-GCM encrypted 32KiB chunks in PostgreSQL; it does not merely save a URL.
Metadata is encrypted with row AAD/key version. Completion requires all ordered
chunks, exact byte count, SHA256 and a valid RIFF/WAVE envelope. Only then is the
opaque recording reference published into the existing durable event inbox.
There is no download/playback or external-URL fetch endpoint. Existing per-row
encryption/fingerprint keys and backup custody remain required.

Current bounded format: RIFF/WAVE, 44 bytes–20MiB, maximum 640 chunks, 10 pending
uploads and 1000 new recordings/day/connection. Larger calls or other codecs need
an explicitly reviewed extension; they fail visibly in the uploader and the PBX
original remains available. Separate recording retention is mandatory before
upload activation: 1–365 approved days. Incomplete uploads expire after 24h;
completed chunks/metadata expire together on the configured deadline with minimal
audit. Database backups and PBX originals have independent retention obligations.
These limits/retention must be approved for the actual call volume before rollout.

## Reliability, tests and rollout limits

TLS, fragmented/coalesced AMI parsing, 64KiB frame limit, 5s connect/action budgets,
bounded in-flight actions/events and reconnect backoff protect the API. No raw
AMI frames, phone numbers, audio, cookies or secrets enter logs/audit. Provider
receipt uses the existing event validator, duplicate/collision handling, encrypted
inbox, Worker retry/dead-letter path and versioned agent routing.

AMI is a live event stream, **not durable replay**. Disconnect/restart/rejected
event persistence is reported as GAP/LIVE_ONLY; reconciliation remains unsupported.
A PBX-side durable event publisher/CDR/CEL reconciliation and installed-version
transfer/queue/recording proof are required before claiming complete production
call coverage. Never silently label a gap as complete historical call data.

Tests use loopback fake AMI and a disposable PostgreSQL database only. No provided
Issabel host/version/credentials or real recording exists, so live acceptance and
production readiness are explicitly pending. Local operational migrations and
PBX changes are not implicit in this source delivery.

Verified locally: all179 migrations on the isolated database;3 actual PostgreSQL
pipeline/authorization/audio lifecycle tests;4 fake-AMI tests;7 telephony
security/state regressions;11 Web/client regressions;1 uploader test and5 CI policy
checks. Scoped API/Web lint and shared builds passed. Integration with current
develop preserves both HR/Sales translations and coordination records. Final
exact-head hosted quality, types, build and PostgreSQL checks gate develop merge;
no live call, playback or installed-PBX compatibility test is claimed.

## 2026-10-21 backend readiness follow-up

The recording-read and operational-readiness limitations above are superseded where explicitly documented in [CALL-CENTER-READINESS-1021](CALL-CENTER-READINESS-1021.md): authenticated scoped byte-range audio delivery and recovery/health/relay tooling are now implemented. No player or technical panel was added, no real provider access was used, and live integration acceptance remains pending.
