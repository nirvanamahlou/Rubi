# CALL-CENTER-RELEASE-1025

PC-C release of the final reviewed Call Center changes, starting from87eb5e3a. User explicitly authorizes PR to develop and merge only after all CI/CD checks pass.

Includes scoped staff assignees, queue columns/alignment/badges, dual calendar filters, outbound first-contact handling, contact destination labels, missed-caller KPI and all four KPI drilldowns with edit-only actions. Existing local staff setup stays local; no credential/environment files or generated next-env changes are published. Local runtime remains in its existing checkout.

Integrated develop8806eac1 before PR. Resolved append-only project/work assignment/decision conflicts by preserving both sides; merged English translation keys without replacing other modules. No Call Center code conflict, new migration or dependency change.

Prior local verification: scoped lint/typechecks, API/Web builds, isolated PostgreSQL tests, Web tests and browser acceptance are recorded in each feature task. Final integrated acceptance is all GitHub CI checks on the exact PR head. Do not bypass failed checks or branch protection.

PR: https://github.com/nirvanamahlou/Rubi/pull/1114 (author Amin-tech11, target develop). Source release prepared and pushed; all final checks and merge SHA are authoritative in the PR checks/timeline. Merge remains conditional on success of every check on the latest head; no gate bypass is authorized.

CI fix: Full typecheck exposed Node UUID template-literal inference in the queue sorting test (TS2345 at ids.includes(row.id)). Explicitly typed the fixture ID collection as string[]; production behavior unchanged. Full CI must rerun on the fixing commit.

CI completeness fix: added13 missing English Call Center strings and synchronized the request-assignment scope error in the offline API catalogue. Local i18n coverage test passes3/3; UI Persian copy and workflow unchanged. Full CI reruns on this translation commit.
