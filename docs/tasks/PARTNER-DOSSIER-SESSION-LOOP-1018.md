# PARTNER-DOSSIER-SESSION-LOOP-1018

PC-B; explicit user request: remove dossier/archive credit help text and repair
the remaining supplier/broker360 reload behavior after PR926. The previous
semantic parent key alone did not remove child-owned session refreshes.

PartnerDossier now owns one session provider. Its content, disclosures and all
hook-based panels consume the same live branch/actor/grants. Nested hook
instances never install refresh timers or auth listeners; standalone agency
consumers retain their existing lifecycle. Documents also consumes this session
instead of refreshing credentials for every list/page/branch query. Recovery,
focus, permission/actor/branch invalidation and sensitive-contact masking remain.
No permanent credential cache or authorization bypass was introduced.

Regression tests execute hook effects for25 nested consumers (zero timers,
listeners or refresh calls), owner subscription/cleanup and immediate replacement
of actor/branch/revoked grants. Existing loader, session, document/disclosure and
partner client regressions remain gates. No API/schema/migration/dependency or
financial semantics changed. Text removal is presentation-only.

Full exact-head hosted quality/build/test gates precede authorized develop merge.
Authenticated browser QA remains unavailable due the previously recorded tool
policy; no claim of a visually verified live resolution. Runtime publication,
if performed, must identify the actual image revision and health result.
