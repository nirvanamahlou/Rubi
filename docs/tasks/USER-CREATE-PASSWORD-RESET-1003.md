# USER-CREATE-PASSWORD-RESET-1003

COMPUTER_ID=PC-A. Base: origin/develop@25547d5e. The owner requests fixing the disabled user creation control and allowing system administrators to reset other users' passwords, followed by a reviewed develop merge.

The optional role proposal no longer blocks Save. Saving explicitly persists the current permission/screen selections; applying the proposal remains a separate action. The form explains this distinction. Initial credentials are checked locally and weak-password errors are returned as HTTP validation errors instead of unhandled server errors. Username pattern escaping remains compatible with current browser validation.

The additive `PATCH /api/v1/iam/users/:id/password` accepts only `newPassword`, requires authentication, `iam.users.manage`, and `X-Nora-Password-Change: 1`. Canonical active `administrator` membership and the actor's live session are rechecked inside the transaction. A job title alone never authorizes reset. Resetting one's own credential uses the existing self-service flow.

Credentials are Argon2id hashes. Locks follow stable user ordering before session mutations, consistent with login/refresh/change-password. Password update, UTC change time, failed-attempt reset, revocation of target ACTIVE/ROTATED sessions, and secret-free actor/target audit commit atomically. Other users and the administrator session remain unchanged. No migration, new permission seed, dependency or actual user/password change is required.

Producer: PC-A IAM; consumer: PC-A Web user management. Older clients retain existing user/access/status endpoints. Existing self-password change is unchanged. The Web password form has confirmation, policy feedback, double-submit protection and clears credentials after success.

Validation: targeted IAM and HTTP tests, Web password/form/proposal tests, lint, typecheck and affected production builds. Isolated PostgreSQL coverage verifies old access/refresh/login rejection and atomic rollback on audit failure; operational databases are excluded by existing randomized-database/local-target guards.

Validation completed: 84 IAM/HTTP, 34 Web and 9 isolated PostgreSQL tests passed; both typechecks, scoped lint and API/Web production builds passed. Implementation commit `a0a1afd4`; PR #586 targets develop. Isolated test container and anonymous test volume were removed after successful cleanup. No operational data was touched.
