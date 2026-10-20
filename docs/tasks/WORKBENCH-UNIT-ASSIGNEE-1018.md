# Workbench requests to a named department member

PC-B; direct execution, without Worker Orchestrator. The owner authorizes implementation, push/develop merge and local3100 rollout. Depends on merged PR933 (the real IAM profile → HR organizational-unit FK). No new schema or migration is introduced here.

## Account and unit source

HR exports only active, non-deleted organization/units IDs and names for the selected branch. A new IAM public directory composes that projection with active internal CRM accounts whose saved profile organizationUnitId matches that unit and whose live branch membership matches the selected active branch. No role-name guessing, personnel-position matching, administrator fallback, contacts, grants or payroll data are exposed. Accounts without a configured unit are not invented as department members.

## Request and inbox contract

GET customer-affairs/workbench/request-options is authenticated, private/no-store and branch scoped. POST customer-affairs/workbench/requests now accepts the bounded WorkbenchRequestInputV1: title/description, supported priority, organizationUnitId, executionOwnerUserId and optional case-reference text. The paired Web/API release requires old Workbench clients to refresh; general Customer Affairs ticket contracts and saved legacy requests remain compatible.

The server authors channel/category/owner/unit snapshot/action/deadline and validates the chosen active unit member inside the same transaction as the request, timeline, idempotency command, audit and notification. Shared locks protect account/profile/branch membership and HR unit against concurrent edits. Existing customer_affairs_tickets.execution_owner_user_id is the actual restricted IAM FK. The human unit-name snapshot uses the existing bounded executionUnit column; the authoritative account-unit relationship remains owned by IAM/HR.

The original minimal input fingerprint is stable across network retries, despite server-generated timestamps. Reusing the key with a different selection conflicts; double-clicks are blocked synchronously in the form. Invalid or stale members produce no ticket or notification. Existing general ticket creation remains unchanged.

GET workbench/requests reads only Workbench categories for the authenticated creator OR execution owner, intersected with current branch scope. It returns sender/recipient names, direction, description, status and priority. New individually assigned requests are excluded from the legacy department-wide HR reader. Incoming/sent filters, refresh and visibility/focus-aware 30-second refresh keep the recipient inbox current. Notification links open the request details in Workbench without navigating to Customer Affairs. Closing the detail does not reopen it on each refresh.

## Verification and rollout

Focused service/DTO/directory/repository and selector tests cover real IDs, clearing stale recipients, disabled/empty states, scope, active membership, executor persistence, transaction notifications, description limits and retry fingerprints. Full Customer Affairs and Workbench/i18n suites are run along with lint, typecheck and affected production builds.

Opt-in workbench-request.postgres.spec.ts uses only named local disposable databases. It executes the real HTTP controller, validation, public directories, repository, transaction and NotificationsService with synthetic accounts: sender/recipient delivery, non-recipient and other-branch isolation, exact-once retry, wrong/departed/inactive members and inactive units. Authentication is replaced only inside the isolated test Nest application; production guards and grants remain untouched. No real users receive test requests or messages.

Local deployment must preserve the existing Rubi database/document volumes, back up before any pending migration, apply the PR933 migration before the new application, and deploy the reviewed merged develop source to Web3100/API4192. Runtime source/hash and HTTP health are verified after rollout; local receipts stay outside Git.

Validated candidate:127 Customer Affairs tests and110 Workbench/component/i18n tests pass; the gated PostgreSQL/HTTP flow separately passes after all160 migrations on the isolated nora_workbench_test_1018 database. Both application typechecks, scoped lint, synchronized localization, API production build and Web production build (62 routes) pass. No operational users or requests were changed. Hosted final-head CI and merged-source local rollout remain the release gates.
