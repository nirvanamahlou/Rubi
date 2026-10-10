-- Existing CONFIDENTIAL_VIEW grants must be removed before reverting the enum.
DELETE FROM "document_access_grants"
WHERE "purpose"::text = 'CONFIDENTIAL_VIEW';

ALTER TABLE "documents"
  DROP COLUMN "confidential_access_code_hash",
  DROP COLUMN "confidential_access_code_salt",
  DROP COLUMN "confidential_access_failed_attempts",
  DROP COLUMN "confidential_access_locked_until";

ALTER TYPE "DocumentAccessPurpose" RENAME TO "DocumentAccessPurpose_with_confidential_view";
CREATE TYPE "DocumentAccessPurpose" AS ENUM ('PREVIEW', 'DOWNLOAD');
ALTER TABLE "document_access_grants"
  ALTER COLUMN "purpose" TYPE "DocumentAccessPurpose"
  USING "purpose"::text::"DocumentAccessPurpose";
DROP TYPE "DocumentAccessPurpose_with_confidential_view";
