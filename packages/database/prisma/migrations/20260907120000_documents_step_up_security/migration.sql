-- Additive IAM TOTP state. Secrets are application-encrypted before persistence.
ALTER TABLE "iam_users"
ADD COLUMN "mfa_totp_secret_ciphertext" VARCHAR(800),
ADD COLUMN "mfa_totp_pending_secret_ciphertext" VARCHAR(800),
ADD COLUMN "mfa_totp_pending_expires_at" TIMESTAMPTZ(3),
ADD COLUMN "mfa_totp_enabled_at" TIMESTAMPTZ(3),
ADD COLUMN "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mfa_locked_until" TIMESTAMPTZ(3),
ADD COLUMN "mfa_last_used_step" BIGINT;

-- Existing documents remain backward-compatible and do not require step-up.
ALTER TABLE "documents"
ADD COLUMN "requires_step_up_verification" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "DocumentAccessPurpose" AS ENUM ('PREVIEW', 'DOWNLOAD');

CREATE TABLE "document_access_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token_hash" CHAR(64) NOT NULL,
  "document_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "actor_session_id" UUID NOT NULL,
  "purpose" "DocumentAccessPurpose" NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_access_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_access_grants_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_access_grants_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_access_grants_actor_session_id_fkey"
    FOREIGN KEY ("actor_session_id") REFERENCES "iam_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "document_access_grants_token_hash_key"
ON "document_access_grants"("token_hash");

CREATE INDEX "document_access_grants_document_id_actor_user_id_purpose_expires_at_idx"
ON "document_access_grants"("document_id", "actor_user_id", "purpose", "expires_at");

CREATE INDEX "document_access_grants_actor_user_id_idx"
ON "document_access_grants"("actor_user_id");

CREATE INDEX "document_access_grants_actor_session_id_idx"
ON "document_access_grants"("actor_session_id");

CREATE INDEX "document_access_grants_expires_at_consumed_at_idx"
ON "document_access_grants"("expires_at", "consumed_at");
