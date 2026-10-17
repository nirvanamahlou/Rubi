# User roles, full section selection and guarded deletion

COMPUTER_ID=PC-B. Direct execution without Worker Orchestrator or additional agents, as explicitly requested. Base develop e4969b42; branch codex/pc-b-user-role-cascade-delete-1017.

## Delivered behavior

- Parent section checkbox selects/removes every actor-assignable screen, native operation and explicit control in that section, including field/resource controls. Search never truncates the parent selection. Unrelated and nondelegable existing grants are preserved. Both creation/template and existing manual-user editors consume the section catalogue.
- Canonical administrators can define named role templates below the new-user action. Custom names have bounded deterministic distinct keys; the legacy standard-title keys remain compatible. Templates are unassigned defaults, not live shared roles. Saving a template does not rewrite existing accounts.
- New-user role selection hydrates the role's saved ticks. Existing-user selection hydrates editable manual-v3 ticks; the existing revision/anti-escalation/last-manager checks apply at explicit save. Per-user changes do not modify a template or another user's grants. Branch scope is separate.
- Permanent user Delete appears beside activation/deactivation for administrators. Confirmation names the account; server checks a live canonical administrator and users.manage, rejects self/last-manager deletion, and requires the current manual snapshot revision.
- Delete locks the administrator-membership gate and both user rows, checks all to-many user dependencies and singular HR/B2B references before deletion. Only IAM membership/session/profile/context cascades are allowed. Any business history, audit history, file, employee or agency reference fails with 409 and recommends deactivation; business records are never cascaded away. Deletion and audit are atomic. No real user was deleted during implementation.

## Compatibility and limits

No schema, migration, dependency, permission backfill or operational DB/runtime change. Existing policies and role assignments remain unchanged without an explicit user save. A template is a reusable snapshot: later template edits intentionally do not silently propagate to users already customized from it. Used accounts with history cannot be physically deleted under data-integrity rules.

## Verification

Focused API coverage includes custom role names, bounded distinct keys, preserved authorization, self/stale/nonadmin/last-admin deletion rejection, arbitrary future dependency protection, singular employee reference and successful atomic deletion.155 IAM API tests pass with four existing opt-in isolated-database skips. Three further HTTP tests verify the real DELETE route, UUID validation, If-Match forwarding and operation guard.76 Web/access/localization tests and scoped lint pass. API typecheck passes after regeneration of the stale ignored Prisma client, without applying any migration. Section tests cover every registered screen/control, all operations, idempotence, removal and preservation of nondelegable/unrelated controls. Normal full CI quality, tests, production builds and PostgreSQL gates are required on the final commit before merge. No authenticated browser or deployment claim.
