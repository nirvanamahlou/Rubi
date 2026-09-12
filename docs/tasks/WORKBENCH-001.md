# WORKBENCH-001 — میزکار من

COMPUTER_ID=PC-B. Status: READY_FOR_REVIEW — foundation only; persisted Phase 1 blocked.
Branch: `codex/pc-b-my-workbench`; worktree: `C:/Users/admin/Rubi-my-workbench`.
Base: `origin/develop@4717b130865e0094adb246ce0caa2ee56a935abd` (fetched 2026-09-11).

## Reservation and authority

The user's pasted request is the execution authority; the DOCX is a product reference,
not an independent source of operational instructions. Priority is Phase 0 and the
persisted general-request vertical slice. The explicitly authorized fallback applies:
no schema/migration or fake persistence while the Migration lock is unavailable.

Reserve new `apps/api/src/tasks/**`, `apps/web/src/modules/workbench/**`,
`apps/web/src/app/(crm)/workbench/**` and this task document. Reserve only additive
Workbench navigation in `apps/web/src/components/layout/app-shell.tsx` and
`user-menu.tsx`; do not replace the 17-module navigation or `/tasks`.
Central status/ownership/decision docs remain untouched pending coordinated handoff.
No dependency, lockfile, IAM catalog/grant, shared-contract root or database reservation.

Open Finance PR #153 explicitly records that the active Reservations owner retains
the Migration lock. Existing historical reservations disagree across accumulated
status entries; absence of a definitive release is not a handoff to this task.
No migration owner is inferred or silently replaced. Tasks domain/proposal ownership
is PC-B; proposed Workbench and Communications ownership is PC-B, pending entry in
the central ownership document by its owner. Communications implementation is deferred.

## Inventory at base

- Tasks: `/tasks` renders ModuleFoundationWorkspace. No Tasks API or request model.
- HR: real employee records, optional IAM user FK, active employee directory, scoped
  domain connections/referrals/responses. Reuse these public contracts for HR operations;
  do not turn HR-specific referrals into a parallel general request store.
- HR directory returns unit/position text. It does not yet provide canonical unit
  membership, supervisor authorization or an employment-change reassignment protocol.
- IAM: real cookie authentication, current user/capabilities, sessions and MFA via the
  existing profile public client. Never query IAM tables from Workbench.
- Documents: real versioned upload/download, scan/access authorization and personal
  list filters. Binary/version/scan ownership remains Documents.
- Notifications: persisted recipient-scoped feed/read state and public transactional
  enqueue service; no Workbench-owned notification table.
- Internal Communications, preferences, private notes and favorites: no existing
  general-purpose persisted implementation to reuse at this base.

## Delivery limits

The request lifecycle domain and integration ports are testable without persistence.
There is no registered request controller, in-memory repository, browser storage,
synthetic KPI, fake tracking number or success response. The UI must visibly state
that request submission is unavailable. Default landing/preferences activation waits
for live authorization and backend preferences; current login redirects stay compatible.
Persisted Phase 1 and optional messaging/notes/favorites remain blocked.

## UI assumptions and targets

Desktop/corporate-network primary; responsive Persian RTL; authenticated Next App Router,
existing Rubi theme/components. PC-B owns WCAG AA verification for this scope.
Targets (not measured claims): LCP p75 <=2000ms, INP <=200ms, CLS <=0.1;
route incremental JS <=80KB gzip; Lighthouse accessibility >=95/performance >=90.
Pilot API p95 <500ms and online update <=5s require real persistence and a 30-user test.

## Contract register and compatibility

