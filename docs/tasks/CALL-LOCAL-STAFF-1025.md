# Local Call Center staff review — 2026-10-25

Work item: CALL-LOCAL-STAFF-1025, PC-C. Explicit owner authorization covers local personnel, unit and account configuration for request-assignee review, continuing the approved ef9ecc4c runtime. Application code and UI are unchanged.

## Applied locally

- Configured19 named review accounts (18 newly created, one existing preserved),20 linked/unlinked employee records,10 organizational units and23 extension entries.
- Seven owner-confirmed unit managers use exact unit identity. Same-named Sales units for different companies remain distinct. Ordinary users retain self-only selection; the two previously approved executive/demo accounts use the existing private global allowlist.
- Existing account passwords, role memberships and branch memberships were preserved. New accounts have random unique local passwords and bounded Call Center permissions; no IAM administration, payroll or general module permissions were inferred from job titles.
- The two explicitly deferred employees remain without ERP accounts and are not assignable. Shared extension and all existing aliases were retained when the HR-backed directory replaced the empty-HR bootstrap.
- Names, usernames, manager identities, credentials and the replay manifest remain in private local backups, outside Git. The full database backup preceded changes; credential files have restricted Windows ACLs.
- IAM bootstrap changes are bounded to exact new usernames and audited; existing-account details and HR employees/units use their owning services. Read-only workflow-generated extension rows are imported by a private local HR bootstrap with HR audit. Replay is idempotent.

## Data limitations

The original sixteen employee start dates were transcribed from the owner-provided HR screenshots. Four newly described personnel had no supplied employment date: their local review records explicitly use a review-only employment-kind label and setup effective date, not a verified hiring date. They must not be copied into production HR/payroll. Unit company affiliation for the three newly described departments was not inferred. Existing unrelated fixture/admin accounts were retained and therefore remain visible to the global directory. Demo is an account, not a fabricated employee. Missing HR titles on nonstaff fixture accounts remain explicitly unknown.

## Verification

- Ten real HTTP logins on API4000 and authenticated request-directory responses passed: unit managers see counts5,2,1,1,1,1,1; ordinary staff see1; both global accounts see20 active accounts including preserved local fixtures. Sessions created for checks were logged out.
- Twenty-one database-backed integrity checks passed, including each employee's scope, server rejection of cross-unit reassignment, two deferred no-account staff and all23 extension entries (two entries share an extension).
- Fifteen existing IAM/HR unit tests passed. Private setup syntax and repeat execution passed; repeat creates no duplicate accounts/employees/units/extensions.
- Web3000 returned HTTP200; original Web21032/API20564 listeners were preserved. No runtime restart was required. Existing application lint/typecheck/build evidence from CALL-REQUEST-ASSIGNEES-1025 remains applicable because no application source changed; this data-only task did not rerun a production build.

No schema migration, production data change, telephony mapping mutation, popup activation, PBX change, PR or merge. Backup, manifest, setup runner, login sheet and HTTP evidence are retained privately on the operator device. Other computers must apply their own authorized personnel data; Git does not transfer this local database.
