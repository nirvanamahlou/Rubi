# USER-ACCESS-TREE-0928

- Computer: PC-A; branch: `codex/pc-a-user-access-tree-0928`; base: `origin/develop`.
- Owner explicitly requests implementation and merge to develop. Original dirty checkout and shared local runtime are preserved.
- IAM producer / central Web navigation consumer; additive permission contract v12. Optional accessTitle/permissionIds/screenIds supplement legacy roleIds/branchIds requests. Managed requests require the three profile fields together and no shared roleIds.

## Behavior

System Management opens `/system/users`; `/users` remains compatible. Create an account, select a job title and branches, then select module/child visibility and native operation permissions. Whole-module selection checks all assignable children/actions; removing a child preserves siblings. Parent checkboxes show indeterminate state. Role titles include manager, sales expert, finance manager/finance, AI team, support, reservation employee/manager, HR and visa team.

Each managed account has a dedicated private IAM role. Private roles cannot be assigned to another user. Updating a profile transactionally replaces only that account's grants. Existing accounts switch to explicit visibility only on saving the new form; the UI explains legacy replacement. Account creation uses the existing strong password hash and audit path. Status/self-disable and last active administrator protections remain.

Visibility applies to sidebar groups/items, search results, direct routes, shared registered tabs/content and focused owner navigation menus. Accounts with only a deep route selected see links to permitted children instead of unrestricted parent content. AccessProvider waits for permissions before mounting business content, refreshes every 30 seconds/on focus/session recovery, and uses authenticated no-cache `/iam/auth/access`. Server action guards re-read current role grants for requests. Uncatalogued managed tabs are hidden; new navigation must extend the catalog. Native operation permissions remain separate from screen visibility and authoritative for data.

`GET /iam/users/access-options` requires users.read and returns only the operator's native permissions and active branch choices, without exposing another role's grant set. Assigning native or UI grants outside the operator's own permissions is rejected. Shared legacy access-options excludes private roles/UI permissions. No foreign-module data query, migration, schema, dependency/lockfile or real account mutation.

## Validation and handoff

- Contracts build, strict API/Web types and production builds pass; Web generates 54 routes.
- API IAM suite: 48 tests including account creation, independent grants/removal, escalation, malformed/unknown profiles, private-role reuse and last administrator preservation.
- Web affected-module suite: 926 passed / one pre-existing skipped; focused IAM policy/render suite additionally covers initial content withholding and unknown future tabs.
- Scoped API/Web lint; final changed-file formatting and CI are checked before merge.
- Tests use synthetic fixtures; interactive authenticated browser QA and shared runtime deployment are not claimed. No operational user was created or modified.
- PC-B Istanbul generator updates are preserved when incorporating newer develop. Remaining module owners should fetch develop and register any new navigation in the shared screen catalog.
- Bounded IAM/central UI/docs locks are released with the scoped commit; no migration/dependency locks acquired.

## CI follow-up

Initial full CI found the existing System source contract still expecting `/users` and an AuthGuard decorator attached to the inserted access method rather than the following password-capability method. The original password-capability guard is restored, the new access endpoint remains authenticated/no-cache, and HTTP regression covers unauthenticated access, current actor identity and ignored caller-supplied userId. The source contract now expects nested `/system/users`; the old route remains supported. Full checks rerun before merge.
