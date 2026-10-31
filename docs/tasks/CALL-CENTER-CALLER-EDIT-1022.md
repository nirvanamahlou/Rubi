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

## CALL-CENTER-ROW-FORM-1022

Owner clarified two independent actions: row click/Enter/Space opens the existing
CallForm with persisted data and concurrency token directly; View stops bubbling
and opens the original responsive dossier (desktop aside/mobile dialog). Existing
form layout retained; edit title/save label distinguish existing record editing.
Read/create/workflow scope remains unchanged. No backend/schema/data changes.
Scoped lint, Web types and2 existing form tests pass.

## CALL-CENTER-DOSSIER-ACTIONS-1022

Identity header now has only edit-contact and new-request actions in owner order.
Removed NextAction component and its request fetch, advisory phone text and repeated
completion/edit actions from history. Dossier request list hides create button and
view filter; shared WorkQueue controls remain. Header create controls existing
WorkflowEditor with actual selected contact/branch, existing permission and save/
close handling; no new API, data mutation or permission rule.13 client/form tests,
Web typecheck and scoped lint pass. Compatible local Web build/health recorded
in status. Authenticated visual acceptance remains unclaimed.
