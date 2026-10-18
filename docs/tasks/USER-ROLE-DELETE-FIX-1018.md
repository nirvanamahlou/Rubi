# IAM deletion feedback and existing-role management

COMPUTER_ID=PC-B; direct execution without Worker Orchestrator or new agents. Branch codex/pc-b-user-role-delete-fix-1018 from develop 1e27e225. Owner authorizes implementation, push and develop merge after final-head CI.

## User deletion

Owner clarified that pressing Delete produces no error but the user remains. Previous UI depended on window.confirm and silently returned before any request if the native dialog returned false, including when a host suppresses native dialogs. Replace that dependency with the existing controlled in-application Dialog primitives. Opening or cancelling the dialog never sends a deletion request. Explicit confirmation alone performs the operation, with duplicate-submit protection, busy state and errors visible beside the action.

After the revision-protected DELETE returns success, fetch the authoritative user list and verify that the target is absent before reporting success or replacing local rows. Reject false acknowledgments, unchanged lists and read/command failures. Do not hide a user optimistically. Existing server user-deletion guards remain unchanged: current account, last manager, dependencies and audit/business history are protected. No actual user's account or history was deleted during implementation.

## Existing roles

The new-role page lists saved role templates and ordinary shared/system definitions, including inactive definitions, ordered by name/ID. Exclude exclusive per-user snapshot roles from this reusable-role directory. Show role kind and assignment count, refresh the directory/templates together and permit loading an active template's existing ticks for editing without automatically changing accounts.

Add compatible GET /iam/access-options/roles and DELETE /iam/access-options/roles/:id. Both retain native users.manage and manual section guards; the service further checks canonical administration. Permanent deletion requires a matching opaque revision, a live ACTIVE administrator with users.manage, administrator-membership and actor/role row locks, non-system/non-private role and zero user memberships (including inactive users). Role and RolePermission links are removed atomically with an audit event; global Permission entries and user accounts/grants are untouched. Never force-delete an assigned role. Existing per-user snapshots remain independent of deleted unassigned templates.

Role deletion also verifies absence in the fresh server directory before showing success, then removes that definition from selectable templates. Confirmation is in-app; blocked roles show their system/assigned status. No schema, migration, dependency, real-data mutation or runtime rollout.

## Validation

IAM API171 tests pass with four pre-existing isolated-database skips; Web/access/localization86 pass. Coverage includes real Nest HTTP routes, native guards and UUID/revision forwarding, fresh authority, reserved/system/private/assigned protection, transactional audit, fingerprint changes, explicit confirmation wiring, duplicate-write disabled state, error rendering and authoritative post-delete verification. Scoped Web/API lint passed. Refresh stale ignored Prisma/contracts build artifacts before type checks; no DB connection or migration is used. All final-head hosted CI quality/test/build/PostgreSQL gates must succeed before merge. No authenticated real-account deletion or browser/runtime deployment claimed.
