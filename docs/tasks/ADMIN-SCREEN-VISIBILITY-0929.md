# ADMIN-SCREEN-VISIBILITY-0929

PC-A; follow-up to the explicitly authorized merge/local rollout of MANAGER-ACCESS-VISIBILITY-0929. Base: origin/develop@85094001. Some general pages have no native operation permission and were hidden even from system administrators.

IAM contract v13 adds the internal derived `ui.administrator` marker. IAM emits it only for an active canonical `administrator` role, strips it from stored permission rows, and ignores role titles. The screen policy permits all catalogued screens for this marker, including Workbench and Integrations. Native API/action guards, branch scopes, unknown-screen rejection and ordinary per-user checkboxes continue to apply. The marker is never seeded or persisted as an assignable permission.

Focused checks cover active/inactive administrator membership, spoofed stored marker/title, all catalogued screen visibility and existing restricted-user policies. API: 13 tests; Web: 9 tests; contracts: 4 tests. Scoped lint, package build and typechecks are checked before release; CI covers production builds and full suites.

No schema, migration or dependency change. Local rollout also reconciles the standard IAM seed catalog and additive canonical administrator membership for the owner-confirmed local account, with audit. Existing credentials, branches and roles are preserved; rollback metadata remains in ignored runtime files, outside Git.
