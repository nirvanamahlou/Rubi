# Ghestiroo connector — PC-D — 2026-11-01

Owner explicitly authorizes both Ghestiroo and Nora implementations, with Nora
application changes strictly limited to Integrations. Branch starts from
origin/PC-D-Integration@f6cd1cd0f. Ghestiroo starts from develop@25244d3.
Reserve only new ghestiroo connector files, Integrations module registration,
workspace/client wiring and this task's coordination records. No Nora schema,
dependencies, IAM, Sales, Finance, Customers or other module changes.

Contract ghestiroo.nora.v1: server-only revocable bearer key bound to an existing
active site staff account and explicit resource scopes; HTTPS transport; bounded
cursor reads; short-lived single-use browser POST SSO grants. Site administrator
generates one-time connection JSON; Nora Integrations stores credentials encrypted
with an operator-managed master key, binds users and branch, and tests the real
capability response. No business-data replication or automatic deployment.
Nora API/Web and Ghestiroo endpoints ship together; absent config fails closed.
Existing admin sessions/permissions remain authoritative in Ghestiroo.

Bounded Web infrastructure reservation: next.config.ts excludes only
`/integrations/ghestiroo-launch` from the static CSP/Referrer-Policy override so
that this integration document can supply its exact-origin, nonce-based policy.
Regression checks preserve the original policies on all other routes. This is
not a policy or behavior change to any other Nora module.

## Delivery and verification

READY_LOCAL / source reservation RELEASED. Nora: 46 targeted API/contract tests,
29 Integrations Web tests, scoped API/Web ESLint, API build and Web production
build (66 routes) passed. Ghestiroo: nine tests passed on disposable PostgreSQL
17, including additive migration preservation, five concurrent redeem/revoke
races, key scope/expiry, one-use grants and SSO session revocation. Eight of the
same tests also passed on isolated SQLite before PostgreSQL rehearsal.
Two headless Chrome flows passed desktop/mobile: real Ghestiroo admin template
with one-time bundle/copy and the Nora connection UI through live synthetic site
capabilities/catalogue and real browser SSO. Nora IAM/unrelated module APIs were
mocked only in browser QA; no production account or business data was used.
Node transport also exercised the actual Python fixture independently.

Nora work is committed locally; publication remains subject to the owner's
explicit PC-D-Integration publication rule. Ghestiroo is delivered on the separate
`codex/nora-connector-1101` branch under standing commit/push authorization.
No merge, hosted CI dispatch, shared local runtime replacement, production
migration or deployment is part of this task. Deployment handoff is in
`apps/api/src/integrations/GHESTIROO_SETUP.md` and Ghestiroo
`docs/nora-connector.md`. Site migration is additive; Nora needs a private
persistent credential directory and 32-byte encryption master key at runtime.

## Publication authorization — 2026-11-01

The owner explicitly authorizes pushing the Nora connector to nirvanamahlou/Rubi,
waiting for green CI, opening a PR to develop and merging after green PR checks.
This task-specific instruction supersedes the earlier PC-D-Integration destination
for this delivery only. Site application code remains exclusively in Ghestiroo.
The unshared Nora commit was replayed onto origin/develop@60273a159, preserving
current Niyayesh, telephony and other modules. Reserve bounded reconciliation,
this task documentation and validation fixes for publication. No deployment.

CI publication follow-up: the full English UI completeness gate found 43 missing
labels introduced by this connector. Reserve the Integrations English dictionary
and the 11 matching entries in the shared API error dictionary solely for those
new Integrations messages. No other module label or runtime behavior changes.
All quality, production-build and PostgreSQL CI gates passed on the first run;
full tests are repeated after completing these translations.
