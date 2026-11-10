# Dashboard KPI cards without mini charts

PC-C; user requests removal of summary charts under all KPI cards, push and develop PR, then merge only after every CI/CD check succeeds. No server deployment.

Remove the KPI-only MiniTrend renderer, its currency legend and loading/chart spacer. Preserve values/currencies, comparison indicators, unavailability explanations and full-size Dashboard charts. The common KpiCard applies this to all Dashboard pages. No API or data changes.

Validation:59 Dashboard tests pass,1 existing skip; scoped lint, Web typecheck/build and hosted gates recorded in the PR.
