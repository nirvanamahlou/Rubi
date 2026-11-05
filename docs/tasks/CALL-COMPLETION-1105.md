# Call completion consistency — 2026-11-05

PC-C; base develop000cd543d. Owner reports completed calls remaining incomplete in expert activity.

## Cause and scope

The shared search-metadata producer required caller name and phone, although name is optional and unknown/hidden phone is accepted and immutable in existing-call completion. Both manual completion and live telephony save use this producer; report, filters and expert drilldown consume the stored flag. Existing Web save/report/meta invalidation works and needs no UI change.

Remove only name/phone prerequisites. Subject, explicit outcome, known source and operator requirements remain. No contact number, caller identity, technical evidence, answer responsibility, permissions or report denominator is invented or changed. Unknown numbers remain excluded from unique-known-phone metrics.

## Historical repair

The operator-only API helper locks session then call, checks saved CREATE/COMPLETE_CALL or matching-session SAVE audit evidence, and reevaluates shared criteria. It skips synthetic, active, genuinely incomplete or unsaved records. Preview is default. Apply changes only needsCompletion and terminal session.completed/version, adds RECONCILE_CALL_COMPLETION audit, and is replay/concurrency safe. The search revision includes that audit so stale pages are rejected. No endpoint or migration is added.

Deploy the shared producer in API and Worker before repair, preserving the current release and normal backup/rollback procedures. From the deployed apps/api directory with its existing private environment:

~~~sh
node scripts/reconcile-call-completion.cjs --preview
node scripts/reconcile-call-completion.cjs --apply
node scripts/reconcile-call-completion.cjs --preview
~~~

The script prints aggregate counts only, never caller details or credentials. Review preview before apply. Existing source data and immutable historical audits remain untouched.

## Evidence

Read-only production inspection found181 flagged calls, of which4 satisfy all remaining criteria and have saved-call evidence and terminal/manual status. No live flags, configuration or images were changed. Counts are a point-in-time observation.

66 targeted API tests passed including real disposable PostgreSQL save/reconciliation/concurrency/read-report/filter checks. Scoped lint and formatting pass. Full API type/build checks and hosted CI remain separate gates; local dependencies link to an older checkout, so stale generated shared contracts/Prisma are not evidence of a verified release. Post-publication verify all4 repaired historical rows and one new saved unknown-number call through the authorized expert drilldown.
