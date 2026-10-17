BEGIN;
-- Existing roles and profile rows remain unchanged. Supplier/broker credit is
-- received by our company, and is isolated by the existing composite role key.
ALTER TABLE "b2b_agency_profiles" DROP CONSTRAINT "b2b_cooperation_role_check";
ALTER TABLE "b2b_agency_profiles" ADD CONSTRAINT "b2b_cooperation_role_check"
  CHECK ("role" IN ('AGENCY','CORPORATE_CUSTOMER','SUPPLIER','BROKER'));

-- Optional true counterparty reference for new Finance requests. No historical
-- free-text party is matched or backfilled by name.
ALTER TABLE "finance_operational_requests"
  ADD COLUMN "counterpartyOrganizationId" UUID,
  ADD COLUMN "counterpartyRole" "MasterOrganizationRoleCode",
  ADD CONSTRAINT "finance_partner_request_organization_fk" FOREIGN KEY ("counterpartyOrganizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "finance_partner_request_pair" CHECK (
    ("counterpartyOrganizationId" IS NULL AND "counterpartyRole" IS NULL)
    OR ("counterpartyOrganizationId" IS NOT NULL AND "counterpartyRole" IS NOT NULL AND "counterpartyRole" IN ('SUPPLIER','BROKER'))
  );
CREATE INDEX "finance_partner_request_lookup" ON "finance_operational_requests"("counterpartyOrganizationId", "counterpartyRole", "branchId", "dueAt");
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_partner_request_role_fk"
  FOREIGN KEY ("counterpartyOrganizationId", "counterpartyRole") REFERENCES "master_organization_roles"("organizationId", "roleCode") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
