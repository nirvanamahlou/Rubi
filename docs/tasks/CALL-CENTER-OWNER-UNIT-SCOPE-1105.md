# Call Center responsible-expert unit scope — 2026-11-05

Work CALL-CENTER-OWNER-UNIT-SCOPE-1105, PC-C. Base develop03dba84cb. The owner requests every unit manager can select only the unit's employees, with company director Danial Altafi retaining all-unit selection. This deliberately supersedes the earlier demo/executive assignee exceptions; other Call Center privileges are unchanged.

## Cause and correction

`IamCallCenterDirectory.requestAssignees` treated membership in `CALL_CENTER_CALLBACK_MANAGER_IDS` as global assignment authority. It also treated every broadly approved Call Center reader as a global assignee selector. Callback triage and responsibility assignment are separate capabilities.

The existing request-operators endpoint now uses:

- Required native Call Center screen/workflow and branch permissions.
- For unit managers, native `customer_affairs.call_center.workflow.manage.team` plus the current exact `UserProfile.organizationUnitId`, validated by the HR public directory as active in the request branch.
- Active internal accounts in that same unit/branch. Unit names, role captions and phone extensions never match identities or grant access.
- Ordinary users remain self-only; a missing, inactive or foreign unit fails closed to self.
- The only all-unit exception is the active native account whose authoritative username is `danial` and whose existing approved global policy is valid. A display name, role caption, callback list or legacy demo allowlist cannot substitute for that identity. Existing branch boundaries remain in effect.

New/changed request responsibility already calls `resolveRequestAssignee` within the save transaction. It now consumes the same corrected list under existing account/profile/branch locks, including the HR unit validation. A forged ID or a person moved to a different unit after the picker loaded is rejected. Historical unchanged responsibility is preserved by the existing workflow; it is not silently reassigned or deleted.

No public response/API shape or UI layout changes. Full-name/position presentation stays compatible, and the existing generic historical-owner placeholder does not expose a person outside today's available list. Contact visibility, triage, audio-download policy, notifications, replay and optimistic concurrency remain unchanged.

## Verification

A standalone candidate was executed in a read-only repeatable-read transaction against current ERP data. No application context or worker started, and no server service/image/environment/account/grant/business row changed. Four configured accounts were checked across their current branches: the unit-manager sample was restricted to6 available accounts out of20 branch accounts; the verified director retained20; other samples were self-only. Every candidate set matched the independently queried native unit/branch/account constraints. No real names/IDs or business records entered Git.

Unit regressions cover Sales, Reservations, Finance, Support and HR unit IDs; callback and general global-read privileges cannot bypass unit restriction; the director exception requires native identity/approval; forged recipients and missing/foreign units fail closed. Existing HR and recording-policy tests and unchanged owner-select rendering are also exercised. Two PostgreSQL scenarios run in the existing CI Call Center fixture: real cross-unit denial and membership changes between list and save.

## Delivery

No migration, new environment variable or dependency change. The existing privately configured verified director remains valid. Deployment requires the API source change only; a Web release is not required because the picker consumes the existing authenticated endpoint. This task does not deploy the site or modify production permissions. Final tests/build and branch/PR status are recorded in PROJECT_STATUS.md and WORK_ASSIGNMENTS.md.
