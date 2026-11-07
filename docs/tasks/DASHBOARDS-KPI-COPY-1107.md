# Dashboard KPI business definitions — 2026-11-07

Owner: PC-C. Branch: `codex/pc-c-dashboard-kpi-copy-1107`.
Base: `4f36df206e7f359ee7d869e32635b2a8c4a1437b` (`origin/develop`).

## Requested behavior

Replace the repeated paragraph in the KPI definition drawer with an individual,
plain-language explanation for each of the 84 registered KPIs. Use the company's
travel services (flights, hotels, tours and related services), not physical goods.
Keep the business decision, calculation, source, exclusions and report link intact.

## Scope

`DashboardKpiDefinition.businessDefinition` is required for both the main registry
and employee commercial KPIs. The shared drawer displays that text on every
dashboard page. The existing English UI catalogue receives matching translations.
No metric IDs, formulas, data queries, permissions, availability or values change.
Unavailable metrics remain unavailable; explanatory text does not enable them.

Definitions distinguish contracted sales from received money, gross profit from
net profit, and recorded activities from successful outcomes. First paid purchase
and unconverted lead explanations preserve the existing approved business rules.

## Validation and delivery

- Existing Dashboard and English UI coverage suites: 54 passed, one existing skipped.
- Scoped ESLint and Prettier checks: passed.
- Shared contracts build, Web TypeScript and production Web build: passed.
- All 84 descriptions are distinct and translated; comparison confirms existing KPI
  metadata is unchanged after removing the new description fields.
- Independent review checked units, timing, denominators and the approved first
  paid purchase rule against existing sources.
- Fresh offline frozen installation; no dependency or lockfile changes.

No migration, production data change, merge or deployment. Deliver a draft PR to
develop; these source changes are not yet published on the ERP server.
