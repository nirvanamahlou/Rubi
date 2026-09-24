DROP TABLE IF EXISTS "document_access_grants";
DROP TYPE IF EXISTS "DocumentAccessPurpose";

ALTER TABLE "documents"
DROP COLUMN IF EXISTS "requires_step_up_verification";

ALTER TABLE "iam_users"
DROP COLUMN IF EXISTS "mfa_totp_secret_ciphertext",
DROP COLUMN IF EXISTS "mfa_totp_pending_secret_ciphertext",
DROP COLUMN IF EXISTS "mfa_totp_pending_expires_at",
DROP COLUMN IF EXISTS "mfa_totp_enabled_at",
DROP COLUMN IF EXISTS "mfa_failed_attempts",
DROP COLUMN IF EXISTS "mfa_locked_until",
DROP COLUMN IF EXISTS "mfa_last_used_step";
