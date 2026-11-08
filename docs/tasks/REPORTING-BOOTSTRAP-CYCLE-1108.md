# Reporting bootstrap cycle recovery — 2026-11-08

PR1484 merged after eight successful checks, but first runtime activation exposed an eager module-import cycle introduced by the independently merged Dashboard activation: Reporting -> CustomerAffairs -> Sales -> Reservations -> SystemManagement -> Reporting. Reviewed rollback restored healthy deployed 0c4cedf6b; no schema migration was applied and no business data was restored or discarded.

Remove ReportingModule's full CustomerAffairsModule import. Resolve the existing exported CallCenterDashboardSource through ModuleRef only when its reader is invoked after application bootstrap. AppModule already owns that provider. The exact public reader, original actor/query and all Call Center scope checks remain authoritative; no direct domain-table reader or new grant is added.

The new full AppModule graph regression reproduces the original SalesModule undefined import before the fix and passes afterwards without instantiating providers, opening database connections or starting jobs. It also proves exactly one public call source is registered and that its query is passed unchanged. A second, isolated production-image probe mounted the compiled corrected modules and resolved all 51 modules with network disabled and providers unstarted.

Targeted Dashboard/bootstrap checks and scoped ESLint pass. Full API typecheck/build and final-head hosted gates are required before the recovery release. Recovery publication will retain PR1484's a43bb8a baseline and apply only the reviewed bootstrap files, avoiding unrelated later develop migrations. Source and patch revisions are recorded independently.
