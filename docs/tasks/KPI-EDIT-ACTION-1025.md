# KPI-EDIT-ACTION-1025

PC-C; user explicitly requests one edit action in all KPI modal tables.

Shared modal removes dossier navigation and the separate callback-registration action. Every row now opens the existing-call edit form using its call ID, labeled «ویرایش اطلاعات تماس». All modes use the existing edit permission gate (create plus manage) and preserve cancel/save refresh behavior. Missed-callback description now refers to editing the latest missed call; callback eligibility itself is unchanged.

No API, schema, IAM, telephony or dependency changes. No production deployment/merge. Preserve unrelated generated next-env.d.ts. Local Web runtime replaced only after ownership check and successful build.

Validation: scoped ESLint and 15 existing Web tests pass. Web typecheck/build and four-mode browser acceptance tracked below.

Final: Web typecheck/build65 routes passed. Browser checked all four modes after data load: edit present; dossier and callback-registration actions absent. Local3000 WebPID21016; API untouched. Screenshot F:/DevData/Temp/kpi-edit-action-1025.png outside Git. No operational call modified.
