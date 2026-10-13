ALTER TYPE "DocumentAccessPurpose" ADD VALUE 'CONFIDENTIAL_VIEW';

ALTER TABLE "documents"
  ADD COLUMN "confidential_access_code_hash" VARCHAR(128),
  ADD COLUMN "confidential_access_code_salt" VARCHAR(64),
  ADD COLUMN "confidential_access_failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "confidential_access_locked_until" TIMESTAMPTZ(3);
