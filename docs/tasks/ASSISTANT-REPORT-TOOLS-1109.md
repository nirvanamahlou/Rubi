# Assistant/reporting integration — 2026-11-09

COMPUTER_ID=PC-C. Scope: consumer-only tools; no business write, migration, dependency or live deployment.

## Architecture assessment

Nora is an independent HTTP service, not a Prisma client. Its registry/executor enforces fixed GET tools, bounded payload/time/concurrency, native session identity before and after source reads, branch revocation and minimized audit. Groq receives messages/history only; ERP evidence must not enter provider history. Existing conversation planner exposes only three prepared actions. Adding a registry tool does not automatically make it a model-selectable action.

## Database and source assessment

Reviewed Prisma structural definitions and public Reporting producers; no production database values were sampled or changed in this unit. ReportingTravelFact is a staging/legacy fact model, not a substitute for live operational sources. Reporting saved definitions, runs, schedules and export artifacts are metadata, not sales/financial balances. Native Reporting obtains Sales, Customers, Customer Affairs and other aggregates through public module contracts. Database/table existence is not proof of a READY business source. The prior REPORTING-READINESS-1103 audit is historical, not a current database census.

Dashboard KPI/visual contracts already carry observation timestamps, date/FX basis and unavailable-source markers. Currency series and Decimal strings must not be summed across currencies. Contract outstanding is not accounting receivable; purchases are not approved costs; accounts are not available cash. Forecast/news/scenario output requires separately accepted data and methods.

## Implementation

Two immutable, no-input registry tools consume normal ERP Core endpoints (not the older assistant read sidecar): reporting.catalog -> GET /reports/catalog; dashboard.snapshot -> GET /reports/dashboard/projection?range=month. Native API remains authoritative for row/branch/source access. Additional tool grants are reporting.read and, for catalog, reports.view.catalog. Model/user cannot supply SQL, URL, actor, dates or company selectors.

Validators reject malformed/oversized/duplicate/unknown-version results. Projection strips internal view names and permission hashes, preserves exact KPI value strings, explicitly retains empty/blocked states and only lists available chart identifiers rather than collapsing their currency series. This is observed dashboard evidence, not a forecast. Additive GET /v1/assistant/reporting composes both through the existing audited executor and rechecks both permissions and branch removal before releasing the combined result. No provider call is involved. Existing actions and UI stay compatible.

## Validation and remaining delivery

74 native Node tests pass, including positive HTTP public-source composition, anonymous/permission/write/selector rejection, exact decimal preservation, malformed source rejection and historical executor revocation/timeout/cap tests. Syntax and formatting checks apply to changed MJS; no compilation or dependency target exists for this native Node service.

This is backend tool groundwork, not a completed assistant dashboard rollout. The new endpoint needs versioned Web response validation/BFF and explicit UI consumption; conversation routing needs an additive reviewed action contract before the model can choose these tools. Full report result tools must preserve per-report readiness, own-row permissions, filter snapshot, grain, sensitivity and pagination/total semantics; arbitrary report execution/export is intentionally not exposed. KPI-specific charts need their full currency-aware schemas before returning chart series. Live source/data reconciliation, operational deployment and model-connectivity verification remain outstanding; no production-use claim follows from synthetic tests.
