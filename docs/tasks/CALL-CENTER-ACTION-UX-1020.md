# Call Center operational UX — 2026-10-20

Owner explicitly approved the preceding UX recommendations and local3000 review.
This is an authorized exception within CALL-CENTER-UI-PRESERVATION.md, not permission
to restore technical/provider/test controls. PC-C continues the approved candidate
b408309a. No migration, dependency, grant or financial change.

## Preserved contact list

Exactly these nine columns, their order, values and centering remain:
نام مخاطب، شماره تماس، موضوع آخرین تماس، منبع، واحد، آخرین تماس،
تعداد تماس، نتیجه، جزئیات.
Selected dossier stays on the right and wide contacts/reports on the left.

## Operational cards and queue

Three cards count distinct requests across all authorized branches: with an open
overdue follow-up, with an open follow-up due today in Tehran, and without an owner.
They select the corresponding existing queue view and expand/focus the queue.
One request with several matching follow-ups counts once. Today and overdue can
overlap; these cards are not additive and do not represent numbers of telephone calls.
The fourth card uses the current report's incomplete-call count with its branch,
period and filters explicitly labelled. It applies the incomplete filter to the
contacts list over all history while retaining other filters, matching the report's
all-matching-calls scope rather than omitting older incomplete calls. Missing or incompletely indexed data
is unavailable, never a fabricated zero.

The additive queue response supplies optional counts/asOf metadata and per-row
earliest-open-follow-up dueAt. Existing consumers remain compatible.
Counts, rows and deadlines share a RepeatableRead snapshot. Counts run server-side
with Tasks-owned relation predicates rather than fetching all matching task IDs.
Row deadlines use one bounded group query for the current page. Count queries
do not decrypt private contact/request text. The queue still pages all requests;
the shorter scroll surface and collapse action do not truncate data.

NO_ACTION is a new queue view: NEW/IN_PROGRESS requests with no OPEN Call Center
follow-up. WAITING_CUSTOMER and CLOSED are excluded. This is an operational
definition, not a sales-loss label or an inferred SLA breach.

## Dossier and drafts

GET contacts/:id/next-action uses existing authentication, read permission,
route permission and branch/contact authorization. Customer Affairs supplies
its request predicate to the Tasks public port. The server selects one earliest
OPEN dated task across all open requests for that contact, with stable ID tie-break.
Only the selected request/task private payloads are decrypted. Response includes
request title/status, action, stored owner label, deadline and overdue state.
No action and fetch failure are distinct; no unauthenticated cache is introduced.

History, requests and notes have separate labelled section controls. Hidden
sections remain mounted so changing a section does not discard a form.
Existing contact-keyed in-memory note drafts survive row changes and are indicated
when reopening the contact. Existing branch/navigation unsaved guards and modal
draft warnings are preserved. Private drafts are not written to browser storage.
Next-action refresh follows workflow mutations. Freshness of queue counters is
explicit and manual refresh remains available; this is not a live phone claim.

## Visual/report meaning

Readable body typography, stronger helper contrast, focus states, compact queue,
visible filter count and existing removable filter chips. Real source donut/legend
remains unchanged. Report labels are now “بیشترین تماس خروجی” and
“فعالیت کارشناسان”; values and historical attribution are unchanged.
Existing on-time follow-up rate remains alongside completed and overdue counts
with its denominator and period explained. Current open workload and period
activity stay explicitly distinct.

Sales conversion, waiting time, call duration and telephone answer rate remain
unavailable pending valid source data/approved definitions. No sample mockup
figures are seeded or displayed as operational data.

## Validation

Targeted PostgreSQL workflow coverage checks authorized multi-branch counts,
one-request/two-follow-up deduplication, no-action exclusion, earliest action and
forbidden branch reads. Chrome/Edge synthetic fixture checks the exact nine
headers, four tables' alignment, action-card navigation, queue collapse, next
action, draft retention across tabs/contacts and390px layout.
Repeated selection of the current card/tab explicitly refreshes the queue rather
than leaving loading active without a changed effect dependency. The incomplete
card's actual search payload is checked for scope ANY and incomplete YES.
Final lint/typecheck/build and runtime evidence is recorded in PROJECT_STATUS.
