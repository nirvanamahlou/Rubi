# CALL-CENTER-RELEASE-1025

PC-C release of the final reviewed Call Center changes, starting from87eb5e3a. User explicitly authorizes PR to develop and merge only after all CI/CD checks pass.

Includes scoped staff assignees, queue columns/alignment/badges, dual calendar filters, outbound first-contact handling, contact destination labels, missed-caller KPI and all four KPI drilldowns with edit-only actions. Existing local staff setup stays local; no credential/environment files or generated next-env changes are published. Local runtime remains in its existing checkout.

Integrated develop8806eac1 before PR. Resolved append-only project/work assignment/decision conflicts by preserving both sides; merged English translation keys without replacing other modules. No Call Center code conflict, new migration or dependency change.

Prior local verification: scoped lint/typechecks, API/Web builds, isolated PostgreSQL tests, Web tests and browser acceptance are recorded in each feature task. Final integrated acceptance is all GitHub CI checks on the exact PR head. Do not bypass failed checks or branch protection.
