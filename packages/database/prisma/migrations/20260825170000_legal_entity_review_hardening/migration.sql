-- Review hardening is additive: bind every issued document to the exact
-- immutable branding row and persist trusted template-policy provenance.
ALTER TABLE "legal_entity_branding_versions"
ADD CONSTRAINT "legal_entity_branding_versions_id_entity_version_key"
UNIQUE ("id", "legalEntityId", "version");

ALTER TABLE "legal_entity_document_issues"
ADD COLUMN "brandingSnapshotId" UUID,
ADD COLUMN "templateId" VARCHAR(120),
ADD COLUMN "templatePolicyId" VARCHAR(120),
ADD COLUMN "templatePolicyVersion" VARCHAR(80);

-- Controlled compatibility backfill for rows created by the preceding draft
-- migration. The snapshot relation must resolve before NOT NULL/FK are applied.
UPDATE "legal_entity_document_issues" AS issue
SET "brandingSnapshotId" = branding."id",
    "templateId" = CONCAT('legacy:', issue."documentType"),
    "templatePolicyId" = 'legacy-unverified',
    "templatePolicyVersion" = '0'
FROM "legal_entity_branding_versions" AS branding
WHERE branding."legalEntityId" = issue."issuerLegalEntityId"
  AND branding."version" = issue."brandingSnapshotVersion"
  AND issue."brandingSnapshotId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "legal_entity_document_issues"
    WHERE "brandingSnapshotId" IS NULL
       OR "templateId" IS NULL
       OR "templatePolicyId" IS NULL
       OR "templatePolicyVersion" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot bind legacy document issue to an exact branding snapshot';
  END IF;
END $$;

ALTER TABLE "legal_entity_document_issues"
ALTER COLUMN "brandingSnapshotId" SET NOT NULL,
ALTER COLUMN "templateId" SET NOT NULL,
ALTER COLUMN "templatePolicyId" SET NOT NULL,
ALTER COLUMN "templatePolicyVersion" SET NOT NULL;

ALTER TABLE "legal_entity_document_issues"
ADD CONSTRAINT "legal_entity_document_issues_branding_snapshot_fkey"
FOREIGN KEY ("brandingSnapshotId", "issuerLegalEntityId", "brandingSnapshotVersion")
REFERENCES "legal_entity_branding_versions"("id", "legalEntityId", "version")
ON DELETE RESTRICT ON UPDATE RESTRICT;
-- Branding versions are append-only snapshots. Rewriting or deleting any
-- version would make historical output metadata non-reproducible.
CREATE FUNCTION "prevent_legal_entity_branding_version_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Legal entity branding versions are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "legal_entity_branding_versions_immutable"
BEFORE UPDATE OR DELETE ON "legal_entity_branding_versions"
FOR EACH ROW
EXECUTE FUNCTION "prevent_legal_entity_branding_version_mutation"();
