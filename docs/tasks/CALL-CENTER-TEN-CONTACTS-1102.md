# Ten contacts per page — 2026-11-02

COMPUTER_ID=PC-C; CALL-CENTER-TEN-CONTACTS-1102. User authorizes source changes only, explicitly no server publication.

The contact-list search now requests10 rows per page. A shared contact-page constant supplies the request size and pagination fallback. The contact table computes page count from the returned page size rather than its previous hardcoded divisor20, preserving access to every result. The final page can contain fewer than10 contacts.

Existing query filters, branch scope, snapshot revision, cancellation, stable backend offset ordering and Previous/Next behavior remain unchanged. KPI dialogs, histories, request queue and report paging are separate and unchanged. No API/schema/migration/dependency or runtime change.

Validation: existing eight read-transport regressions pass, including search size10, branch/filter/revision/cancellation forwarding and retained20-row KPI requests. Scoped lint and formatting pass. Full Web typecheck and production build pass. The build used a same-drive isolated copy with the existing workspace dependencies to avoid Windows cross-drive dependency-junction paths; current Contracts declarations were regenerated after switching to latest develop.

No SSH/server command, deployment, configuration or data mutation performed. Earlier executive-only audio work remains on its separate draft PR1314 and is not mixed into this change.

