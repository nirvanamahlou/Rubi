# HR Workbench surveys — PC-B

The Workbench survey form already persists submissions in `workbench_feedback`. HR now has a read-only Surveys and Suggestions section that reads only submissions addressed to Human Resources from branches where the current account is an authorized Workbench feedback recipient. The list has newest-first pagination and refreshes while open. Anonymous submissions omit the sender identity in the API response and interface.

The Workbench feedback service owns the new additive `GET /api/v1/workbench/feedback/hr/inbox` contract. HR consumes it through the public API; it does not query Workbench tables. The existing sender/detail access and notification behavior are unchanged. Producer and consumer are both PC-B; old clients ignore the additive response. No schema, migration, dependency, permission grant or data rewrite.

Validation: 10 focused Workbench feedback API tests, 54 focused HR Web tests, API/Web lint and typechecks, API build and Web production build (53 routes) passed. No runtime activation or business-data mutation. Handoff: review PR against develop; the shared Web3100/API4190 deployment must include both the new API endpoint and HR page.