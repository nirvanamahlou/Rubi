# CALL-CENTER-RECORDING-DOWNLOAD-1031 — PC-C

Owner requests production call-audio downloads and previously selected90-day ERP
retention. The existing Call Center recording download UI and native Integrations
recording storage/read API are used without changing their appearance, API/schema,
dependencies, approved popups, call capture or employee data scopes.

## Production acceptance — 2026-10-31

- Direct ERP-server-to-PBX SSH using the existing `bi` account and pinned ED25519
  host identity succeeded over the independent VPN; no workstation relay.
- Read-only CDR/CEL inspection confirmed MariaDB5.5.64, CDR recordingfile/uniqueid
  and CEL linkedid/LINKEDID_END metadata. Database and PBX epoch clocks matched;
  current local UTC offset is3600 seconds, despite the cached CEST startup label.
- Existing ended nonsynthetic ERP calls are correlated by their authenticated
  canonical root IDs/fingerprints and actual CEL leg/root membership. Never match
  voice by caller number, approximate time, display name or file-name guessing.
- Initial synchronization completed9 recorded roots. Remaining inspected roots
  returned no recording reference in CDR; they remain retryable without invented
  audio. Source PBX files/CDR/configuration are never modified or deleted.
- A real downloaded WAV287724 bytes matched its stored/source SHA256. The actual
  answering expert could read it, an unrelated scoped expert was denied, both
  approved global accounts could read it, and3 actual same-unit managers passed.
- Owner refreshed ERP, downloaded audio through the existing history button and
  explicitly confirmed playback was correct. UI acceptance complete.

## Transfer/finalization boundary

`pbx-recording-source.py` runs in the existing PBX Python2 process via SSH stdin.
Only fixed parameterized SELECT statements are used with existing readable CDR
configuration. No PBX service, route, permission, credential or dialplan is changed.
It requires terminal LINKEDID_END, an ended ERP session, a completed CDR file
reference, unambiguous leg/root membership,30 seconds of quiet time, confined
regular nonsymlink paths, stable file identity/stat before and after reading and a
complete RIFF/WAVE size. Missing/ambiguous/active files are retained for review/retry.

`recording-pull.py` uses the owning CallCenterCrypto implementation inside the
deployed API to read only canonical root context; no caller payloads are emitted.
The source audio crosses SSH into memory, then uploads through the existing
loopback-only authenticated recording API using a distinct private credential.
No plaintext voice is spooled to disk. Stable v8 identities match the existing
JS uploader, and native chunk deduplication/checksums make interrupted retries
safe. Publication uses the normal Inbox/Outbox/Worker; no direct business writes.

SQLite checkpoints contain only opaque root/file fingerprints, audio hashes,
recording UUIDs and retry/cursor metadata, in a root-only directory. Recent calls
are prioritized while an independent cursor scans older ended calls within90 days.
At most10 source roots are inspected per run. Source failures retry after5 minutes.
The existing20MiB WAV limit, upload quotas and native90-day expiry remain in force;
larger/unsupported files are not truncated or substituted. The transfer reserves
at least2GiB plus three times the next file size before upload. Future capacity
must be monitored as encrypted audio contributes to PostgreSQL/backup size.

## Authorization and credentials

The existing native administrator account supplies IAM authority. The existing
Integration manager supplies its own read-only configuration authority. The
bootstrap previews all15 already-scoped mapped/global accounts, adds exactly
`customer_affairs.call_center.recordings.read` through ManualUserAccessService
with native operator checks/CAS/audit, and retains every unrelated grant/control.
There is no invented actor capability, direct IAM table write or broader team grant.
Native answered-call/branch/unit/global policies and recording-read audit remain
authoritative. Partial access changes have a private rollback receipt; concurrent
edits are never silently overwritten during compensation.

Secrets/known-host pin/checkpoints/source scripts are protected under
`/opt/rubi/private/call-recordings-1031`; no credential or real audio is in Git.
The dedicated upload credential is installed in the private API environment;
it differs from Worker/AMI credentials and redirects are refused. SSH credentials
are read by a root-only askpass helper, not placed in arguments or logs. Restore
requires the existing encrypted configuration and database backups/keys.

## Runtime and rollback

`rubi-call-recordings.timer` is enabled at boot and runs one minute after each
completed run. Its root oneshot service uses an OS advisory lock, private temp,
restricted home access and no-new-privileges; no overlap/stale directory lock.
Successful automatic runs were verified. Allow roughly1–2 minutes after hangup
for normal recordings, plus any backlog/network retry delay.

Fresh encrypted backup preceded API credential activation. Deployed API/Web/Worker
images and volumes were preserved; API and Worker were recreated together because
Worker shares API network namespace. Web, PostgreSQL and Redis were unchanged.
Stop/disable the recording timer first to pause transfer; revert only the dedicated
API upload credential/configuration if needed, recreating API/Worker together.
Already accepted encrypted audio and source files must not be deleted as rollback.
Native IAM compensation is possible only while the expected post-grant selections
still match, using the private access-result receipt.

Private machine upload remains separate from authenticated staff download. Existing
UI must be refreshed after grants; expired or genuinely unrecorded calls continue
to display the existing unavailable/no-file message. No CDR gap-recovery feature
is enabled by this task.

## Evidence and checks

-7 Linux Python safety checks: source path/symlink/quiet/final WAV integrity,
  stable native uploader UUID contract, missing terminal event refusal and API-only
  credential configuration preserving Worker/unrelated settings.
- Native read-only permission preview15 accounts, then15 audited own-scope grants.
- Real source correlation, native upload/checksum/publication and role/download
  acceptance above; no synthetic production call or voice data.
- Python compile checks, Node syntax/format checks and systemd unit verification.
  No application source changes require a new API/Web build or migration.

Sanitized receipts (contain counts/booleans, no phone/audio payload):
`/opt/rubi/CALL-RECORDINGS-RELEASE-1031.json`,
`/opt/rubi/CALL-RECORDINGS-PULL-1031.json`,
`/opt/rubi/CALL-RECORDINGS-ACCEPTANCE-1031.json`.
Future API deployments must retain the private upload credential, answered-access
code,90-day retention and persistent checkpoint directory; never replace runtime
from a stale local snapshot. Recreate Worker whenever API is recreated.
The live answered-access producer is the previously reviewed policy overlay
`0dad51a92` (PR1206); this operational PR does not merge or replace that separate
API/schema change. Integrate that producer before replacing its live implementation
with a normal upstream API build.