| Producer / owner | Consumer | Contract and status | Compatibility / gate |
| --- | --- | --- | --- |
| IAM / PC-A | Workbench, Tasks, Communications | Existing LoginResponse, AuthenticatedActor; cookie refresh and profile endpoints | Consume unchanged; new workbench permissions require catalog-only owner change, no grants |
| HR / PC-B | Tasks, Communications | Existing HrDirectoryService; proposed workbench organization directory v1 | Add canonical unit ID, branch, active membership, supervisor, revision and effective interval; existing employee list unchanged |
| Tasks / PC-B | Workbench, future module launchers | Proposed tasks.requests.v1 in request.ports.ts | No root export/HTTP registration until reviewed and persistence ready; keep /tasks intact |
| Communications / proposed PC-B | Workbench, Tasks conversion | Proposed communications.v1 | Not published; memberships, message identity and conversion idempotency must be persisted first |
| Documents / PC-B | Workbench and request attachments | Existing documents personalView and upload/download authorization | Revalidate current source/branch/scan permission on each access, no binary or signed-link storage in Workbench |
| Notifications / PC-B | Tasks outbox worker, Workbench | Existing notifications.v1 and createWithinTransaction | Recipient feed is not a message read receipt; durable worker retry/dedup required before Tasks integration |
| Audit / IAM owner | Workbench activity projection | Proposed own-business-activity v1 | Exclude auth/security events and all private body text; filter source permission on query |
| Sales/Finance/Reservations/Procurement/HR owners | Tasks | Proposed DomainActionReferencePort | Validate request-bound successful action, source version, branch and actor; no domain mutation through request commands |
| Reporting owner | Workbench metrics | Proposed KPI projection v1 | No Reporting edits; counts computed from same current user predicate as lists |

IAM auth controller currently exposes own sessions, session revocation, MFA setup/confirm
and status. No own password-change or MFA-disable endpoint was found there; those
actions stay blocked rather than being reimplemented in Workbench. Existing profile
is linked, not described as a completed password/session-management flow.

## Permission matrix proposal

Every row additionally requires active IAM identity, workbench.access, current branch
scope and current HR resolution. UI checks do not replace server authorization.
Role names alone never grant access. Emergency access is disabled by default.

| Action | Operational permission | Relationship required |
| --- | --- | --- |
| Read draft | workbench.requests.read_own | Sender only |
| Read direct request | workbench.requests.read_own | Sender, destination, current assignee or designated approver |
| Read unit queue | workbench.requests.queue.read | Current member or supervisor of that unit |
| Create/submit | workbench.requests.create | Sender, validated active destination |
| Claim | workbench.requests.claim | Current unit member, unassigned request |
| Assign/reassign | workbench.requests.assign | Current unit supervisor, validated assignee, reason |
| Route | workbench.requests.route | Current assignee or unit supervisor; reason and validated destination |
| Respond/ask/complete | workbench.requests.respond | Current assignee; result required for completion |
| Supply requested information | workbench.requests.respond | Sender while waiting for information |
| Approve | workbench.requests.approve | Designated approver, waiting for approval |
| Confirm and close | workbench.requests.close | Sender after completion |
| Reopen | workbench.requests.reopen | Sender, completed/closed, reason |
| Reject | workbench.requests.respond | Assignee or supervisor, reason |
| Cancel | workbench.requests.create | Sender of nonfinal request, reason |
| Change deadline | workbench.requests.change_due (additional proposal) | Assignee or supervisor, reason and canonical UTC |
| Private notes/favorites/preferences | workbench.private_notes.manage / favorites.manage / preferences.manage | Self only; no supervisor/delegation inheritance |

Remaining message/files/activity/audit/template permissions from the user brief remain
catalog proposals; none have been seeded, granted or published. Copies do not confer
assign/approve rights. An eventual read-only copy predicate must validate both recipient
authorization and request/source confidentiality, and must not reuse the assignee path.

## State machine and decision boundaries

The executable policy models draft submission, queue claim/assignment, routing,
response/start, information wait/answer, approval wait/decision, completion and sender
confirmation. Normal route: DRAFT → SUBMITTED → IN_PROGRESS (atomic claim), or
SUBMITTED → ROUTED → IN_PROGRESS. Routing preserves tracking identity.
Only COMPLETED can close. Sender reopen requires a reason, removes completion evidence
and resumes assigned work or returns it to a unit queue. No timer auto-closes a request.
An approval response returns to IN_PROGRESS and cannot create a financial release,
payment, issuance, HR action or permission grant. Specialized completion needs a
validated successful owner action bound to this request; free-form text is insufficient.
Unit routing clears old assignment/approver. Old internal notes stay scoped to the
original unit and are not copied into sender responses or the new unit timeline.

Cancellation after work starts additionally requires owner-port evidence of responsible
party consent bound to request/version. Specialized cancellation also requires the
owning domain to have settled its operation. Cancellation never reverses that operation.

