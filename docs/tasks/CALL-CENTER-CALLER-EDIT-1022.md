# Caller preservation and existing-record editing — 2026-10-22

PC-C; base254679d0; codex/pc-c-call-center-caller-edit-1022.

Incoming known numeric callers now survive the Customer Affairs normalizer even
when local/short. Native queue normalization accepts canonical3–15 digits.
Malformed input is rejected instead of silently replacing a known caller with an
empty string. Withheld/unknown identities remain explicitly unknown; no invented
prefix. Existing national-number equivalence remains. This does not expand PBX
queue subscriptions or claim historical reconciliation of unreceived events.

Rows open the existing accessible dossier dialog on desktop and mobile. Existing
View button remains keyboard reachable. Explicit edit opens the prefilled existing
form; saved completed and manual records can be edited with the same read/create/
workflow permissions, branch scope, claim check, immutable phone/direction/time,
CAS token and audit. No ownership reassignment or duplicate follow-up is implied.

Recovery helper is operator-only, no HTTP endpoint. It restores blank caller from
original encrypted technical evidence atomically, refuses contact collisions or
ambiguous multi-call contacts, updates search identity and emits a sanitized audit.
Repeating recovery is a no-op. User-requested10:02 call was recovered after an
exclusive encrypted-record backup outside Git. Phone present,8 digits; contact,
call ID and occurredAt unchanged. No raw phone or credentials in repository/logs.

Validation:6 API unit/socket tests pass (5 database tests intentionally skipped in
that command),9 Web model/form tests pass,10 real disposable PostgreSQL tests pass
including caller recovery, completed-call edit, replay/stale version and existing
scope defenses. API/Web types and scoped lint pass; compatible API and65-route Web
production builds pass. Existing CSS optimizer warning remains unrelated to this
change. Runtime API22636/Web19292, new build .next-caller-edit and dist-caller-edit.
Operational AMI reconnected07:29:50UTC. No active calls/pending inbox at rollover;
restart gap remains honestly recorded. Original artifacts retained for rollback.

No migration or production deployment. Authenticated browser acceptance not yet
performed; login and API health verified independently. Local operational backup:
F:/Projects/Rubi/backups/caller-recovery-1022-encrypted.json (never commit).
