# Call Center package one — PC-C — 2026-10-19

## Scope and ownership

Owner explicitly requested full package-one implementation and local review on
localhost:3000. Branch: `codex/pc-c-call-center-package-one-1019`, based on
develop a463cfbd. Existing private calls/notes and the reset-button appearance are
preserved. No telephony API, simulated incoming-call action, external delivery,
customer identity merge, production rollout or unrelated migration is included.

Customer Affairs uses its existing `CustomerAffairsTicket` for telephone requests,
with reserved category `CALL_CENTER_REQUEST` and an optional real contact FK.
Private titles/reasons/revision snapshots are encrypted; generic support fields
contain non-private labels. Support lists, exports, reports and SLA reminders
exclude this category, and generic ticket mutation paths cannot edit it.
Requests have NEW, IN_PROGRESS, WAITING_CUSTOMER and CLOSED states, independent
from call outcomes and actionable task state. Closing requires a reason and no
open actions; reopening requires a reason and preserves history.

Tasks owns follow-ups in existing `AutomationTask`, through a public service.
The new optional ticket FK and source-reference check retain real linkage.
Private action/result/assignee-name snapshots are encrypted. Action states are
OPEN, COMPLETED and CANCELLED; completion/cancellation require a result and final
actions are immutable. Ownership, deadline and revision history are retained.
No parallel generic Request or Task entity is introduced.

## Commands, access and compatibility

Additive IAM catalogue v15 introduces only
`customer_affairs.call_center.workflow.manage`. It never implies Lead or generic
Ticket authority. Existing read/call-create/note-create permissions keep their
scope. The owner separately approved this new grant only for amin; a dedicated
exclusive existing local role receives exactly this permission with IAM audit.
No shared role or other account is expanded.

The IAM public directory exposes only active internal account IDs/names in the
authorized branch with Call Center read and workflow permissions. New assignment
revalidates the recipient. Historical inactive owners remain visible and finished
tasks preserve their saved name. No personnel or role data is returned.

All workflow reads require Call Center read plus route/branch authority. Writes
also require workflow.manage. UUID commands, request fingerprints, per-request
locks and optimistic versions prevent duplicate or lost updates. Global task-ID
locks additionally protect concurrent use of one task ID across different
requests. Contact/call/request ownership is checked before linking; metadata
links use expected previous state and audit, without rewriting call contents.

Old calls retain their original status and unknown technical outcome. New manual
calls expose origin and an explicitly selected outcome. Blank names are allowed.
Withheld numbers have event-specific contact fingerprints and never coalesce
into one anonymous customer. A repeated command still resolves to one contact.
Iranian phone variants normalize consistently. UTC/explicit-offset timestamps
are required. Contact and call ordering have stable tie-breakers.

## API and UI

Existing authenticated prefix: `/api/v1/customer-affairs/call-center`.

- GET `/operators`: minimal eligible branch directory.
- GET `/queue?view=MINE|TODAY|OVERDUE|UNASSIGNED|ALL&page=1`: branch-wide
  request queue, 50 rows per page; today uses Tehran day boundaries.
- GET `/contacts/:id/requests`: requests, actions and revision history.
- POST `/contacts/:id/requests`: create/update with commandId/id/expectedVersion.
- POST `/requests/:id/follow-ups`: create/change/complete/cancel an action.
- POST `/calls/:id/request`: link or correct the request reference with audit.

The panel offers separate request and action editors, assignment, explicit
priority/deadline/result, revision history, contact-level views and a branch-wide
work queue with explicit refresh. Calls can be linked after their first save or
linked during a subsequent call. Closing a request never silently cancels work.

The first authorized actor branch remains the existing default. All eligible
agents in that branch are available; the old call unit labels are historical
context rather than IAM identities. Team hierarchy, full-server call search,
Customer/Sales linking and analytical reporting remain later-package work.

Private unsaved drafts stay in memory. Save failures preserve forms; closing a
dirty dialog, following a page link, reload or tab close triggers a warning.
There is deliberately no plaintext localStorage persistence. Unconfirmed drafts
are not promised to survive a forced reload/browser crash. Contact-specific note
drafts survive switching rows in the current page, and a late save response cannot
erase a different contact's note. Shared searchable ERP controls are retained.

## Reminders

The existing Notifications public transaction boundary creates assignment and
due notifications without private descriptions. The Tasks-owned port supplies
due action metadata. A one-minute timer, durable revision-scoped claims and
request locks prevent duplicate deliveries and stale scheduling races. A cursor
prevents inactive recipients at the front of a batch from starving later work.
Changing or finishing an action retires its previous unread due reminders in
the same transaction; retained read notifications remain historical records.
Only explicit deadlines are used; no working-hour calendar or SLA is inferred.

## Migration and local rollout

`20261019180000_call_center_workflow` adds nullable call/request/task links,
call outcome/origin, encrypted request fields and indexes/checks. It makes no
historical backfill or destructive data change. Existing support SLA order stays
enforced; only the reserved category with CALL_CENTER_NO_SLA bypasses that order.
Its required legacy date columns are technical placeholders, excluded from SLA
processing/reporting, not a promised response deadline.

All164 runtime migrations passed from scratch on the dedicated disposable
`nora_call_center_package_one_test_1019` database. A verified1,505,785-byte local
ERP PostgreSQL backup was taken before applying only this migration. Other
pending local migrations were left untouched. Runtime remains the scoped
compatibility checkout; do not replace its API with arbitrary latest develop
against the local database. API/Web/Contracts/Database generated artifacts must
be built together before activation.

## Validation and review

Targeted PostgreSQL/HTTP tests cover concurrent replay, encrypted private values,
anonymous grouping, branch/permission denial, stale versions, call linking,
due reminder replay/reschedule, final actions, close/reopen and cross-request
task-ID collisions. Broader Customer Affairs/Tasks regression tests pass.
Web tests cover transport, aborts, retries/conflicts, grouping, shared selectors
and English catalogue coverage. IAM and permission seed catalogue tests pass.
Affected lint, TypeScript and API/Web production builds are required before
handoff. Hosted CI remains a separate publication gate, not a local test claim.

Review at `http://localhost:3000/customer-affairs/call-center` using amin:

1. Register a clearly synthetic manual call, choosing its actual outcome.
2. Open its history, create a request and assign an eligible agent or leave it
   explicitly unassigned.
3. Link the saved call to that request.
4. Add an action with owner, priority and deadline; refresh the branch work queue.
5. Edit its deadline, finish it with a result, then close the request with reason.
6. Reload and verify records/history; test the warning on an unsaved form.

The browser is currently at the login page. Authenticated visual acceptance is
left to the owner's session; no password reset or guessed login was performed.
Telephony, recording ingestion and live popup timing cannot be accepted until
the actual Issabel capabilities and access arrive.
