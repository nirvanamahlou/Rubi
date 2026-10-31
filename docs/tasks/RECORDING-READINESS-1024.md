# Recording readiness — 2026-10-24

Owner authorizes preparation without PBX file/database access, preserving approved
UI and suppressing all automatic call popups, then local3000 activation.
PC-C source starts at1168321a (current develop), retains answered staff/unit display
and current own/team access, and composes released dossier cards cd561146 plus
download e3bc3910. No source overwrite from the older runtime. No new UI control
except the already explicitly authorized audio-download action. No CSS changes.

## Prepared transport

Existing upload-issabel-recording.mjs now accepts validated relative dated paths,
rejects traversal/symlinks, missing root, malformed/truncated RIFF WAV and changed
files, checks the queued SHA256 before sending, validates ERP receipts and uses
bounded retry with jitter. HTTPS is required except loopback; redirects forbidden.
Existing20MiB/32KiB chunk limits and stable replay IDs remain. Files are never
deleted from the PBX/staging directory. Upload credentials must be distinct from
AMI, Worker and relay credentials. Secrets never belong in CLI arguments or Git.

New recording-spool.mjs persists encrypted manifests (AES256-GCM, filename AAD,
HMAC opaque identity). It stores path/correlation/digest inside ciphertext only;
no recording bytes or credentials are copied into the spool. A verified adapter
must supply version1, finalized=true, relative file, rootCallId, externalCallId,
direction. Finalized is an assertion backed by the verified PBX/CDR adapter, not a
guess based on a file's age. Filename/phone/time proximity never proves call identity.

Spool retains source digest, attempts and deadline; max10000 jobs, max20 attempts
per flush, eight failed flush attempts before review, exponential backoff/jitter.
400/409/413/415/422 immediately require review. Authentication/transient/network
failure stays pending with bounded attempts. Changed content requires review and
cannot silently become a new call recording. Replayed completed jobs do not upload
again. Crash between upload and local acknowledgement replays the same server IDs.
Successful receipts and review records expire under explicit local retention;
expiry removes only encrypted manifests, never source audio. Server retention is
independently configured. No default retention choice is made for the owner.

Single-writer .lock directory covers enqueue/flush/retry. Unexpected process death
leaves a lock for operator recovery; no process steals a potentially live lock.
After confirming no writer remains, remove only .lock and any matching .json.tmp
left by interrupted atomic replacement, then rerun flush. Completed .json files
must be retained. This is explicit recovery, not automatic crash-lock recovery.
Files are fsynced before rename; durable volume and filesystem guarantees still
apply. Directory permissions700 and files600 on POSIX; on Windows restrict ACLs to
the collector service account. Keep key stable and backed up separately.

## Private collector configuration

Configure outside Git, loaded by the service manager/private environment file:

- ISSABEL_RECORDING_DIRECTORY: trusted read-only source/staging root.
- ISSABEL_RECORDING_API_URL: verified ERP URL ending in /api/v1/internal/issabel/recordings.
- ISSABEL_RECORDING_UPLOAD_SECRET: separate private shared credential, minimum32 characters.
- ISSABEL_RECORDING_SPOOL_DIRECTORY: writable private durable local directory.
- ISSABEL_RECORDING_SPOOL_KEY_BASE64: independent random32-byte key, canonical Base64.
- ISSABEL_RECORDING_SPOOL_RETENTION_DAYS: owner-selected integer1..365.

Run with Node24 on a trusted collector that can read finalized files. Commands:

```text
node --env-file=<private-environment> scripts/call-center/recording-spool.mjs enqueue
node --env-file=<private-environment> scripts/call-center/recording-spool.mjs flush
node --env-file=<private-environment> scripts/call-center/recording-spool.mjs retry <opaque-job-id.json>
```

Enqueue reads bounded JSON from stdin, e.g. synthetic contract:

```json
{"version":1,"finalized":true,"file":"2026/10/24/synthetic.wav","rootCallId":"test.123","externalCallId":"test.456","direction":"IN"}
```

Retry requires an unexpired review job and unchanged source; records retry count
and timestamp inside encrypted state. Flush prints counts only, returns2 for
pending/review and1 for configuration/integrity/lock failure. Schedule repeated
flush only after verified adapter/credentials/retention are supplied. No scheduler
or real uploader has been enabled locally; existing AMI capture remains separate.

## Authorization and operational limits

Dossier manifest and each download recheck the latest own/team contact policy plus
recordings.read. Legacy attention media scope remains unchanged. No permission
grants. Approved dossier navigation/card changes are included without reverting
new caller/answered-destination fields. Native capture continues suppressing offers.

No remote SFTP credentials, server host fingerprint or CDR schema available yet.
Thus no guessed SQL, SFTP connection, recording-to-call mapping, recording-complete
hook or PBX configuration is deployed. Collector contract is ready for the verified
adapter. SSH/CDR access, actual file format, private network reachability, credentials,
retention and a real recorded-call acceptance are external gates. Only RIFF WAV up
to20MiB currently supported; unsupported real formats need a verified conversion
decision. No claim of full real-PBX recording integration or production acceptance.

## Validation

46 targeted checks passed:20 API (including10 real disposable PostgreSQL scenarios
and3 dossier authorization cases),19 Web (including both icon directions, dossier
cards, confirmed answer form/draft and explicit popup hold),7 collector/spool tests.
The initial parallel database run hit the existing5s timeout in one answer-history
scenario; rerunning the complete10-case database suite with30s timeout passed.
All189 existing migrations deployed to disposable nora_ci only, then its container
was stopped. No synthetic data or migration entered the operational database.
Scoped API/Web/scripts lint, API TypeScript, API Nest and final Web production
build/typecheck pass. Existing generated CSS optimizer warnings remain unrelated;
no CSS changed. The popup-hold source change received a separate final Web rebuild.

Local activation explicitly authorized this turn: publish worktree API4000 runs
dist-recording-ready-1024 (PID19912); Web3000 runs .next-recording-ready-1024
(PID14012, build DlCkN_ahWGUiq8WcjxL8j). Build/start both use
NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=false; even pre-existing synthetic offers
cannot mount the attention UI. Native queue1002 capture configuration and private
answer directory retained. Existing Worker4409 untouched. All three health/login
URLs return200; anonymous dossier recording manifest returns401. Authenticated
visual acceptance and actual company audio download remain unexecuted (login and
real audio ingestion required). Operational recording count remains0.

Before/after read-only aggregate: five real ENDED inbound calls,21 DONE receipts,
zero pending dispatch, zero real offers. No field/data/grant rewrite. Old API
dist-answer-1024 and Web .next-answer-1024 artifacts retained for rollback; keep
popup hold if rolling back UI (older build lacks the explicit hold).

No new migration, dependency, production deployment, PR or merge in this unit.
