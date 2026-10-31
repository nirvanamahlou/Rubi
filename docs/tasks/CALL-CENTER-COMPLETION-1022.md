# Call Center completion workflow — 2026-10-22

PC-C; codex/pc-c-call-center-completion-1022; base13d4c5f1. User confirms LAST
answering extension (not first). Existing sticky history/selection stays unchanged;
actual PBX routing still awaits SSH. Native recipient suppression stays mandatory.

## Behavior

Technical calls persist immediately, including incomplete calls, so refresh/closed
forms cannot lose them. Existing list/incomplete filter exposes pending work.
Business fields are persisted by explicit save. New manual calls enter on save;
existing telephone calls are completed in place, preserving ID, origin, caller,
direction, occurredAt, provider evidence and contact. No fake customer identity,
no implicit sales/financial action. No additional contact/call on completion/retry.

The existing dossier action opens the existing form for an incomplete telephone
call. Earlier incomplete calls can be completed inside their existing expandable
history details. Same layout/CSS/nine columns/four KPI cards remain; no technical
or simulator panel and no automatic popup. Source-only IssabelDialer import/render
removed to match the approved runtime, where it was already absent.

GET calls/:id is read/branch protected and returns an opaque HMAC concurrency token.
POST calls with that token requires calls.create plus workflow.manage. Locks and
stored token reject stale/conflicting edits; matching actor/request retries reuse
the persisted receipt audit. Technical fields cannot be changed, a call claimed by
another operator cannot be overwritten, and related tickets must be open and belong
to the same authorized contact. Audit stores actor and request hash, no private text.
Partial saves remain incomplete. Completion checks include name, caller, subject,
source, unit and outcome; unknown/hidden callers can still be saved but remain
incomplete under the current definition. Notes are optional. Native technical
answer evidence is never mistaken for an ERP-user mapping or business sale.

The old telephony SAVE path no longer forces needsCompletion=false while required
information is missing. Search revision includes completion audits and telephony
versions so changed filters/results invalidate stale later pages.

## Unanswered evidence

Official AMI QueueCallerAbandon (available since12.0) supplies explicit queue
abandonment evidence; it maps to canonical ENDED/NO_ANSWER with terminalForCall=false.
It does not claim the whole PBX call ended merely because a queue was abandoned.
The adapter requires an accepted sales-queue anchor and allowlist membership.
Source: https://docs.asterisk.org/Asterisk_24_Documentation/API_Documentation/AMI_Events/QueueCallerAbandon/

Such evidence projects outcome NO_ANSWER/status بدون پاسخ, visible in the existing
result column/filter for callback. A later real answer retracts an automatic
unanswered label; saved operator results are preserved. Root Hangup remains the
whole-call terminal fact. Hangup without positive answer/abandonment evidence stays
UNKNOWN: network gaps must not fabricate unanswered calls. Actual queue timeout/
other provider end paths and missing-event reconciliation still require verified
PBX/CDR evidence. No historical calls are relabeled or guessed in this unit.

## Deployment boundary

No schema/migration/dependency/permission/mapping change. Isolated candidate
call-center-completion-runtime-1022 preserves approved runtime base and overlays
only this unit. Old API/Web artifacts retained for rollback; Worker unchanged.
No SSH/PBX mutation, live dial, PR/merge or production deployment.

## Verification and local activation

41 targeted API tests and21 Web tests pass. Real disposable PostgreSQL coverage
includes duplicate/late native events, sticky last-agent history, no popup despite
mapping, same-call partial/full completion, unauthorized scope/permission, forged
technical fields, stale token, retry audit uniqueness, note preservation and
late unanswered evidence after partial save. Final9-test PostgreSQL suite rerun
also passes after that edge-case addition. API/Web scoped lint and typecheck pass;
compatible API build and65-route production Web build pass. Initial test fixture
issues (actual camel-case DB column, nullable DTO fixture and isolated test ordering)
were corrected; no production constraint or check was weakened. Initial Next build
invocation leaked --env-file into worker exec arguments; rerun inherited the loaded
environment through a child process and passed, without dependency/config changes.

Preview API health200, protected single-call read401, preview Web200 with correct
build were verified. On2026-10-22 local API4000 PID10520 and Web3000 PID9284 activated;
Web build dzjznuaksuBZxlUxzuRJI, API/Web health200. Worker4409 PID16484 retained.
Pre-cutover stored sessions all ended. AMI authenticated at06:58:57UTC; restart gap
recorded honestly. Post-cutover preserves3 real ended calls,13 DONE receipts, zero
pending dispatch, zero real offers and2 answering-history entries. No real business
form submitted or historical outcome rewritten during testing. No claim of fresh
live abandonment/timeout acceptance; provider-specific gaps remain documented.

Rollback uses preserved sticky-sales-runtime-1021 API and durable-runtime-1018 Web
with NORA_CALL_CENTER_NEXT_DIST_DIR=.next-call-center-table-align-1020. Stop the new
collector before starting the old one; preserve data. No migration in this unit.
