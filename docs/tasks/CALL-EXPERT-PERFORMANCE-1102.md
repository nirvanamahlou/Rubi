# CALL-EXPERT-PERFORMANCE-1102

PC-C; codex/pc-c-call-expert-performance-1102. Owner explicitly approves removal
of the outgoing-contact ranking and limited read-only HR public projection.

## Implemented behavior

The outbound-contact ranking is removed from Web. The expert table shows current
HR name and every registered extension, inbound answered, outbound attempts and
connected calls, known unique phone groups, current open/overdue follow-ups and
completion percentage with its actual denominator. Zero denominator is unavailable.
Sort: overdue descending, open descending, incomplete descending, Persian name,
canonical account ID. No volume-only employee score or invented durations/sales.

Historical attribution uses saved answer responsibilities for inbound calls and
stored outbound session offers for outbound originators, with provider direction
validation. Current HR extensions label rows; they never guess historical owners.
Shared/transferred calls credit each proven actor once; totals are not additive.
Calls without proven attribution remain in an explicit separate count. Missing
phone numbers never count as known unique contacts. Manual registration is not
substituted for a physical employee phone call.

HR owns hr-call-performance-directory.ts; Customer Affairs never reads private HR
tables directly. The port returns canonical account/name/extensions only, constrained
by authenticated branch and allowed report accounts; no private personnel fields.
Tasks owns current-backlog facts constrained by report assignees, source CALL_CENTER
and OPEN status. No task title, payload/history or customer identity is exposed in
the new detail view. Backlog is explicitly current and independent of call dates.

Report response is additive (expertActivity and optional activityDetail). Existing
report fields remain compatible, including the legacy outbound aggregate for older
consumers. Optional actor/metric query fields are UUID/allowlist validated. Details
recompute the same authorized call predicate, report scope and fixed period; no
client-supplied call IDs bypass authorization. Unknown/out-of-scope actors are denied.
Each numeric cell opens a paginated Tehran-time detail view, with cancellation,
stale-result protection, retry and no-data states. Detail totals match summary
measurement; open/overdue views reflect current backlog on each read.

## Bounds and validation

Maximum10,000 calls,10,000 current tasks and1,000 HR records; exceedance fails closed,
never silently truncates. Independent call roots and duplicate participant IDs are
deduplicated; all registered employee extensions aggregate under canonical user ID.
Schema, migrations, IAM grants, dependency/lockfile and business data are unchanged.

198 API checks pass;68 existing database-dependent checks skipped without a test
DB URL.78 Call Center Web checks pass. Scoped lint, API/Web typechecks and production
builds pass on the actual task checkout after preparing matching generated Prisma
and contract outputs. Read-only in-memory candidate probe against actual production
confirms roster/activity construction and summary/detail count reconciliation; it
is neither an authenticated HTTP acceptance nor a deployment.

Pending: hosted CI, review/merge and separately authorized production rollout;
manual role/branch/period/drilldown browser acceptance (تست). Production unchanged.
