-- Additive reference metadata. Existing identities/contact data are not rewritten.
ALTER TABLE "master_organizations" ADD COLUMN "personType" VARCHAR(16);
ALTER TABLE "master_organizations" ADD CONSTRAINT "master_organizations_person_type_check"
  CHECK ("personType" IS NULL OR "personType" IN ('NATURAL', 'LEGAL'));

ALTER TABLE "master_suppliers" ADD COLUMN "englishName" VARCHAR(160), ADD COLUMN "primaryContactId" UUID;
ALTER TABLE "master_brokers" ADD COLUMN "englishName" VARCHAR(160), ADD COLUMN "primaryContactId" UUID;

CREATE UNIQUE INDEX "master_organization_contacts_id_organizationId_key" ON "master_organization_contacts" ("id", "organizationId");
CREATE INDEX "master_suppliers_primaryContactId_organizationId_idx" ON "master_suppliers" ("primaryContactId", "organizationId");
CREATE INDEX "master_brokers_primaryContactId_organizationId_idx" ON "master_brokers" ("primaryContactId", "organizationId");

ALTER TABLE "master_suppliers" ADD CONSTRAINT "master_suppliers_primaryContactId_organizationId_fkey"
  FOREIGN KEY ("primaryContactId", "organizationId") REFERENCES "master_organization_contacts" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "master_brokers" ADD CONSTRAINT "master_brokers_primaryContactId_organizationId_fkey"
  FOREIGN KEY ("primaryContactId", "organizationId") REFERENCES "master_organization_contacts" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT;
