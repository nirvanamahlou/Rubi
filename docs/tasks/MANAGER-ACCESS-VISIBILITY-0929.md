# MANAGER-ACCESS-VISIBILITY-0929

- Computer: PC-A; branch: `codex/pc-a-manager-access-visibility-0929`; base: `origin/develop@e082d1be`.
- Owner reports that the Ramtin account is the system administrator and should be able to configure the «مدیر» profile for every application section.

## Change

`GET /iam/users/access-options` now detects an active membership in IAM's canonical `administrator` role. Only that account receives all non-UI operation permissions and every screen in the catalog as assignable options. The user-management form uses these server-provided options for counts, checkboxes and the manager recommendation. On save, IAM rechecks the administrator membership and allows this full catalog for managed profiles. Ordinary operators continue to see and assign only their own native permissions and visible screens. Legacy role creation/assignment, branch scopes and administrator membership safety are unchanged.

No database schema, migration, shared permission contract or dependency change is needed. No real account or operational data was modified.

## Verification

- Focused API access/profile tests: 10 passed, including all-catalog administrator options, elevated profile save, restricted operator options, anti-escalation and legacy behavior.
- Focused Web role recommendation tests: 20 passed, including the all-sections administrator recommendation and grant-limited operator behavior.
- API and Web typechecks, lint, and production builds passed; Web generated 55 routes.
- No migration, dependency, runtime, or operational account changes. The branch awaits PR review/CI; no merge or local rollout is claimed.
