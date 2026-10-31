-- Preserve existing organization links, foreign keys and uniqueness.
ALTER TABLE "master_rail_companies" ALTER COLUMN "organizationId" DROP NOT NULL;
-- Bank-account removal preserves audit history and historical references.
ALTER TABLE "FinanceSettlementAccount" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