The domain function returns an immutable **proposal**, not a successful command.
HTTP 409 mapping, secure DTO validation, database concurrency and response persistence
remain application/repository work after the lock handoff. A stale-version unit test
must never be reported as AC02 database-race evidence.

## Persistence plan awaiting the single Migration owner

Do not overload HrRecord, AuditEvent, Notifications or arbitrary JSON as a request store.
Re-audit the latest schema immediately before an additive migration reservation.

| Owner | Proposed records | Required integrity |
| --- | --- | --- |
| Tasks | InternalRequest, RequestFormDefinition/Version, RequestDestination, RequestAssignment | Unique tracking; FK sender/branch/active version; canonical validated HR unit; one active primary assignment; version CAS |
| Tasks | RequestResponse, RequestInternalNote, RequestStatusHistory, RequestCopyRecipient | Response visibility distinct from unit-only notes; append-only history, original unit retained across routing |
| Tasks | RequestSlaSnapshot, RequestDomainReference, RequestDocumentReference | Immutable policy/calendar version; typed owner validation and real FK where available; no unchecked arbitrary ID |
| Tasks | RequestCommandReceipt, RequestOutbox | Unique actor/operation/idempotency key plus payload hash; transaction with request/assignment/history; outbox replay dedup |
| Workbench | WorkbenchPreference, UserFavorite, PrivateNote, PrivateNoteFolder | User FK, self-scoped queries, secure persistent text, soft delete, validated favorite targets |
| Communications | Conversation/Membership, Message/Revision/ReadReceipt/AttachmentReference | Membership interval, revoked access, unique command key, revision/soft-delete tombstone; document public authorization |
| HR | UserDelegation and employment-change outbox integration | HR-approved interval/scope; organizational requests only; no private notes/messages/session transfer |

Claim transaction: resolve actor and membership revision → authorize scoped row →
UPDATE with id/branch/expectedVersion AND assignee IS NULL → one updated row → append
assignment/history + command receipt + outbox → commit. Loser rolls back, rereads through
current authorization and returns 409 CONCURRENT_MODIFICATION with authorized current
assignee. Idempotent replay reauthorizes; same key/different payload conflicts.
Request creation needs unique tracking and command key within the same transaction.
No actor/HR membership supplied by the browser is trusted. Membership invalidation and
claim must share revision/locking semantics so offboarding cannot race with assignment.

Offboarding/unit transfer must move open work to the authorized supervisor's
reassignment queue, preserve the previous assignment and revoke current access.
This needs HR/IAM event and transactional revision contracts; not implemented here.

## SLA and delivery proposal

Policy snapshot records type/priority, first-human-response budget, resolution budget,
working calendar/version, at-risk threshold, information-wait pause rule and escalation
recipient policy. Product owners must approve real durations/calendars; test numbers
are not production defaults. All storage timestamps use UTC.

The pure evaluator accepts validated working-time intervals. It does not pause first
response and only subtracts information waiting from resolution when the snapshot
allows it. Internal approval waiting remains chargeable by default. Automatic notices
do not set firstHumanResponseAt. Completion must freeze measured intervals in the owner.

Persistent worker design: deduplicated reminder stage followed by supervisor escalation,
unique request/policy/stage/time-window key, last-attempt/next-attempt/delivery outcome,
bounded retry and per-request/recipient rate limits. No worker or reminder delivery is
claimed. Audit/metrics carry request ID, action, UTC and outcome only; never private text.

## Acceptance and rollout gates

| Gate | Current evidence / missing evidence |
| --- | --- |
| AC01 | Domain denies unauthorized/cross-branch requests and drafts; actual private storage/count queries absent |
| AC02 | Stale-version policy covered; simultaneous PostgreSQL claim test blocked |
| AC03 | Domain submit/route/respond/close proposals; real two-account round trip blocked |
| AC04/AC05 | Messaging and conversion deferred; no persistence or duplicate-delivery claims |
| AC06 | Invalid transitions, reason/result, role and version domain tests |
| AC07 | No domain-execution dependency; request approval/close never executes owner commands |
| AC08 | No attachment or favorite bypass introduced; end-to-end revoked Documents access test deferred |
| AC09 | Existing profile link only; no Workbench credential/session mutation |
| AC10 | No fake successful write; real reload/idempotent retry acceptance blocked |
| AC11 | Controlled-time SLA policy tests; calendar adapter/escalation worker tests deferred |
| AC12 | Inactive actor denied; persistent reassignment/event/race acceptance blocked |

