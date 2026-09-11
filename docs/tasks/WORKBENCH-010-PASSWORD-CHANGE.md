# WORKBENCH-010 — Password change in account settings

PC-B, branch codex/pc-b-workbench-password-change, base2794b60. User requests changing the password inside Workbench. Reserve Workbench UI and own reports only until owner handoff.

The existing IAM auth controller/service has login, refresh, logout, MFA and sessions but no password change endpoint; Profile is read-only. Runtime coordinator checked IAM remote refs and cannot transfer PC-A module ownership. Project-owner authorization for a bounded IAM slice has been requested, not authorization to alter any real account password.

UI: native Rubi dialog in Account Settings, with current/new/confirmation password fields and the existing IAM password policy. While the service is unavailable all credential inputs and submit are disabled and an explicit message explains this. No fake success, credential collection, network request, browser storage, migration or dependency change.

Proposed additive contract (pending producer-owner agreement): IAM owns POST /api/v1/iam/auth/change-password; Workbench consumes currentPassword/newPassword in an authenticated JSON body. Target identity derives exclusively from the session, never a caller-supplied user ID. Validate current password, existing password policy and different new password; use existing Argon2 configuration, bounded failure attempts, transactionally replace hash and revoke all sessions with a secret-free audit event. Clear cookies only after success and require a fresh login. Consider refresh/login concurrency explicitly so no old-credential session survives completion. Existing endpoints remain backward-compatible. No schema change is planned; any schema need requires separate migration-owner handoff.

Required validation before activation: wrong current password, weak/same new password, unauthenticated/disabled user, concurrent updates, session revocation and refresh races, failure rollback, audit redaction, UI confirmation mismatch/error/loading/success and cleared sensitive inputs. Only synthetic fixture accounts in isolated tests; browser QA never changes the actual operator password.
