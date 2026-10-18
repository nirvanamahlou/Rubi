# PARTNER-DOSSIER-READY-1018

PC-B repairs the supplier/broker dossier delivered by PR922.

Root cause: PartnerDossier keyed its loaded state by the session refresh revision.
Mounting its child panels calls useDossierBranch, refreshing the authenticated
session and emitting a recovery event. The changed revision hid the parent data,
unmounted children and then remounted them after another load. A semantic key
(actor, authorized grants, branch) now ignores same-session refresh revisions;
changed user, permissions, branch and unresolved session still invalidate data.

All new partners create their canonical organization and actual role in the same
transaction, including older API clients without optional contact fields. Legacy
rows are prepared automatically in authenticated POST batches of50 on workspace
entry using the existing audited, advisory-locked CAS/idempotent connector.
There is no name matching, GET mutation, grant bypass or Finance balance change.
An individual late-arriving legacy row also resolves automatically on opening.
The post-connect source is reloaded so the first edit uses its current version.
The separate create/connect button is removed. A30-second deadline exposes a
retryable error instead of infinite waiting, and stale completions are ignored.

No schema, migration, dependency or lockfile change. No real payment, message or
credential manipulation. Focused lifecycle/client/session tests13 and persistence/
directory/repository tests22 pass. Full type/lint/build and exact-head CI remain
delivery gates. Two actual PostgreSQL automatic-create regressions join the
existing25-concurrent legacy-link checks. Browser observation remains unavailable
under the prior tool policy; do not claim authenticated visual QA.