Full production states (uncertain outcome, conflict, deleted record, not found and
write success) need real endpoints. Current UI implements loading, unavailable,
authentication failure, forbidden, read error/retry and offline/reconnect. It does not
render pretend empty results or simulated successful commands. URL tab changes retain
other query parameters and avoid forced scroll. Backend saved landing preferences,
default-login switch, personal task checklist/reminders and specialized forms remain pending.

Reporting-only proposals: weekly workbench adoption by actor/week; first response and
resolution duration by request/policy version; reopen ratio; unassigned/delayed queue;
duplicate-command integrity count. Exclude message/note bodies and do not join monetary
facts to request history. Current KPI cards use unavailable, never invented zeros.

PC-A handoff required: establish authoritative active Migration/Central Docs owner and
explicit transfer; publish scoped IAM capability/catalog and any missing self-service
contracts; coordinate canonical HR membership/revision/offboarding port with PC-B;
review additive Tasks contract; then run empty PostgreSQL migrations, twice-run catalog
seed, two-account authorization, parallel claim, atomic outbox and retry acceptance.
Central ownership/decision/status integration is pending, so Phase 0 is prepared for
review rather than declared organizationally ratified.

## Verification and runtime handoff — 2026-09-11

- Frozen install: passed with pnpm 11.19.0, 904 packages; lockfile unchanged.
- Existing Prisma schema validate/generate: passed. Initial generation without
  DATABASE_URL failed; repeated with a build-only unreachable loopback URL. No database
  connection, migration, schema format/write, seed or permission grant was performed.
- API domain: 30 tests passed, including lifecycle, stale version, branch/identity,
  mandatory reasons, specialized completion/cancellation and controlled-time SLA.
- Targeted Web: 22 tests passed (Workbench, UserMenu, navigation and collapse).
- Full Web: 1148 passed / 3 HR timeouts at default 5000ms. Isolated unchanged HR file:
  41 passed / 1 timeout. Diagnostic rerun with `--testTimeout=20000`: all 42 passed.
  Do not describe the default full-suite invocation as green; no timeout config or HR
  source was changed to hide the result.
- Full API and Web lint/typecheck passed. Final changed Tasks files were linted and
  API typecheck/build rerun after the cancellation refinement.
- Production API and Web builds passed; Web emits 41 routes including /workbench.
- Smoke on loopback only: API PID 21296 at 4300 from this worktree's apps/api;
  Web PID 26104 at 3300 from this worktree's apps/web. Health 200, unregistered
  tasks/requests 404, unauthenticated /workbench 307, login 200. Generated ephemeral
  keys and unreachable DB URL isolate smoke from operational data. This is process
  liveness/navigation evidence, not persistence or authenticated end-to-end acceptance.
- Both smoke processes were closed by their own launcher after checks. No other
  listener was stopped or replaced. No operational dev server is kept running.
- Browser visual QA, Lighthouse/performance pilot, authenticated two-user workflow,
  PostgreSQL concurrency, migration/seed and live offboarding remain unverified/blocked.

## Final scope and locks

Delivered: Tasks policy and proposed public ports, tested SLA evaluator, separate gated
Workbench route with eight unavailable-state tabs, safe navigation entries and detailed
producer/consumer/security/persistence/acceptance handoff. No new Nest controller/module
registration or API mutation. This does **not** complete the requested persisted slice.

Task source reservations are released for review after push. Migration and central docs
remain with their existing owners; Dependency/Lockfile and all existing shared contracts
were not acquired or changed. Tasks proposal is task-local, not a published contract.
WORK_ASSIGNMENTS.md / PROJECT_STATUS.md / MODULE_OWNERSHIP.md / DECISIONS.md remain
unchanged under the user's central-lock fallback; the coordinated owner must integrate
this task record before approving persistence or claiming Phase 0 ratification.
No merge, force push, branch deletion or direct main/develop modification is authorized.
