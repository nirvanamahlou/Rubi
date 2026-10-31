# CALL-CENTER-LIVE-INGRESS-1029 — PC-C

## Production acceptance — 2026-10-31

The colleague's deployment lock was awaited and released normally. Actual base
became `358bf900f691016c00ed5b5a9c346cdd7aedea34`. The24-file overlay was
three-way merged onto that base, preserving the appended Procurement models and
all other incoming changes. New API candidate immutable ID:
`sha256:373261230ff4fac1a82bc2d87fbcb432fb7b722aefce11ecfbd132e21f9d5169`.
Types/build and206 tests in25 files passed again on an isolated database.

Final activation receipt: `/opt/rubi/CALL-CENTER-LIVE-INGRESS-RELEASE4-1031.json`.
Collector AMI authentication and authenticated Worker/API transport passed.
Worker uses `network_mode: service:api`; it must be recreated together with API
to avoid retaining the deleted API container's network namespace. Its image,
environment values, command, user, working directory and mounts remain unchanged;
environment ordering/container hostname are not semantic configuration differences.
Web, PostgreSQL and Redis containers remain unchanged. Future API releases must
also recreate Worker, preserve the private Issabel environment file and retain
the answered-access API overlay until its upstream source integration is complete.

Owner placed an actual answered/ended outbound call. Read-only proof reached
`ANSWERED_CALL_VERIFIED`: one real persisted/ended call, one answer responsibility,
three DONE inbox receipts, zero pending outbox, last transition AMI_CONNECTED.
No phone number or call payload is retained in this repository.

The previously alive xl2tpd process had lost its IPsec/PPP tunnel. Restarting only
the dedicated VPN restored route and Docker AMI login. A dedicated30-second
systemd watchdog now requires three consecutive route/IPsec failures before
restarting that VPN; it respects the deployment lock and does not modify ERP.
Timer and VPN/TLS services are enabled. Actual host reboot remains untested.

Production capture is enabled for43 configured endpoints, with13 valid account
mappings. Extensions114/203 still require real HR/account links. Recording transfer,
CDR gap recovery and native/global popup remain disabled as scoped above.

Owner explicitly requests real production Issabel ingestion, independently of the
company PC. Preserve [approved UI](CALL-CENTER-UI-PRESERVATION.md), including the
disabled global widget. This task adds deployment tooling, not a new UI.

## Verified deployment boundary

- Base actual API/Web/Worker image: `b5ce75bcc97a0c34cf8563aa18b0280634d23ad9`.
- Answered-access source: reviewed policy `0dad51a92`, PR1206; source PR not merged.
- Candidate API image: `rubi-production:call-center-answered-1029-b5`, immutable
  `sha256:27aa4aff3bffa4a97fea7bab047f09718961e7eb1cde929488b4b11f5b893e36`.
- Candidate overlays only24 compatible API/database files onto the actual base.
  Exact source manifest, typecheck/build and206 tests in25 files passed in an
  isolated database. Production Web/Worker were not replaced during validation.
- Independent VPN and Docker-to-Issabel authenticated TLS/AMI previously verified;
  fresh2026-10-31 diagnosis confirms VPN/TLS services active.

## Migration diagnosis and correction — 2026-10-31

The first activation used the runtime `rubi_app` database role for Prisma DDL.
PostgreSQL correctly denied access to `_prisma_migrations`. Read-only diagnosis
confirmed198 completed migrations, no unfinished migration and no answer table.

The corrected runner derives a temporary migration URL from the existing
PostgreSQL container administrator credentials, available only inside the root
process. It validates exact database/host/runtime identity, URL-encodes the
password, uses a root-private temporary environment file and removes that file.
No runtime account elevation or schema/migration privileges are granted.
Only CRUD on the new answer-responsibility table is granted to `rubi_app`.

First corrected run successfully applied migration
`20261029120000_call_answer_responsibilities`; fresh diagnosis confirms199
completed migrations, zero unfinished migrations and the expected new table.
The next step stopped at native IAM delegation: recording-download access was
outside the existing operator's authority. No access update/provider activation
was accepted. Recording grants are now omitted because recording transfer is
disabled in this rollout; native IAM checks remain in force. Before writing,
the bootstrap checks every requested delta against the actual operator selection.

## Activation and rollback

`activate-live-ingress.py` validates immutable image/source hashes, current
release, exact migration names/checksums, health, branch/account links and native
operator authority. It backs up before taking the deployment lock and modifies
only the API image/environment. Configuration, mappings and access updates use
owning IAM/Integration services, preserving CAS/audit and existing unrelated grants.

The latest bounded attempt uses a new private work directory/report; previous
attempt evidence is preserved. An already-completed matching additive migration
is accepted, never repaired/reset/deleted. Failure restores API configuration and
uses native services to compensate accepted access/provider changes. Additive
schema and accepted calls are retained. A bounded read-only observer proves real
call persistence/answer responsibility without emitting numbers or call payloads.

## Scope and acceptance still to verify

-43 verified PBX endpoints and one verified SIP trunk;13 HR-linked staff accounts.
-Physical extensions114/203 lack valid account links; do not guess ownership.
-CEO/demo globals use exact eligible runtime IDs; no role inferred from a title.
-Native notifications/global floating widget stay disabled; Web stays unchanged.
-Recording retention90 days is configured; audio transfer and CDR gap recovery
  remain disabled and must not be advertised as operational.
-IT confirms L2TP/IPsec, VPN access requires no additional firewall action, CDR
  persists until disk limits and recordings/CDR finish after hangup. This does not
  prove a file-stability mechanism or a read-only CDR credential for recovery.
-Production acceptance requires successful activation receipt, authenticated
  collector/Worker and an actual answered/ended call persisted with responsibility.

## Tool validation

Six Python safety checks pass, including separate migration identity, URL escaping,
refusal of foreign identities, API-only Compose changes and literal credential/PEM
round-trip with the actual Compose CLI. Five bootstrap tests pass for preservation,
idempotency, own-only access and refusal of ambiguous/missing account mappings.
Compile checks passed on the server. No synthetic calls were placed in production.
