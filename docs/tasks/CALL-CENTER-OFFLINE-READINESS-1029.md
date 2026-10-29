# CALL-CENTER-OFFLINE-READINESS-1029

COMPUTER_ID=PC-C. Base origin/develop a55321015. The owner authorizes VPN-independent completion while IT confirms the network profile. Preserve the approved interface and disabled global widget. No production application deployment, business-data writes, account grants, schema change or PBX writes in this work item.

## Fresh production evidence — 2026-10-29

A new restricted audit receipt at /home/rubi-deploy/rubi-audit-20261029T082154286596Z.json confirms API/Web/Worker revision5314830983, running containers and unchanged Compose hash31bf091e5bc4c336e7ca355755997788faede0390567ae75bd741181199749e4. Docker and rubi-backup.timer are active. The transport activation receipt remains present; it is historical evidence of authenticated Worker/API setup, not proof of a current AMI session.

A new live READ ONLY database diagnostic through an ephemeral SSH tunnel confirms: zero contacts, calls, real sessions, real connections, active mappings, recordings and pending telephony outbox;196 completed migrations, zero unfinished. Seventeen profiles have a unit and thirteen employees link to accounts. Some approved accounts still lack HR links and some reviewed employees have only one registered extension. Role-only inspection does not calculate effective IAM grants. Private staff details and credentials are excluded from Git. The diagnostic tunnel is closed after the read.

The HTTPS readiness probe reaches the API and receives401 for anonymous operations. Without an authorized human session it reports authenticated checks NOT_SUPPLIED and operationalReady=false. No session was fabricated and the Worker credential was not repurposed for a user endpoint.

## Completed repair

The existing readiness CLI could pass incomplete health replies because it trusted a healthy state label and empty alerts without checking counters. It now requires nonnegative safe-integer counters/frame backlog, zero dead-letter/unpublished-recording/unknown-command/expired-recording counts, and a consistent pending-work age below the existing60-second alert threshold. Brief work in progress is allowed. Unknown, malformed and contradictory fields fail closed. This CLI does not claim real-call acceptance.

The owner approved90-day ERP recording retention. production-recording.env.example records the two non-secret settings for API retention and encrypted retry-manifest retention. It is not a full connection configuration or an activation command. API expiry currently starts at upload creation; source PBX files are not deleted by this template. Upload credentials, keys, source directory and retention activation remain deployment configuration. Existing maximum supported WAV size is20MiB; unsupported files must be retained for review, never reported uploaded.

## Source review: independent work still requiring a separate implementation unit

- Answered-call visibility remains incomplete: CallCenterAccessService filters ownerUserId; report SQL also considers creator/claim. Neither constitutes the approved additive, trusted ANSWERED responsibility policy. IntegrationTelephonyMapping still has one-user-per-extension uniqueness. A real-FK many-person responsibility projection and shared-extension contract need a coordinated additive schema/migration with IAM/HR public directory services, repeat-safe historical projection and endpoint isolation tests. Do not enable staff-wide production access or infer responsibilities from offers/manual outcome text. See CALL-ANSWER-ACCESS-1024. The shared migration owner has active peer work; this item does not take that lock or modify their schema.
- Server staff linkage, second extensions, organization/company membership and effective grants require a private reviewed preview against real identities. Missing HR links are not solved by copying localhost fixtures, guessed matching or broad grants. This is distinct from VPN.
- Recovery coordinator exists, but ISSABEL_RECOVERY_SOURCE has no production provider. Implementing the actual CDR/CEL reader requires verified source schema, UTC conversion, stable linked IDs/finalization watermark and read permissions. Passing coordinator tests does not recover a network gap.
- Recording uploader and encrypted spool exist, including retry, deduplication, changed-file rejection and expiry. Actual finalized-file discovery/correlation and service installation require verified source path/permissions and approved permanent account. No recording source or directory has been invented.
- Existing health includes backlog/dead-letter/unknown command/retention/publication alerts. A durable notification channel and approved recipient are not configured; no external message is sent.

## Acceptance boundary

Keep VPN-dependent direct/queue inbound, outbound, transfer, unanswered, actual staff identity, real audio download, network interruption/reconnect, reboot and duplicate prevention as NOT_RUN_LIVE. Also retain organization/access rollout as incomplete until implemented and tested; source unit tests are not production acceptance.

## Validation

Results are appended after execution. All PostgreSQL checks use a new disposable nora_ci container on loopback59629. Neither production nor the existing localhost operational database is used for test writes.

Validation completed:25 standalone CLI/recording/spool tests;48 AMI/native/company/recovery/security tests;4 Worker transport tests;5 authenticated HTTP boundary tests on isolated rerun;92 real PostgreSQL tests in7 files including access/workflow/read/recordings/telephony/recovery passed. An earlier combined HTTP run hit its existing10s setup deadline during concurrent environment preparation (18 passed,8 opt-in skipped,1 failed); the isolated unchanged rerun passes all5 without timeout changes. Fresh disposable PostgreSQL18 accepted all198 current-source migrations. No operational DB test writes.

Worker full typecheck and Nest build pass. Changed standalone JavaScript passes Node syntax checks and scoped Prettier checks; git diff check passes. API/Web source is unchanged; no new migration. These results validate existing owner/team access, not the unimplemented answered-responsibility policy. Tests that inject a fake recovery source do not validate an actual CDR adapter.

Fresh production backup recovery drill also passes: restricted root helper restored backup-20261029T073541310195Z into a no-network disposable database, verified313 tables/196 completed migrations and removed its temporary container. Receipt: /home/rubi-deploy/rubi-restore-drill-20261029T083043856479Z.json; production_database_modified=false. This is a real restore proof for the post-Worker backup, not only a checksum test.

A current Issabel SSH host-key scan matches the owner-supplied ED25519 fingerprint. Existing noninteractive workstation SSH key was rejected for bi; no password was guessed, no host verification bypassed, and no PBX file/configuration was changed. Further source discovery requires the authorized password session or an approved dedicated key.

Source candidate only: deploy the readiness CLI repair through the normal reviewed source workflow. The90-day template is prepared, not activated. This work item releases its bounded source scope on publication; it does not close the outstanding domain/security/configuration work above or claim full Call Center readiness.
