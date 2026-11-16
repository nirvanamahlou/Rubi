-- Existing publications keep their original scope; floating packages opt in per period.
ALTER TABLE "website_publications" ADD COLUMN "periodKey" VARCHAR(100) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "website_publications_site_branch_resource_period_key"
ON "website_publications" ("siteCode", "branchId", "kind", "resourceId", "periodKey");
DROP INDEX "website_publications_siteCode_branchId_kind_resourceId_key";
