# B2B-ORGANIZATION-USERS-001 — PC-B

The owner requests populated Users & Access, popup entry forms and selectable per-user sections, explicitly restricted to that agency's own 360 dossier. This work adds dedicated IAM-backed accounts through the existing public IAM service and B2B-owned organization membership. Existing staff users, global role grants, branch assignments, contacts and signatories remain unchanged.

## User behavior

- Staff with B2B read/manage and the selected internal branch can list/create users, edit organizational role, active status and six viewable sections, and inspect access history. Create captures display name, username and initial password; identity/credential ownership remains IAM. Updates require current version and a reason. Deactivation immediately denies subsequent portal reads.
- `/login?next=%2Fagency-portal` uses normal authentication. `/agency-portal` shows only allowed sections of the membership's organization. No organization supplied by the client is trusted. Direct requests for disallowed sections or global authenticated endpoints are denied, even if a linked account later receives global IAM grants.
- Membership grants viewing, not edits or approvals. Finance displays an explicit unavailable-owner-data notice. Portal audit is currently access-change history, not an aggregate of all module audits. Service/order limits from the broader PRD remain out of this bounded delivery.

## Contracts and data

Additive staff routes: GET/POST `b2b/agencies/:organizationId/users`, PUT `users/:id`, GET `users/history`; reads require `x-branch-id`. Portal routes: GET `b2b/portal/me`, GET `b2b/portal/sections/:section`. Existing routes stay compatible. Producer B2B, consumers Organizations UI/standalone portal and tests. Shared contracts export six section identifiers and safe response DTOs.

Migration `20260910100000_b2b_organization_users` adds one table, restrictive FKs, checks and indexes. Rehearsal against a restored full backup preserved all data in 128 tables and 48 historical migrations; local application repeated those checks successfully. Cutover backup: `C:/Users/admin/Rubi-backups/b2b-organization-users/cutover-1788977697641.dump`. No dependency or destructive migration changes.

The guarded local loader `apps/api/scripts/b2b-organization-users-demo.mjs` provisions 12 accounts across four existing synthetic agencies (active viewer, active commercial user and inactive supervisor for each). All receive zero global roles/branches. It backs up before writes, preserves existing grants and modified fixtures, and stores randomly generated credentials outside Git in `C:/Users/admin/Rubi-backups/b2b-organization-users/demo/organization-user-credentials.json`. Preview/apply verify identity and scope; no real contact details are seeded.

## Verification

139 B2B/IAM tests, 90 Organizations tests and 17 disposable PostgreSQL tests pass. The 25 new focused service/HTTP tests include real Nest guards, interceptor and DTO validation, scoped projection, disabled access, field injection and provisioning failure. PostgreSQL tests cover optimistic concurrency, foreign scope denial, section constraints and transactional audit rollback. API/Web lint and typecheck, Contracts/Database lint/build and API build pass. Browser fixture uses actual React components; create, section editing and deactivation work. Final production build/runtime and CI results are appended after cutover.

Branch `codex/pc-b-b2b-organization-users` retains the combined runtime and PR142 stack. Review targets develop; no merge authorized or performed.

## Completed cutover

- Source d8de690f08fbedd914981e4bfadf8fc9118e1a5a is active on Web3100 PID26256 / hr005-67cffe6403214472. API4191 PID27972 is healthy, with the same local database and Documents storage. The prior API4190 port is restricted by Fetch (`bad port`); the owned local `.env.local` and build use `http://localhost:4191/api/v1`. The old listener is stopped. Future local launches must use API4191. No checked-in infrastructure configuration changed.
- All 41 Web routes build successfully. Final browser fixture uses current production CSS and actual React components; selected-section re-click retains content, only allowed navigation is visible, and console errors are empty. Production browser returns to `/organizations` and requires its normal staff login; no staff session was fabricated.
- Live smoke checks used normal password login for four newly created synthetic accounts, including a second agency and inactive membership. Own organization projection, ignored client organization substitution, allowed contracts, denied unselected sections/global routes, inactive denial and successful logout all pass. Credentials/cookies are never printed. Post-seed preview reports 0 new / 12 existing records. Private evidence: `organization-users-live-smoke.json` in the existing local B2B runtime directory.
- All four gates of CI run34460651768 pass (quality, tests, production build, PostgreSQL migrations/seed). Initial CI caught the Next navigation lint rule in the added logout action; source d8de690 fixes it through useRouter and passes. Draft PR143: https://github.com/nirvanamahlou/Rubi/pull/143. No merge. Implementation and migration locks released; this documentation follow-up does not change the built source.
