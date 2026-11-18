# Floating package visibility repair — 2026-11-18 — PC-A

## Reproduction

The public ERP's current Web/API images are based on develop aaeb7553 (1117). Read-only inspection confirms the floating package card in source and compiled chunks, `/sales/pricing/floating` in the route manifest, its API controller and both existing floating migrations. No missing application deployment was established.

The actual access helper reproduced the defect with synthetic permissions: a manual-v3 profile with `package_pricing.read` and `ui.screen.sales.pricing.management` could open management but not floating packages. The manual-v3 early return bypassed the floating screen's declared `inheritFrom`. No live account, grant or sales-price record was changed during diagnosis.

## Bounded change

The owner explicitly approves inherited floating visibility for holders of the existing management screen. Only this child inherits in manual-v3; generic inheritance policy and other screens stay unchanged. Explicit child denial wins. Parent denial prevents inheritance; separately granted child access still works. `package_pricing.period.manage`, branch isolation, preview/commit validation, FX snapshot and all workbook rules stay unchanged. No account grant or migration is required for this repair.

## Main publication scope

The owner explicitly selects a feature-only main backport, not a bulk develop-to-main release. Main is based on October13 and lacks the original November15 import plus November16 combined-workbook corrections. A separate main-based branch carries only floating definition/import/catalogue/template/access and required combined-destination/BUY-rate dependencies. Existing unrelated main behavior and migration SQL must be preserved. This main candidate is independently tested and gated; production must not be replaced with the older main baseline.

## Validation and rollout

Five new access regression cases pass, including explicit child/parent denial, independent grant, unrelated manual users and no automatic write grant. Existing API import/service/manual-policy suites pass40 tests; floating UI/hub suites pass3 tests. Further main/backport validation, exact-head hosted CI and guarded Web-only production activation remain required. Real business imports are not used as test fixtures.
